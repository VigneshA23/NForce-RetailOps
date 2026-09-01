package com.nforce.retailops.dto;

import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Task;

public record TaskChecklistItemResponse(
    Long id,
    String name,
    ResponseType responseType
) {
    public static TaskChecklistItemResponse from(Task task) {
        return new TaskChecklistItemResponse(task.getId(), task.getName(), task.getResponseType());
    }
}
