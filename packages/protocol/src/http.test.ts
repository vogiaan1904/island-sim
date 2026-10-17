import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { InviteCode, IslandName, Password, RegisterRequest, Username } from './http.ts';

const ok = (schema: v.GenericSchema, input: unknown) => v.safeParse(schema, input).success;

describe('account and world fields', () => {
  it('keeps usernames as typed, with ASCII letters, digits, "-" and "_"', () => {
    expect(v.parse(Username, 'Captain_Jo-7')).toBe('Captain_Jo-7');
  });

  it('refuses usernames with spaces, emoji, other letters, or the wrong length', () => {
    for (const name of ['jo jo', 'jo\u{1F600}', 'jörg', 'ab', 'a'.repeat(25)]) expect(ok(Username, name)).toBe(false);
  });

  it('needs passwords of 8 to 128 characters', () => {
    expect(ok(Password, '1234567')).toBe(false);
    expect(ok(Password, '12345678')).toBe(true);
    expect(ok(Password, 'x'.repeat(129))).toBe(false);
  });

  it('reads invite codes in any case, with spaces or dashes', () => {
    expect(v.parse(InviteCode, 'abcd-efgh 23')).toBe('ABCDEFGH23');
    expect(ok(InviteCode, 'ABCDEFGH2')).toBe(false);
  });

  it('refuses island names with characters the sim does not allow', () => {
    expect(ok(IslandName, "Palm Cove's-2")).toBe(true);
    for (const name of ['Palm\u{1F334}', 'x', '<b>Isle</b>']) expect(ok(IslandName, name)).toBe(false);
  });

  it('refuses unknown fields in a request', () => {
    const request = { username: 'jo', password: 'password1', inviteCode: 'ABCDEFGH23', islandName: 'Palm Cove' };
    expect(ok(RegisterRequest, { ...request, username: 'joe' })).toBe(true);
    expect(ok(RegisterRequest, { ...request, username: 'joe', admin: true })).toBe(false);
  });
});
