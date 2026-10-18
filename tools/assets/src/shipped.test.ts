import { describe, expect, it } from 'vitest';
import { problems } from './shipped.ts';

describe('the shipped models and icons', () => {
  it('are exactly the catalog, and every one passes its checks', async () => {
    expect(await problems()).toEqual([]);
  }, 60_000);
});
