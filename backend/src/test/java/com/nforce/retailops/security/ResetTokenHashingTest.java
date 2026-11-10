package com.nforce.retailops.security;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// The hash format is a contract with the V111 backfill SQL
// (encode(sha256(convert_to(token::text, 'UTF8')), 'hex')): if it changes,
// links issued before that migration stop working.
class ResetTokenHashingTest {

    private static final UUID TOKEN = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");

    @Test
    void isLowercaseHexSha256OfTheCanonicalUuidText() {
        // sha256("123e4567-e89b-12d3-a456-426614174000"), computed independently.
        assertThat(ResetTokenHashing.hash(TOKEN))
            .isEqualTo("986c0dc956dc822b5d8f698661b9eb1ef880786ff9043c16744d2a420e99e9bb");
    }

    @Test
    void ignoresLetterCaseOfTheIncomingToken() {
        UUID upper = UUID.fromString("123E4567-E89B-12D3-A456-426614174000");
        assertThat(ResetTokenHashing.hash(upper)).isEqualTo(ResetTokenHashing.hash(TOKEN));
    }

    @Test
    void differentTokensHashDifferently() {
        assertThat(ResetTokenHashing.hash(UUID.randomUUID()))
            .isNotEqualTo(ResetTokenHashing.hash(UUID.randomUUID()))
            .hasSize(64)
            .matches("[0-9a-f]{64}");
    }
}
