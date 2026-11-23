package com.nforce.retailops.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

// RTS-582: every request that saves an email (Owner add/edit, Employee
// create/edit, Profile) rejects a malformed one with the Login page's message,
// and accepts a valid one even with surrounding spaces (the services trim).
class EmailFieldValidationTest {

    private static final String MESSAGE = "Please enter a valid email address";

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private static AddOwnerRequest addOwner(String email) {
        return new AddOwnerRequest("Priya Admin", email, "+1 5550100099", "Female", null, null, null);
    }

    private static UpdateOwnerRequest updateOwner(String email) {
        return new UpdateOwnerRequest("Priya Admin", email);
    }

    private static EmployeeCreateRequest createEmployee(String email) {
        return new EmployeeCreateRequest("Jane Doe", email, "+1 5550100099", "Full Time", "Female", null);
    }

    private static EmployeeUpdateRequest updateEmployee(String email) {
        return new EmployeeUpdateRequest("Jane Doe", email, "+1 5550100099", "Full Time", "Female");
    }

    private static UpdateMeRequest updateMe(String email) {
        return new UpdateMeRequest("Jane Doe", email, null);
    }

    private static <T> Set<String> emailMessages(Set<ConstraintViolation<T>> violations, String field) {
        return violations.stream()
            .filter(v -> v.getPropertyPath().toString().equals(field))
            .map(ConstraintViolation::getMessage)
            .collect(java.util.stream.Collectors.toSet());
    }

    @ParameterizedTest
    @ValueSource(strings = {"notanemail", "jane@nforceone", "jane@nforceone.c", "jane doe@nforceone.com"})
    void everyEmailFieldRejectsAMalformedEmailWithTheLoginMessage(String email) {
        assertThat(emailMessages(validator.validate(addOwner(email)), "ownerEmail")).containsExactly(MESSAGE);
        assertThat(emailMessages(validator.validate(updateOwner(email)), "ownerEmail")).containsExactly(MESSAGE);
        assertThat(emailMessages(validator.validate(createEmployee(email)), "email")).containsExactly(MESSAGE);
        assertThat(emailMessages(validator.validate(updateEmployee(email)), "email")).containsExactly(MESSAGE);
        assertThat(emailMessages(validator.validate(updateMe(email)), "email")).containsExactly(MESSAGE);
    }

    @Test
    void everyEmailFieldAcceptsAValidEmailEvenWithSurroundingSpaces() {
        String email = "  jane@nforceone.com ";
        assertThat(validator.validate(addOwner(email))).isEmpty();
        assertThat(validator.validate(updateOwner(email))).isEmpty();
        assertThat(validator.validate(createEmployee(email))).isEmpty();
        assertThat(validator.validate(updateEmployee(email))).isEmpty();
        assertThat(validator.validate(updateMe(email))).isEmpty();
    }

    @Test
    void aBlankEmailReportsOnlyThatItIsRequired() {
        assertThat(emailMessages(validator.validate(createEmployee(" ")), "email")).containsExactly("Email is required");
        assertThat(emailMessages(validator.validate(updateMe(" ")), "email")).containsExactly("Email is required");
    }
}
