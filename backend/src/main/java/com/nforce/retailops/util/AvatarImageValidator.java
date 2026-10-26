package com.nforce.retailops.util;

import com.nforce.retailops.exception.InvalidImageUploadException;

import java.util.Base64;

// Server-side check for a profile photo sent as a base64 data URL. The type
// comes from the file's own magic bytes, not the client's claim, so a renamed
// file can't get through. null/blank means "remove the photo" and is allowed.
public final class AvatarImageValidator {

    public static final int MAX_AVATAR_BYTES = 1024 * 1024;
    public static final String INVALID_IMAGE_MESSAGE =
        "Image size must not exceed 1 MB. Supported formats: JPG, PNG, and WebP.";

    private AvatarImageValidator() {
    }

    public static void validate(String avatarUrl) {
        if (avatarUrl == null || avatarUrl.isBlank()) {
            return;
        }
        int comma = avatarUrl.indexOf(',');
        if (!avatarUrl.startsWith("data:image/") || comma < 0 || !avatarUrl.substring(0, comma).endsWith(";base64")) {
            throw new InvalidImageUploadException(INVALID_IMAGE_MESSAGE);
        }
        // Reject on the encoded length first so an oversized payload is never decoded.
        if (avatarUrl.length() - comma - 1 > (MAX_AVATAR_BYTES / 3 + 1) * 4) {
            throw new InvalidImageUploadException(INVALID_IMAGE_MESSAGE);
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(avatarUrl.substring(comma + 1));
        } catch (IllegalArgumentException e) {
            throw new InvalidImageUploadException(INVALID_IMAGE_MESSAGE);
        }
        if (bytes.length > MAX_AVATAR_BYTES || !isJpegPngOrWebp(bytes)) {
            throw new InvalidImageUploadException(INVALID_IMAGE_MESSAGE);
        }
    }

    private static boolean isJpegPngOrWebp(byte[] b) {
        boolean jpeg = b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
        boolean png = b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G';
        boolean webp = b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
            && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
        return jpeg || png || webp;
    }
}
