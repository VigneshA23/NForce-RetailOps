package com.nforce.retailops.dto;

import java.time.LocalDate;
import java.util.List;

public record MissedTaskDateGroupResponse(
    LocalDate date,
    List<MissedTaskInstanceResponse> instances
) {
}
