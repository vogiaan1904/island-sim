import { beforeEach, describe, expect, it } from 'vitest';
import { ManualClock } from '../../test/support.ts';
import { openDatabase } from '../db.ts';
import { sha256 } from '../random.ts';
import { Accounts, type EndedSessions } from './accounts.ts';
import { hashPassword } from './passwords.ts';
import { AccountStore } from './store.ts';

const DAY = 24 * 60 * 60_000;

let clock: ManualClock;
let accounts: Accounts;
let ended: EndedSessions[];

beforeEach(async () => {
  clock = new ManualClock();
  accounts = new Accounts(new AccountStore(openDatabase(':memory:')), clock);
  accounts.store.insertAccount(accounts.newAccount('Alice', await hashPassword('password-1')));
  ended = [];
  accounts.onSessionsEnded((which) => ended.push(which));
});

const alice = () => {
  const account = accounts.store.accountByUsername('alice');
  if (!account) throw new Error('no alice');
  return account;
};

describe('Accounts', () => {
  it('logs in with the username in any case, and gives one answer for a wrong password or an unknown name', async () => {
    expect((await accounts.checkLogin('ALICE', 'password-1'))?.username).toBe('Alice');
    expect(await accounts.checkLogin('alice', 'password-2')).toBeNull();
    expect(await accounts.checkLogin('nobody', 'password-1')).toBeNull();
    expect(accounts.username(alice().id)).toBe('Alice');
  });

  it('keeps a session per device as a hash, sliding its expiry 90 days from the last use', () => {
    const token = accounts.startSession(alice().id);
    expect(accounts.store.session(token)).toBeUndefined();
    expect(accounts.store.session(sha256(token))?.expiresMs).toBe(clock.now() + 90 * DAY);
    clock.advance(89 * DAY);
    expect(accounts.session(token)?.account.username).toBe('Alice');
    clock.advance(89 * DAY);
    expect(accounts.session(token)?.tokenHash).toBe(sha256(token));
    clock.advance(91 * DAY);
    expect(accounts.session(token)).toBeNull();
    expect(accounts.store.session(sha256(token))).toBeUndefined();
    expect(accounts.session('made-up')).toBeNull();
  });

  it('logs out one device only', () => {
    const phone = accounts.startSession(alice().id);
    const laptop = accounts.startSession(alice().id);
    accounts.endSession(sha256(phone));
    expect([accounts.session(phone), accounts.session(laptop)?.account.id]).toEqual([null, alice().id]);
    expect([ended[0]?.(sha256(phone), alice().id), ended[0]?.(sha256(laptop), alice().id)]).toEqual([true, false]);
  });

  it('changes a password with the current one and logs out every other device', async () => {
    const phone = accounts.startSession(alice().id);
    const laptop = accounts.startSession(alice().id);
    expect(await accounts.changePassword(alice(), 'wrong-password', 'password-2', sha256(phone))).toBe(false);
    expect(await accounts.changePassword(alice(), 'password-1', 'password-2', sha256(phone))).toBe(true);
    expect([accounts.session(phone)?.account.id, accounts.session(laptop)]).toEqual([alice().id, null]);
    expect(await accounts.checkLogin('alice', 'password-1')).toBeNull();
    expect(await accounts.checkLogin('alice', 'password-2')).not.toBeNull();
    expect([ended[0]?.(sha256(phone), alice().id), ended[0]?.(sha256(laptop), alice().id)]).toEqual([false, true]);
  });

  it('resets a forgotten password once with the code from the host, within a day, and logs out every device', async () => {
    expect(accounts.issueResetCode('nobody')).toBeNull();
    const code = accounts.issueResetCode('alice') ?? '';
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{12}$/);
    const phone = accounts.startSession(alice().id);
    expect(await accounts.resetPassword('alice', 'WRONGCODE234', 'password-3')).toBe(false);
    expect(await accounts.resetPassword('alice', code, 'password-3')).toBe(true);
    expect(await accounts.resetPassword('alice', code, 'password-4')).toBe(false);
    expect(accounts.session(phone)).toBeNull();
    expect(ended[0]?.('any device', alice().id)).toBe(true);
    expect(await accounts.checkLogin('alice', 'password-3')).not.toBeNull();

    const late = accounts.issueResetCode('alice') ?? '';
    clock.advance(DAY);
    expect(await accounts.resetPassword('alice', late, 'password-5')).toBe(false);
  });
});
