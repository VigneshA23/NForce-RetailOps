package com.nforce.retailops.service;

import com.nforce.retailops.dto.ExpectedCashResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * THE one place the expected-cash formula is written down. The live display and
 * the Monthly summary must call {@link #dailyExpected} / {@link #calculate};
 * they must never re-derive the arithmetic.
 *
 * <pre>
 * daily expected cash = cashRemaining + otherAdjustments   // adjustments signed
 * expected cash on hand = the sum of daily expected cash over the days so far
 * </pre>
 *
 * Cash remaining is what the employee dropped into the safe after taking out
 * the removed cash, so cash removed and opening drawer cash are only recorded
 * and shown: neither feeds the expected figure. A missing amount counts as 0.
 * The cash-drawer target is likewise not an input.
 *
 * <p>"Live" means the entry with the latest business date for the store on or
 * before today, i.e. the most recent day on record. A future-dated row is never
 * live (RTS-471), even if one pre-dates the request-level check.
 */
@Service
public class CashCalculationService {

    private final DailyCashEntryRepository entryRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreRepository storeRepository;

    public CashCalculationService(
        DailyCashEntryRepository entryRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreRepository storeRepository
    ) {
        this.entryRepository = entryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeRepository = storeRepository;
    }

    /** The formula. The only place its arithmetic exists. */
    public static BigDecimal dailyExpected(BigDecimal cashRemaining, BigDecimal otherAdjustments) {
        return (cashRemaining == null ? BigDecimal.ZERO : cashRemaining)
            .add(otherAdjustments == null ? BigDecimal.ZERO : otherAdjustments);
    }

    public BigDecimal calculateExpectedCash(DailyCashEntry entry) {
        return dailyExpected(entry.getCashRemaining(), entry.getOtherAdjustments());
    }

    /** One entry's own figures (any day). expectedCashOnHand here is that day's expected cash. */
    public ExpectedCashResponse calculate(DailyCashEntry entry) {
        return new ExpectedCashResponse(
            entry.getStore().getId(), true, null, entry.getBusinessDate(),
            calculateExpectedCash(entry),
            entry.getCashRemaining(),
            entry.getOpeningDrawerCash(),
            entry.getCashRemoved(),
            entry.getOtherAdjustments(),
            entry.getUpdatedAt()
        );
    }

    /**
     * Unauthorised core for trusted in-process callers (reconciliation): the
     * store's latest entry, or an explicit "not available" result.
     */
    @Transactional(readOnly = true)
    public ExpectedCashResponse getExpectedCashForStore(Long storeId) {
        return entryRepository
            .findFirstByStoreIdAndBusinessDateLessThanEqualOrderByBusinessDateDesc(storeId, LocalDate.now())
            .map(latest -> {
                ExpectedCashResponse day = calculate(latest);
                BigDecimal onHand = entryRepository.sumExpectedCashOnHandUpTo(storeId, latest.getBusinessDate());
                return day.withExpectedCashOnHand(onHand == null ? BigDecimal.ZERO : onHand);
            })
            .orElseGet(() -> ExpectedCashResponse.unavailable(storeId));
    }

    /** Owner/Admin: only their own active store; anything else is a 404. */
    @Transactional(readOnly = true)
    public ExpectedCashResponse getExpectedCashForOwner(Long ownerId) {
        Long storeId = OwnerStoreScope.requireStoreId(storeOwnerRepository, ownerId);
        return getExpectedCashForStore(storeId);
    }

    /** Super Admin: any store that exists. */
    @Transactional(readOnly = true)
    public ExpectedCashResponse getExpectedCashForSuperAdmin(Long storeId) {
        if (!storeRepository.existsById(storeId)) {
            throw new StoreNotFoundException("Store not found");
        }
        return getExpectedCashForStore(storeId);
    }
}
