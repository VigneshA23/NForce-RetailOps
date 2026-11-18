package com.nforce.retailops.service;

import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;

// Who is acting on a cash entry: a user (Owner/Admin or employee) or a Super
// Admin. Exactly one is non-null.
public record CashActor(User user, SuperAdmin superAdmin) {

    public static CashActor of(User user) {
        return new CashActor(user, null);
    }

    public static CashActor of(SuperAdmin superAdmin) {
        return new CashActor(null, superAdmin);
    }

    public String displayName() {
        if (user != null) return user.getFullName();
        return superAdmin == null ? null : superAdmin.getName();
    }
}
