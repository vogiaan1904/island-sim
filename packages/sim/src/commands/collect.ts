import { credit } from '../ledger.ts';
import { accept, claimedIsland, reject, type CommandContext } from './context.ts';
import type { CollectCommand, CommandResult } from './types.ts';

/** Tapping a reward bubble: pays a reached goal's reward once (spec 12.1). */
export function collect(ctx: CommandContext, command: CollectCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const index = island.rewards.indexOf(command.goal);
  const goal = ctx.content.goals.find((g) => g.id === command.goal);
  if (index === -1 || !goal) return reject('no-reward');
  island.rewards.splice(index, 1);
  if (goal.rewardCents > 0) credit(island, goal.rewardCents, 'reward', ctx.ledger);
  return accept(ctx, { rewardCents: goal.rewardCents });
}
