import { mkdtempSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { IslandServer } from '../src/server.ts';
import { Browser, addAccount, startTestServer, tempDatabase } from './server.ts';
import { TICK_MS } from './support.ts';

let running: IslandServer[] = [];

afterEach(async () => {
  await Promise.all(running.map((server) => server.close()));
  running = [];
});

async function adminServer(overrides = {}) {
  const setup = await startTestServer(overrides);
  running.push(setup.server);
  return setup;
}

/** A request from a program on the server machine, as `pnpm admin` sends it. */
async function admin(server: IslandServer, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json', ...headers } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(server.adminUrl + path, init);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe('the admin interface', () => {
  it('listens on 127.0.0.1 only', async () => {
    const { server } = await adminServer({ host: '0.0.0.0' });
    expect(new URL(server.adminUrl).hostname).toBe('127.0.0.1');
  });

  it('answers a request target new URL() cannot parse like any unknown path', async () => {
    const { server } = await adminServer();
    const status = await new Promise<number>((resolve, reject) => {
      const url = new URL(server.adminUrl);
      const req = request({ host: url.hostname, port: url.port, path: '//', method: 'GET' }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(404);
  });

  it('creates the first account, with a made-up password shown once', async () => {
    const { server } = await adminServer();
    const created = await admin(server, 'POST', '/admin/accounts', { username: 'Host' });
    expect(created).toMatchObject({ status: 201, body: { username: 'Host', password: expect.stringMatching(/^[A-HJKMNP-Z2-9]{16}$/) } });
    await new Browser(server.url).login('host', String(created.body.password));
    expect(await admin(server, 'POST', '/admin/accounts', { username: 'HOST' })).toEqual({ status: 409, body: { error: 'username-taken' } });
    const chosen = await admin(server, 'POST', '/admin/accounts', { username: 'friend', password: 'password-8' });
    expect(chosen.body).toEqual({ id: expect.any(String), username: 'friend' });
  });

  it('issues reset codes and new invite codes', async () => {
    const { server } = await adminServer();
    const aliceId = await addAccount(server, 'alice');
    const created = server.worlds.create(aliceId, 'Palm Cove', 42);
    if (!created.ok) throw new Error(created.reason);
    const reset = await admin(server, 'POST', '/admin/reset-codes', { username: 'ALICE' });
    expect(reset.body.code).toMatch(/^[A-HJKMNP-Z2-9]{12}$/);
    expect((await admin(server, 'POST', '/admin/reset-codes', { username: 'nobody' })).status).toBe(404);
    const old = created.runtime.record.inviteCode;
    const invite = await admin(server, 'POST', '/admin/invite-codes', { world: created.runtime.id });
    expect([invite.body.inviteCode === old, server.worlds.byInviteCode(old)]).toEqual([false, undefined]);
    expect(await admin(server, 'POST', '/admin/invite-codes', { world: 'nope' })).toEqual({ status: 404, body: { error: 'no-such-world' } });
  });

  it('lists the worlds and resumes a paused one, which then catches up', async () => {
    const { server, clock } = await adminServer();
    const aliceId = await addAccount(server, 'alice');
    const created = server.worlds.create(aliceId, 'Palm Cove', 42);
    if (!created.ok) throw new Error(created.reason);
    const { runtime } = created;
    runtime.world.islands[0]?.transit.push({ id: runtime.world.nextId, good: 'wood', amount: 1, from: 1, to: 999, arriveTick: 1 });
    runtime.world.nextId += 1;
    clock.advance(TICK_MS);
    await server.worlds.runDue();
    const listed = await admin(server, 'GET', '/admin/worlds');
    expect(listed.body.worlds).toEqual([
      {
        id: runtime.id,
        creator: 'alice',
        inviteCode: runtime.record.inviteCode,
        status: 'paused',
        tick: 0,
        pausedReason: expect.stringMatching(/^tick after tick 0 threw/),
        islands: [{ slot: 0, name: 'Palm Cove', owner: 'alice' }],
      },
    ]);
    clock.advance(TICK_MS * 50);
    expect(await admin(server, 'POST', '/admin/resume', { world: runtime.id })).toEqual({
      status: 200,
      body: { resumed: true, status: 'running', pausedReason: null },
    });
    expect(runtime.world.tick).toBe(51);
    expect((await admin(server, 'POST', '/admin/resume', { world: runtime.id })).body).toMatchObject({ resumed: false });
  });

  it('refuses requests a web page sends', async () => {
    const { server } = await adminServer();
    expect(await admin(server, 'POST', '/admin/accounts', { username: 'mallory' }, { origin: 'https://evil.example' })).toEqual({
      status: 403,
      body: { error: 'forbidden' },
    });
    expect(server.accounts.store.accountByUsername('mallory')).toBeUndefined();
  });

  it('refuses a Host header that is not this machine (a name rebound to loopback)', async () => {
    const { server } = await adminServer();
    const { port } = new URL(server.adminUrl);
    // fetch cannot set Host, so send the request by hand.
    const get = (host: string) =>
      new Promise<number>((resolve, reject) => {
        const req = request(server.adminUrl + '/admin/worlds', { headers: { host } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        req.end();
      });
    const statuses = await Promise.all(
      [`evil.example:${port}`, `127.0.0.1.evil.example:${port}`, 'evil.example', `127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].map(get),
    );
    expect(statuses).toEqual([403, 403, 403, 200, 200, 200]);
  });

  it('writes a backup a server can start from', async () => {
    const backupDir = mkdtempSync(join(tmpdir(), 'island-backups-'));
    const { server, clock } = await adminServer({ databasePath: tempDatabase(), backupDir });
    const aliceId = await addAccount(server, 'alice');
    const created = server.worlds.create(aliceId, 'Palm Cove', 42);
    if (!created.ok) throw new Error(created.reason);
    const backup = await admin(server, 'POST', '/admin/backup');
    expect(backup.body.path).toMatch(/island-.+\.sqlite$/);
    const restored = (await startTestServer({ databasePath: String(backup.body.path) }, clock)).server;
    running.push(restored);
    expect(restored.worlds.get(created.runtime.id)?.world.islands[0]?.name).toBe('Palm Cove');
    const off = await adminServer();
    expect(await admin(off.server, 'POST', '/admin/backup')).toEqual({ status: 409, body: { error: 'backups-off' } });
  });
});
