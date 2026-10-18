import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupDatabase } from './backup.ts';
import { openDatabase } from './db.ts';

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
});
