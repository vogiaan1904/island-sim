import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './db.ts';

describe('openDatabase', () => {
  it('creates the schema once and keeps the data on reopen', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'island-db-')), 'island.sqlite');
    const db = openDatabase(path);
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    db.prepare("INSERT INTO accounts VALUES ('a1', 'Alice', 'alice', 'hash', 0)").run();
    db.close();
    const again = openDatabase(path);
    expect(again.prepare('SELECT username FROM accounts').get()).toEqual({ username: 'Alice' });
    again.close();
  });

  it('refuses a database written by a newer server', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'island-db-')), 'island.sqlite');
    const db = openDatabase(path);
    db.pragma('user_version = 99');
    db.close();
    expect(() => openDatabase(path)).toThrow(/newer than this server/);
  });
});
