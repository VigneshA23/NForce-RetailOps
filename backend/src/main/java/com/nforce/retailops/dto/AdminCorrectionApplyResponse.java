package com.nforce.retailops.dto;

public record AdminCorrectionApplyResponse(
    HistoryResponseEntryResponse updatedResponse,
    AdminCorrectionEntry correction
) {
}
