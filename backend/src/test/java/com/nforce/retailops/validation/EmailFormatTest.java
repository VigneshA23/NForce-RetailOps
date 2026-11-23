package com.nforce.retailops.validation;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

// RTS-582: same cases as the frontend's utils/emailValidation.test.ts, so the
// two copies of the rule can't drift apart unnoticed.
class EmailFormatTest {

    @ParameterizedTest
    @ValueSource(strings = {"jane@nforceone.com", "jane.doe+cash@store.co.uk", "a@b.io"})
    void acceptsAWellFormedEmail(String email) {
        assertThat(EmailFormat.isValid(email)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "notanemail", "jane@", "@nforceone.com", "jane@nforceone", "jane@nforceone.c",
        "jane doe@nforceone.com", "jane@@nforceone.com", " jane@nforceone.com", "",
        "jane doe@nforceone.com"
    })
    void rejectsAMalformedEmail(String email) {
        assertThat(EmailFormat.isValid(email)).isFalse();
    }
}
