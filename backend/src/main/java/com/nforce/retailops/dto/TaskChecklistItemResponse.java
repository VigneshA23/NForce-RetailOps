package com.nforce.retailops.dto;

import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;

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
    boolean canUndo
) {
    public static TaskChecklistItemResponse from(Task task, List<TaskResponseEntry> activeResponses, Long employeeUserId) {
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
            activeResponses.stream().anyMatch(entry -> entry.getEmployee().getId().equals(employeeUserId))
        );
    }
}
