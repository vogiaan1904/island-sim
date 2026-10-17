import { content } from '@island/content';
import { SIM_VERSION, applyCommand, contentHash, loadWorld, tickWorld, type Command, type WorldState } from '@island/sim';
import type { WorldStore } from './store.ts';

/** The content this server runs, recorded with every logged command and snapshot (spec 12.2). */
export const CONTENT_HASH = contentHash(content);

export type Recovered = { ok: true; world: WorldState; lastSequence: number } | { ok: false; reason: string };

/**
 * Rebuilds a world from its newest snapshot and the commands logged after it (spec 5.2): each command is applied
 * after the tick it followed, as it was live, so the result is exact. With untilTick, ticks then run up to that tick
 * (a paused world's last good tick); without it, the world stops after its last command and catch-up runs the rest.
 * Events are written again by their keys, which skips the ones already stored.
 */
export function recoverWorld(store: WorldStore, worldId: string, untilTick: number | null): Recovered {
  const snapshot = store.latestSnapshot(worldId);
  if (!snapshot) return { ok: false, reason: 'no snapshot' };
  const commands = store.commandsAfter(worldId, snapshot.lastSequence);
  // Replay is exact only with the rules that wrote the log; never replay old commands with new rules (spec 12.2).
  const foreign = commands.find((c) => c.simVersion !== SIM_VERSION || c.contentHash !== CONTENT_HASH);
  if (foreign) {
    return {
      ok: false,
      reason:
        `replay refused: command ${foreign.sequence} and later were applied by sim version ${foreign.simVersion} ` +
        `with content ${foreign.contentHash}; run that version once so it writes a clean snapshot`,
    };
  }
  let world: WorldState;
  try {
    world = loadWorld(snapshot.state, content);
  } catch (error) {
    return { ok: false, reason: `snapshot refused: ${message(error)}` };
  }
  const runTo = (tick: number) => {
    while (world.tick < tick) store.insertEvents(worldId, tickWorld(world, content).events);
  };
  try {
    store.transaction(() => {
      for (const record of commands) {
        if (record.tick < world.tick) {
          throw new Error(`command ${record.sequence} followed tick ${record.tick}, before tick ${world.tick}`);
        }
        runTo(record.tick);
        const result = applyCommand(world, content, JSON.parse(record.command) as Command, { sequence: record.sequence });
        if (!result.ok) throw new Error(`command ${record.sequence} was refused on replay (${result.reason})`);
        store.insertEvents(worldId, result.events);
      }
      if (untilTick !== null) runTo(untilTick);
    });
  } catch (error) {
    return { ok: false, reason: `replay failed: ${message(error)}` };
  }
  return { ok: true, world, lastSequence: commands.at(-1)?.sequence ?? snapshot.lastSequence };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
