import type { Db } from '../db.ts';

// Accounts, sessions and reset codes (island-server, accounts-and-security.md). Tokens and codes are stored only as
// hashes, so a copied database file hands out no live session.

export interface AccountRecord {
  id: string;
  /** As typed; looked up in lowercase (spec 12.3). */
  username: string;
  passwordHash: string;
  createdMs: number;
}

interface AccountRow {
  id: string;
  username: string;
  password_hash: string;
  created_ms: number;
}

const toAccount = (row: AccountRow): AccountRecord => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  createdMs: row.created_ms,
});

export class AccountStore {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  insertAccount(account: AccountRecord): void {
    this.db
      .prepare('INSERT INTO accounts (id, username, username_key, password_hash, created_ms) VALUES (?, ?, ?, ?, ?)')
      .run(account.id, account.username, account.username.toLowerCase(), account.passwordHash, account.createdMs);
  }

  account(id: string): AccountRecord | undefined {
    const row = this.db.prepare<[string], AccountRow>('SELECT * FROM accounts WHERE id = ?').get(id);
    return row && toAccount(row);
  }

  /** Usernames are unique without regard to case. */
  accountByUsername(username: string): AccountRecord | undefined {
    const row = this.db
      .prepare<[string], AccountRow>('SELECT * FROM accounts WHERE username_key = ?')
      .get(username.toLowerCase());
    return row && toAccount(row);
  }

  setPasswordHash(id: string, passwordHash: string): void {
    this.db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  }

  insertSession(tokenHash: string, accountId: string, expiresMs: number): void {
    this.db.prepare('INSERT INTO sessions (token_hash, account_id, expires_ms) VALUES (?, ?, ?)').run(tokenHash, accountId, expiresMs);
  }

  session(tokenHash: string): { accountId: string; expiresMs: number } | undefined {
    return this.db
      .prepare<[string], { accountId: string; expiresMs: number }>(
        'SELECT account_id AS accountId, expires_ms AS expiresMs FROM sessions WHERE token_hash = ?',
      )
      .get(tokenHash);
  }

  extendSession(tokenHash: string, expiresMs: number): void {
    this.db.prepare('UPDATE sessions SET expires_ms = ? WHERE token_hash = ?').run(expiresMs, tokenHash);
  }

  deleteSession(tokenHash: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  /** Ends every session of the account but one (or all, when keep is null). */
  deleteSessions(accountId: string, keep: string | null): void {
    this.db.prepare('DELETE FROM sessions WHERE account_id = ? AND token_hash IS NOT ?').run(accountId, keep);
  }

  deleteExpiredSessions(nowMs: number): void {
    this.db.prepare('DELETE FROM sessions WHERE expires_ms <= ?').run(nowMs);
  }

  /** One reset code per account; a new one replaces the old. */
  setResetCode(accountId: string, codeHash: string, expiresMs: number): void {
    this.db
      .prepare(
        `INSERT INTO reset_codes (account_id, code_hash, expires_ms) VALUES (?, ?, ?)
         ON CONFLICT (account_id) DO UPDATE SET code_hash = excluded.code_hash, expires_ms = excluded.expires_ms`,
      )
      .run(accountId, codeHash, expiresMs);
  }

  resetCode(accountId: string): { codeHash: string; expiresMs: number } | undefined {
    return this.db
      .prepare<[string], { codeHash: string; expiresMs: number }>(
        'SELECT code_hash AS codeHash, expires_ms AS expiresMs FROM reset_codes WHERE account_id = ?',
      )
      .get(accountId);
  }

  deleteResetCode(accountId: string): void {
    this.db.prepare('DELETE FROM reset_codes WHERE account_id = ?').run(accountId);
  }
}
