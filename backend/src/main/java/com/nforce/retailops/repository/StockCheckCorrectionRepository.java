package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StockCheckCorrection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public interface StockCheckCorrectionRepository extends JpaRepository<StockCheckCorrection, Long> {

    List<StockCheckCorrection> findByStockCheckIdIn(Iterable<Long> stockCheckIds);

    // The pre-correction value each corrected check originally held -- the
    // FIRST correction ever recorded against it, so a second/third
    // correction never overwrites what the employee actually entered.
    default Map<Long, StockCheckCorrection> findEarliestByStockCheckIds(Iterable<Long> stockCheckIds) {
        return findByStockCheckIdIn(stockCheckIds).stream()
            .collect(Collectors.toMap(
                c -> c.getStockCheck().getId(),
                c -> c,
                (a, b) -> a.getCorrectedAt().isBefore(b.getCorrectedAt()) ? a : b
            ));
    }

    // Who corrected it (most recently), same "latest wins" pattern as
    // AdminCorrectionRepository.findLatestByResponseIds.
    default Map<Long, StockCheckCorrection> findLatestByStockCheckIds(Iterable<Long> stockCheckIds) {
        return findByStockCheckIdIn(stockCheckIds).stream()
            .collect(Collectors.toMap(
                c -> c.getStockCheck().getId(),
                c -> c,
                (a, b) -> a.getCorrectedAt().isAfter(b.getCorrectedAt()) ? a : b
            ));
    }
}
