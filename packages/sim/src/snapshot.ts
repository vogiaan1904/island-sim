import type { Content } from '@island/content';
import { canonicalJson } from './hash.ts';
import { migrateV1 } from './migrations.ts';
import type { WorldState } from './state.ts';
import { validateWorld } from './validate.ts';
import { SIM_VERSION } from './version.ts';

// Snapshots are canonical JSON of the world (spec 5.2, 12.2). An older snapshot is migrated step by step to the
// current sim version; a newer one is refused, and so is one whose shape validateWorld rejects.

export type SnapshotErrorCode =
  | 'not-a-snapshot'
  | 'newer-sim-version'
  | 'missing-migration'
  | 'migration-failed'
  | 'invalid-data';

export class SnapshotError extends Error {
  code: SnapshotErrorCode;

  constructor(code: SnapshotErrorCode, message: string) {
    super(message);
    this.name = 'SnapshotError';
    this.code = code;
  }
}

/** Upgrades snapshot data from one version to the next. Pure and deterministic like the rest of the sim. */
export type Migration = (data: Record<string, unknown>, content: Content) => Record<string, unknown>;

/** Key: the version a migration upgrades from. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = { 1: migrateV1 };

export function serializeWorld(world: WorldState): string {
  return canonicalJson(world);
}

export function loadWorld(
  json: string,
  content: Content,
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
    let migrated: Record<string, unknown>;
    try {
      migrated = migrate(current, content);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new SnapshotError('migration-failed', `migration from sim version ${version} failed: ${reason}`);
    }
    version += 1;
    current = { ...migrated, simVersion: version };
  }
  try {
    canonicalJson(current);
  } catch (error) {
    throw new SnapshotError('invalid-data', error instanceof Error ? error.message : String(error));
  }
  const problems = validateWorld(current, content);
  if (problems.length > 0) throw new SnapshotError('invalid-data', problems.slice(0, 5).join('; '));
  return current as unknown as WorldState;
}
