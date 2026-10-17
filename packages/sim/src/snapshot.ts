import { canonicalJson } from './hash.ts';
import type { WorldState } from './state.ts';
import { SIM_VERSION } from './version.ts';

// Snapshots are canonical JSON of the world (spec 5.2, 12.2). An older snapshot is migrated step by step to the
// current sim version; a newer one is refused.

export type SnapshotErrorCode = 'not-a-snapshot' | 'newer-sim-version' | 'missing-migration' | 'invalid-data';

export class SnapshotError extends Error {
  code: SnapshotErrorCode;

  constructor(code: SnapshotErrorCode, message: string) {
    super(message);
    this.name = 'SnapshotError';
    this.code = code;
  }
}

/** Upgrades snapshot data from one version to the next. Pure and deterministic like the rest of the sim. */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Key: the version a migration upgrades from. Empty until the state shape first changes. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export function serializeWorld(world: WorldState): string {
  return canonicalJson(world);
}

export function loadWorld(
  json: string,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  targetVersion: number = SIM_VERSION,
): WorldState {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new SnapshotError('not-a-snapshot', 'snapshot is not valid JSON');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new SnapshotError('not-a-snapshot', 'snapshot is not an object');
  }
  let current = data as Record<string, unknown>;
  let version = current.simVersion;
  if (typeof version !== 'number' || !Number.isSafeInteger(version)) {
    throw new SnapshotError('not-a-snapshot', 'snapshot has no sim version');
  }
  if (version > targetVersion) {
    throw new SnapshotError('newer-sim-version', `snapshot is from sim version ${version}, this sim is ${targetVersion}`);
  }
  while (version < targetVersion) {
    const migrate = migrations[version];
    if (!migrate) throw new SnapshotError('missing-migration', `no migration from sim version ${version}`);
    version += 1;
    current = { ...migrate(current), simVersion: version };
  }
  try {
    canonicalJson(current);
  } catch (error) {
    throw new SnapshotError('invalid-data', error instanceof Error ? error.message : String(error));
  }
  return current as unknown as WorldState;
}
