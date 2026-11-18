package com.nforce.retailops.entity;

// Every action recorded in daily_cash_entry_flag_history. Kept in sync with
// the check constraint in V116.
public enum DailyCashEntryFlagAction {
    RAISED,
    COMMENT_EDITED,
    REMOVED,
    RESOLVED
}
