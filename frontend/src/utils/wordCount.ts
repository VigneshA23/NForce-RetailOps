// Words in a free-text explanation (runs of non-space characters).
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

// A "could not count" End of Day needs a real explanation, not a token word.
export const MIN_SKIP_REASON_WORDS = 15;
