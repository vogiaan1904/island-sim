import Database from 'better-sqlite3';

export type Db = Database.Database;

// Database migrations, applied in order at startup; PRAGMA user_version counts how many have run. Never edit one that
// has shipped: add the next. (Migrations of the world state itself are the sim's, spec 12.2.)
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    username_key TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_ms INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts (id),
    expires_ms INTEGER NOT NULL
  );
  CREATE INDEX sessions_account ON sessions (account_id);
  CREATE TABLE reset_codes (
    account_id TEXT PRIMARY KEY REFERENCES accounts (id),
    code_hash TEXT NOT NULL,
    expires_ms INTEGER NOT NULL
  );
  CREATE TABLE worlds (
    id TEXT PRIMARY KEY,
    seed INTEGER NOT NULL,
    creator_id TEXT NOT NULL REFERENCES accounts (id),
    invite_code TEXT NOT NULL UNIQUE,
    created_ms INTEGER NOT NULL,
    anchor_tick INTEGER NOT NULL,
    anchor_ms INTEGER NOT NULL,
    paused_reason TEXT,
    paused_tick INTEGER
  );
  CREATE TABLE members (
    world_id TEXT NOT NULL REFERENCES worlds (id),
    slot INTEGER NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts (id),
    PRIMARY KEY (world_id, slot),
    UNIQUE (world_id, account_id)
  );
  CREATE INDEX members_account ON members (account_id);
  CREATE TABLE snapshots (
    id INTEGER PRIMARY KEY,
    world_id TEXT NOT NULL REFERENCES worlds (id),
    tick INTEGER NOT NULL,
    last_sequence INTEGER NOT NULL,
    sim_version INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    state TEXT NOT NULL,
    created_ms INTEGER NOT NULL
  );
  CREATE INDEX snapshots_world ON snapshots (world_id, id);
  CREATE TABLE commands (
    world_id TEXT NOT NULL REFERENCES worlds (id),
    sequence INTEGER NOT NULL,
    tick INTEGER NOT NULL,
    account_id TEXT,
    sim_version INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    command TEXT NOT NULL,
    created_ms INTEGER NOT NULL,
    PRIMARY KEY (world_id, sequence)
  );
  CREATE TABLE events (
    world_id TEXT NOT NULL REFERENCES worlds (id),
    tick INTEGER NOT NULL,
    source INTEGER NOT NULL,
    idx INTEGER NOT NULL,
    slot INTEGER NOT NULL,
    event TEXT NOT NULL,
    PRIMARY KEY (world_id, tick, source, idx)
  );
  CREATE INDEX events_slot ON events (world_id, slot, tick, source, idx);
  CREATE TABLE last_seen (
    account_id TEXT NOT NULL REFERENCES accounts (id),
    world_id TEXT NOT NULL REFERENCES worlds (id),
    tick INTEGER NOT NULL,
    source INTEGER NOT NULL,
    idx INTEGER NOT NULL,
    PRIMARY KEY (account_id, world_id)
  );
  `,
];

/** Opens the database file and brings its schema up to date. */
export function openDatabase(path: string): Db {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  const applied = db.pragma('user_version', { simple: true }) as number;
  if (applied > MIGRATIONS.length) {
    db.close();
    throw new Error(`the database schema (${applied}) is newer than this server (${MIGRATIONS.length})`);
  }
  for (let i = applied; i < MIGRATIONS.length; i += 1) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i] ?? '');
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
  return db;
}
