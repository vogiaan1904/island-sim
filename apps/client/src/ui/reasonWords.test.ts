import { describe, expect, it } from 'vitest';
import { findEmoji } from '../test/no-emoji.ts';
import { REASONS, reasonWords } from './reasonWords.ts';

describe('refusal reasons in words', () => {
  it('has plain words for every reason code, never the raw code, and no emoji', () => {
    expect(REASONS.length).toBeGreaterThanOrEqual(35);
    for (const reason of REASONS) {
      const words = reasonWords(reason, 0);
      expect(words, reason).not.toBe('');
      expect(words, reason).not.toContain(reason);
      expect(findEmoji(words), reason).toBeNull();
    }
  });

  it('says what the Mainland floor price means, as the spec words it', () => {
    expect(reasonWords('price-below-floor', 0)).toBe('The Mainland pays too little right now');
  });

  it('turns a coin shortfall into whole coins, rounded up so the player can afford it', () => {
    expect(reasonWords('not-enough-coins', 20_000)).toBe('Need 200 more coins');
    expect(reasonWords('not-enough-coins', 150)).toBe('Need 2 more coins');
    expect(reasonWords('not-enough-coins', 1)).toBe('Need 1 more coin');
  });

  it('says the ferry has no more seats', () => {
    expect(reasonWords('not-enough-seats', 0)).toBe("The ferry doesn't have that many seats");
  });
});
