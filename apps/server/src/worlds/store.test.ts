import type { SimEvent } from '@island/sim';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountStore } from '../accounts/store.ts';
import { openDatabase, type Db } from '../db.ts';
import { WorldStore, type WorldRecord } from './store.ts';

let db: Db;
let store: WorldStore;

const world: WorldRecord = {
  id: 'w1',
  seed: 42,
  creatorId: 'a1',
  inviteCode: 'ABCDEFGH23',
  createdMs: 1_000,
  anchorTick: 0,
  anchorMs: 1_000,
  pausedReason: null,
  pausedTick: null,
};

const event = (tick: number, source: number, index: number, slot = 0): SimEvent => ({
  tick,
  source,
  index,
  type: 'construction-finished',
  slot,
  data: { building: 7 },
});

beforeEach(() => {
  db = openDatabase(':memory:');
  const accounts = new AccountStore(db);
  for (const id of ['a1', 'a2']) accounts.insertAccount({ id, username: id, passwordHash: 'hash', createdMs: 0 });
  store = new WorldStore(db);
  store.insertWorld(world);
});

describe('WorldStore', () => {
  it('stores worlds and finds them by id and invite code', () => {
    store.setAnchor('w1', 120, 301_000);
    store.setPaused('w1', 'tick 121 threw', 120);
    const expected = { ...world, anchorTick: 120, anchorMs: 301_000, pausedReason: 'tick 121 threw', pausedTick: 120 };
    expect(store.world('w1')).toEqual(expected);
    expect(store.worlds()).toEqual([expected]);
    expect(store.worldByInviteCode('ABCDEFGH23')?.id).toBe('w1');
    store.setInviteCode('w1', 'ZZZZZZZZZ2');
    expect(store.worldByInviteCode('ABCDEFGH23')).toBeUndefined();
    expect(store.world('nope')).toBeUndefined();
  });

  it('keeps the two newest snapshots of a world', () => {
    for (const tick of [0, 120, 240]) {
      store.insertSnapshot('w1', { tick, lastSequence: tick / 120, simVersion: 2, contentHash: 'c', state: `{"t":${tick}}` }, tick);
    }
    expect(store.latestSnapshot('w1')).toEqual({ tick: 240, lastSequence: 2, simVersion: 2, contentHash: 'c', state: '{"t":240}' });
    expect(db.prepare('SELECT tick FROM snapshots ORDER BY id').all()).toEqual([{ tick: 120 }, { tick: 240 }]);
    expect(store.latestSnapshot('w2')).toBeUndefined();
  });

  it('returns the commands logged after a sequence number, in order', () => {
    for (const sequence of [2, 1, 3]) {
      store.insertCommand('w1', { sequence, tick: 10, accountId: sequence === 1 ? null : 'a1', simVersion: 2, contentHash: 'c', command: '{}' }, 0);
    }
    expect(store.commandsAfter('w1', 1).map((c) => c.sequence)).toEqual([2, 3]);
    expect(store.commandsAfter('w1', 0)[0]).toEqual({ sequence: 1, tick: 10, accountId: null, simVersion: 2, contentHash: 'c', command: '{}' });
    expect(store.lastSequence('w1')).toBe(3);
    expect(store.lastSequence('w2')).toBe(0);
  });

  it('stores each event once by its key and returns the newest after a marker, oldest first', () => {
    store.insertEvents('w1', [event(5, 0, 0), event(5, 0, 1), event(5, 3, 0), event(6, 0, 0, 1)]);
    store.insertEvents('w1', [event(5, 0, 1), event(7, 0, 0)]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM events').get()).toEqual({ n: 5 });
    const keys = (events: SimEvent[]) => events.map((e) => [e.tick, e.source, e.index]);
    expect(keys(store.eventsAfter('w1', 0, null, 10))).toEqual([[5, 0, 0], [5, 0, 1], [5, 3, 0], [7, 0, 0]]);
    expect(keys(store.eventsAfter('w1', 0, { tick: 5, source: 0, index: 1 }, 10))).toEqual([[5, 3, 0], [7, 0, 0]]);
    expect(keys(store.eventsAfter('w1', 0, null, 2))).toEqual([[5, 3, 0], [7, 0, 0]]);
    expect(store.eventsAfter('w1', 0, null, 1)[0]).toEqual(event(7, 0, 0));
  });

  it('moves the last-seen marker only forward', () => {
    expect(store.lastSeen('a1', 'w1')).toBeNull();
    store.markSeen('a1', 'w1', { tick: 5, source: 3, index: 0 });
    store.markSeen('a1', 'w1', { tick: 5, source: 0, index: 9 });
    expect(store.lastSeen('a1', 'w1')).toEqual({ tick: 5, source: 3, index: 0 });
    store.markSeen('a1', 'w1', { tick: 6, source: 0, index: 0 });
    expect(store.lastSeen('a1', 'w1')).toEqual({ tick: 6, source: 0, index: 0 });
    expect(store.lastSeen('a2', 'w1')).toBeNull();
  });

  it('mirrors the members of a world and lists the worlds of an account', () => {
    store.insertWorld({ ...world, id: 'w0', inviteCode: 'QQQQQQQQQ2', createdMs: 500 });
    store.setMembers('w1', [{ slot: 0, accountId: 'a1' }, { slot: 1, accountId: 'a2' }]);
    store.setMembers('w0', [{ slot: 3, accountId: 'a1' }]);
    store.setMembers('w1', [{ slot: 1, accountId: 'a2' }, { slot: 0, accountId: 'a1' }]);
    expect(store.members('w1')).toEqual([{ slot: 0, accountId: 'a1' }, { slot: 1, accountId: 'a2' }]);
    expect(store.memberships('a1')).toEqual([{ worldId: 'w0', slot: 3 }, { worldId: 'w1', slot: 0 }]);
  });
});
