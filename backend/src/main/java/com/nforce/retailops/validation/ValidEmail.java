package com.nforce.retailops.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * An email address in the same format the Login page accepts (RTS-582):
 * local@domain.tld, no spaces, at least one dot in the domain and an ending of
 * two or more characters. Checked on the trimmed value, since the services
 * trim before saving. Null or blank passes -- pair with {@code @NotBlank}.
 *
 * <p>Used for emails being saved (Owner, Employee and Profile). Deliberately
 * not on LoginRequest / ForgotPasswordRequest; see the note there.
 */
@Documented
@Constraint(validatedBy = ValidEmailValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidEmail {

    String message() default EmailFormat.INVALID_MESSAGE;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
