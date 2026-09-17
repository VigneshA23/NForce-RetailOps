package com.nforce.retailops.dto;

public record SessionConfigResponse(
    long inactivityTimeoutMinutes,
    long rememberMeTimeoutMinutes
) {
}
