package com.nforce.retailops.service;

import com.nforce.retailops.entity.InventoryItemImage;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.exception.InventoryItemImageNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.security.SuperAdminUserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Who may read an inventory image's bytes. Unsplash stock photos are not
// sensitive and stay readable by any signed-in user. An owner-uploaded photo
// is arbitrary content and belongs to exactly one store's item, so only that
// store's active Owner/Admin, its assigned employees and Super Admin may read
// it. Everyone else gets the same 404 as a missing id, so ids can't be probed.
@Service
public class InventoryImageAccessService {

    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;

    public InventoryImageAccessService(
        StoreInventoryItemRepository storeInventoryItemRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository
    ) {
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
    }

    // Throws InventoryItemImageNotFoundException (404) when the caller may not read the image.
    @Transactional(readOnly = true)
    public void requireReadable(Object principal, InventoryItemImage image) {
        if (image.getUnsplashPhotoId() != null) {
            return;
        }
        if (principal instanceof SuperAdminUserDetails) {
            return;
        }
        if (principal instanceof AppUserDetails appUser) {
            Long storeId = storeInventoryItemRepository.findByImageId(image.getId())
                .map(StoreInventoryItem::getStore)
                .map(store -> store.getId())
                .orElse(null);
            Long userId = appUser.getUser().getId();
            if (storeId != null
                && (storeOwnerRepository.findByStoreIdAndOwnerIdAndActiveTrue(storeId, userId).isPresent()
                    || storeEmployeeRepository.existsByEmployeeIdAndStoresId(userId, storeId))) {
                return;
            }
        }
        throw new InventoryItemImageNotFoundException("Image not found");
    }
}
