package com.nforce.retailops.entity;

public enum CompletionType {
    SINGLE,
    MULTIPLE;

    // Minimum number of distinct active-employee responses needed to consider a
    // task completed for a day: SINGLE only ever has one (enforced store-wide
    // by construction, see TaskService.submitResponse), MULTIPLE requires at
    // least two employees to have responded -- one employee's response alone
    // must still show as Open, not Completed.
    private static final long MULTIPLE_MIN_RESPONDERS = 2;

    public boolean isSatisfiedBy(long distinctActiveResponderCount) {
        return distinctActiveResponderCount >= (this == MULTIPLE ? MULTIPLE_MIN_RESPONDERS : 1);
    }
}
