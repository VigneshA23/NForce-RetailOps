package com.nforce.retailops.dto;

import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Task;

// Employee-facing view of a Task: only what the checklist needs to render and
// validate a response, not the admin-only configuration (owner, stores, schedule,
// dates, display order).
public record EmployeeTaskResponse(
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
    Integer maxCompletions
) {
    public static EmployeeTaskResponse from(Task task) {
        return new EmployeeTaskResponse(
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
            task.getMaxCompletions()
        );
    }
}
