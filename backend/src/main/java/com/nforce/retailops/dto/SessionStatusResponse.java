package com.nforce.retailops.dto;

// Seconds remaining before the CALLER's own current session hits its absolute
// expiry. Purely informational -- lets the frontend seed an accurate UX
// countdown after a page refresh instead of restarting at the full policy
// duration; enforcement itself never depends on this value.
public record SessionStatusResponse(
    long remainingSeconds
) {
}
