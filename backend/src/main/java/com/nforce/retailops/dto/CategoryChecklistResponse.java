package com.nforce.retailops.dto;

import java.util.List;

public record CategoryChecklistResponse(
    Long id,
    String name,
    List<TaskChecklistItemResponse> tasks
) {
}
