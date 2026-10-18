import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  ChangePasswordRequest,
  CreateWorldRequest,
  JoinWorldRequest,
  LoginRequest,
  RegenerateInviteRequest,
  RegisterRequest,
  ResetPasswordRequest,
  type AccountInfo,
  type ApiReason,
  type WorldInfo,
} from '@island/protocol';
import * as v from 'valibot';
import type { Accounts } from '../accounts/accounts.ts';
import { hashPassword } from '../accounts/passwords.ts';
import { RateLimiter } from '../accounts/rate-limit.ts';
import type { AccountRecord } from '../accounts/store.ts';
import type { Clock } from '../clock.ts';
import type { ServerConfig } from '../config.ts';
import type { Log } from '../log.ts';
import type { ClaimResult, Worlds } from '../worlds/registry.ts';
import type { WorldRuntime } from '../worlds/runtime.ts';
import type { WorldRecord } from '../worlds/store.ts';
import { SESSION_COOKIE, clearedSessionCookie, clientIp, cookieValue, fromOrigin, readJson, sendJson, sessionCookie } from './request.ts';

// The account and world endpoints (island-server, accounts-and-security.md). They are HTTPS requests because only an
// HTTP response can set the httpOnly session cookie that the WebSocket upgrade then uses.

export interface ApiDeps {
  config: ServerConfig;
  clock: Clock;
  log: Log;
  accounts: Accounts;
  worlds: Worlds;
  /** True once the server is shutting down: every request is answered 503 shutting-down. */
  closing: () => boolean;
}

const MINUTE = 60_000;

const STATUS: Record<ApiReason, number> = {
  'bad-request': 400,
  'bad-island-name': 400,
  'bad-reset-code': 400,
  'not-signed-in': 401,
  'bad-credentials': 401,
  'bad-origin': 403,
  'not-the-creator': 403,
  'not-found': 404,
  'no-such-world': 404,
  'bad-invite-code': 404,
  'username-taken': 409,
  'world-full': 409,
  'already-has-island': 409,
  'too-large': 413,
  'too-many-attempts': 429,
  'server-error': 500,
  'world-resting': 503,
  'shutting-down': 503,
};

class Failure extends Error {
  readonly reason: ApiReason;

  constructor(reason: ApiReason) {
    super(reason);
    this.reason = reason;
  }
}

interface Session {
  account: AccountRecord;
  tokenHash: string;
}

/** The handler for every /api request. It never throws: a failure becomes an error reason and a status code. */
export function createApi(deps: ApiDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { config, clock, log, accounts, worlds } = deps;
  const limits = {
    loginByName: new RateLimiter(10, 15 * MINUTE, clock),
    loginByIp: new RateLimiter(30, 15 * MINUTE, clock),
    registerByIp: new RateLimiter(10, 60 * MINUTE, clock),
    resetByName: new RateLimiter(5, 15 * MINUTE, clock),
    resetByIp: new RateLimiter(20, 15 * MINUTE, clock),
    byAccount: new RateLimiter(20, 15 * MINUTE, clock),
    createByAccount: new RateLimiter(5, 60 * MINUTE, clock),
  };

  const limit = (limiter: RateLimiter, key: string) => {
    if (!limiter.take(key)) throw new Failure('too-many-attempts');
  };

  const parse = async <T extends v.GenericSchema>(req: IncomingMessage, schema: T): Promise<v.InferOutput<T>> => {
    const body = await readJson(req);
    if (!body.ok) throw new Failure(body.reason);
    const parsed = v.safeParse(schema, body.value);
    if (!parsed.success) throw new Failure('bad-request');
    return parsed.output;
  };

  const session = (req: IncomingMessage): Session => {
    const token = cookieValue(req, SESSION_COOKIE);
    const found = token === null ? null : accounts.session(token);
    if (!found) throw new Failure('not-signed-in');
    return found;
  };

  const accountInfo = (account: AccountRecord): AccountInfo => ({ id: account.id, username: account.username });

  const worldInfo = (record: WorldRecord, slot: number, accountId: string): WorldInfo => {
    const runtime = worlds.get(record.id);
    return {
      id: record.id,
      slot,
      islandName: runtime?.world.islands[slot]?.name ?? '',
      creator: accounts.username(record.creatorId),
      inviteCode: record.creatorId === accountId ? record.inviteCode : null,
      // A world that could not be loaded rests like a paused one until the host acts.
      status: runtime?.status ?? 'paused',
    };
  };

  /** The world an invite code belongs to, if it runs and accepts commands now. */
  const invitedWorld = (code: string): WorldRuntime => {
    const record = deps.worlds.recordByInviteCode(code);
    if (!record) throw new Failure('bad-invite-code');
    const runtime = worlds.get(record.id);
    if (!runtime || runtime.status !== 'running') throw new Failure('world-resting');
    return runtime;
  };

  const claimed = (result: ClaimResult): { runtime: WorldRuntime; slot: number } => {
    if (result.ok) return result;
    switch (result.reason) {
      case 'world-full':
      case 'already-has-island':
      case 'bad-island-name':
        throw new Failure(result.reason);
      case 'world-paused':
      case 'world-catching-up':
        throw new Failure('world-resting');
      default:
        throw new Failure('server-error');
    }
  };

  const routes: Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void> | void> = {
    /** Registering needs a world's invite code and claims an island there; account and claim are made together (spec 12.3). */
    'POST /api/register': async (req, res) => {
      limit(limits.registerByIp, clientIp(req, config.trustProxy));
      const body = await parse(req, RegisterRequest);
      if (accounts.store.accountByUsername(body.username)) throw new Failure('username-taken');
      invitedWorld(body.inviteCode);
      const passwordHash = await hashPassword(body.password);
      // Synchronous from here on; the password took a while to hash, so everything is checked again.
      if (accounts.store.accountByUsername(body.username)) throw new Failure('username-taken');
      const runtime = invitedWorld(body.inviteCode);
      const account = accounts.newAccount(body.username, passwordHash);
      const { slot } = claimed(worlds.claim(runtime, account.id, body.islandName, () => accounts.store.insertAccount(account)));
      const token = accounts.startSession(account.id);
      log.info('account registered', { account: account.id, world: runtime.id, slot });
      sendJson(res, 201, { account: accountInfo(account), world: worldInfo(runtime.record, slot, account.id) }, sessionCookie(token, config.secureCookies));
    },

    'POST /api/login': async (req, res) => {
      const body = await parse(req, LoginRequest);
      limit(limits.loginByIp, clientIp(req, config.trustProxy));
      limit(limits.loginByName, body.username.toLowerCase());
      const account = await accounts.checkLogin(body.username, body.password);
      if (!account) throw new Failure('bad-credentials');
      const token = accounts.startSession(account.id);
      sendJson(res, 200, { account: accountInfo(account) }, sessionCookie(token, config.secureCookies));
    },

    /** Ends this device's session only (spec 5.4). */
    'POST /api/logout': (req, res) => {
      const token = cookieValue(req, SESSION_COOKIE);
      const found = token === null ? null : accounts.session(token);
      if (found) accounts.endSession(found.tokenHash);
      sendJson(res, 200, { ok: true }, clearedSessionCookie(config.secureCookies));
    },

    /** The signed-in account and its worlds; it also renews the cookie, so a session in use never runs out. */
    'GET /api/me': (req, res) => {
      const { account } = session(req);
      const list: WorldInfo[] = [];
      for (const { worldId, slot } of deps.worlds.membershipsOf(account.id)) {
        const record = deps.worlds.record(worldId);
        if (record) list.push(worldInfo(record, slot, account.id));
      }
      const token = cookieValue(req, SESSION_COOKIE) ?? '';
      sendJson(res, 200, { account: accountInfo(account), worlds: list }, sessionCookie(token, config.secureCookies));
    },

    'POST /api/password': async (req, res) => {
      const { account, tokenHash } = session(req);
      limit(limits.byAccount, `password:${account.id}`);
      const body = await parse(req, ChangePasswordRequest);
      if (!(await accounts.changePassword(account, body.currentPassword, body.newPassword, tokenHash))) {
        throw new Failure('bad-credentials');
      }
      sendJson(res, 200, { ok: true });
    },

    /** With the one-time code the host issued (there is no email, spec 5.4). */
    'POST /api/password-reset': async (req, res) => {
      const body = await parse(req, ResetPasswordRequest);
      limit(limits.resetByIp, clientIp(req, config.trustProxy));
      limit(limits.resetByName, body.username.toLowerCase());
      if (!(await accounts.resetPassword(body.username, body.code, body.newPassword))) throw new Failure('bad-reset-code');
      sendJson(res, 200, { ok: true });
    },

    /** Creating a world claims an island in it for its creator (spec 12.3). */
    'POST /api/worlds': async (req, res) => {
      const { account } = session(req);
      limit(limits.createByAccount, account.id);
      const body = await parse(req, CreateWorldRequest);
      const { runtime, slot } = claimed(worlds.create(account.id, body.islandName));
      log.info('world created', { world: runtime.id, account: account.id });
      sendJson(res, 201, { account: accountInfo(account), world: worldInfo(runtime.record, slot, account.id) });
    },

    'POST /api/worlds/join': async (req, res) => {
      const { account } = session(req);
      limit(limits.byAccount, `join:${account.id}`);
      const body = await parse(req, JoinWorldRequest);
      const runtime = invitedWorld(body.inviteCode);
      if (runtime.slotOf(account.id) !== null) throw new Failure('already-has-island');
      const { slot } = claimed(worlds.claim(runtime, account.id, body.islandName));
      sendJson(res, 201, { account: accountInfo(account), world: worldInfo(runtime.record, slot, account.id) });
    },

    /** Only the world's creator may regenerate its code from the client (spec 12.3); the old one stops working. */
    'POST /api/worlds/invite': async (req, res) => {
      const { account } = session(req);
      limit(limits.byAccount, `invite:${account.id}`);
      const body = await parse(req, RegenerateInviteRequest);
      const runtime = worlds.get(body.world);
      if (!runtime || runtime.slotOf(account.id) === null) throw new Failure('no-such-world');
      if (runtime.record.creatorId !== account.id) throw new Failure('not-the-creator');
      sendJson(res, 200, { inviteCode: worlds.regenerateInviteCode(runtime) });
    },
  };

  return async (req, res) => {
    try {
      if (deps.closing()) throw new Failure('shutting-down');
      const route = routes[`${req.method ?? ''} ${new URL(req.url ?? '/', 'http://host').pathname}`];
      if (!route) throw new Failure('not-found');
      if (req.method !== 'GET' && !fromOrigin(req, config.origin)) throw new Failure('bad-origin');
      await route(req, res);
    } catch (error) {
      const reason = error instanceof Failure ? error.reason : 'server-error';
      if (reason === 'server-error') log.error('request failed', { path: req.url, error: error instanceof Error ? error.stack : String(error) });
      if (!res.headersSent) sendJson(res, STATUS[reason], { error: reason });
    }
  };
}
