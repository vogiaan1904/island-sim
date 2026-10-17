import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db.ts';
import { AccountStore } from './store.ts';

let store: AccountStore;

beforeEach(() => {
  store = new AccountStore(openDatabase(':memory:'));
  store.insertAccount({ id: 'a1', username: 'Alice_7', passwordHash: 'hash-1', createdMs: 10 });
});

describe('AccountStore', () => {
  it('finds an account by its username in any case and keeps the name as typed', () => {
    expect(store.accountByUsername('alice_7')).toEqual({ id: 'a1', username: 'Alice_7', passwordHash: 'hash-1', createdMs: 10 });
    expect(store.account('a1')?.username).toBe('Alice_7');
    expect(() => store.insertAccount({ id: 'a2', username: 'ALICE_7', passwordHash: 'x', createdMs: 0 })).toThrow(/UNIQUE/);
    store.setPasswordHash('a1', 'hash-2');
    expect(store.account('a1')?.passwordHash).toBe('hash-2');
  });

  it('keeps sessions per device and ends them one, all but one, or all at a time', () => {
    for (const token of ['phone', 'laptop', 'tablet']) store.insertSession(token, 'a1', 1_000);
    store.extendSession('phone', 5_000);
    expect(store.session('phone')).toEqual({ accountId: 'a1', expiresMs: 5_000 });
    store.deleteSession('tablet');
    expect(store.session('tablet')).toBeUndefined();
    store.deleteSessions('a1', 'phone');
    expect([store.session('phone')?.accountId, store.session('laptop')]).toEqual(['a1', undefined]);
    store.deleteSessions('a1', null);
    expect(store.session('phone')).toBeUndefined();
  });

  it('drops expired sessions', () => {
    store.insertSession('old', 'a1', 1_000);
    store.insertSession('new', 'a1', 3_000);
    store.deleteExpiredSessions(2_000);
    expect([store.session('old'), store.session('new')?.expiresMs]).toEqual([undefined, 3_000]);
  });

  it('keeps one reset code per account', () => {
    store.setResetCode('a1', 'code-1', 100);
    store.setResetCode('a1', 'code-2', 200);
    expect(store.resetCode('a1')).toEqual({ codeHash: 'code-2', expiresMs: 200 });
    store.deleteResetCode('a1');
    expect(store.resetCode('a1')).toBeUndefined();
  });
});
