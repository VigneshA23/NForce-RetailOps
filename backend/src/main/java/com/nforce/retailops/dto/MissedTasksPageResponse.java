package com.nforce.retailops.dto;

import java.util.List;

// Cursor pagination groups whole dates per page (never splits one date's instances
// across two pages): `nextCursor` is the oldest date returned on this page, to be
// passed back as the next request's cursor, or null when there are no older dates left.
// `totalInstances` is the full missed-instance count across every page (the whole
// lookback-window scan, see TaskMakeupLinkService.MAX_LOOKBACK_DAYS, happens on every
// call regardless of page size) -- the Home page's "Missed Tasks (n)" stat tile reads
// this off page one rather than a separate count call.
public record MissedTasksPageResponse(
    List<MissedTaskDateGroupResponse> groups,
    String nextCursor,
    int totalInstances
) {
}
