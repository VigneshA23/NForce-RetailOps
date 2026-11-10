package com.nforce.retailops.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Month-end cash summary (RTS-297): one entry per store plus a Combined total.
 * {@code periodEnd} is the month's last day, or today for the current month.
 */
public record MonthlyCashSummaryResponse(
    String month,
    LocalDate periodStart,
    LocalDate periodEnd,
    List<StoreMonthlyCashSummary> stores,
    StoreMonthlyCashSummary combined
) {
}
