import { IslandName, InviteCode, Password, Username } from '@island/protocol';
import * as v from 'valibot';

// The rules of the sign-up and world fields, checked with the protocol's own schemas so the screen refuses exactly
// what the server would, and in the player's words. Each check returns null when the text is fine.

/** Shown next to the field before the player types (island-ui, screens.md section 10). */
export const RULE_TEXT = {
  username: 'Letters, digits, - and _ only. Capitals show as you type them, but Lena and lena are the same name.',
  password: 'At least 8 characters.',
  inviteCode: 'Ten letters and digits from a friend. Capitals and dashes do not matter.',
  islandName: "2 to 24 characters: letters, digits, spaces, - and '.",
} as const;

export function checkUsername(text: string): string | null {
  if (v.safeParse(Username, text).success) return null;
  if (text.length < 3 || text.length > 24) return 'A username has 3 to 24 characters.';
  return 'Use letters, digits, - and _ only, with no spaces.';
}

export function checkPassword(text: string): string | null {
  return v.safeParse(Password, text).success ? null : 'A password has at least 8 characters.';
}

export function checkIslandName(text: string): string | null {
  if (v.safeParse(IslandName, text).success) return null;
  if (text.length < 2 || text.length > 24) return 'An island name has 2 to 24 characters.';
  return "Use letters, digits, spaces, - and ' only.";
}

export function checkInviteCode(text: string): string | null {
  return v.safeParse(InviteCode, text).success ? null : 'An invite code has 10 letters and digits. Check it with your friend.';
}
