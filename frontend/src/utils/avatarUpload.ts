export const AVATAR_MAX_BYTES = 1024 * 1024;
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp';
export const AVATAR_ERROR_MESSAGE = 'Image size must not exceed 1 MB. Supported formats: JPG, PNG, and WebP.';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

// Returns the error to show, or null when the file may be uploaded. Checks the
// browser-reported type and the extension (some systems report no type); the
// server re-checks the real bytes.
export function validateAvatarFile(file: Pick<File, 'size' | 'type' | 'name'>): string | null {
  if (file.size > AVATAR_MAX_BYTES) return AVATAR_ERROR_MESSAGE;
  const typeOk = file.type ? ALLOWED_TYPES.has(file.type) : ALLOWED_EXTENSIONS.test(file.name);
  return typeOk ? null : AVATAR_ERROR_MESSAGE;
}
