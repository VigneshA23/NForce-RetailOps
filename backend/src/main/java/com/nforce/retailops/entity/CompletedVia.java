package com.nforce.retailops.entity;

// How a TaskResponseEntry came to exist. NORMAL is the default same-day submission;
// MAKEUP_NOW is an employee explicitly completing a past missed instance; LINK_FULFILLED
// is an auto-generated row created when a linked "today" instance was completed --
// permanent, never undoable or admin-correctable (see TaskService/AdminCorrectionService).
public enum CompletedVia {
    NORMAL,
    MAKEUP_NOW,
    LINK_FULFILLED
}
