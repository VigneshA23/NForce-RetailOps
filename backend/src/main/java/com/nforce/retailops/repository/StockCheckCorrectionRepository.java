package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StockCheckCorrection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface StockCheckCorrectionRepository extends JpaRepository<StockCheckCorrection, Long> {

    // Every edit recorded against a page of checks, oldest first, with the
    // editor fetched in the same query (the history view names each one).
    // The earliest row for a snapshot holds the value first entered.
    @Query("select c from StockCheckCorrection c join fetch c.correctedBy "
        + "where c.stockCheck.id in :stockCheckIds "
        + "order by c.correctedAt asc, c.id asc")
    List<StockCheckCorrection> findWithEditorByStockCheckIds(@Param("stockCheckIds") Collection<Long> stockCheckIds);
}
