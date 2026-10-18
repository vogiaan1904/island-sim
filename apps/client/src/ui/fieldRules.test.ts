import { describe, expect, it } from 'vitest';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { RULE_TEXT, checkInviteCode, checkIslandName, checkPassword, checkUsername } from './fieldRules.ts';

describe('the field rules shown to the player', () => {
  it('accepts names and codes the server accepts, whatever the letter case or spacing of a code', () => {
    expect(checkUsername('Lena_2-b')).toBeNull();
    expect(checkPassword('sea-breeze-1')).toBeNull();
    expect(checkIslandName("Palm Cove's-Edge")).toBeNull();
    expect(checkInviteCode(' abcde-fghij ')).toBeNull();
  });

  it('says in plain words what is wrong with a username', () => {
    expect(checkUsername('ab')).toBe('A username has 3 to 24 characters.');
    expect(checkUsername('a'.repeat(25))).toBe('A username has 3 to 24 characters.');
    expect(checkUsername('lena!')).toBe('Use letters, digits, - and _ only, with no spaces.');
  });

  it('says what is wrong with a password, an island name and an invite code', () => {
    expect(checkPassword('short')).toBe('A password has at least 8 characters.');
    expect(checkIslandName('A')).toBe('An island name has 2 to 24 characters.');
    expect(checkIslandName('Cove <3')).toBe("Use letters, digits, spaces, - and ' only.");
    expect(checkInviteCode('ABC')).toBe('An invite code has 10 letters and digits. Check it with your friend.');
  });

  it('has hints and messages free of emoji and emoji-like symbols', () => {
    for (const text of Object.values(RULE_TEXT)) expectNoEmoji(text);
    for (const text of [checkUsername('a'), checkUsername('a b c'), checkPassword('x'), checkIslandName('<'), checkInviteCode('x')]) expectNoEmoji(text ?? '');
  });
});
