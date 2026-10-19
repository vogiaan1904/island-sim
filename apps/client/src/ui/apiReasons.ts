import type { ClientApiReason } from '../connection/api.ts';
import { RULE_TEXT } from './fieldRules.ts';

// Why the server refused an /api request, in the player's words (island-ui text tone: kind, specific, with the way
// out). The one place these lines live; the sign-up and world screens (ticket 06) add theirs here.

const TEXT: Partial<Record<ClientApiReason, string>> = {
  'bad-credentials': "That username and password don't match. Check them and try again.",
  'too-many-attempts': 'Too many tries for now. Wait a few minutes, then try again.',
  unreachable: "The island can't be reached right now. Check your connection and try again.",
  'shutting-down': 'The island is taking a short break. Try again in a minute.',
  'username-taken': 'Someone already uses that username. Try another one.',
  'bad-invite-code': "That invite code doesn't work. Check it with your friend.",
  'world-full': 'This world is full. Ask your friend if they have room somewhere else.',
  'world-resting': 'This world is resting, try again soon.',
  'already-has-island': 'You already have an island in that world.',
  'bad-island-name': `That island name doesn't work. ${RULE_TEXT.islandName}`,
  'bad-request': "Something in the form doesn't look right. Check the names and try again.",
  'not-signed-in': 'You were signed out. Log in again to continue.',
  'no-such-world': "That world can't be found any more.",
  'not-the-creator': 'Only the person who made the world can change its invite code.',
};

export function apiReasonText(reason: ClientApiReason): string {
  return TEXT[reason] ?? 'Something went wrong on our side. Try again in a moment.';
}
