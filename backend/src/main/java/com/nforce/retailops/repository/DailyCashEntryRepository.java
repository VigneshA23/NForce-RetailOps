package com.nforce.retailops.repository;

import com.nforce.retailops.entity.DailyCashEntry;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DailyCashEntryRepository extends JpaRepository<DailyCashEntry, Long> {
    Optional<DailyCashEntry> findByStoreIdAndBusinessDate(Long storeId, LocalDate businessDate);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from DailyCashEntry e where e.store.id = :storeId and e.businessDate = :businessDate")
    Optional<DailyCashEntry> lockByStoreIdAndBusinessDate(
        @Param("storeId") Long storeId, @Param("businessDate") LocalDate businessDate);

    // The store's most recent day on record up to asOf (unique per store +
    // date, so no tie). Callers pass today so a future-dated row can never
    // become the "live" figure (RTS-471).
    Optional<DailyCashEntry> findFirstByStoreIdAndBusinessDateLessThanEqualOrderByBusinessDateDesc(
        Long storeId, LocalDate asOf);

    // Month-end summary (RTS-297): every entry for the given stores inside a
    // period, oldest first per store, so the last one is the month-end day.
    @Query("select e from DailyCashEntry e "
        + "where e.store.id in :storeIds and e.businessDate between :from and :to "
        + "order by e.store.id asc, e.businessDate asc")
    List<DailyCashEntry> findForStoresBetween(
        @Param("storeIds") Collection<Long> storeIds,
        @Param("from") LocalDate from,
        @Param("to") LocalDate to
    );

    // Stores with at least one entry in the period -- lets a store deactivated
    // since still show up in the month it traded.
    @Query("select distinct e.store.id from DailyCashEntry e where e.businessDate between :from and :to")
    List<Long> findStoreIdsWithEntriesBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
