// Seeded random numbers: mulberry32, one 32-bit state, one stream per world.
// The state lives in the world state so snapshots carry it and replay continues the same stream.

export interface RngHolder {
  rng: number;
}

/** One step of mulberry32: returns a uint32 and the next state. */
export function rngNext(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, state: next };
}

/** Draws a whole number in [0, bound) and advances the holder's state. */
export function draw(holder: RngHolder, bound: number): number {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 0x100000000) {
    throw new Error(`draw: bound must be a whole number from 1 to 2^32, got ${String(bound)}`);
  }
  const step = rngNext(holder.rng);
  holder.rng = step.state;
  return step.value % bound;
}
