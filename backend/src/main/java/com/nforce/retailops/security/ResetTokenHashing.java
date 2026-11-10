package com.nforce.retailops.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

/**
 * SHA-256 of a password-reset / account-setup token, as stored in
 * {@code password_reset_tokens.token_hash} (RTS-495). Only this hash is ever
 * persisted; the raw token exists only in the emailed link.
 *
 * <p>The input is the token's canonical UUID text (lowercase, hyphenated,
 * which is what {@link UUID#toString()} gives), so a link that differs only in
 * letter case still resolves. It must stay byte-for-byte identical to the V111
 * backfill, {@code encode(sha256(convert_to(token::text, 'UTF8')), 'hex')}, or
 * links issued before that migration would stop working.
 *
 * <p>Plain SHA-256 with no salt or stretching is deliberate: the tokens are
 * server-generated with ~122 bits of randomness and short-lived, so there is
 * nothing for a dictionary or brute-force attack to work with.
 */
public final class ResetTokenHashing {

    private ResetTokenHashing() {}

    /** Lowercase hex SHA-256 of the token's canonical UUID text (64 chars). */
    public static String hash(UUID token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(token.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            // Every JVM is required to provide SHA-256.
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
