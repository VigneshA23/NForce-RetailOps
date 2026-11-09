package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreCashTarget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StoreCashTargetRepository extends JpaRepository<StoreCashTarget, Long> {
    Optional<StoreCashTarget> findByStoreId(Long storeId);
}
