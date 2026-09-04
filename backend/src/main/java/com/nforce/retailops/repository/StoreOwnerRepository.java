package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreOwner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StoreOwnerRepository extends JpaRepository<StoreOwner, Long> {

    List<StoreOwner> findByOwnerId(Long ownerId);

    Optional<StoreOwner> findByOwnerIdAndActiveTrue(Long ownerId);

    boolean existsByOwnerIdAndActiveTrue(Long ownerId);

    // Batched form of findByOwnerId, for listing many owners at once without one
    // query per owner.
    @Query("select so from StoreOwner so join fetch so.store join fetch so.owner where so.owner.id in :ownerIds")
    List<StoreOwner> findByOwnerIdInWithStoreAndOwner(@Param("ownerIds") Collection<Long> ownerIds);

    List<StoreOwner> findByOwnerIdAndStoreIdIn(Long ownerId, List<Long> storeIds);

    Optional<StoreOwner> findByStoreIdAndOwnerId(Long storeId, Long ownerId);

    Optional<StoreOwner> findByStoreId(Long storeId);

    Optional<StoreOwner> findByStoreIdAndActiveTrue(Long storeId);

    void deleteByStoreId(Long storeId);

    @Query("select so from StoreOwner so join fetch so.store join fetch so.owner")
    List<StoreOwner> findAllWithStoreAndOwner();

    // Store-owner links with access revoked -- candidates for handing off to a
    // newly created owner while keeping the same store record/code.
    @Query("select so from StoreOwner so join fetch so.store join fetch so.owner where so.active = false")
    List<StoreOwner> findAllWithRevokedAccess();
}
