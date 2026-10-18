import type { IncomingMessage, ServerResponse } from 'node:http';
import { Password, Username, WorldId } from '@island/protocol';
import * as v from 'valibot';
import type { Accounts } from '../accounts/accounts.ts';
import { hashPassword } from '../accounts/passwords.ts';
import { readJson, sendJson } from '../http/request.ts';
import type { Log } from '../log.ts';
import { newCode } from '../random.ts';
import type { Worlds } from '../worlds/registry.ts';

// The host's admin interface (spec 12.3): reachable from the server machine only, used through `pnpm admin`. It creates
// accounts without an invite code (the first one), issues password reset codes, regenerates invite codes, resumes
// paused worlds and writes backups. None of it changes world state except through the worlds' own logged paths.

export interface AdminDeps {
  accounts: Accounts;
  worlds: Worlds;
  log: Log;
  /** Writes a backup now; null when backups are off. */
  backup: () => Promise<string | null>;
}

const NewAccount = v.strictObject({ username: Username, password: v.optional(Password) });
const ForUsername = v.strictObject({ username: v.pipe(v.string(), v.maxLength(64)) });
const ForWorld = v.strictObject({ world: WorldId });

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

class AdminError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createAdminApi(deps: AdminDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { accounts, worlds, log } = deps;

  const parse = async <T extends v.GenericSchema>(req: IncomingMessage, schema: T): Promise<v.InferOutput<T>> => {
    const body = await readJson(req);
    const parsed = body.ok ? v.safeParse(schema, body.value) : null;
    if (!parsed?.success) throw new AdminError(400, 'bad-request');
    return parsed.output;
  };

  const runtimeOf = (id: string) => {
    const runtime = worlds.get(id);
    if (!runtime) throw new AdminError(404, worlds.failed.has(id) ? 'world-not-loaded' : 'no-such-world');
    return runtime;
  };

  const routes: Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void> | void> = {
    'GET /admin/worlds': (_req, res) => {
      const list: unknown[] = worlds.all().map((runtime) => ({
        id: runtime.id,
        creator: accounts.username(runtime.record.creatorId),
        inviteCode: runtime.record.inviteCode,
        status: runtime.status,
        tick: runtime.world.tick,
        pausedReason: runtime.record.pausedReason,
        islands: runtime.summary().islands.map(({ slot, name, owner }) => ({ slot, name, owner })),
      }));
      for (const [id, reason] of worlds.failed) list.push({ id, status: 'not-loaded', reason });
      sendJson(res, 200, { worlds: list });
    },

    /** The first account, or anyone the host adds by hand. Without a password, one is made up and shown once. */
    'POST /admin/accounts': async (req, res) => {
      const body = await parse(req, NewAccount);
      if (accounts.store.accountByUsername(body.username)) throw new AdminError(409, 'username-taken');
      const password = body.password ?? newCode(16);
      const passwordHash = await hashPassword(password);
      if (accounts.store.accountByUsername(body.username)) throw new AdminError(409, 'username-taken');
      const account = accounts.newAccount(body.username, passwordHash);
      accounts.store.insertAccount(account);
      log.info('account created by the host', { account: account.id });
      sendJson(res, 201, { id: account.id, username: account.username, ...(body.password ? {} : { password }) });
    },

    'POST /admin/reset-codes': async (req, res) => {
      const body = await parse(req, ForUsername);
      const code = accounts.issueResetCode(body.username);
      if (code === null) throw new AdminError(404, 'no-such-account');
      sendJson(res, 200, { code });
    },

    'POST /admin/invite-codes': async (req, res) => {
      const body = await parse(req, ForWorld);
      sendJson(res, 200, { inviteCode: worlds.regenerateInviteCode(runtimeOf(body.world)) });
    },

    /** A paused world resumes and catches up the paused time with the 24-hour cap (spec 12.3). */
    'POST /admin/resume': async (req, res) => {
      const body = await parse(req, ForWorld);
      const runtime = runtimeOf(body.world);
      const resumed = await runtime.resume();
      sendJson(res, 200, { resumed, status: runtime.status, pausedReason: runtime.record.pausedReason });
    },

    'POST /admin/backup': async (_req, res) => {
      const path = await deps.backup();
      if (path === null) throw new AdminError(409, 'backups-off');
      sendJson(res, 200, { path });
    },
  };

  return async (req, res) => {
    try {
      // Only programs on this machine; a web page would send an Origin (a browser on the host is not the host).
      if (!LOOPBACK.has(req.socket.remoteAddress ?? '') || req.headers.origin !== undefined) {
        throw new AdminError(403, 'forbidden');
      }
      const route = routes[`${req.method ?? ''} ${new URL(req.url ?? '/', 'http://host').pathname}`];
      if (!route) throw new AdminError(404, 'not-found');
      await route(req, res);
    } catch (error) {
      if (!(error instanceof AdminError)) log.error('admin request failed', { path: req.url, error: error instanceof Error ? error.stack : String(error) });
      const status = error instanceof AdminError ? error.status : 500;
      if (!res.headersSent) sendJson(res, status, { error: error instanceof AdminError ? error.message : 'server-error' });
    }
  };
}
