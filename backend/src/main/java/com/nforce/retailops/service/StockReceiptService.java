package com.nforce.retailops.service;

import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.StockCheckCorrectionRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

// Records a delivery when an order is marked Received. Kept apart from
// StockCheckService because OrderListService calls this and StockCheckService
// already depends on OrderListService.
//
// The delivery is tracked on today's stock-check row as quantity_received and
// is never folded into the Start of Day count, so "stock used" stays
// SOD + received - EOD instead of going negative, and the current count is
// SOD usable + received until End of Day is counted.
//
// If End of Day is already saved it was counted without this delivery, so the
// closing count is raised too (and audited in stock_check_corrections); usage
// is unchanged since both sides move together.
//
// With no row for today there is nothing to record against -- stock only
// exists as counts -- so nothing is changed and the caller is told.
@Service
public class StockReceiptService {

    static final String CORRECTION_REASON = "Stock received (order marked received)";

    private final StockCheckRepository stockCheckRepository;
    private final StockCheckCorrectionRepository stockCheckCorrectionRepository;

    public StockReceiptService(
        StockCheckRepository stockCheckRepository,
        StockCheckCorrectionRepository stockCheckCorrectionRepository
    ) {
        this.stockCheckRepository = stockCheckRepository;
        this.stockCheckCorrectionRepository = stockCheckCorrectionRepository;
    }

    // currentStock is usable stock after the delivery (null when not updated).
    // reorderQuantity is what is still missing: against tomorrow's minimum once
    // End of Day is saved (the figure the order list normally runs on), else
    // against today's.
    public record Result(boolean stockUpdated, BigDecimal currentStock, BigDecimal requiredToday, BigDecimal reorderQuantity) {
    }

    // Exactly one of user / superAdmin is the actor; with neither, stock is
    // left alone (the audit row needs someone to attribute the change to).
    @Transactional
    public Result applyReceipt(StoreInventoryItem item, BigDecimal received, User user, SuperAdmin superAdmin) {
        LocalDate today = LocalDate.now();
        BigDecimal requiredToday = item.requiredMinimumOn(today);

        Optional<StockCheck> todaysCheck = user == null && superAdmin == null
            ? Optional.empty()
            : stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(item.getId(), today);
        if (todaysCheck.isEmpty()) {
            return new Result(false, null, requiredToday, null);
        }

        StockCheck check = todaysCheck.get();
        boolean endOfDayTaken = check.hasSnapshot(StockCheckSnapshot.END_OF_DAY);
        BigDecimal previousEndAvailable = check.getEndOfDayAvailable();

        check.addReceived(received);

        BigDecimal reorderQuantity;
        if (endOfDayTaken) {
            BigDecimal requiredTomorrow = item.requiredMinimumOn(check.getCheckDate().plusDays(1));
            check.setRequiredTomorrow(requiredTomorrow);
            check.setQuantityNeeded(StockCheckService.orderQuantity(requiredTomorrow, check.usableFor(StockCheckSnapshot.END_OF_DAY)));
            reorderQuantity = check.getQuantityNeeded();
        } else {
            reorderQuantity = StockCheckService.orderQuantity(requiredToday, check.getCurrentCount());
        }
        StockCheck saved = stockCheckRepository.save(check);

        if (endOfDayTaken) {
            BigDecimal deadStock = check.getEndOfDayDeadStock();
            StockCheckCorrection correction = new StockCheckCorrection();
            correction.setStockCheck(saved);
            correction.setSnapshot(StockCheckSnapshot.END_OF_DAY);
            correction.setOriginalCount(previousEndAvailable);
            correction.setOriginalDeadStock(deadStock);
            correction.setCorrectedCount(check.getEndOfDayAvailable());
            correction.setCorrectedDeadStock(deadStock);
            correction.setCorrectedByUser(user);
            correction.setCorrectedBySuperAdmin(superAdmin);
            correction.setReason(CORRECTION_REASON);
            stockCheckCorrectionRepository.save(correction);
        }

        return new Result(true, saved.getCurrentCount(), requiredToday, reorderQuantity);
    }
}
