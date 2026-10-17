// When the bot is at its island (spec 2.1 sets real-time targets, so pacing depends on how often a player looks
// in). The first session is an hour of real time; later visits follow the pattern. These are documented
// assumptions, printed in every report.

export interface CheckInPattern {
  name: string;
  /** Whether the player is at the island during this tick. */
  present(tick: number): boolean;
}

const HOUR = 1_440;
const VISIT = 240;

/** Present for the first hour, then for VISIT ticks at every multiple of `everyHours` real hours. */
function visits(name: string, everyHours: number): CheckInPattern {
  const period = everyHours * HOUR;
  return { name, present: (tick) => tick < HOUR || (tick >= period && tick % period < VISIT) };
}

/** A first hour, then 10 minutes every 8 hours: three short looks a day. */
export const CASUAL = visits('first-hour+10min-every-8h-v1', 8);
/** A first hour, then 10 minutes every 2 hours. */
export const KEEN = visits('first-hour+10min-every-2h-v1', 2);

export const PATTERNS: readonly CheckInPattern[] = [CASUAL, KEEN];
