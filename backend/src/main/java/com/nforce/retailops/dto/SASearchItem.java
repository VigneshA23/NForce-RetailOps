package com.nforce.retailops.dto;

public record SASearchItem(long id, String label, String subtitle, String navTarget, String avatarUrl) {

    public SASearchItem(long id, String label, String subtitle, String navTarget) {
        this(id, label, subtitle, navTarget, null);
    }
}
