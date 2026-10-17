import { content } from '@island/content';
import { HIGH_PRIORITY, type Command } from '@island/sim';
import * as v from 'valibot';
import { MAX_COUNT, whole } from './fields.ts';

// Commands a player sends (spec 12.2: the sim defines them, the protocol wraps them). None names an island: the
// server applies each to the sender's own island, taken from the session (island-server, "never trust the client").
// Claiming and checking in are applied by the server itself, never sent by a player.

const Coordinate = whole(content.rules.islandSize - 1);
const Count = whole(MAX_COUNT);
const GoodId = v.picklist(content.goods.map((good) => good.id));
const BuildingId = v.picklist(content.buildings.map((building) => building.id));
const GoalId = v.picklist(content.goals.map((goal) => goal.id));

export const PlayerCommand = v.variant('type', [
  v.strictObject({
    type: v.literal('place-building'),
    building: BuildingId,
    x: Coordinate,
    y: Coordinate,
    rotation: v.picklist([0, 1, 2, 3]),
  }),
  v.strictObject({
    type: v.literal('place-road'),
    // At most one road per tile of the island; the sim's own limit per command answers with 'too-many-tiles'.
    tiles: v.pipe(
      v.array(v.strictTuple([Coordinate, Coordinate])),
      v.minLength(1),
      v.maxLength(content.rules.islandSize * content.rules.islandSize),
    ),
  }),
  v.strictObject({ type: v.literal('hire-commuters'), count: Count }),
  v.strictObject({ type: v.literal('set-priority'), buildingId: Count, priority: whole(HIGH_PRIORITY) }),
  v.strictObject({ type: v.literal('set-auto-sell'), good: GoodId, keep: v.nullable(Count) }),
  v.strictObject({ type: v.literal('sell'), good: GoodId, amount: Count }),
  v.strictObject({ type: v.literal('buy-materials'), buildingId: Count }),
  v.strictObject({ type: v.literal('collect'), goal: GoalId }),
]);

export type PlayerCommand = v.InferOutput<typeof PlayerCommand>;

/** The sim command for a parsed player command on the sender's own island. */
export function toSimCommand(command: PlayerCommand, slot: number): Command {
  return { ...command, slot };
}
