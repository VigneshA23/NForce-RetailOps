package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StockReceiptRequest;
import com.nforce.retailops.entity.StockReceiptRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StockReceiptRequestRepository extends JpaRepository<StockReceiptRequest, Long> {

    Optional<StockReceiptRequest> findByIdAndStoreId(Long id, Long storeId);

    // Pending reports for one store's day, so the employee screen and the
    // End of Day usage check can count what is already waiting on approval.
    List<StockReceiptRequest> findByStoreIdAndCheckDateAndStatus(Long storeId, LocalDate checkDate, StockReceiptRequestStatus status);

    @Query("select coalesce(sum(r.quantity), 0) from StockReceiptRequest r "
        + "where r.storeInventoryItem.id = :itemId and r.checkDate = :date and r.status = 'PENDING'")
    java.math.BigDecimal pendingQuantityFor(@Param("itemId") Long itemId, @Param("date") LocalDate date);

    boolean existsByOrderListEntryIdAndStatus(Long orderListEntryId, StockReceiptRequestStatus status);
}
