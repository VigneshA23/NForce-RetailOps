package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// Everything the Super Admin cash review page needs for one (store, date):
// the store header, the entry (null when none for the date), the cash-drawer
// target, the running "expected cash on hand" up to and including the date,
// and the current flag + the entry's history. All amounts are 2dp on the
// server so the UI renders them as-is.
public record SuperAdminCashReviewResponse(
    Long storeId,
    String storeName,
    String storeCode,
    LocalDate date,
    BigDecimal cashTarget,
    BigDecimal expectedCashOnHand,
    Entry entry,
    Flag flag,
    List<CorrectionHistoryEntry> history
) {

    public static SuperAdminCashReviewResponse noEntry(
        Long storeId, String storeName, String storeCode, LocalDate date,
        BigDecimal cashTarget, BigDecimal expectedCashOnHand
    ) {
        return new SuperAdminCashReviewResponse(
            storeId, storeName, storeCode, date, cashTarget, expectedCashOnHand,
            null, null, List.of());
    }

    // The entry itself, plus who entered it (an employee, an owner or a Super
    // Admin) and when, so the UI can draw the "entered by / when" line.
    public record Entry(
        Long id,
        Long storeId,
        LocalDate businessDate,
        // Shown in review order: opening, cash expenses, cash removed, cash
        // remaining, other adjustments; the two others (cash sales, bank
        // deposits) are kept here for completeness and not displayed by the
        // review page.
        BigDecimal openingDrawerCash,
        BigDecimal cashExpenses,
        BigDecimal cashRemoved,
        BigDecimal cashRemaining,
        BigDecimal otherAdjustments,
        Actor enteredBy,
        OffsetDateTime enteredAt,
        Actor updatedBy,
        OffsetDateTime updatedAt,
        // "Corrected" when any correction exists for this entry, "Entered"
        // otherwise. Flag status is separate and surfaced via `flag`.
        String status
    ) {
    }

    // Outstanding flag, if any; null when the entry has never been flagged
    // or its last flag has been resolved/removed.
    public record Flag(
        Long id,
        String comment,
        Actor flaggedBy,
        OffsetDateTime flaggedAt,
        OffsetDateTime commentUpdatedAt
    ) {
    }

    public record CorrectionHistoryEntry(
        Long id,
        BigDecimal previousOpeningDrawerCash,
        BigDecimal previousCashExpenses,
        BigDecimal previousCashRemoved,
        BigDecimal previousCashRemaining,
        BigDecimal previousOtherAdjustments,
        Actor correctedBy,
        OffsetDateTime correctedAt,
        String reason
    ) {
    }

    // Who someone was, resolved at read time: the user's or super admin's
    // display name, plus which "kind" of principal they are so the UI can
    // badge them as needed.
    public record Actor(
        Long id,
        String name,
        String kind // "EMPLOYEE" | "OWNER_ADMIN" | "SUPER_ADMIN"
    ) {
    }
}
