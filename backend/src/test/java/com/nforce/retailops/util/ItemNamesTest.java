package com.nforce.retailops.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ItemNamesTest {

    @Test
    void normalizeKeepsCaseAndSingleSpacesBetweenWords() {
        assertThat(ItemNames.normalize("  Vanilla   Syrup ")).isEqualTo("Vanilla Syrup");
        assertThat(ItemNames.normalize("Vanilla \tSyrup")).isEqualTo("Vanilla Syrup");
        assertThat(ItemNames.normalize(null)).isNull();
    }

    // RTS-583
    @Test
    void duplicateKeyIgnoresCaseAndEveryWhitespaceCharacter() {
        assertThat(ItemNames.duplicateKey("Vanilla Syrup")).isEqualTo("vanillasyrup");
        assertThat(ItemNames.duplicateKey("VanillaSyrup")).isEqualTo("vanillasyrup");
        assertThat(ItemNames.duplicateKey(" vanillasyrup ")).isEqualTo("vanillasyrup");
        assertThat(ItemNames.duplicateKey("VANILLA \tSYRUP")).isEqualTo("vanillasyrup");
        assertThat(ItemNames.duplicateKey(null)).isNull();
    }

    @Test
    void duplicateKeyStillTellsDifferentNamesApart() {
        assertThat(ItemNames.duplicateKey("Vanilla Syrup")).isNotEqualTo(ItemNames.duplicateKey("Vanilla Syrups"));
    }
}
