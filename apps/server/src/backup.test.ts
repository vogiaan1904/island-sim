import { mkdtempSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupDatabase } from './backup.ts';
import { type Db, openDatabase } from './db.ts';

describe('backupDatabase', () => {
  it('writes a copy that opens with its data, and keeps the newest seven', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'island-backup-'));
    const db = openDatabase(':memory:');
    db.prepare("INSERT INTO accounts VALUES ('a1', 'Alice', 'alice', 'hash', 0)").run();
    const day = 24 * 60 * 60_000;
    let last = '';
    for (let i = 0; i < 9; i += 1) last = await backupDatabase(db, dir, Date.UTC(2026, 9, 1) + i * day);
    expect(readdirSync(dir).sort()).toEqual(
      Array.from({ length: 7 }, (_, i) => `island-2026-10-${String(i + 3).padStart(2, '0')}T00-00-00-000Z.sqlite`),
    );
    const copy = openDatabase(last);
    expect(copy.prepare('SELECT username FROM accounts').get()).toEqual({ username: 'Alice' });
    copy.close();
  });

  it('leaves nothing behind when a backup fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'island-backup-'));
    const failing = {
      backup: async (path: string) => {
        writeFileSync(path, 'half a database');
        throw new Error('disk full');
      },
    } as unknown as Db;
    await expect(backupDatabase(failing, dir, Date.UTC(2026, 9, 1))).rejects.toThrow('disk full');
    expect(readdirSync(dir)).toEqual([]);
  });

  it('removes part files a killed process left behind, but not one still being written', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'island-backup-'));
    const db = openDatabase(':memory:');
    const stale = join(dir, 'island-2026-09-01T00-00-00-000Z.sqlite.part');
    const fresh = join(dir, 'island-2026-09-02T00-00-00-000Z.sqlite.part');
    writeFileSync(stale, 'killed');
    writeFileSync(fresh, 'in flight');
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000);
    utimesSync(stale, twoHoursAgo, twoHoursAgo);
    const day = 24 * 60 * 60_000;
    for (let i = 0; i < 8; i += 1) await backupDatabase(db, dir, Date.UTC(2026, 9, 1) + i * day);
    const names = readdirSync(dir).sort();
    expect(names.filter((name) => name.endsWith('.part'))).toEqual([fresh.slice(dir.length + 1)]);
    expect(names.filter((name) => !name.endsWith('.part'))).toHaveLength(7);
  });

  it('never deletes the copy it just wrote, even when the clock jumped back', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'island-backup-'));
    const db = openDatabase(':memory:');
    const day = 24 * 60 * 60_000;
    for (let i = 0; i < 7; i += 1) await backupDatabase(db, dir, Date.UTC(2026, 9, 10) + i * day);
    const early = await backupDatabase(db, dir, Date.UTC(2026, 9, 1));
    const names = readdirSync(dir);
    expect(names).toHaveLength(7);
    expect(names).toContain(early.slice(dir.length + 1));
  });
});
