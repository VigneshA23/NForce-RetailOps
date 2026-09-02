package com.nforce.retailops.service;

import com.nforce.retailops.entity.DayOfWeekCode;
import com.nforce.retailops.entity.Task;

import java.time.LocalDate;

/**
 * Whether a Task's configured schedule (day-of-week pattern -- its active date
 * range is a plain column comparison already handled in SQL) covers a given
 * calendar date. Shared by TaskService (today's checklist) and
 * ChecklistHistoryService (historical reconstruction) so schedule semantics
 * can't drift between the "today" and "history" views.
 */
final class TaskScheduleMatcher {

    private TaskScheduleMatcher() {
    }

    static boolean matches(Task task, LocalDate date) {
        return switch (task.getScheduleType()) {
            case EVERY_DAY -> true;
            case WEEKDAYS -> date.getDayOfWeek().getValue() <= 5;
            case WEEKENDS -> date.getDayOfWeek().getValue() >= 6;
            case SELECTED_DAYS -> task.getSelectedDays().contains(dayCode(date));
        };
    }

    private static DayOfWeekCode dayCode(LocalDate date) {
        return DayOfWeekCode.valueOf(date.getDayOfWeek().name().substring(0, 3));
    }
}
