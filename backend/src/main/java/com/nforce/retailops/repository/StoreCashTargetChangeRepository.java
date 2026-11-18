package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreCashTargetChange;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StoreCashTargetChangeRepository extends JpaRepository<StoreCashTargetChange, Long> {

    @Modifying
    @Query("delete from StoreCashTargetChange c where c.store.id = :storeId")
    void deleteByStoreId(@Param("storeId") Long storeId);
}
