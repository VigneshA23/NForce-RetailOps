package com.nforce.retailops.repository;

import com.nforce.retailops.entity.DailyCashEntryFlagHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DailyCashEntryFlagHistoryRepository extends JpaRepository<DailyCashEntryFlagHistory, Long> {

    List<DailyCashEntryFlagHistory> findByEntryIdOrderByRecordedAtAscIdAsc(Long entryId);
}
