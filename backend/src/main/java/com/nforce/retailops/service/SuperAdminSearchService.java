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

        List<SASearchItem> owners = userRepository.searchOwnersByNameOrEmail(trimmed, top5).stream()
            .map(u -> new SASearchItem(u.getId(), u.getFullName(), u.getEmail(), "owners"))
            .toList();

        List<SASearchItem> stores = storeRepository.searchByNameOrLocation(trimmed, top5).stream()
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
                "employees"
            ))
            .toList();

        return new SASearchResponse(owners, stores, employees);
    }
}
