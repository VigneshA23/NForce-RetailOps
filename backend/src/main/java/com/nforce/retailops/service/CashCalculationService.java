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

/**
 * THE one place the expected-cash formula is written down (RTS-295). The live
 * display (RTS-296) and the Monthly Reconciliation aggregation (RTS-297) must
 * call {@link #calculateExpectedCash} / {@link #getExpectedCashForStore}; they
 * must never re-derive the arithmetic. {@code CashCalculationServiceTest}
 * fails the build if another class starts reading the formula's inputs.
 *
 * <pre>
 * expected = openingDrawerCash + totalCashSales - cashRemoved
 *          - bankDeposits - cashExpenses + otherAdjustments   // signed
 * variance = cashRemaining (physically counted) - expected
 * </pre>
 *
 * The cash-drawer target (RTS-293) is deliberately NOT an input: it is a
 * separate informational figure.
 *
 * <p>"Live" means the entry with the latest business date for the store, i.e.
 * the most recent day on record. Re-saving or correcting an older day does not
 * change which entry is current.
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
    public BigDecimal calculateExpectedCash(DailyCashEntry entry) {
        return entry.getOpeningDrawerCash()
            .add(entry.getTotalCashSales())
            .subtract(entry.getCashRemoved())
            .subtract(entry.getBankDeposits())
            .subtract(entry.getCashExpenses())
            .add(entry.getOtherAdjustments());
    }

    /** Expected cash plus variance for one entry (any day, e.g. for reconciliation). */
    public ExpectedCashResponse calculate(DailyCashEntry entry) {
        BigDecimal expected = calculateExpectedCash(entry);
        return new ExpectedCashResponse(
            entry.getStore().getId(), true, null, entry.getBusinessDate(),
            expected,
            entry.getCashRemaining(),
            entry.getCashRemaining().subtract(expected),
            entry.getOpeningDrawerCash(),
            entry.getTotalCashSales(),
            entry.getCashRemoved(),
            entry.getBankDeposits(),
            entry.getCashExpenses(),
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
        return entryRepository.findFirstByStoreIdOrderByBusinessDateDesc(storeId)
            .map(this::calculate)
            .orElseGet(() -> ExpectedCashResponse.unavailable(storeId));
    }

    /** Owner/Admin: only their own active store; anything else is a 404. */
    @Transactional(readOnly = true)
    public ExpectedCashResponse getExpectedCashForOwner(Long ownerId) {
        Long storeId = storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .findFirst()
            .orElseThrow(() -> new StoreNotFoundException("Store not found"))
            .getStore().getId();
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
