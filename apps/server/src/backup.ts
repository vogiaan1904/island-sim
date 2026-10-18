import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './db.ts';

/** Backups kept in the backup folder; older ones are deleted. */
const KEEP_BACKUPS = 7;

/**
 * Copies the database into the backup folder with SQLite's online backup, which is safe while the server runs
 * (spec 12.3), then deletes all but the newest few copies. Returns the new copy's path.
 */
export async function backupDatabase(db: Db, dir: string, nowMs: number): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `island-${new Date(nowMs).toISOString().replace(/[:.]/g, '-')}.sqlite`);
  await db.backup(path);
  const copies = readdirSync(dir).filter((name) => /^island-.+\.sqlite$/.test(name)).sort();
  for (const name of copies.slice(0, -KEEP_BACKUPS)) rmSync(join(dir, name));
  return path;
}
