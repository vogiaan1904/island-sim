import type { Content } from '@island/content';
import {
  applyCommand,
  checkInvariants,
  createWorld,
  residentsOf,
  tickWorld,
  type Command,
  type ReasonCode,
  type WorldState,
} from '@island/sim';
import { BOT_OWNER, decide } from './bot.ts';
import type { CheckInPattern } from './patterns.ts';

// The headless pacing runner (spec 9): one island, a scripted bot, ticks as fast as they go, no server. It records
// the tick each milestone is reached and every command the bot sent, so a run can be replayed as a golden scenario.

export interface Milestone {
  name: string;
  /** Ticks since the claim; the targets are real time at 2.5 s a tick (1,440 ticks = 1 real hour). */
  targetTicks: number;
  /** Sooner than this is reported as early: the stage would feel too short (0: never early). */
  earlyTicks: number;
  target: string;
  reached: (world: WorldState, slot: number) => boolean;
}

export const MILESTONES: readonly Milestone[] = [
  {
    name: 'first residents',
    targetTicks: 1_440,
    earlyTicks: 0,
    target: 'first session (~1 h)',
    reached: (world, slot) => residentsOf(islandAt(world, slot)) > 0,
  },
  {
    name: 'Settlement starts',
    targetTicks: 34_560,
    earlyTicks: 8_640,
    target: 'first day (24 h)',
    reached: (world, slot) => islandAt(world, slot).stage === 'settlement',
  },
];

export interface LoggedCommand {
  afterTick: number;
  command: Command;
}

export interface PacingRun {
  seed: number;
  pattern: string;
  invariants: boolean;
  /** Tick each milestone was reached, or null if the run ended first. */
  reachedAt: Array<number | null>;
  /** Every command the bot sent that the sim accepted, with the tick it followed. */
  log: LoggedCommand[];
  /** Commands the sim refused, by reason: a sensible bot should rarely see these. */
  refused: Partial<Record<ReasonCode, number>>;
  world: WorldState;
}

/** The bot decides every this many ticks while present. */
const DECIDE_EVERY = 10;

export function runPacing(
  seed: number,
  pattern: CheckInPattern,
  content: Content,
  options: { maxTicks?: number; invariants?: boolean } = {},
): PacingRun {
  const maxTicks = options.maxTicks ?? 2 * 34_560;
  const invariants = options.invariants ?? true;
  const world = createWorld(seed, content);
  const log: LoggedCommand[] = [];
  const refused: Partial<Record<ReasonCode, number>> = {};
  const reachedAt: Array<number | null> = MILESTONES.map(() => null);
  let sequence = 1;
  let slot = -1;
  let wasPresent = false;

  const send = (command: Command) => {
    const before = invariants ? structuredClone(world) : null;
    const result = applyCommand(world, content, command, { sequence });
    if (!result.ok) {
      refused[result.reason] = (refused[result.reason] ?? 0) + 1;
      return;
    }
    if (before) assertInvariants(before, world, result.ledger, content);
    log.push({ afterTick: world.tick, command });
    sequence += 1;
  };

  while (world.tick < maxTicks) {
    const present = pattern.present(world.tick);
    if (present && !wasPresent && slot >= 0) send({ type: 'check-in', slot });
    wasPresent = present;
    if (present && world.tick % DECIDE_EVERY === 0) {
      for (const command of decide(world, content)) send(command);
      slot = world.islands.findIndex((i) => i.owner === BOT_OWNER);
    }
    const before = invariants ? structuredClone(world) : null;
    const { ledger } = tickWorld(world, content);
    if (before) assertInvariants(before, world, ledger, content);
    MILESTONES.forEach((milestone, i) => {
      if (reachedAt[i] === null && slot >= 0 && milestone.reached(world, slot)) reachedAt[i] = world.tick;
    });
    if (reachedAt.every((t) => t !== null)) break;
  }
  return { seed, pattern: pattern.name, invariants, reachedAt, log, refused, world };
}

function islandAt(world: WorldState, slot: number) {
  const island = world.islands[slot];
  if (!island) throw new Error(`no island in slot ${slot}`);
  return island;
}

function assertInvariants(before: WorldState, after: WorldState, ledger: Parameters<typeof checkInvariants>[2], content: Content) {
  const violations = checkInvariants(before, after, ledger, content);
  if (violations.length > 0) throw new Error(`invariants broken at tick ${after.tick}: ${JSON.stringify(violations)}`);
}
