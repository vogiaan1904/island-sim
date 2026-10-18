import type { ClientApiReason } from '../connection/api.ts';

// Why the server refused an /api request, in the player's words (island-ui text tone: kind, specific, with the way
// out). The one place these lines live; the sign-up and world screens (ticket 06) add theirs here.

const TEXT: Partial<Record<ClientApiReason, string>> = {
  'bad-credentials': "That username and password don't match. Check them and try again.",
  'too-many-attempts': 'Too many tries for now. Wait a few minutes, then try again.',
  unreachable: "The island can't be reached right now. Check your connection and try again.",
  'shutting-down': 'The island is taking a short break. Try again in a minute.',
};

export function apiReasonText(reason: ClientApiReason): string {
  return TEXT[reason] ?? 'Something went wrong on our side. Try again in a moment.';
}
