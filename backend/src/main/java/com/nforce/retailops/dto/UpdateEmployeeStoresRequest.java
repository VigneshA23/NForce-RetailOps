package com.nforce.retailops.dto;

import java.util.List;

public record UpdateEmployeeStoresRequest(
    List<Long> storeIds
) {
}
