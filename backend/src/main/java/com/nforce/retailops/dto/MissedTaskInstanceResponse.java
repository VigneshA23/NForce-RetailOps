package com.nforce.retailops.dto;

import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.DayOfWeekCode;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;

import java.time.LocalDate;
import java.util.List;

// One missed (task, date) instance on the employee's Missed Tasks page. The server
// computes every button's eligibility up front -- the frontend just renders `state`.
public record MissedTaskInstanceResponse(
    Long taskId,
    String taskName,
    String categoryName,
    String description,
    ResponseType responseType,
    String responseNote,
    String numericUnit,
    Double numericMin,
    Double numericMax,
    Integer textMaxLength,
    CompletionType completionType,
    // Mirrors TaskResponse's own scheduleType/selectedDays/startDate/endDate so the
    // frontend can reuse the same scheduleSummary() formatter it already uses for
    // Admin's task table, e.g. "Every day" / "Weekdays" / "Once on Sep 20".
    ScheduleType scheduleType,
    List<DayOfWeekCode> selectedDays,
    LocalDate taskStartDate,
    LocalDate taskEndDate,
    LocalDate date,
    // ACTIONABLE: the Move button is available. WAITING_ON_SECOND: a MULTIPLE task the
    // current employee already answered, awaiting a second distinct employee -- no
    // button. An instance with a PENDING move is excluded from the list entirely
    // (never surfaced with a "LINKED"-style state) -- see TaskMakeupLinkService.
    String state,
    int completedByCount,
    int totalActiveEmployees
) {
}
