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
 * Answers are normalized (trimmed, uppercased) before hashing.
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
 */
export async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Normalize an answer before validation:
 * - Strip leading/trailing whitespace
 * - Convert to uppercase
 * Empty strings (after trim) are rejected immediately.
 */
function normalize(raw: string): string {
  return raw.trim().toUpperCase();
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
  const normalized = normalize(rawAnswer);
  if (!normalized) return false;

  const expectedHash = LAYER_HASHES[layerId];
  if (!expectedHash) return false;

  const actualHash = await sha256(normalized);
  return actualHash === expectedHash;
}
