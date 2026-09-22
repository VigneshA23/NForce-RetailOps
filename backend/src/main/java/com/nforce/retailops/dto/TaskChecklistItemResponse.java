package com.nforce.retailops.dto;

import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;

public record TaskChecklistItemResponse(
    Long id,
    String name,
    String description,
    ResponseType responseType,
    String responseNote,
    String numericUnit,
    Double numericMin,
    Double numericMax,
    Integer textMaxLength,
    CompletionType completionType,
    Integer maxCompletions,
    List<TaskResponseSummary> responses,
    boolean canUndo,
    // "X/Y Completed By" status: X is the count of distinct ACTIVE employees with
    // at least one active response today (completedByNames carries who, for the
    // info tooltip); Y is the store's total active-employee headcount. Deactivated
    // employees are excluded from both, even if one of their old responses is
    // still active in `responses` above.
    int completedByCount,
    int totalActiveEmployees,
    List<String> completedByNames,
    // Past dates with a PENDING makeup link to today for this task (see
    // TaskMakeupLinkService) -- when non-empty, the checklist card shows "Will also
    // complete N missed (dates)". Empty for every task with no pending links.
    List<LocalDate> pendingMakeupDates
) {
    public static TaskChecklistItemResponse from(
        Task task, List<TaskResponseEntry> activeResponses, Long employeeUserId, int totalActiveEmployees,
        List<LocalDate> pendingMakeupDates
    ) {
        LinkedHashMap<Long, String> activeResponders = new LinkedHashMap<>();
        for (TaskResponseEntry entry : activeResponses) {
            if (entry.getEmployee().isActive()) {
                activeResponders.putIfAbsent(entry.getEmployee().getId(), entry.getEmployee().getFullName());
            }
        }

        return new TaskChecklistItemResponse(
            task.getId(),
            task.getName(),
            task.getDescription(),
            task.getResponseType(),
            task.getResponseNote(),
            task.getNumericUnit(),
            task.getNumericMin(),
            task.getNumericMax(),
            task.getTextMaxLength(),
            task.getCompletionType(),
            task.getMaxCompletions(),
            activeResponses.stream().map(TaskResponseSummary::from).toList(),
            activeResponses.stream().anyMatch(entry -> entry.getEmployee().getId().equals(employeeUserId)),
            activeResponders.size(),
            totalActiveEmployees,
            List.copyOf(activeResponders.values()),
            pendingMakeupDates
        );
    }
}
