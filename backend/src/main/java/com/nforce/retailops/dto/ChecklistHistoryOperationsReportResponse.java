package com.nforce.retailops.dto;

import java.util.List;

// Daily Operations Summary report: one row per authorized store per date range
// (summary) plus the underlying task-level records (details), both scoped to
// exactly the stores the requesting Owner/Admin is authorized for.
public record ChecklistHistoryOperationsReportResponse(
    List<ChecklistHistorySummaryRow> summary,
    List<ChecklistHistoryTaskDetailRow> details
) {
}
