package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;

// Exactly one of the three value fields is expected, chosen by the task's configured
// responseType (YES_NO/DONE_NOT_DONE -> booleanValue, NUMERIC -> numericValue,
// TEXT -> textValue); TaskService validates the match, not bean validation, since the
// required field depends on the referenced task.
public record TaskResponseSubmitRequest(
    @NotNull(message = "Store is required")
    Long storeId,

    Boolean booleanValue,
    Double numericValue,
    String textValue
) {
}
