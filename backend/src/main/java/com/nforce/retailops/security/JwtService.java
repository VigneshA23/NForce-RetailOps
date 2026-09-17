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

    public JwtService(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.expiration-ms}") long expirationMs
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
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
