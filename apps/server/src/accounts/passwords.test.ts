import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords.ts';

describe('passwords', () => {
  it('are stored as argon2id hashes with the OWASP parameters', async () => {
    const stored = await hashPassword('correct horse');
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(stored).not.toContain('correct horse');
    expect(await verifyPassword(stored, 'correct horse')).toBe(true);
    expect(await verifyPassword(stored, 'correct horse!')).toBe(false);
  });

  it('do not match a hash that cannot be read', async () => {
    expect(await verifyPassword('not a hash', 'anything')).toBe(false);
  });
});
