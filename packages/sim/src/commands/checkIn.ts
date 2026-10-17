import type { Content } from '@island/content';
import type { IslandState, WorldState } from '../state.ts';
import { accept, claimedIsland, reject, type CommandContext } from './context.ts';
import type { CheckInCommand, CommandResult } from './types.ts';

/** The server sends this when an owner opens their island; "active island" is decided from it (spec 12.1). */
export function checkIn(ctx: CommandContext, command: CheckInCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  island.lastCheckInTick = ctx.world.tick;
  return accept(ctx, {});
}

/** Active: checked in within the last 7 real days (241,920 ticks). */
export function isIslandActive(world: WorldState, island: IslandState, content: Content): boolean {
  return island.lastCheckInTick !== null && world.tick - island.lastCheckInTick <= content.rules.activeIslandTicks;
}
