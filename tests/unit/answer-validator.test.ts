import { describe, it, expect, vi, afterEach } from 'vitest';
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

  // Step 4 normalization requirements:
  describe('normalization requirements (separators and unicode lookalike rejection)', () => {
    it('accepts spaces instead of hyphens', async () => {
      expect(await validateAnswer(LAYER, 'MYSTERY BOX OPENS WITH KNOWLEDGE')).toBe(true);
      expect(await validateAnswer(LAYER, 'mystery box opens with knowledge')).toBe(true);
    });

    it('accepts underscores as separators', async () => {
      expect(await validateAnswer(LAYER, 'MYSTERY_BOX_OPENS_WITH_KNOWLEDGE')).toBe(true);
    });

    it('accepts en dash (U+2013) and em dash (U+2014)', async () => {
      expect(await validateAnswer(LAYER, 'MYSTERY\u2013BOX\u2013OPENS\u2013WITH\u2013KNOWLEDGE')).toBe(true);
      expect(await validateAnswer(LAYER, 'MYSTERY\u2014BOX\u2014OPENS\u2014WITH\u2014KNOWLEDGE')).toBe(true);
    });

    it('accepts hyphen U+2010 and non-breaking hyphen U+2011', async () => {
      expect(await validateAnswer(LAYER, 'MYSTERY\u2010BOX\u2010OPENS\u2010WITH\u2010KNOWLEDGE')).toBe(true);
      expect(await validateAnswer(LAYER, 'MYSTERY\u2011BOX\u2011OPENS\u2011WITH\u2011KNOWLEDGE')).toBe(true);
    });

    it('accepts repeated and mixed separators', async () => {
      expect(await validateAnswer(LAYER, 'MYSTERY--BOX   OPENS__WITH-\u2013KNOWLEDGE')).toBe(true);
    });

    it('accepts leading and trailing separators and whitespace', async () => {
      expect(await validateAnswer(LAYER, '  --__MYSTERY-BOX-OPENS-WITH-KNOWLEDGE__--  ')).toBe(true);
    });

    it('rejects Turkish dotless ı', async () => {
      expect(await validateAnswer(LAYER, 'mystery-box-opens-wıth-knowledge')).toBe(false);
    });

    it('rejects long ſ (Latin small letter sharp s / long s)', async () => {
      expect(await validateAnswer(LAYER, 'myſtery-box-opens-with-knowledge')).toBe(false);
    });

    it('rejects Kelvin sign (\u212A)', async () => {
      expect(await validateAnswer(LAYER, 'MYSTERY-BOX-OPENS-WITH-\u212ANOWLEDGE')).toBe(false);
    });

    it('rejects fullwidth letters', async () => {
      expect(await validateAnswer(LAYER, 'ＭＹＳＴＥＲＹ-BOX-OPENS-WITH-KNOWLEDGE')).toBe(false);
    });

    it('rejects extra or missing words', async () => {
      expect(await validateAnswer(LAYER, 'MYSTERY-BOX-OPENS-WITH')).toBe(false);
      expect(await validateAnswer(LAYER, 'THE-MYSTERY-BOX-OPENS-WITH-KNOWLEDGE')).toBe(false);
    });

    it('rejects empty and separators-only input', async () => {
      expect(await validateAnswer(LAYER, '')).toBe(false);
      expect(await validateAnswer(LAYER, '---___   --')).toBe(false);
    });

    it('Layer 2 accepts "verified" and " VeRiFiEd ", rejects "verıfied"', async () => {
      expect(await validateAnswer('dom-inspect', 'verified')).toBe(true);
      expect(await validateAnswer('dom-inspect', ' VeRiFiEd ')).toBe(true);
      expect(await validateAnswer('dom-inspect', 'verıfied')).toBe(false);
    });

    it('Layer 3 accepts "SIGNAL-SYNCHRONIZED" and " signal_synchronized "', async () => {
      expect(await validateAnswer('cross-tab', 'SIGNAL-SYNCHRONIZED')).toBe(true);
      expect(await validateAnswer('cross-tab', ' signal_synchronized ')).toBe(true);
      expect(await validateAnswer('cross-tab', 'WRONG-SIGNAL')).toBe(false);
    });

    it('Layer 4 accepts "EV-302-EV-814-EV-409-EV-127-EV-955" in varied casing and separators', async () => {
      expect(await validateAnswer('temporal', 'EV-302-EV-814-EV-409-EV-127-EV-955')).toBe(true);
      expect(await validateAnswer('temporal', 'ev-302-ev-814-ev-409-ev-127-ev-955')).toBe(true);
      expect(await validateAnswer('temporal', ' EV-302 EV-814 EV-409 EV-127 EV-955 ')).toBe(true);
      expect(await validateAnswer('temporal', 'ev-302_ev-814_ev-409_ev-127_ev-955')).toBe(true);
      // Rejects incorrect order
      expect(await validateAnswer('temporal', 'EV-814-EV-302-EV-409-EV-955-EV-127')).toBe(false);
      expect(await validateAnswer('temporal', 'WRONG-CHRONOLOGY')).toBe(false);
    });

    it('validates Layer 5 (final-reveal) answer "KNOWLEDGE-VERIFIED-SYNCHRONIZED-EV-955"', async () => {
      expect(await validateAnswer('final-reveal', 'KNOWLEDGE-VERIFIED-SYNCHRONIZED-EV-955')).toBe(true);
      expect(await validateAnswer('final-reveal', 'knowledge verified synchronized ev-955')).toBe(true);
      expect(await validateAnswer('final-reveal', '  knowledge_verified_synchronized_ev-955  ')).toBe(true);
      expect(await validateAnswer('final-reveal', 'WRONG-VAULT-KEY')).toBe(false);
    });
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


describe('sha256 without Web Crypto (non-secure context)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws a descriptive error when crypto.subtle is unavailable', async () => {
    vi.stubGlobal('crypto', {});
    await expect(sha256('test')).rejects.toThrow(/HTTPS or localhost/);
  });

  it('validateAnswer surfaces the failure instead of silently returning false', async () => {
    vi.stubGlobal('crypto', undefined);
    await expect(validateAnswer(LAYER, CORRECT)).rejects.toThrow(/crypto\.subtle/);
  });
});
