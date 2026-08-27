package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreOwner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StoreOwnerRepository extends JpaRepository<StoreOwner, Long> {

    Optional<StoreOwner> findByOwnerId(Long ownerId);
}
