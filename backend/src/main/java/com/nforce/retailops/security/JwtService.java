package com.nforce.retailops.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Component
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    // The placeholder application.yml falls back to when JWT_SECRET is unset.
    static final String DEFAULT_SECRET = "change-me-in-env";
    // HS256 needs a 256-bit key.
    static final int MIN_SECRET_BYTES = 32;

    public JwtService(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.expiration-ms}") long expirationMs
    ) {
        requireStrongSecret(secret);
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    // Fail at startup rather than run with a signing key anyone can guess: a
    // known secret lets an attacker forge a token for any subject.
    private static void requireStrongSecret(String secret) {
        if (secret == null || secret.isBlank() || DEFAULT_SECRET.equals(secret)) {
            throw new IllegalStateException(
                "jwt.secret is unset or still the default placeholder. Set the JWT_SECRET "
                    + "environment variable to a random value of at least " + MIN_SECRET_BYTES + " characters.");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                "jwt.secret is too short. JWT_SECRET must be at least " + MIN_SECRET_BYTES + " characters.");
        }
    }

    public String generateToken(String email, List<String> roles) {
        return generateToken(email, roles, expirationMs);
    }

    // Lets a caller mint a token whose own expiry matches a specific session
    // policy (e.g. the 30-minute standard / 4-hour Remember Me lifetime),
    // rather than always using the single default. This keeps the JWT itself
    // honest about how long it should live -- the server-side session record
    // (ActiveSession.expiresAt) remains the actual enforced boundary either way.
    public String generateToken(String email, List<String> roles, long tokenExpirationMs) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + tokenExpirationMs);

        return Jwts.builder()
            .subject(email)
            .id(UUID.randomUUID().toString())
            .claim("roles", roles)
            .issuedAt(now)
            .expiration(expiry)
            .signWith(key)
            .compact();
    }

    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public String extractTokenId(String token) {
        return parseClaims(token).getId();
    }

    public boolean isTokenValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
