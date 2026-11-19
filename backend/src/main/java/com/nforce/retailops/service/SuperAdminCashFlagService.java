package com.nforce.retailops.service;

import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.exception.DailyCashEntryNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// A Super Admin flagging an entry from the Daily Cash page. The entry must
// belong to the store named in the path, so an entry id from another store is
// a 404. All rules (note length, one open flag, who gets notified) live in
// CashFlagService, shared with Owner/Admin.
@Service
public class SuperAdminCashFlagService {

    private final DailyCashEntryRepository entryRepository;
    private final SuperAdminRepository superAdminRepository;
    private final CashFlagService flagService;
    private final DailyCashEntryService entryService;

    public SuperAdminCashFlagService(
        DailyCashEntryRepository entryRepository,
        SuperAdminRepository superAdminRepository,
        CashFlagService flagService,
        DailyCashEntryService entryService
    ) {
        this.entryRepository = entryRepository;
        this.superAdminRepository = superAdminRepository;
        this.flagService = flagService;
        this.entryService = entryService;
    }

    @Transactional
    public DailyCashEntryResponse raise(Long superAdminId, Long storeId, Long entryId, String comment) {
        DailyCashEntry entry = requireEntry(storeId, entryId);
        flagService.raise(entry, actor(superAdminId), comment);
        return entryService.getForSuperAdmin(storeId, entry.getBusinessDate());
    }

    @Transactional
    public DailyCashEntryResponse editComment(Long superAdminId, Long storeId, Long entryId, String comment) {
        DailyCashEntry entry = requireEntry(storeId, entryId);
        flagService.editComment(entry, actor(superAdminId), comment);
        return entryService.getForSuperAdmin(storeId, entry.getBusinessDate());
    }

    @Transactional
    public DailyCashEntryResponse remove(Long superAdminId, Long storeId, Long entryId) {
        DailyCashEntry entry = requireEntry(storeId, entryId);
        flagService.remove(entry, actor(superAdminId));
        return entryService.getForSuperAdmin(storeId, entry.getBusinessDate());
    }

    private CashActor actor(Long superAdminId) {
        return CashActor.of(superAdminRepository.getReferenceById(superAdminId));
    }

    private DailyCashEntry requireEntry(Long storeId, Long entryId) {
        DailyCashEntry entry = entryRepository.findById(entryId)
            .orElseThrow(() -> new DailyCashEntryNotFoundException("Cash entry not found"));
        if (!entry.getStore().getId().equals(storeId)) {
            throw new DailyCashEntryNotFoundException("Cash entry not found");
        }
        return entry;
    }
}
