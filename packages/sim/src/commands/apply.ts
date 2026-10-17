import type { Content } from '@island/content';
import type { WorldState } from '../state.ts';
import { checkIn } from './checkIn.ts';
import { claimIsland } from './claimIsland.ts';
import { reject, type CommandContext } from './context.ts';
import { placeBuilding } from './placeBuilding.ts';
import { placeRoad } from './placeRoad.ts';
import type { Command, CommandMeta, CommandResult } from './types.ts';

/**
 * Applies one player command between ticks (spec 12.2). Pure apart from mutating the world it is given: it reads
 * only the world, the content and the command. It either applies fully or changes nothing, and answers bad input
 * with a reason code; it throws only on bugs.
 */
export function applyCommand(world: WorldState, content: Content, command: Command, meta: CommandMeta): CommandResult {
  if (!Number.isSafeInteger(meta.sequence) || meta.sequence < 1) {
    throw new Error(`applyCommand: meta.sequence must be a whole number >= 1, got ${String(meta.sequence)}`);
  }
  if (typeof command !== 'object' || command === null) return reject('bad-input');
  const ctx: CommandContext = {
    world,
    content,
    sink: { tick: world.tick, source: meta.sequence, events: [] },
    ledger: [],
  };
  switch (command.type) {
    case 'claim-island':
      return claimIsland(ctx, command);
    case 'check-in':
      return checkIn(ctx, command);
    case 'place-building':
      return placeBuilding(ctx, command);
    case 'place-road':
      return placeRoad(ctx, command);
    default:
      return reject('bad-input');
  }
}
