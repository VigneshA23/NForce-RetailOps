package com.nforce.retailops.dto;

// avatarUrl is the base64 data URL (data:image/jpeg;base64,...) or null to remove.
public record UpdateAvatarRequest(String avatarUrl) {
}
