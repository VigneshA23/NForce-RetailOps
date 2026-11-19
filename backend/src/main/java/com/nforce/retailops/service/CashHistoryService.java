package com.nforce.retailops.service;

import com.nforce.retailops.dto.CashHistoryResponse;
import com.nforce.retailops.dto.CashHistoryResponse.Event;
import com.nforce.retailops.dto.CashHistoryResponse.Figures;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.DailyCashEntryCorrection;
import com.nforce.retailops.entity.DailyCashEntryFlag;
import com.nforce.retailops.entity.DailyCashEntryFlagHistory;
import com.nforce.retailops.exception.InvalidDateRangeException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryCorrectionRepository;
import com.nforce.retailops.repository.DailyCashEntryFlagHistoryRepository;
import com.nforce.retailops.repository.DailyCashEntryFlagRepository;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

// Cash entry history: who created, edited, corrected, flagged, resolved or
// unflagged each entry, with old and new figures and the comment or reason.
// Read-only by construction -- there is no write path.
//
// Owner/Admin sees their own store (OwnerStoreScope; another store is a 404),
// Super Admin picks a store, an employee sees only entries they entered.
@Service
public class CashHistoryService {

    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_RESOLVED = "RESOLVED";
    private static final int MAX_RANGE_DAYS = 366;
    private static final int DEFAULT_RANGE_DAYS = 30;

    private final DailyCashEntryRepository entryRepository;
    private final DailyCashEntryCorrectionRepository correctionRepository;
    private final DailyCashEntryFlagRepository flagRepository;
    private final DailyCashEntryFlagHistoryRepository flagHistoryRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final StoreRepository storeRepository;

    public CashHistoryService(
        DailyCashEntryRepository entryRepository,
        DailyCashEntryCorrectionRepository correctionRepository,
        DailyCashEntryFlagRepository flagRepository,
        DailyCashEntryFlagHistoryRepository flagHistoryRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        StoreRepository storeRepository
    ) {
        this.entryRepository = entryRepository;
        this.correctionRepository = correctionRepository;
        this.flagRepository = flagRepository;
        this.flagHistoryRepository = flagHistoryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.storeRepository = storeRepository;
    }

    @Transactional(readOnly = true)
    public CashHistoryResponse forOwner(Long ownerId, LocalDate from, LocalDate to, String status) {
        Long storeId = OwnerStoreScope.requireStoreId(storeOwnerRepository, ownerId);
        return build(storeId, from, to, status, null);
    }

    @Transactional(readOnly = true)
    public CashHistoryResponse forSuperAdmin(Long storeId, LocalDate from, LocalDate to, String status) {
        if (!storeRepository.existsById(storeId)) {
            throw new StoreNotFoundException("Store not found");
        }
        return build(storeId, from, to, status, null);
    }

    // Employees see the history of entries they entered themselves, in a
    // store they work at (anything else is a 404).
    @Transactional(readOnly = true)
    public CashHistoryResponse forEmployee(Long employeeId, Long storeId, LocalDate from, LocalDate to, String status) {
        if (!storeEmployeeRepository.existsByEmployeeIdAndActiveStoreId(employeeId, storeId)) {
            throw new StoreNotFoundException("Store not found");
        }
        return build(storeId, from, to, status, employeeId);
    }

    private CashHistoryResponse build(Long storeId, LocalDate from, LocalDate to, String status, Long onlyEnteredBy) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusDays(DEFAULT_RANGE_DAYS - 1L);
        if (end.isBefore(start)) {
            throw new InvalidDateRangeException("'to' date cannot be before 'from' date");
        }
        if (start.plusDays(MAX_RANGE_DAYS).isBefore(end)) {
            throw new InvalidDateRangeException("Choose a range of at most a year");
        }
        String filter = status == null ? "" : status.trim().toUpperCase();
        if (!filter.isEmpty() && !filter.equals("ALL") && !filter.equals(STATUS_OPEN) && !filter.equals(STATUS_RESOLVED)) {
            throw new InvalidDateRangeException("Status must be OPEN or RESOLVED");
        }

        List<DailyCashEntry> entries = entryRepository
            .findByStoreIdAndBusinessDateBetweenOrderByBusinessDateDescIdDesc(storeId, start, end).stream()
            .filter(e -> onlyEnteredBy == null
                || (e.getEnteredByUser() != null && e.getEnteredByUser().getId().equals(onlyEnteredBy)))
            .toList();
        if (entries.isEmpty()) {
            return new CashHistoryResponse(storeId, start, end, List.of());
        }
        List<Long> ids = entries.stream().map(DailyCashEntry::getId).toList();

        Map<Long, List<DailyCashEntryCorrection>> corrections = correctionRepository
            .findByEntryIdInOrderByCorrectedAtAscIdAsc(ids).stream()
            .collect(Collectors.groupingBy(c -> c.getEntry().getId()));
        List<DailyCashEntryFlag> flags = flagRepository.findByEntryIdInOrderByFlaggedAtAscIdAsc(ids);
        Map<Long, List<DailyCashEntryFlagHistory>> flagEvents = flagHistoryRepository
            .findByEntryIdInOrderByRecordedAtAscIdAsc(ids).stream()
            .collect(Collectors.groupingBy(h -> h.getEntry().getId()));

        Set<Long> withOpenFlag = flags.stream().filter(DailyCashEntryFlag::isOpen)
            .map(f -> f.getEntry().getId()).collect(Collectors.toSet());
        Set<Long> withResolvedFlag = flags.stream().filter(f -> !f.isOpen())
            .map(f -> f.getEntry().getId()).collect(Collectors.toSet());

        List<Event> events = new ArrayList<>();
        for (DailyCashEntry entry : entries) {
            if (filter.equals(STATUS_OPEN) && !withOpenFlag.contains(entry.getId())) continue;
            if (filter.equals(STATUS_RESOLVED) && !withResolvedFlag.contains(entry.getId())) continue;
            addEntryEvents(events, entry, corrections.getOrDefault(entry.getId(), List.of()),
                flagEvents.getOrDefault(entry.getId(), List.of()));
        }
        // Newest first; the sort is stable so same-instant events keep the
        // order they were recorded in.
        events.sort(Comparator.comparing(Event::at).reversed());
        return new CashHistoryResponse(storeId, start, end, events);
    }

    private void addEntryEvents(
        List<Event> out, DailyCashEntry entry,
        List<DailyCashEntryCorrection> corrections, List<DailyCashEntryFlagHistory> flagEvents
    ) {
        // The figures the entry was created with: the first correction's
        // "previous" values if it was ever corrected, else what it holds now.
        Figures created = corrections.isEmpty() ? figuresOf(entry) : previousOf(corrections.get(0));
        out.add(new Event(
            entry.getId(), entry.getBusinessDate(), "CREATED",
            actorName(entry.getEnteredByUser(), entry.getEnteredBySuperAdmin()),
            actorRole(entry.getEnteredByUser(), entry.getEnteredBySuperAdmin()),
            entry.getEnteredAt(), null, created, null));

        for (int i = 0; i < corrections.size(); i++) {
            DailyCashEntryCorrection c = corrections.get(i);
            Figures after = c.getNewCashRemaining() != null
                ? new Figures(c.getNewOpeningDrawerCash(), c.getNewCashRemoved(),
                    c.getNewCashRemaining(), c.getNewOtherAdjustments())
                : i + 1 < corrections.size() ? previousOf(corrections.get(i + 1)) : figuresOf(entry);
            String role = actorRole(c.getCorrectedByUser(), c.getCorrectedBySuperAdmin());
            out.add(new Event(
                entry.getId(), entry.getBusinessDate(),
                "EMPLOYEE".equals(role) ? "EMPLOYEE_EDIT" : "ADMIN_CORRECTION",
                actorName(c.getCorrectedByUser(), c.getCorrectedBySuperAdmin()), role,
                c.getCorrectedAt(), previousOf(c), after, c.getReason()));
        }

        for (DailyCashEntryFlagHistory h : flagEvents) {
            String type = switch (h.getAction()) {
                case RAISED -> "FLAGGED";
                case COMMENT_EDITED -> "FLAG_EDITED";
                case RESOLVED -> "FLAG_RESOLVED";
                case REMOVED -> "FLAG_REMOVED";
            };
            // RAISED / COMMENT_EDITED carry the (new) comment; a resolution
            // carries the employee's note if any, else the flag's comment.
            String comment = h.getNewComment() != null ? h.getNewComment() : h.getPreviousComment();
            out.add(new Event(
                entry.getId(), entry.getBusinessDate(), type,
                actorName(h.getActorUser(), h.getActorSuperAdmin()),
                actorRole(h.getActorUser(), h.getActorSuperAdmin()),
                h.getRecordedAt(), null, null, comment));
        }
    }

    private static Figures figuresOf(DailyCashEntry e) {
        return new Figures(e.getOpeningDrawerCash(), e.getCashRemoved(),
            e.getCashRemaining(), e.getOtherAdjustments());
    }

    private static Figures previousOf(DailyCashEntryCorrection c) {
        return new Figures(c.getPreviousOpeningDrawerCash(),
            c.getPreviousCashRemoved(), c.getPreviousCashRemaining(), c.getPreviousOtherAdjustments());
    }

    private static String actorName(com.nforce.retailops.entity.User user, com.nforce.retailops.entity.SuperAdmin sa) {
        if (user != null) return user.getFullName();
        return sa == null ? null : sa.getName();
    }

    private static String actorRole(com.nforce.retailops.entity.User user, com.nforce.retailops.entity.SuperAdmin sa) {
        return DailyCashEntryService.roleOf(user, sa);
    }
}
