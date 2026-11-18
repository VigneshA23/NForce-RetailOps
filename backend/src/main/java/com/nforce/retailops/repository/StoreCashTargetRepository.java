package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreCashTarget;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StoreCashTargetRepository extends JpaRepository<StoreCashTarget, Long> {
    Optional<StoreCashTarget> findByStoreId(Long storeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from StoreCashTarget t where t.store.id = :storeId")
    Optional<StoreCashTarget> lockByStoreId(@Param("storeId") Long storeId);

    // Reads the stored amount straight from the DB (used to pick up the column default after insert).
    @Query("select t.targetAmount from StoreCashTarget t where t.store.id = :storeId")
    BigDecimal findAmountByStoreId(@Param("storeId") Long storeId);

    // Batched form for the Super Admin store listing: [storeId, targetAmount].
    @Query("select t.store.id, t.targetAmount from StoreCashTarget t where t.store.id in :storeIds")
    List<Object[]> findAmountsByStoreIds(@Param("storeIds") Collection<Long> storeIds);

    @Modifying
    @Query("delete from StoreCashTarget t where t.store.id = :storeId")
    void deleteByStoreId(@Param("storeId") Long storeId);
}
