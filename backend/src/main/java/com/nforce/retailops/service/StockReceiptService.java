package com.nforce.retailops.service;

import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.StockCheckReceipt;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.StockCheckCorrectionRepository;
import com.nforce.retailops.repository.StockCheckReceiptRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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
// With no row for today the delivery is still recorded, on top of the item's
// latest count (see StockCheckReceipt); an item that has never been counted has
// nothing to add to, so nothing is changed and the caller is told.
//
// Every delivery also writes a StockCheckReceipt row, which is what the count
// history shows as "Stock received" along with who received it.
@Service
public class StockReceiptService {

    static final String CORRECTION_REASON = "Stock received (order marked received)";

    private final StockCheckRepository stockCheckRepository;
    private final StockCheckCorrectionRepository stockCheckCorrectionRepository;
    private final StockCheckReceiptRepository stockCheckReceiptRepository;

    public StockReceiptService(
        StockCheckRepository stockCheckRepository,
        StockCheckCorrectionRepository stockCheckCorrectionRepository,
        StockCheckReceiptRepository stockCheckReceiptRepository
    ) {
        this.stockCheckRepository = stockCheckRepository;
        this.stockCheckCorrectionRepository = stockCheckCorrectionRepository;
        this.stockCheckReceiptRepository = stockCheckReceiptRepository;
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

        if (user == null && superAdmin == null) {
            return new Result(false, null, requiredToday, null);
        }
        Optional<StockCheck> todaysCheck = stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(item.getId(), today);
        if (todaysCheck.isEmpty()) {
            return applyWithoutTodaysRow(item, received, user, superAdmin, requiredToday);
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

        recordReceipt(item, saved, received, saved.getCurrentCount(), user, superAdmin);
        return new Result(true, saved.getCurrentCount(), requiredToday, reorderQuantity);
    }

    // No row today: the delivery goes on top of the latest count (plus earlier
    // deliveries since) until the next count is taken.
    private Result applyWithoutTodaysRow(StoreInventoryItem item, BigDecimal received, User user, SuperAdmin superAdmin, BigDecimal requiredToday) {
        List<StockCheck> latest = stockCheckRepository.findRecentForItem(item.getId(), PageRequest.of(0, 1));
        if (latest.isEmpty()) {
            return new Result(false, null, requiredToday, null);
        }
        StockCheck last = latest.get(0);
        BigDecimal pending = StockCheckReceipt.pendingTotal(stockCheckReceiptRepository.findUnappliedForItem(item.getId()), last);
        BigDecimal countAfter = last.getCurrentCount().add(pending).add(received);
        recordReceipt(item, null, received, countAfter, user, superAdmin);
        return new Result(true, countAfter, requiredToday, StockCheckService.orderQuantity(requiredToday, countAfter));
    }

    private void recordReceipt(StoreInventoryItem item, StockCheck check, BigDecimal received, BigDecimal countAfter, User user, SuperAdmin superAdmin) {
        StockCheckReceipt receipt = new StockCheckReceipt();
        receipt.setStore(item.getStore());
        receipt.setStoreInventoryItem(item);
        receipt.setStockCheck(check);
        receipt.setQuantity(received);
        receipt.setCountAfter(countAfter);
        receipt.setReceivedByUser(user);
        receipt.setReceivedBySuperAdmin(superAdmin);
        stockCheckReceiptRepository.save(receipt);
    }
}
