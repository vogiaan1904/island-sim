import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassword } from '../src/accounts/passwords.ts';
import { DEFAULT_CONFIG, type ServerConfig } from '../src/config.ts';
import { startServer, type IslandServer } from '../src/server.ts';
import { ManualClock, memoryLog } from './support.ts';

/** The origin the test server treats as the game's own pages. */
export const ORIGIN = 'http://game.test';

/** A server on free ports and an in-memory database, whose worlds tick only when the test runs them. */
export async function startTestServer(overrides: Partial<ServerConfig> = {}, clock = new ManualClock()) {
  const log = memoryLog();
  const config: ServerConfig = {
    ...DEFAULT_CONFIG,
    port: 0,
    adminPort: 0,
    databasePath: ':memory:',
    backupDir: null,
    clientDir: null,
    origin: ORIGIN,
    ...overrides,
  };
  const server = await startServer(config, { clock, log, autoTick: false });
  return { server, clock, log, config };
}

/** A database file in a new temporary folder, for tests that stop and start the server on the same data. */
export function tempDatabase(): string {
  return join(mkdtempSync(join(tmpdir(), 'island-server-')), 'island.sqlite');
}

/** Adds an account directly, as the host's admin command does, and returns its id. */
export async function addAccount(server: IslandServer, username: string, password = 'password-1'): Promise<string> {
  const account = server.accounts.newAccount(username, await hashPassword(password));
  server.accounts.store.insertAccount(account);
  return account.id;
}

export interface Reply<T> {
  status: number;
  body: T;
  setCookie: string | null;
}

/** A browser on the game's page: it sends the game's Origin and keeps the session cookie it is given. */
export class Browser {
  token: string | null = null;
  private readonly base: string;
  private readonly origin: string;

  constructor(base: string, origin = ORIGIN) {
    this.base = base;
    this.origin = origin;
  }

  async request<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<Reply<T>> {
    const headers: Record<string, string> = { origin: this.origin, 'content-type': 'application/json' };
    if (this.token !== null) headers.cookie = `island_session=${this.token}`;
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
    const res = await fetch(this.base + path, init);
    const setCookie = res.headers.getSetCookie()[0] ?? null;
    if (setCookie?.startsWith('island_session=')) {
      const value = setCookie.slice('island_session='.length).split(';')[0] ?? '';
      this.token = value === '' ? null : value;
    }
    const text = await res.text();
    return { status: res.status, body: (text === '' ? null : JSON.parse(text)) as T, setCookie };
  }

  post<T = Record<string, unknown>>(path: string, body: unknown = {}): Promise<Reply<T>> {
    return this.request<T>('POST', path, body);
  }

  get<T = Record<string, unknown>>(path: string): Promise<Reply<T>> {
    return this.request<T>('GET', path);
  }

  async login(username: string, password = 'password-1'): Promise<void> {
    const reply = await this.post('/api/login', { username, password });
    if (reply.status !== 200) throw new Error(`login ${username}: ${reply.status} ${JSON.stringify(reply.body)}`);
  }
}
