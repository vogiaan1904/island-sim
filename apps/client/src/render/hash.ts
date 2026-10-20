// Stateless hashes of stable ids (island-3d-client rule 4): looks, timings and the landscape never use a random
// generator, so the same island at the same game time always looks the same.

/** A stateless 32-bit hash of whole numbers (stable ids). */
export function hash32(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    h = Math.imul(h ^ (part | 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}

/** A share in [0, 1) from a hash. */
export const unit = (h: number) => (h % 10_000) / 10_000;
