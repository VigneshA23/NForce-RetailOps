package com.nforce.retailops.util;

import java.util.regex.Pattern;

/**
 * The one way an inventory item name is tidied before it is saved or
 * compared: leading/trailing space removed and any run of spaces, tabs or
 * non-breaking spaces inside it collapsed to a single space. Case is kept as
 * typed; duplicate checks compare ignoring case.
 */
public final class ItemNames {

    // \s misses non-breaking and other Unicode spaces; \p{Z} covers them.
    private static final Pattern WHITESPACE = Pattern.compile("[\\s\\p{Z}]+");

    private ItemNames() {
    }

    public static String normalize(String name) {
        if (name == null) {
            return null;
        }
        return WHITESPACE.matcher(name).replaceAll(" ").trim();
    }
}
