package com.nforce.retailops.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record HistoryCategoryResponse(
    Long id,
    String name,
    // The category's Super Admin badge color (drives its icon tile color).
    String badgeColor,
    // Whether the category itself is still active -- false means every task
    // under it is treated as inactive too for live-view purposes, even if a
    // task's own `active` flag happens to still read true.
    boolean active,
    // Deactivation audit, resolved from ActivityLog by entity name + store
    // (best-effort -- see ChecklistHistoryService). Null when the category is
    // active, or no matching CATEGORY_DEACTIVATED log row could be found.
    String deactivatedByName,
    OffsetDateTime deactivatedAt,
    List<HistoryTaskItemResponse> tasks
) {
}
