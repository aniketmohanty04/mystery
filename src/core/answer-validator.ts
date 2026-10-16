import type { LayerId } from './types.js';

/**
 * SECURITY NOTE — please read before modifying.
 *
 * This module validates puzzle answers client-side using SHA-256 hashes
 * embedded in the compiled JavaScript bundle.
 *
 * What this provides:
 *   ✓ The plaintext answers are not directly visible in source.
 *   ✓ Casual inspection of the page HTML or network tab reveals nothing.
 *
 * What this does NOT provide:
 *   ✗ No protection against a user who reads the minified bundle and
 *     identifies the hash constants.
 *   ✗ No protection against direct sessionStorage manipulation.
 *   ✗ SHA-256 hashes of short, guessable answers can be reversed via
 *     rainbow tables or brute force.
 *
 * This is intentional and acceptable for a codeathon demonstration.
 * Do not use this pattern in a production puzzle where answer integrity
 * is a meaningful security requirement.
 */

/**
 * SHA-256 hex digests of each layer's correct answer.
 * Answers are canonicalized by normalizeAnswer() before hashing.
 * Only layers with implemented puzzles have entries here.
 *
 * Layer 1 answer: MYSTERY-BOX-OPENS-WITH-KNOWLEDGE
 * Layer 2 answer: VERIFIED
 */
const LAYER_HASHES: Partial<Record<LayerId, string>> = {
  'crypto': 'df8a3f2768f8e539e624cc6b2799af0c091f6c5fafee0b5089732a04d6cbcf23',
  'dom-inspect': '8766e017df3d4497840e53fa7594a954fd6e68b1b0bf7528045514bc774ea499',
};

/**
 * Compute the SHA-256 hex digest of a UTF-8 string.
 * Uses the browser/Node native Web Crypto API — no dependencies.
 *
 * crypto.subtle only exists in secure contexts (HTTPS or localhost). Throws a
 * descriptive error otherwise; StateMachine.solve() turns that into 'error'.
 */
export async function sha256(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto (crypto.subtle) is unavailable. Serve the app over HTTPS or localhost.');
  }
  const encoded = new TextEncoder().encode(text);
  const buffer = await subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const SEPARATOR_REGEX = /[\s_\-\u2010\u2011\u2013\u2014]+/g;
const ASCII_ALPHANUMERIC_REGEX = /^[A-Za-z0-9-]+$/;

/**
 * Normalize an answer before validation.
 *
 * Normalization pipeline (applied in strict order):
 * 1. trim() whitespace.
 * 2. Collapse runs of permitted separators to a single '-':
 *    whitespace (including NBSP), underscore, hyphen-minus, U+2010,
 *    non-breaking hyphen U+2011, en dash (U+2013), em dash (U+2014).
 *    Strip leading/trailing '-'.
 * 3. Reject if any remaining character is outside [A-Za-z0-9-].
 *    NOTE: NFKC normalization is deliberately NOT applied to letters here
 *    to prevent unicode lookalikes (such as dotless 'ı', long 'ſ', Kelvin sign,
 *    or fullwidth letters) from folding into ASCII before validation.
 * 4. toUpperCase().
 *
 * Returns null if the input is empty, separator-only, or contains non-ASCII characters.
 */
export function normalizeAnswer(raw: string): string | null {
  // 1. Trim
  let s = raw.trim();
  if (!s) return null;

  // 2. Collapse permitted separators to '-' and strip leading/trailing '-'
  s = s.replace(SEPARATOR_REGEX, '-').replace(/^-+|-+$/g, '');
  if (!s) return null;

  // 3. Reject any character outside [A-Za-z0-9-] before case folding
  if (!ASCII_ALPHANUMERIC_REGEX.test(s)) {
    return null;
  }

  // 4. toUpperCase()
  return s.toUpperCase();
}

/**
 * Validate a user-submitted answer for a given layer.
 * Returns true only if the normalized answer's SHA-256 hash matches
 * the expected hash for that layer.
 */
export async function validateAnswer(
  layerId: LayerId,
  rawAnswer: string,
): Promise<boolean> {
  const normalized = normalizeAnswer(rawAnswer);
  if (!normalized) return false;

  const expectedHash = LAYER_HASHES[layerId];
  if (!expectedHash) return false;

  const actualHash = await sha256(normalized);
  return actualHash === expectedHash;
}

