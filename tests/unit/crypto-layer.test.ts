import { describe, it, expect } from 'vitest';
import { caesarDecode, caesarEncode } from '../../src/utils/crypto-utils.js';

const CIPHER = 'ZLFGREL-OBK-BCRAF-JVGU-XABJYRQTR';
const PLAIN  = 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE';
const SHIFT  = 13;

describe('caesarDecode', () => {
  // 1. Single letter decode — boundary of the alphabet
  it('decodes A with shift 13 to N', () => {
    expect(caesarDecode('A', SHIFT)).toBe('N');
  });

  it('decodes N with shift 13 to A (ROT-13 is self-inverse)', () => {
    expect(caesarDecode('N', SHIFT)).toBe('A');
  });

  // 2. Wrap-around
  it('wraps correctly: Z decoded by 13 gives M', () => {
    expect(caesarDecode('Z', SHIFT)).toBe('M');
  });

  it('wraps correctly: M decoded by 13 gives Z', () => {
    expect(caesarDecode('M', SHIFT)).toBe('Z');
  });

  // 3. First word
  it('decodes ZLFGREL to MYSTERY', () => {
    expect(caesarDecode('ZLFGREL', SHIFT)).toBe('MYSTERY');
  });

  // 4. Full ciphertext
  it('decodes the full ciphertext to the expected plaintext', () => {
    expect(caesarDecode(CIPHER, SHIFT)).toBe(PLAIN);
  });

  // 5. Non-alpha characters pass through unchanged
  it('passes hyphens through unchanged', () => {
    expect(caesarDecode('---', SHIFT)).toBe('---');
  });

  it('passes digits and symbols through unchanged', () => {
    expect(caesarDecode('ABC-123!', SHIFT)).toBe('NOP-123!');
  });

  // 6. Lowercase input is handled correctly
  it('handles lowercase input', () => {
    expect(caesarDecode('abcdefghijklmnopqrstuvwxyz', SHIFT))
      .toBe('nopqrstuvwxyzabcdefghijklm');
  });

  // 7. Shift of 0 is identity
  it('shift of 0 returns the original string', () => {
    expect(caesarDecode('HELLO', 0)).toBe('HELLO');
  });

  // 9. Oversized positive shifts (> 26)
  it('handles oversized positive shifts correctly', () => {
    expect(caesarDecode('A', 27)).toBe('Z');
    expect(caesarDecode('A', 52)).toBe('A');
    expect(caesarDecode('A', 53)).toBe('Z');
    expect(caesarDecode(CIPHER, SHIFT + 26)).toBe(PLAIN);
  });

  // 10. Negative shifts (< 0)
  it('handles negative shifts correctly', () => {
    expect(caesarDecode('A', -1)).toBe('B');
    expect(caesarDecode('A', -26)).toBe('A');
    expect(caesarDecode('A', -27)).toBe('B');
    expect(caesarDecode('A', -53)).toBe('B');
  });
});

describe('caesarEncode', () => {
  // Encode should be the inverse of decode
  it('encodes MYSTERY to ZLFGREL with shift 13', () => {
    expect(caesarEncode('MYSTERY', SHIFT)).toBe('ZLFGREL');
  });

  it('encodes the full plaintext back to the ciphertext', () => {
    expect(caesarEncode(PLAIN, SHIFT)).toBe(CIPHER);
  });

  it('encode then decode returns the original string', () => {
    const original = 'HELLO-WORLD';
    expect(caesarDecode(caesarEncode(original, SHIFT), SHIFT)).toBe(original);
  });

  it('handles negative and oversized shifts in caesarEncode', () => {
    expect(caesarEncode('Z', 27)).toBe('A');
    expect(caesarEncode('A', -1)).toBe('Z');
    expect(caesarEncode('A', 53)).toBe('B');

    const testStr = 'CLASSIFIED-EVIDENCE-404';
    expect(caesarDecode(caesarEncode(testStr, -15), -15)).toBe(testStr);
    expect(caesarDecode(caesarEncode(testStr, 100), 100)).toBe(testStr);
  });
});
