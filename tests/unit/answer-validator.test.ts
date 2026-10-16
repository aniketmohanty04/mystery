import { describe, it, expect } from 'vitest';
import { validateAnswer, sha256 } from '../../src/core/answer-validator.js';

const LAYER = 'crypto' as const;
const CORRECT = 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE';

describe('validateAnswer', () => {
  // 1. Exact correct answer
  it('returns true for the exact correct answer', async () => {
    expect(await validateAnswer(LAYER, CORRECT)).toBe(true);
  });

  // 2. Leading/trailing whitespace normalised
  it('returns true for the correct answer with surrounding whitespace', async () => {
    expect(await validateAnswer(LAYER, `  ${CORRECT}  `)).toBe(true);
    expect(await validateAnswer(LAYER, `\t${CORRECT}\n`)).toBe(true);
  });

  // 3. Lowercase normalised to uppercase
  it('returns true for the correct answer in lowercase', async () => {
    expect(await validateAnswer(LAYER, CORRECT.toLowerCase())).toBe(true);
  });

  // 4. Mixed case normalised
  it('returns true for the correct answer in mixed case', async () => {
    expect(await validateAnswer(LAYER, 'Mystery-Box-Opens-With-Knowledge')).toBe(true);
  });

  // 5. Wrong answer
  it('returns false for an incorrect answer', async () => {
    expect(await validateAnswer(LAYER, 'WRONG-ANSWER')).toBe(false);
  });

  // 6. Empty string
  it('returns false for an empty string', async () => {
    expect(await validateAnswer(LAYER, '')).toBe(false);
  });

  // 7. Whitespace only
  it('returns false for a whitespace-only string', async () => {
    expect(await validateAnswer(LAYER, '   ')).toBe(false);
    expect(await validateAnswer(LAYER, '\t\n')).toBe(false);
  });

  // 8. Layer 2 (dom-inspect) correct answer
  it('validates Layer 2 (dom-inspect) answer "VERIFIED" correctly with case/whitespace normalization', async () => {
    expect(await validateAnswer('dom-inspect', 'VERIFIED')).toBe(true);
    expect(await validateAnswer('dom-inspect', 'verified')).toBe(true);
    expect(await validateAnswer('dom-inspect', '  Verified  ')).toBe(true);
    expect(await validateAnswer('dom-inspect', 'WRONG')).toBe(false);
  });

  // 9. Unknown layer ID returns false without error
  it('returns false for a layer with no registered hash', async () => {
    expect(await validateAnswer('cross-tab', CORRECT)).toBe(false);
  });
});

describe('sha256', () => {
  it('produces a 64-character hex string', async () => {
    const result = await sha256('test');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input produces same output', async () => {
    const a = await sha256(CORRECT);
    const b = await sha256(CORRECT);
    expect(a).toBe(b);
  });

  it('produces different output for different inputs', async () => {
    const a = await sha256(CORRECT);
    const b = await sha256('DIFFERENT');
    expect(a).not.toBe(b);
  });
});
