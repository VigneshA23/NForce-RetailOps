package com.nforce.retailops.service;

import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.exception.StoreScopeInvalidException;
import com.nforce.retailops.repository.StoreOwnerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Bean face of {@link OwnerStoreScope} for the store picker endpoint and the
 * per-request check in StoreScopeInterceptor. The rule itself lives in
 * OwnerStoreScope so the owner services can share it without new constructor
 * dependencies.
 */
@Service
public class OwnerStoreAccessService {

    private final StoreOwnerRepository storeOwnerRepository;

    public OwnerStoreAccessService(StoreOwnerRepository storeOwnerRepository) {
        this.storeOwnerRepository = storeOwnerRepository;
    }

    /** Every store the admin is actively linked to, ordered for the store picker. */
    @Transactional(readOnly = true)
    public List<StoreOwner> activeLinks(Long ownerId) {
        return storeOwnerRepository.findActiveWithStoreByOwnerId(ownerId);
    }

    /**
     * A header naming a store the admin is no longer actively linked to is
     * refused up front (404), even on endpoints that are not themselves
     * store-scoped. No header: nothing to check here.
     */
    @Transactional(readOnly = true)
    public void validateSelectedStore(Long ownerId) {
        OwnerStoreScope.selectedStoreId().ifPresent(storeId -> {
            if (storeOwnerRepository.findByStoreIdAndOwnerIdAndActiveTrue(storeId, ownerId).isEmpty()) {
                throw new StoreScopeInvalidException();
            }
        });
    }
}
