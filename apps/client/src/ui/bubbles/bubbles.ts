import type { GoalId } from '@island/content';
import { isBuilt, type BuildingState } from '@island/sim';
import type { Limits } from '../../camera/controller.ts';
import { buildingAnchor, islandAnchor, type Anchor } from '../../render/anchors.ts';
import { problemOf, statusOf, type CardContext, type Picture } from '../cards/conditions.ts';
import { BUILDING_NAMES, NEED_ICONS, NEED_WORDS } from '../names.ts';
import { coinsHeld, countText } from '../coins.ts';

// Which bubbles float over the island and where (island-ui, screens.md section 2). Pure: no React, no store. What
// counts as a problem is the building card's own reading of the sim's conditions (`problemOf`, so a bubble and a card
// never disagree), a wish is a home's unmet need, a reward is a goal the sim has finished and the player has not
// collected. A bubble holds a picture; the words are its accessible name and the card's.

export type BubbleKind = 'problem' | 'wish' | 'reward';

/** Bubbles that hang over the same spot are laid side by side: this one is `index` of `of`. */
export interface Stack {
  index: number;
  of: number;
}

interface BubbleBase {
  /** Stays the same while the cause stays, so the layer keeps the same element (and its bobbing) across ticks. */
  key: string;
  anchor: Anchor;
  picture: Picture;
  /** What a screen reader says; the player reads the picture. */
  label: string;
  stack: Stack;
  /** What bubbles share a spot: the building it floats over, or the island's own spot. */
  spot: string;
}

export interface BuildingBubble extends BubbleBase {
  kind: 'problem' | 'wish';
  /** The building whose card a tap opens. */
  buildingId: number;
}

export interface RewardBubble extends BubbleBase {
  kind: 'reward';
  goal: GoalId;
  /** Whole coins, rounded down like the counter. */
  coins: number;
}

export type Bubble = BuildingBubble | RewardBubble;

const SOLO: Stack = { index: 0, of: 1 };

function nameOf(building: BuildingState): string {
  return BUILDING_NAMES[building.type];
}

/** Gives every bubble its place among the ones that share its spot, in the order given. */
function stacked<T extends Bubble>(bubbles: readonly T[]): T[] {
  const counts = new Map<string, number>();
  for (const bubble of bubbles) counts.set(bubble.spot, (counts.get(bubble.spot) ?? 0) + 1);
  const seen = new Map<string, number>();
  return bubbles.map((bubble) => {
    const index = seen.get(bubble.spot) ?? 0;
    seen.set(bubble.spot, index + 1);
    return { ...bubble, stack: { index, of: counts.get(bubble.spot) ?? 1 } };
  });
}

/** The building a goal is about, for its reward bubble: the first of the kind it asks for, else the dock where newcomers land. */
function rewardSpot(goal: GoalId, ctx: CardContext): { spot: string; anchor: Anchor } {
  const def = ctx.content.goals.find((g) => g.id === goal);
  const buildings = [...ctx.island.buildings].sort((a, b) => a.id - b.id);
  const wanted = def?.target.kind === 'build' ? def.target.building : undefined;
  const target = wanted === undefined ? undefined : buildings.find((b) => b.type === wanted);
  const over = target ?? buildings.find((b) => b.type === 'dock');
  if (over === undefined) return { spot: 'island', anchor: islandAnchor(ctx.content) };
  return { spot: `building/${over.id}`, anchor: buildingAnchor(over, ctx.content) };
}

/**
 * Every bubble of the island, problems first (buildings in id order), then wishes, then rewards. Rewards are the owner's
 * to collect, so a visit gets none.
 */
export function bubblesOf(ctx: CardContext, own: boolean): Bubble[] {
  const buildings = [...ctx.island.buildings].sort((a, b) => a.id - b.id);
  const problems: BuildingBubble[] = [];
  const wishes: BuildingBubble[] = [];
  for (const building of buildings) {
    const problem = problemOf(building, ctx);
    if (problem !== null) {
      const status = statusOf(building, ctx);
      // The thing that is missing when it is a good; otherwise the picture of the kind of trouble.
      const picture: Picture = problem.picture.kind === 'good' ? problem.picture : { kind: 'icon', name: status.icon };
      problems.push({
        key: `problem/${building.id}/${problem.condition}`,
        kind: 'problem',
        buildingId: building.id,
        anchor: buildingAnchor(building, ctx.content),
        picture,
        label: `${nameOf(building)}: ${status.words}`,
        stack: SOLO,
        spot: `building/${building.id}`,
      });
    }
    const need = building.home !== null && isBuilt(building) ? building.home.unmetNeeds[0] : undefined;
    if (need !== undefined) {
      wishes.push({
        key: `wish/${building.id}/${need}`,
        kind: 'wish',
        buildingId: building.id,
        anchor: buildingAnchor(building, ctx.content),
        picture: { kind: 'icon', name: NEED_ICONS[need] },
        label: `${nameOf(building)}: wants ${NEED_WORDS[need]}`,
        stack: SOLO,
        spot: `building/${building.id}`,
      });
    }
  }
  const rewards: RewardBubble[] = [];
  if (own) {
    for (const goal of ctx.island.rewards) {
      const def = ctx.content.goals.find((g) => g.id === goal);
      if (def === undefined) continue;
      const coins = coinsHeld(def.rewardCents);
      rewards.push({
        key: `reward/${goal}`,
        kind: 'reward',
        goal,
        coins,
        ...rewardSpot(goal, ctx),
        picture: { kind: 'icon', name: 'gift' },
        label: `Collect ${countText(coins)} coins`,
        stack: SOLO,
      });
    }
  }
  return stacked<Bubble>([...problems, ...wishes, ...rewards]);
}

/** Full bubbles, or dots with only problems left. */
export type BubbleDetail = 'full' | 'dots';

/** Zoomed out beyond this share of the farthest distance the whole island is in view, and bubbles shrink to dots. */
const DOTS_FROM = 0.6;

export function bubbleDetail(distance: number, limits: Limits): BubbleDetail {
  return distance >= limits.maxDistance * DOTS_FROM ? 'dots' : 'full';
}

/** The bubbles to draw at this detail: all of them, or only the problems (laid out again without the ones that went). */
export function shownBubbles(bubbles: readonly Bubble[], detail: BubbleDetail): Bubble[] {
  return detail === 'full' ? [...bubbles] : stacked(bubbles.filter((b) => b.kind === 'problem'));
}
