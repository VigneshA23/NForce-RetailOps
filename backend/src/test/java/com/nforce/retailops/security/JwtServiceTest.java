package com.nforce.retailops.security;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final String SECRET = "test-secret-key-that-is-long-enough-for-hmac-sha-256";

    @Test
    void validTokenIsAcceptedAndClaimsAreReadable() {
        JwtService jwtService = new JwtService(SECRET, 60_000);

        String token = jwtService.generateToken("owner@nforce.test", List.of("OWNER_ADMIN"));

        assertThat(jwtService.isTokenValid(token)).isTrue();
        assertThat(jwtService.extractEmail(token)).isEqualTo("owner@nforce.test");
        assertThat(jwtService.extractTokenId(token)).isNotBlank();
    }

    @Test
    void eachGeneratedTokenGetsAUniqueTokenId() {
        JwtService jwtService = new JwtService(SECRET, 60_000);

        String tokenA = jwtService.generateToken("owner@nforce.test", List.of("OWNER_ADMIN"));
        String tokenB = jwtService.generateToken("owner@nforce.test", List.of("OWNER_ADMIN"));

        assertThat(jwtService.extractTokenId(tokenA)).isNotEqualTo(jwtService.extractTokenId(tokenB));
    }

    @Test
    void tamperedTokenIsRejected() {
        JwtService jwtService = new JwtService(SECRET, 60_000);
        String token = jwtService.generateToken("owner@nforce.test", List.of("OWNER_ADMIN"));

        String tampered = token.substring(0, token.length() - 4) + "abcd";

        assertThat(jwtService.isTokenValid(tampered)).isFalse();
    }

    @Test
    void tokenSignedWithADifferentSecretIsRejected() {
        JwtService issuer = new JwtService(SECRET, 60_000);
        JwtService verifier = new JwtService("a-completely-different-secret-key-of-sufficient-length", 60_000);

        String token = issuer.generateToken("owner@nforce.test", List.of("OWNER_ADMIN"));

        assertThat(verifier.isTokenValid(token)).isFalse();
    }

    @Test
    void expiredTokenIsRejected() throws InterruptedException {
        JwtService jwtService = new JwtService(SECRET, 1);

        String token = jwtService.generateToken("owner@nforce.test", List.of("OWNER_ADMIN"));
        Thread.sleep(25);

        assertThat(jwtService.isTokenValid(token)).isFalse();
    }

    @Test
    void garbageInputIsRejectedRatherThanThrowing() {
        JwtService jwtService = new JwtService(SECRET, 60_000);

        assertThat(jwtService.isTokenValid("not-a-jwt-at-all")).isFalse();
    }
}
