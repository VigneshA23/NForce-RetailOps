package com.nforce.retailops.service;

import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.StoreOwnerRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class StoreAccessService {

    private final StoreOwnerRepository storeOwnerRepository;

    public StoreAccessService(StoreOwnerRepository storeOwnerRepository) {
        this.storeOwnerRepository = storeOwnerRepository;
    }

    @Transactional(readOnly = true)
    public List<Store> getOwnedStores(User admin) {
        return storeOwnerRepository.findByOwner_Id(admin.getId()).stream()
            .map(storeOwner -> storeOwner.getStore())
            .toList();
    }

    @Transactional(readOnly = true)
    public List<Long> getOwnedStoreIds(User admin) {
        return getOwnedStores(admin).stream().map(Store::getId).toList();
    }

    @Transactional(readOnly = true)
    public Store requireOwnedStore(User admin, Long storeId) {
        return getOwnedStores(admin).stream()
            .filter(store -> store.getId().equals(storeId))
            .findFirst()
            .orElseThrow(() -> new AccessDeniedException("Store does not belong to you"));
    }
}
