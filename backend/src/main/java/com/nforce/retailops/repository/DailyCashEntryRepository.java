package com.nforce.retailops.repository;

import com.nforce.retailops.entity.DailyCashEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface DailyCashEntryRepository extends JpaRepository<DailyCashEntry, Long> {
    Optional<DailyCashEntry> findByStoreIdAndBusinessDate(Long storeId, LocalDate businessDate);
}
