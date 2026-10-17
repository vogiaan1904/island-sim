import type { WorldRules } from '@island/content';
import { emit } from '../events.ts';
import { credit } from '../ledger.ts';
import { findDockSpot } from '../placement.ts';
import { accept, reject, type CommandContext } from './context.ts';
import type { ClaimIslandCommand, CommandResult } from './types.ts';

// Words of ASCII letters, digits, "-" and "'", separated by single spaces (spec 12.3).
const NAME_PATTERN = /^[A-Za-z0-9'-]+( [A-Za-z0-9'-]+)*$/;
const HAS_LETTER_OR_DIGIT = /[A-Za-z0-9]/;
const MAX_OWNER_LENGTH = 64;

export function isValidIslandName(name: unknown, rules: WorldRules): name is string {
  return (
    typeof name === 'string' &&
    name.length >= rules.islandName.minLength &&
    name.length <= rules.islandName.maxLength &&
    NAME_PATTERN.test(name) &&
    HAS_LETTER_OR_DIGIT.test(name)
  );
}

/** Claims the lowest free slot for an account, names the island, pays the starting coins and places the dock. */
export function claimIsland(ctx: CommandContext, command: ClaimIslandCommand): CommandResult {
  const { world, content } = ctx;
  const owner: unknown = command.owner;
  const name: unknown = command.name;
  if (typeof owner !== 'string' || owner.length === 0 || owner.length > MAX_OWNER_LENGTH) return reject('bad-input');
  if (!isValidIslandName(name, content.rules)) return reject('bad-island-name');
  if (world.islands.some((island) => island.owner === owner)) return reject('already-has-island');
  const island = world.islands.find((candidate) => candidate.owner === null);
  if (!island) return reject('world-full');
  const dock = findDockSpot(island, content);
  if (!dock) throw new Error(`claimIsland: slot ${island.slot} has no dock spot (terrain generator bug)`);

  island.owner = owner;
  island.name = name;
  island.lastCheckInTick = world.tick;
  credit(island, content.rules.startingCoinsCents, 'starting-coins', ctx.ledger);
  island.buildings.push({ id: world.nextId, type: 'dock', x: dock.x, y: dock.y, rotation: 0, constructionLeft: 0 });
  world.nextId += 1;
  emit(ctx.sink, 'island-claimed', island.slot, { slot: island.slot });
  return accept(ctx, { slot: island.slot });
}
