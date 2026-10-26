package com.nforce.retailops.util;

import com.nforce.retailops.exception.InvalidImageUploadException;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AvatarImageValidatorTest {

    private static final byte[] JPEG_HEAD = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0};
    private static final byte[] PNG_HEAD = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] GIF_HEAD = {'G', 'I', 'F', '8', '9', 'a', 0, 0};

    private static String dataUrl(String mime, byte[] head, int totalBytes) {
        byte[] bytes = new byte[Math.max(totalBytes, head.length)];
        System.arraycopy(head, 0, bytes, 0, head.length);
        return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
    }

    @Test
    void nullAndBlankMeanRemoveAndAreAllowed() {
        assertDoesNotThrow(() -> AvatarImageValidator.validate(null));
        assertDoesNotThrow(() -> AvatarImageValidator.validate(""));
    }

    @Test
    void acceptsSmallJpegAndPng() {
        assertDoesNotThrow(() -> AvatarImageValidator.validate(dataUrl("image/jpeg", JPEG_HEAD, 2_000)));
        assertDoesNotThrow(() -> AvatarImageValidator.validate(dataUrl("image/png", PNG_HEAD, 2_000)));
    }

    @Test
    void acceptsAnImageExactlyAtTheOneMegabyteLimit() {
        assertDoesNotThrow(() -> AvatarImageValidator.validate(
            dataUrl("image/jpeg", JPEG_HEAD, AvatarImageValidator.MAX_AVATAR_BYTES)));
    }

    @Test
    void rejectsAnImageOverOneMegabyteWithTheAgreedMessage() {
        InvalidImageUploadException ex = assertThrows(InvalidImageUploadException.class,
            () -> AvatarImageValidator.validate(dataUrl("image/jpeg", JPEG_HEAD, AvatarImageValidator.MAX_AVATAR_BYTES + 1)));
        assertEquals("Image size must not exceed 1 MB. Supported formats: JPG, PNG, and WebP.", ex.getMessage());
    }

    @Test
    void rejectsAFormatThatIsNotJpegPngOrWebpEvenIfLabelledAsAnImage() {
        assertThrows(InvalidImageUploadException.class,
            () -> AvatarImageValidator.validate(dataUrl("image/png", GIF_HEAD, 2_000)));
    }

    @Test
    void rejectsNonDataUrlsAndBrokenBase64() {
        assertThrows(InvalidImageUploadException.class, () -> AvatarImageValidator.validate("https://example.com/a.png"));
        assertThrows(InvalidImageUploadException.class, () -> AvatarImageValidator.validate("data:text/html;base64,PGI+"));
        assertThrows(InvalidImageUploadException.class, () -> AvatarImageValidator.validate("data:image/png;base64,!!!not-base64!!!"));
    }
}
