package com.nforce.retailops.dto;

import java.time.LocalDate;

public record MissedTaskLinkResponse(
    Long taskId,
    LocalDate pastDate,
    LocalDate linkedDate,
    String status
) {
}
