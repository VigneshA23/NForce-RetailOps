package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreOwner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StoreOwnerRepository extends JpaRepository<StoreOwner, Long> {

    List<StoreOwner> findByOwnerId(Long ownerId);

    List<StoreOwner> findByOwnerIdAndStoreIdIn(Long ownerId, List<Long> storeIds);

    Optional<StoreOwner> findByStoreIdAndOwnerId(Long storeId, Long ownerId);

    Optional<StoreOwner> findByStoreId(Long storeId);

    void deleteByStoreId(Long storeId);

    @Query("select so from StoreOwner so join fetch so.store join fetch so.owner")
    List<StoreOwner> findAllWithStoreAndOwner();
}
