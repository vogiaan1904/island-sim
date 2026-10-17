import type { EventKey } from '@island/protocol';
import type { SimEvent } from '@island/sim';
import type { Db } from '../db.ts';

// Everything the server keeps about worlds (island-server, persistence.md). Synchronous like better-sqlite3, so a
// write has finished before the next tick or message runs.

export interface WorldRecord {
  id: string;
  seed: number;
  creatorId: string;
  /** The world's one invite code (spec 12.3). */
  inviteCode: string;
  createdMs: number;
  /** Tick anchorTick was due at anchorMs; tick T is due at anchorMs + (T - anchorTick) * tickMs. */
  anchorTick: number;
  anchorMs: number;
  /** Set while the world is paused after a throw: why, and the last good tick it was rebuilt to. */
  pausedReason: string | null;
  pausedTick: number | null;
}

export interface SnapshotRecord {
  tick: number;
  /** The last logged command the state includes. */
  lastSequence: number;
  simVersion: number;
  contentHash: string;
  /** The sim's serialized world. */
  state: string;
}

/** One accepted command, exactly as it was passed to the sim (spec 12.3). */
export interface CommandRecord {
  sequence: number;
  /** The tick it followed: the last completed tick when it was applied. */
  tick: number;
  /** The account that sent it, or null for the commands the server applies itself. */
  accountId: string | null;
  simVersion: number;
  contentHash: string;
  /** JSON of the sim command. */
  command: string;
}

export interface Member {
  slot: number;
  accountId: string;
}

/** Snapshots kept per world; the previous one stays until a newer one is committed. */
const KEEP_SNAPSHOTS = 2;

interface WorldRow {
  id: string;
  seed: number;
  creator_id: string;
  invite_code: string;
  created_ms: number;
  anchor_tick: number;
  anchor_ms: number;
  paused_reason: string | null;
  paused_tick: number | null;
}

const toWorld = (row: WorldRow): WorldRecord => ({
  id: row.id,
  seed: row.seed,
  creatorId: row.creator_id,
  inviteCode: row.invite_code,
  createdMs: row.created_ms,
  anchorTick: row.anchor_tick,
  anchorMs: row.anchor_ms,
  pausedReason: row.paused_reason,
  pausedTick: row.paused_tick,
});

export class WorldStore {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** Runs fn in one transaction: everything it writes lands together or not at all. */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  insertWorld(world: WorldRecord): void {
    this.db
      .prepare(
        `INSERT INTO worlds (id, seed, creator_id, invite_code, created_ms, anchor_tick, anchor_ms, paused_reason, paused_tick)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(world.id, world.seed, world.creatorId, world.inviteCode, world.createdMs, world.anchorTick, world.anchorMs,
        world.pausedReason, world.pausedTick);
  }

  worlds(): WorldRecord[] {
    return this.db.prepare<[], WorldRow>('SELECT * FROM worlds ORDER BY created_ms, id').all().map(toWorld);
  }

  world(id: string): WorldRecord | undefined {
    const row = this.db.prepare<[string], WorldRow>('SELECT * FROM worlds WHERE id = ?').get(id);
    return row && toWorld(row);
  }

  worldByInviteCode(code: string): WorldRecord | undefined {
    const row = this.db.prepare<[string], WorldRow>('SELECT * FROM worlds WHERE invite_code = ?').get(code);
    return row && toWorld(row);
  }

  setInviteCode(id: string, code: string): void {
    this.db.prepare('UPDATE worlds SET invite_code = ? WHERE id = ?').run(code, id);
  }

  setAnchor(id: string, tick: number, ms: number): void {
    this.db.prepare('UPDATE worlds SET anchor_tick = ?, anchor_ms = ? WHERE id = ?').run(tick, ms, id);
  }

  setPaused(id: string, reason: string | null, tick: number | null): void {
    this.db.prepare('UPDATE worlds SET paused_reason = ?, paused_tick = ? WHERE id = ?').run(reason, tick, id);
  }

  /** Stores a snapshot and drops all but the newest few of that world, in one transaction. */
  insertSnapshot(worldId: string, snapshot: SnapshotRecord, nowMs: number): void {
    this.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO snapshots (world_id, tick, last_sequence, sim_version, content_hash, state, created_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(worldId, snapshot.tick, snapshot.lastSequence, snapshot.simVersion, snapshot.contentHash, snapshot.state, nowMs);
      this.db
        .prepare(
          `DELETE FROM snapshots WHERE world_id = ? AND id NOT IN
           (SELECT id FROM snapshots WHERE world_id = ? ORDER BY id DESC LIMIT ?)`,
        )
        .run(worldId, worldId, KEEP_SNAPSHOTS);
    });
  }

  latestSnapshot(worldId: string): SnapshotRecord | undefined {
    return this.db
      .prepare<[string], SnapshotRecord>(
        `SELECT tick, last_sequence AS lastSequence, sim_version AS simVersion, content_hash AS contentHash, state
         FROM snapshots WHERE world_id = ? ORDER BY id DESC LIMIT 1`,
      )
      .get(worldId);
  }

  insertCommand(worldId: string, record: CommandRecord, nowMs: number): void {
    this.db
      .prepare(
        `INSERT INTO commands (world_id, sequence, tick, account_id, sim_version, content_hash, command, created_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(worldId, record.sequence, record.tick, record.accountId, record.simVersion, record.contentHash,
        record.command, nowMs);
  }

  /** The logged commands after a sequence number, in order. */
  commandsAfter(worldId: string, sequence: number): CommandRecord[] {
    return this.db
      .prepare<[string, number], CommandRecord>(
        `SELECT sequence, tick, account_id AS accountId, sim_version AS simVersion, content_hash AS contentHash, command
         FROM commands WHERE world_id = ? AND sequence > ? ORDER BY sequence`,
      )
      .all(worldId, sequence);
  }

  /** The highest sequence number logged for the world, or 0. */
  lastSequence(worldId: string): number {
    const row = this.db
      .prepare<[string], { last: number | null }>('SELECT MAX(sequence) AS last FROM commands WHERE world_id = ?')
      .get(worldId);
    return row?.last ?? 0;
  }

  /** Stores events by their stable key; one already stored is skipped, so replay never duplicates it (spec 12.3). */
  insertEvents(worldId: string, events: readonly SimEvent[]): void {
    if (events.length === 0) return;
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO events (world_id, tick, source, idx, slot, event) VALUES (?, ?, ?, ?, ?, ?)',
    );
    this.transaction(() => {
      for (const event of events) {
        insert.run(worldId, event.tick, event.source, event.index, event.slot, JSON.stringify(event));
      }
    });
  }

  /** The newest `limit` events of one island after a key (all of them when the key is null), oldest first. */
  eventsAfter(worldId: string, slot: number, after: EventKey | null, limit: number): SimEvent[] {
    const from = after ?? { tick: -1, source: 0, index: 0 };
    const rows = this.db
      .prepare<[string, number, number, number, number, number], { event: string }>(
        `SELECT event FROM events WHERE world_id = ? AND slot = ? AND (tick, source, idx) > (?, ?, ?)
         ORDER BY tick DESC, source DESC, idx DESC LIMIT ?`,
      )
      .all(worldId, slot, from.tick, from.source, from.index, limit);
    return rows.reverse().map((row) => JSON.parse(row.event) as SimEvent);
  }

  lastSeen(accountId: string, worldId: string): EventKey | null {
    const row = this.db
      .prepare<[string, string], EventKey>(
        'SELECT tick, source, idx AS "index" FROM last_seen WHERE account_id = ? AND world_id = ?',
      )
      .get(accountId, worldId);
    return row ?? null;
  }

  /** Moves the account's marker forward to the key; a key at or before it changes nothing. */
  markSeen(accountId: string, worldId: string, key: EventKey): void {
    this.db
      .prepare(
        `INSERT INTO last_seen (account_id, world_id, tick, source, idx) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (account_id, world_id) DO UPDATE SET tick = excluded.tick, source = excluded.source, idx = excluded.idx
         WHERE (excluded.tick, excluded.source, excluded.idx) > (last_seen.tick, last_seen.source, last_seen.idx)`,
      )
      .run(accountId, worldId, key.tick, key.source, key.index);
  }

  /** Replaces the world's membership rows: the mirror of who owns which island (spec 12.3). */
  setMembers(worldId: string, members: readonly Member[]): void {
    this.transaction(() => {
      this.db.prepare('DELETE FROM members WHERE world_id = ?').run(worldId);
      const insert = this.db.prepare('INSERT INTO members (world_id, slot, account_id) VALUES (?, ?, ?)');
      for (const member of members) insert.run(worldId, member.slot, member.accountId);
    });
  }

  members(worldId: string): Member[] {
    return this.db
      .prepare<[string], Member>('SELECT slot, account_id AS accountId FROM members WHERE world_id = ? ORDER BY slot')
      .all(worldId);
  }

  /** The worlds an account has an island in, oldest world first. */
  memberships(accountId: string): Array<{ worldId: string; slot: number }> {
    return this.db
      .prepare<[string], { worldId: string; slot: number }>(
        `SELECT members.world_id AS worldId, members.slot AS slot FROM members
         JOIN worlds ON worlds.id = members.world_id
         WHERE members.account_id = ? ORDER BY worlds.created_ms, worlds.id`,
      )
      .all(accountId);
  }
}
