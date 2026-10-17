import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { contentHash } from './version.ts';

describe('contentHash', () => {
  it('is the same for equal content and differs when one number changes', () => {
    expect(contentHash(content)).toMatch(/^[0-9a-f]{14}$/);
    expect(contentHash(structuredClone(content))).toBe(contentHash(content));
    expect(contentHash({ ...content, rules: { ...content.rules, ferrySeats: 13 } })).not.toBe(contentHash(content));
  });
});
