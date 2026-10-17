import { content } from '@island/content';
import * as v from 'valibot';

// Field schemas shared by the messages and the HTTP requests. They check shape and size only; the sim checks the
// game rules and the server checks access.

/** A whole number from 0 to max. */
export function whole(max: number) {
  return v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(max));
}

/** Large enough for any count or amount in the game, small enough to stay exact in JSON. */
export const MAX_COUNT = 1_000_000_000;

export const WorldId = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{1,64}$/));

export const Slot = whole(content.rules.slotCount - 1);
