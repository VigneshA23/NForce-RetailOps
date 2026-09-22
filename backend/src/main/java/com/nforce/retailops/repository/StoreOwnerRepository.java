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

    // Used when reassigning a store's owner -- checks if the target owner already
    // manages a DIFFERENT store (excluding the store being reassigned).
    boolean existsByOwnerIdAndActiveTrueAndStoreIdNot(Long ownerId, Long storeId);

    // Batched form of findByOwnerId, for listing many owners at once without one
    // query per owner.
    @Query("select so from StoreOwner so join fetch so.store join fetch so.owner where so.owner.id in :ownerIds")
    List<StoreOwner> findByOwnerIdInWithStoreAndOwner(@Param("ownerIds") Collection<Long> ownerIds);

    List<StoreOwner> findByOwnerIdAndStoreIdIn(Long ownerId, List<Long> storeIds);

    Optional<StoreOwner> findByStoreIdAndOwnerId(Long storeId, Long ownerId);

    Optional<StoreOwner> findByStoreId(Long storeId);

    // Batched form of findByStoreId -- used by the Super Admin task creation
    // flow to group a set of selected stores by their current owner in one
    // query instead of one per store.
    List<StoreOwner> findByStoreIdIn(Collection<Long> storeIds);

    Optional<StoreOwner> findByStoreIdAndActiveTrue(Long storeId);

    void deleteByStoreId(Long storeId);

    // Left-joined on owner: a store can have no owner at all (see StoreOwner.owner).
    @Query("select so from StoreOwner so join fetch so.store left join fetch so.owner")
    List<StoreOwner> findAllWithStoreAndOwner();

    // Store-owner links with access revoked -- candidates for handing off to a
    // newly created owner while keeping the same store record/code. Also
    // covers never-owned stores (owner = null, active = false). Excludes a
    // deactivated store (store.active = false): a closed store shouldn't be
    // offered for reassignment until it's reactivated.
    @Query("select so from StoreOwner so join fetch so.store left join fetch so.owner "
        + "where so.active = false and so.store.active = true")
    List<StoreOwner> findAllWithRevokedAccess();

    // Links currently tracking an unresolved owner vacancy -- candidates for
    // SuperAdminAlertService.runOwnerVacancyCheck's 24-hour notification.
    @Query("select so from StoreOwner so join fetch so.store where so.ownerVacantSince is not null")
    List<StoreOwner> findAllWithOwnerVacancyPending();
}
