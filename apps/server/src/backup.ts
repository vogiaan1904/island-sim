import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Db } from './db.ts';

/** Backups kept in the backup folder; older ones are deleted. */
const KEEP_BACKUPS = 7;

/** A half-written copy older than this was left by a killed process; a backup takes seconds. */
const STALE_PART_MS = 60 * 60_000;

/**
 * Copies the database into the backup folder with SQLite's online backup, which is safe while the server runs
 * (spec 12.3), then deletes all but the newest few copies. Returns the new copy's path. The copy is written under a
 * `.part` name and renamed when complete, so a failed or killed backup never leaves a truncated copy that counts as the
 * newest.
 */
export async function backupDatabase(db: Db, dir: string, nowMs: number): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `island-${new Date(nowMs).toISOString().replace(/[:.]/g, '-')}.sqlite`);
  const part = `${path}.part`;
  try {
    await db.backup(part);
    renameSync(part, path);
  } catch (error) {
    rmSync(part, { force: true });
    throw error;
  }
  const written = basename(path);
  const names = readdirSync(dir);
  // Never the copy just written, even if a clock jump makes it sort oldest.
  const older = names.filter((name) => name !== written && /^island-.+\.sqlite$/.test(name)).sort();
  for (const name of older.slice(0, -(KEEP_BACKUPS - 1))) rmSync(join(dir, name));
  // Mtimes come from the real clock, not nowMs; a part file still being written is fresh and left alone.
  for (const name of names.filter((entry) => /^island-.+\.sqlite\.part$/.test(entry))) {
    if (statSync(join(dir, name)).mtimeMs < Date.now() - STALE_PART_MS) rmSync(join(dir, name), { force: true });
  }
  return path;
}
