package com.nforce.retailops.entity;

import java.util.List;

public enum OrderStatus {
    NEEDS_ORDERING,
    ORDERED,
    RECEIVED;

    // Statuses that represent an actual purchase having happened -- used by
    // supplier purchasing-metrics reporting so NEEDS_ORDERING (not yet
    // purchased) never contributes to a totals query.
    public static final List<OrderStatus> PURCHASED_STATUSES = List.of(ORDERED, RECEIVED);
}
