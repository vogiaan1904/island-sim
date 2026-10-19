import type { Reason } from '@island/protocol';
import { needMoreText } from './coins.ts';

// Why a command was refused, in the player's words (island-ui, text-tone.md "Rejections and errors"). The sim and the
// server hold codes only. This is the one place the lines live; a table typed over every code, so a new code fails
// the build until it has words. Never show the raw code.

const WORDS: Record<Reason, string> = {
  // The sim's reasons.
  'bad-input': "That didn't look right, try again",
  'no-such-island': "That island isn't here",
  'island-not-claimed': "That island isn't claimed yet",
  'world-full': 'This world is full',
  'already-has-island': 'You already have an island here',
  'bad-island-name': "That island name doesn't work",
  'unknown-building': "We don't know that building",
  'not-player-buildable': "That one can't be built by hand",
  'not-available-yet': 'Not available yet',
  'out-of-bounds': 'That spot is off the island',
  'bad-terrain': "It can't go on that ground",
  'tile-occupied': 'Something is already there',
  'no-road-access': 'It needs road access',
  'not-enough-coins': 'Need more coins',
  'too-many-tiles': "That's too many road tiles at once",
  'nothing-to-build': 'There is nothing new to build there',
  'not-enough-seats': "The ferry doesn't have that many seats",
  'no-such-building': 'That building is gone',
  'unknown-good': "We don't know that good",
  'not-enough-goods': 'Not enough in storage',
  'price-below-floor': 'The Mainland pays too little right now',
  'landmark-locked': "That landmark isn't unlocked yet",
  'already-built': 'You already have one',
  'not-a-landmark-site': 'Only a landmark site needs materials',
  'nothing-missing': 'Nothing is missing',
  'no-reward': 'There is no reward to collect',
  // The server's reasons.
  'bad-message': 'Something went wrong, try again',
  'bad-command': 'Something went wrong, try again',
  'rate-limited': 'Slow down a little',
  'no-island-open': 'No island is open',
  'not-your-island': 'This island belongs to a friend',
  'not-a-member': "You aren't part of this world",
  'world-paused': 'This island is resting, back soon',
  'world-catching-up': 'The island is catching up, one moment',
  'server-error': 'Something went wrong on our side, try again',
};

/** Every reason a command can be refused with. */
export const REASONS = Object.keys(WORDS) as Reason[];

/** What a command sent while nothing could carry it (reconnecting, a resting world) tells the player. */
export const NOT_SENT_WORDS = "That can't be done just now, try again in a moment";

/** The refusal in words. A coin shortfall (cents) reads "Need N more coins" in whole coins, rounded up. */
export function reasonWords(reason: Reason, shortfallCents: number): string {
  if (reason === 'not-enough-coins' && shortfallCents > 0) {
    return needMoreText(shortfallCents);
  }
  return WORDS[reason];
}
