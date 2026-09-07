package com.nforce.retailops.dto;

import java.util.List;

public record SASearchResponse(
    List<SASearchItem> owners,
    List<SASearchItem> stores,
    List<SASearchItem> employees
) {}
