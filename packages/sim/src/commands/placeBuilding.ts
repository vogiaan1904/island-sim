import { newBuilding } from '../buildings.ts';
import { emit } from '../events.ts';
import { pay } from '../ledger.ts';
import { findBuildingDef, stageOrder } from '../lookup.ts';
import { checkPlacement, type PlacementCheckId } from '../placement.ts';
import { accept, claimedIsland, isRotation, isWhole, reject, type CommandContext } from './context.ts';
import type { CommandResult, PlaceBuildingCommand, ReasonCode } from './types.ts';

const REASON_FOR_CHECK: Record<PlacementCheckId, ReasonCode> = {
  'in-bounds': 'out-of-bounds',
  terrain: 'bad-terrain',
  free: 'tile-occupied',
  'road-access': 'no-road-access',
  affordable: 'not-enough-coins',
};

/** Pays the price up front and starts a construction site (spec 12.1); nothing is ever queued. */
export function placeBuilding(ctx: CommandContext, command: PlaceBuildingCommand): CommandResult {
  const { world, content } = ctx;
  const island = claimedIsland(world, command.slot);
  if (typeof island === 'string') return reject(island);
  const def = findBuildingDef(content, command.building);
  if (!def) return reject('unknown-building');
  if (!def.playerBuildable) return reject('not-player-buildable');
  if (stageOrder(content, def.availableFrom) > stageOrder(content, island.stage)) return reject('not-available-yet');
  const x: unknown = command.x;
  const y: unknown = command.y;
  const rotation: unknown = command.rotation;
  if (!isWhole(x) || !isWhole(y) || !isRotation(rotation)) return reject('bad-input');

  const report = checkPlacement(island, content, def, x, y, rotation);
  const failed = report.checks.find((check) => !check.ok);
  if (failed) return reject(REASON_FOR_CHECK[failed.id], failed.id === 'affordable' ? report.shortfallCents : 0);

  pay(island, def.priceCents, 'building-purchase', ctx.ledger);
  const id = world.nextId;
  world.nextId += 1;
  island.buildings.push(newBuilding(def, id, x, y, rotation));
  emit(ctx.sink, 'construction-started', island.slot, { buildingId: id, building: def.id });
  return accept(ctx, { buildingId: id });
}
