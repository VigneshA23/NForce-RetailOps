package com.nforce.retailops.entity;

// How a TaskResponseEntry came to exist. NORMAL is the default same-day submission;
// MOVED is an independently-completed "moved" unit (see TaskMakeupLinkService/
// TaskService.submitResponse) -- its responseDate is the instance's original due
// date, not the day it was actually submitted on, but it is otherwise a normal,
// fully undoable/admin-correctable response. MAKEUP_NOW and LINK_FULFILLED are
// retired (the direct-complete and same-day auto-fulfillment "Missed Tasks"
// actions they backed have been replaced by MOVED) but kept as enum constants
// since historical rows still reference them -- LINK_FULFILLED rows remain
// permanent, never undoable or admin-correctable (see TaskService/AdminCorrectionService).
public enum CompletedVia {
    NORMAL,
    MAKEUP_NOW,
    LINK_FULFILLED,
    MOVED
}
