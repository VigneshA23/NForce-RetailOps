package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;

// Shared active/inactive toggle body for the Phase 2 catalog resources
// (inventory categories, inventory items, suppliers) -- identical shape to
// CategoryStatusRequest, reused here rather than duplicated three times.
public record StatusRequest(
    @NotNull(message = "Active is required")
    Boolean active
) {
}
