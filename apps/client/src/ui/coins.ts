// Money in words (island-ui, screens.md section 3). The sim keeps cents; the player sees whole coins. Amounts held and
// prices round down, so the counter never shows money the player does not have; a shortfall rounds up, so "Need N more
// coins" never reads 0 while a cent is missing. One fixed locale, not the device's, so every player and every
// screenshot check sees the same text.

const COUNT = new Intl.NumberFormat('en-US');

/** A whole number with thousands separators, the same on every device. */
export function countText(value: number): string {
  return COUNT.format(value);
}

/** Whole coins in cents, rounded down: what a player holds, what something costs. */
export function coinsHeld(cents: number): number {
  return Math.floor(cents / 100);
}

/** `coinsHeld` as text, e.g. "12,480". */
export function coinsText(cents: number): string {
  return countText(coinsHeld(cents));
}

/** Whole coins missing, rounded up. */
export function coinsShort(shortfallCents: number): number {
  return Math.ceil(shortfallCents / 100);
}

/** "Need 1,235 more coins". */
export function needMoreText(shortfallCents: number): string {
  const coins = coinsShort(shortfallCents);
  return `Need ${countText(coins)} more ${coins === 1 ? 'coin' : 'coins'}`;
}
