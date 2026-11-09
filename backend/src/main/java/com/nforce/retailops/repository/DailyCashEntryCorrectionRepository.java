package com.nforce.retailops.repository;

import com.nforce.retailops.entity.DailyCashEntryCorrection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DailyCashEntryCorrectionRepository extends JpaRepository<DailyCashEntryCorrection, Long> {
    List<DailyCashEntryCorrection> findByEntryIdOrderByCorrectedAtAscIdAsc(Long entryId);
}
