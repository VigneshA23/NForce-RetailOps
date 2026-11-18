package com.nforce.retailops.service;

import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.exception.DailyCashEntryNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// An Owner/Admin flagging an entry in their own store. The entry is looked up
// within the store the request is scoped to, so an entry id from another
// store is a 404, never a leak. All rules live in CashFlagService.
@Service
public class OwnerCashFlagService {

    private final DailyCashEntryRepository entryRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final UserRepository userRepository;
    private final CashFlagService flagService;
    private final DailyCashEntryService entryService;

    public OwnerCashFlagService(
        DailyCashEntryRepository entryRepository,
        StoreOwnerRepository storeOwnerRepository,
        UserRepository userRepository,
        CashFlagService flagService,
        DailyCashEntryService entryService
    ) {
        this.entryRepository = entryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.userRepository = userRepository;
        this.flagService = flagService;
        this.entryService = entryService;
    }

    @Transactional
    public DailyCashEntryResponse raise(Long ownerId, Long entryId, String comment) {
        DailyCashEntry entry = requireOwnEntry(ownerId, entryId);
        flagService.raise(entry, actor(ownerId), comment);
        return entryService.get(ownerId, entry.getBusinessDate());
    }

    @Transactional
    public DailyCashEntryResponse editComment(Long ownerId, Long entryId, String comment) {
        DailyCashEntry entry = requireOwnEntry(ownerId, entryId);
        flagService.editComment(entry, actor(ownerId), comment);
        return entryService.get(ownerId, entry.getBusinessDate());
    }

    @Transactional
    public DailyCashEntryResponse remove(Long ownerId, Long entryId) {
        DailyCashEntry entry = requireOwnEntry(ownerId, entryId);
        flagService.remove(entry, actor(ownerId));
        return entryService.get(ownerId, entry.getBusinessDate());
    }

    private CashActor actor(Long ownerId) {
        return CashActor.of(userRepository.getReferenceById(ownerId));
    }

    private DailyCashEntry requireOwnEntry(Long ownerId, Long entryId) {
        StoreOwner link = OwnerStoreScope.requireLink(storeOwnerRepository, ownerId);
        DailyCashEntry entry = entryRepository.findById(entryId)
            .orElseThrow(() -> new DailyCashEntryNotFoundException("Cash entry not found"));
        if (!entry.getStore().getId().equals(link.getStore().getId())) {
            throw new DailyCashEntryNotFoundException("Cash entry not found");
        }
        return entry;
    }
}
