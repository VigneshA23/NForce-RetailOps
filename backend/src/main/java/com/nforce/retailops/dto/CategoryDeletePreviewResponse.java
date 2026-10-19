package com.nforce.retailops.dto;

import java.util.List;

// What deleting a category would take with it: the names of its tasks, and whether
// any of them has checklist history (in which case the delete is blocked).
public record CategoryDeletePreviewResponse(List<String> taskNames, boolean hasHistory) {
}
