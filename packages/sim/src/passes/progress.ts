import type { GoalDef } from '@island/content';
import { isBuilt } from '../buildings.ts';
import { emit } from '../events.ts';
import { stageOrder } from '../lookup.ts';
import { residentsOf } from '../people.ts';
import type { IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

/**
 * Every slow pass: landmarks unlock when the island has enough residents (children included) and has reached their
 * stage; once unlocked they stay unlocked (spec 12.1). Goals of the stages reached so far complete once, and each
 * leaves a reward for the collect command.
 */
export function checkProgress(ctx: TickContext, island: IslandState): void {
  const { content } = ctx;
  const stage = stageOrder(content, island.stage);
  const residents = residentsOf(island);
  for (const def of content.buildings) {
    if (!def.landmark || island.unlockedLandmarks.includes(def.id)) continue;
    if (stageOrder(content, def.availableFrom) > stage || residents < def.landmark.unlockResidents) continue;
    island.unlockedLandmarks.push(def.id);
    emit(ctx.sink, 'landmark-unlocked', island.slot, { building: def.id });
  }
  for (const goal of content.goals) {
    if (stageOrder(content, goal.stage) > stage || island.completedGoals.includes(goal.id)) continue;
    if (!isReached(island, goal, residents)) continue;
    island.completedGoals.push(goal.id);
    island.rewards.push(goal.id);
    emit(ctx.sink, 'goal-completed', island.slot, { goal: goal.id });
  }
}

function isReached(island: IslandState, goal: GoalDef, residents: number): boolean {
  const target = goal.target;
  if (target.kind === 'residents') return residents >= target.count;
  const built = island.buildings.filter((b) => b.type === target.building && isBuilt(b)).length;
  return built >= target.count;
}
