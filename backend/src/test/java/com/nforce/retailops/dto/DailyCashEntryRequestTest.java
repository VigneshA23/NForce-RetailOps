package com.nforce.retailops.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class DailyCashEntryRequestTest {

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

    private static DailyCashEntryRequest requestFor(LocalDate businessDate) {
        BigDecimal ten = new BigDecimal("10.00");
        return new DailyCashEntryRequest(businessDate, ten, ten, ten, BigDecimal.ZERO, null);
    }

    @Test
    void rejectsAFutureBusinessDate() {
        Set<ConstraintViolation<DailyCashEntryRequest>> violations =
            validator.validate(requestFor(LocalDate.now().plusDays(1)));

        assertThat(violations).singleElement().satisfies(violation -> {
            assertThat(violation.getPropertyPath().toString()).isEqualTo("businessDate");
            assertThat(violation.getMessage()).isEqualTo("Business date cannot be in the future");
        });
    }

    @Test
    void everyAmountIsOptionalButAtLeastOneIsNeeded() {
        BigDecimal ten = new BigDecimal("10.00");
        DailyCashEntryRequest openingOnly = new DailyCashEntryRequest(null, ten, null, null, null, null);
        assertThat(validator.validate(openingOnly)).isEmpty();
        assertThat(openingOnly.hasAnyAmount()).isTrue();

        DailyCashEntryRequest rest = new DailyCashEntryRequest(null, null, ten, ten, null, null);
        assertThat(validator.validate(rest)).isEmpty();
        assertThat(rest.hasAnyAmount()).isTrue();

        DailyCashEntryRequest empty = new DailyCashEntryRequest(null, null, null, null, null, null);
        assertThat(validator.validate(empty)).isEmpty();
        assertThat(empty.hasAnyAmount()).isFalse();
    }

    @Test
    void negativeAmountsAreRejectedExceptOtherAdjustments() {
        BigDecimal minus = new BigDecimal("-1.00");
        DailyCashEntryRequest bad = new DailyCashEntryRequest(null, minus, null, null, minus, null);
        assertThat(validator.validate(bad)).singleElement().satisfies(v ->
            assertThat(v.getPropertyPath().toString()).isEqualTo("openingDrawerCash"));
    }

    @Test
    void acceptsTodayAPastDateOrNoDate() {
        assertThat(validator.validate(requestFor(LocalDate.now()))).isEmpty();
        assertThat(validator.validate(requestFor(LocalDate.now().minusDays(30)))).isEmpty();
        assertThat(validator.validate(requestFor(null))).isEmpty();
    }
}
