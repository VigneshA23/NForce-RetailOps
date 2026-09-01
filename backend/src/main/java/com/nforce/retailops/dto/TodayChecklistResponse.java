package com.nforce.retailops.dto;

import java.time.LocalDate;
import java.util.List;

public record TodayChecklistResponse(
    Long storeId,
    LocalDate date,
    List<CategoryChecklistResponse> categories
) {
}
