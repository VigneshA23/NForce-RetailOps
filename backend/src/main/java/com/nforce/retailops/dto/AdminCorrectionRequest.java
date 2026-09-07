package com.nforce.retailops.dto;

public record AdminCorrectionRequest(
    Boolean correctedBooleanValue,
    Double correctedNumericValue,
    String correctedTextValue,
    String reason
) {
}
