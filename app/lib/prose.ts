/**
 * Turning atlas fields into readable prose.
 *
 * The atlas stores fragments, not sentences — `dailyFact` is "beats about 100,000
 * times", `location` is "behind the sternum, slightly left". They were authored to
 * sit in a labelled row, where no full stop is wanted. Anywhere they are read as
 * prose, or read *aloud*, the punctuation has to be put back, and a text-to-speech
 * voice runs two of them together without it.
 *
 * Shared because both the lesson and the quiz need exactly this, and two copies
 * drift.
 */

/** Sentence-cases a fragment so it can stand as a sentence of its own. */
export function sentence(text: string) {
  const trimmed = text.trim();
  const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

/** Lower-cases a fragment so it can be dropped into the middle of a sentence. */
export function clause(text: string) {
  const trimmed = text.trim().replace(/[.]$/, "");
  // Only the first word, and only if it is not a proper noun or an acronym —
  // "Behind the sternum" should soften, "L of air" and "Vitamin D" should not.
  return /^[A-Z][a-z]/.test(trimmed) ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1) : trimmed;
}
