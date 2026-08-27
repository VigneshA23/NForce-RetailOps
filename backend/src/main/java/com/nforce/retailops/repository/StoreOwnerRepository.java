package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreOwner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StoreOwnerRepository extends JpaRepository<StoreOwner, Long> {

    List<StoreOwner> findByOwnerId(Long ownerId);

    Optional<StoreOwner> findByStoreIdAndOwnerId(Long storeId, Long ownerId);

    void deleteByStoreId(Long storeId);
}
