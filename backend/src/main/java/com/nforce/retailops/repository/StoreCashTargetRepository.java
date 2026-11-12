package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreCashTarget;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

import java.util.Optional;

public interface StoreCashTargetRepository extends JpaRepository<StoreCashTarget, Long> {
    Optional<StoreCashTarget> findByStoreId(Long storeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from StoreCashTarget t where t.store.id = :storeId")
    Optional<StoreCashTarget> lockByStoreId(@Param("storeId") Long storeId);

    // Reads the stored amount straight from the DB (used to pick up the column default after insert).
    @Query("select t.targetAmount from StoreCashTarget t where t.store.id = :storeId")
    BigDecimal findAmountByStoreId(@Param("storeId") Long storeId);
}
