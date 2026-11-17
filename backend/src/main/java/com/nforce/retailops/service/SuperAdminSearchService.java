package com.nforce.retailops.service;

import com.nforce.retailops.dto.SASearchItem;
import com.nforce.retailops.dto.SASearchResponse;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SuperAdminSearchService {

    private static final int MAX_RESULTS = 5;

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;

    public SuperAdminSearchService(
        UserRepository userRepository,
        StoreRepository storeRepository,
        StoreEmployeeRepository storeEmployeeRepository
    ) {
        this.userRepository = userRepository;
        this.storeRepository = storeRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
    }

    @Transactional(readOnly = true)
    public SASearchResponse search(String q) {
        if (q == null || q.isBlank()) {
            return new SASearchResponse(List.of(), List.of(), List.of());
        }
        var top5 = PageRequest.of(0, MAX_RESULTS);
        String trimmed = q.trim();

        // Admin codes are `ADM` + zero-padded user id, so accept either
        // `ADM007`, `ADM7`, `007`, or `7` and compare against the raw id.
        Long codeId = parseAdminCodeQuery(trimmed);
        List<SASearchItem> owners = userRepository.searchOwnersByNameEmailOrAdminCode(trimmed, codeId, top5).stream()
            .map(u -> new SASearchItem(u.getId(), u.getFullName(), u.getEmail(), "owners:" + u.getId()))
            .toList();

        // Strip a leading '#' so "#101" and "101" both find store 101; the
        // name/location branches don't care either way.
        String codeQuery = trimmed.startsWith("#") ? trimmed.substring(1) : trimmed;
        List<SASearchItem> stores = storeRepository.searchByNameLocationOrCode(trimmed, codeQuery, top5).stream()
            .map(s -> new SASearchItem(
                s.getId(),
                s.getName(),
                s.getLocation() != null && !s.getLocation().isBlank() ? s.getLocation() : "#" + s.getStoreCode(),
                "checklist:" + s.getId()
            ))
            .toList();

        List<SASearchItem> employees = storeEmployeeRepository.searchByNameOrEmail(trimmed, top5).stream()
            .map(se -> new SASearchItem(
                se.getId(),
                se.getEmployee().getFullName(),
                se.getEmployee().getEmail(),
                "employees:" + se.getId()
            ))
            .toList();

        return new SASearchResponse(owners, stores, employees);
    }

    // Returns the numeric id to look up when the query looks like an admin
    // code (`ADM007`, `adm7`, `007`, `7`), stripping an optional `ADM`
    // prefix and leading zeros; returns null for anything else so the
    // name/email branches of the query still apply alone.
    static Long parseAdminCodeQuery(String query) {
        if (query == null) return null;
        String candidate = query.trim();
        if (candidate.length() > 2 && candidate.substring(0, 3).equalsIgnoreCase("ADM")) {
            candidate = candidate.substring(3);
        }
        if (candidate.isEmpty() || !candidate.chars().allMatch(Character::isDigit)) return null;
        try {
            return Long.parseLong(candidate);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
