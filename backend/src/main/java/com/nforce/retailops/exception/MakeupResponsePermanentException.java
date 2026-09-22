package com.nforce.retailops.exception;

// A response created by fulfilling a "Missed Tasks" link (CompletedVia.LINK_FULFILLED)
// is permanent: never undoable, never admin-correctable. Undoing or flagging today's
// triggering response never reverts it either.
public class MakeupResponsePermanentException extends RuntimeException {
    public MakeupResponsePermanentException(String message) {
        super(message);
    }
}
