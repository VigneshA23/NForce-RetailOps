package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// updatedBy* are both null while the target is still the default.
public record StoreCashTargetResponse(
    Long storeId,
    BigDecimal targetAmount,
    Long updatedByUserId,
    Long updatedBySuperAdminId,
    OffsetDateTime updatedAt
) {
}
