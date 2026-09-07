package com.nforce.retailops.dto;

import java.util.List;

public record AdminSearchResponse(
    List<AdminSearchItem> tasks,
    List<AdminSearchItem> categories,
    List<AdminSearchItem> employees
) {}
