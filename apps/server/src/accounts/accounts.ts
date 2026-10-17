import { timingSafeEqual } from 'node:crypto';
import { RESET_CODE_LENGTH } from '@island/protocol';
import type { Clock } from '../clock.ts';
import { newCode, newId, newToken, sha256 } from '../random.ts';
import { hashPassword, verifyPassword } from './passwords.ts';
import type { AccountRecord, AccountStore } from './store.ts';

// Accounts (spec 5.4, D21): username and password, a sliding session per device, one-time reset codes from the host.

/** Sessions last 90 days from their last use (spec 5.4). */
export const SESSION_MS = 90 * 24 * 60 * 60_000;
/** A session's expiry moves forward at most this often, to keep writes down. */
const SLIDE_EVERY_MS = 60 * 60_000;
export const RESET_CODE_MS = 24 * 60 * 60_000;

/** Which sessions just ended, by token hash and account; open connections on them close. */
export type EndedSessions = (tokenHash: string, accountId: string) => boolean;

export class Accounts {
  readonly store: AccountStore;
  private readonly clock: Clock;
  private readonly names = new Map<string, string>();
  private readonly endedListeners = new Set<(ended: EndedSessions) => void>();
  /** Checked against for unknown usernames, so a login takes as long whether or not the name exists. */
  private dummyHash: Promise<string> | null = null;

  constructor(store: AccountStore, clock: Clock) {
    this.store = store;
    this.clock = clock;
  }

  /** The username as typed; usernames never change, so they are kept once read. */
  username(accountId: string): string {
    let name = this.names.get(accountId);
    if (name === undefined) {
      name = this.store.account(accountId)?.username ?? '';
      this.names.set(accountId, name);
    }
    return name;
  }

  /** A new account's record, to insert in the same transaction as its first claim (spec 12.3). */
  newAccount(username: string, passwordHash: string): AccountRecord {
    return { id: newId(), username, passwordHash, createdMs: this.clock.now() };
  }

  /** The account for a username and password; null, with the same answer, for an unknown name or a wrong password. */
  async checkLogin(username: string, password: string): Promise<AccountRecord | null> {
    const account = this.store.accountByUsername(username);
    if (!account) {
      this.dummyHash ??= hashPassword('not the password of anyone');
      await verifyPassword(await this.dummyHash, password);
      return null;
    }
    return (await verifyPassword(account.passwordHash, password)) ? account : null;
  }

  /** Starts a session for one device and returns its token, which only the cookie holds. */
  startSession(accountId: string): string {
    const token = newToken();
    this.store.insertSession(sha256(token), accountId, this.clock.now() + SESSION_MS);
    return token;
  }

  /** The account of a session token, moving its expiry 90 days ahead; null when unknown or expired. */
  session(token: string): { account: AccountRecord; tokenHash: string } | null {
    const tokenHash = sha256(token);
    const session = this.store.session(tokenHash);
    const now = this.clock.now();
    if (!session) return null;
    if (session.expiresMs <= now) {
      this.store.deleteSession(tokenHash);
      return null;
    }
    const account = this.store.account(session.accountId);
    if (!account) return null;
    if (session.expiresMs - now < SESSION_MS - SLIDE_EVERY_MS) this.store.extendSession(tokenHash, now + SESSION_MS);
    return { account, tokenHash };
  }

  /** Logs out one device only (spec 5.4). */
  endSession(tokenHash: string): void {
    this.store.deleteSession(tokenHash);
    this.announce((hash) => hash === tokenHash);
  }

  /** Changes the password after checking the current one; every other device of the account is logged out. */
  async changePassword(account: AccountRecord, current: string, next: string, keepTokenHash: string): Promise<boolean> {
    if (!(await verifyPassword(account.passwordHash, current))) return false;
    this.store.setPasswordHash(account.id, await hashPassword(next));
    this.store.deleteSessions(account.id, keepTokenHash);
    this.announce((hash, accountId) => accountId === account.id && hash !== keepTokenHash);
    return true;
  }

  /** The host's admin command: a one-time code for a forgotten password, valid for a day; null for an unknown name. */
  issueResetCode(username: string): string | null {
    const account = this.store.accountByUsername(username);
    if (!account) return null;
    const code = newCode(RESET_CODE_LENGTH);
    this.store.setResetCode(account.id, sha256(code), this.clock.now() + RESET_CODE_MS);
    return code;
  }

  /** Sets a new password with a reset code, which then stops working; every device of the account is logged out. */
  async resetPassword(username: string, code: string, next: string): Promise<boolean> {
    const account = this.store.accountByUsername(username);
    const reset = account && this.store.resetCode(account.id);
    if (!account || !reset || reset.expiresMs <= this.clock.now() || !sameHash(reset.codeHash, sha256(code))) return false;
    const passwordHash = await hashPassword(next);
    if (this.store.resetCode(account.id)?.codeHash !== reset.codeHash) return false;
    this.store.deleteResetCode(account.id);
    this.store.setPasswordHash(account.id, passwordHash);
    this.store.deleteSessions(account.id, null);
    this.announce((_hash, accountId) => accountId === account.id);
    return true;
  }

  /** Hears of every logout, password change and reset, to close the connections of the sessions that ended. */
  onSessionsEnded(listener: (ended: EndedSessions) => void): () => void {
    this.endedListeners.add(listener);
    return () => {
      this.endedListeners.delete(listener);
    };
  }

  private announce(ended: EndedSessions): void {
    for (const listener of this.endedListeners) listener(ended);
  }
}

function sameHash(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
