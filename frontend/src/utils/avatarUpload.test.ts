import { describe, expect, it } from 'vitest';
import { AVATAR_ERROR_MESSAGE, AVATAR_MAX_BYTES, validateAvatarFile } from './avatarUpload';

const file = (name: string, type: string, size: number) => ({ name, type, size });

describe('validateAvatarFile', () => {
  it('accepts JPG, JPEG, PNG and WebP up to 1 MB', () => {
    expect(validateAvatarFile(file('a.jpg', 'image/jpeg', 1000))).toBeNull();
    expect(validateAvatarFile(file('a.jpeg', 'image/jpeg', 1000))).toBeNull();
    expect(validateAvatarFile(file('a.png', 'image/png', AVATAR_MAX_BYTES))).toBeNull();
    expect(validateAvatarFile(file('a.webp', 'image/webp', 1000))).toBeNull();
  });

  it('rejects an image over 1 MB with the agreed message', () => {
    expect(validateAvatarFile(file('a.jpg', 'image/jpeg', AVATAR_MAX_BYTES + 1))).toBe(AVATAR_ERROR_MESSAGE);
    expect(AVATAR_ERROR_MESSAGE).toBe('Image size must not exceed 1 MB. Supported formats: JPG, PNG, and WebP.');
  });

  it('rejects other formats such as GIF or PDF', () => {
    expect(validateAvatarFile(file('a.gif', 'image/gif', 1000))).toBe(AVATAR_ERROR_MESSAGE);
    expect(validateAvatarFile(file('a.pdf', 'application/pdf', 1000))).toBe(AVATAR_ERROR_MESSAGE);
  });

  it('falls back to the extension when the browser reports no type', () => {
    expect(validateAvatarFile(file('a.png', '', 1000))).toBeNull();
    expect(validateAvatarFile(file('a.gif', '', 1000))).toBe(AVATAR_ERROR_MESSAGE);
  });
});
