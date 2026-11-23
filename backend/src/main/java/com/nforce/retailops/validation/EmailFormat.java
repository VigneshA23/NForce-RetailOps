package com.nforce.retailops.validation;

import java.util.regex.Pattern;

/**
 * The one email-format rule for saved emails (RTS-582). It is the same rule
 * and message as the frontend's {@code utils/emailValidation.ts}, which the
 * Login and Forgot Password forms use -- keep the two in step.
 */
public final class EmailFormat {

    public static final String INVALID_MESSAGE = "Please enter a valid email address";

    // local@domain.tld, no whitespace, at least one dot in the domain and an
    // ending of two or more characters. UNICODE_CHARACTER_CLASS makes \s match
    // the same whitespace as JavaScript's \s (e.g. non-breaking space).
    private static final Pattern PATTERN =
        Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$", Pattern.UNICODE_CHARACTER_CLASS);

    private EmailFormat() {
    }

    public static boolean isValid(String email) {
        return email != null && PATTERN.matcher(email).matches();
    }
}
