package com.nforce.retailops.dto;

public record StoreResponse(
    Long id,
    String name,
    boolean active,
    int employeeCount,
    // TODO: no Task entity exists yet (Phase 1 tasks aren't built) — always 0 until then.
    int taskCount
) {
}
