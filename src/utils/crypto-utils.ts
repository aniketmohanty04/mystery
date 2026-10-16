/**
 * Caesar cipher helpers.
 * Used by both the crypto layer (UI) and unit tests (pure logic).
 */

/**
 * Normalize any integer shift (positive, negative, oversized) into the range [0, 25].
 */
function normalizeShift(shift: number): number {
  return ((shift % 26) + 26) % 26;
}

/**
 * Decode a Caesar-ciphered string by shifting each letter back by `shift`.
 * Non-alphabetic characters pass through unchanged.
 * Handles both uppercase and lowercase input, as well as negative and oversized shifts.
 *
 * @param text  The encoded string.
 * @param shift The number of positions each letter was shifted forward.
 */
export function caesarDecode(text: string, shift: number): string {
  const s = normalizeShift(shift);
  return text
    .split('')
    .map(char => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        // Uppercase A–Z
        return String.fromCharCode(((code - 65 - s + 26) % 26) + 65);
      }
      if (code >= 97 && code <= 122) {
        // Lowercase a–z
        return String.fromCharCode(((code - 97 - s + 26) % 26) + 97);
      }
      return char;
    })
    .join('');
}

/**
 * Encode a string with a Caesar cipher by shifting each letter forward by `shift`.
 * Supports negative and oversized shifts.
 */
export function caesarEncode(text: string, shift: number): string {
  const s = normalizeShift(shift);
  return caesarDecode(text, 26 - s);
}
