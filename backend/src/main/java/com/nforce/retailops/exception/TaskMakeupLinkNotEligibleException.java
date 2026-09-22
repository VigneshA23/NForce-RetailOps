package com.nforce.retailops.exception;

// A "Missed Tasks" link-to-today action failed its server-side eligibility check
// (task not on today's checklist, today already completed, or a concurrent request
// already created/fulfilled/completed the same instance).
public class TaskMakeupLinkNotEligibleException extends RuntimeException {
    public TaskMakeupLinkNotEligibleException(String message) {
        super(message);
    }
}
