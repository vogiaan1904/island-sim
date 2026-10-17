import type { JoinedResponse, MeResponse } from '@island/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import type { IslandServer } from '../src/server.ts';
import { Browser, addAccount, startTestServer } from './server.ts';
import { TICK_MS } from './support.ts';

let running: IslandServer[] = [];

afterEach(async () => {
  await Promise.all(running.map((server) => server.close()));
  running = [];
});

/** A server where alice (made by the host) has created a world; returns her browser and the world's invite code. */
async function aliceWithWorld(overrides = {}) {
  const setup = await startTestServer(overrides);
  running.push(setup.server);
  await addAccount(setup.server, 'alice');
  const alice = new Browser(setup.server.url);
  await alice.login('alice');
  const created = await alice.post<JoinedResponse>('/api/worlds', { islandName: 'Palm Cove' });
  expect(created.status).toBe(201);
  const inviteCode = created.body.world.inviteCode ?? '';
  return { ...setup, alice, world: created.body.world, inviteCode };
}

const bobSignsUp = (inviteCode: string) => ({ username: 'Bob', password: 'password-2', inviteCode, islandName: 'Coral Bay' });

describe('registering', () => {
  it("creates the account, a session cookie and an island in the invite code's world, together", async () => {
    const { server, alice, world, inviteCode } = await aliceWithWorld();
    const bob = new Browser(server.url);
    const signedUp = await bob.post<JoinedResponse>('/api/register', bobSignsUp(inviteCode.toLowerCase()));
    expect(signedUp.status).toBe(201);
    expect(signedUp.setCookie).toMatch(/^island_session=[\w-]{43}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=7776000; Secure$/);
    expect(signedUp.body.world).toEqual({ id: world.id, slot: 1, islandName: 'Coral Bay', creator: 'alice', inviteCode: null, status: 'running' });

    const bobMe = await bob.get<MeResponse>('/api/me');
    expect(bobMe.body).toEqual({ account: { id: signedUp.body.account.id, username: 'Bob' }, worlds: [signedUp.body.world] });
    const aliceMe = await alice.get<MeResponse>('/api/me');
    expect(aliceMe.body.worlds).toEqual([{ ...world, inviteCode }]);
  });

  it('creates nothing when the world is full', async () => {
    const { server, inviteCode, world } = await aliceWithWorld();
    const runtime = server.worlds.get(world.id);
    if (!runtime) throw new Error('no world');
    for (let i = 1; i < 10; i += 1) {
      const account = server.accounts.newAccount(`friend${i}`, 'not a real hash');
      expect(server.worlds.claim(runtime, account.id, `Isle ${i}`, () => server.accounts.store.insertAccount(account)).ok).toBe(true);
    }
    const bob = new Browser(server.url);
    expect(await bob.post('/api/register', bobSignsUp(inviteCode))).toMatchObject({ status: 409, body: { error: 'world-full' } });
    expect(server.accounts.store.accountByUsername('bob')).toBeUndefined();
    expect(bob.token).toBeNull();
  });

  it('refuses a wrong invite code and a username already taken in any case', async () => {
    const { server, inviteCode } = await aliceWithWorld();
    const bob = new Browser(server.url);
    expect(await bob.post('/api/register', bobSignsUp('ZZZZZZZZZZ'))).toMatchObject({ status: 404, body: { error: 'bad-invite-code' } });
    expect(await bob.post('/api/register', { ...bobSignsUp(inviteCode), username: 'ALICE' })).toMatchObject({
      status: 409,
      body: { error: 'username-taken' },
    });
  });

  it('refuses a resting world', async () => {
    const { server, clock, inviteCode, world } = await aliceWithWorld();
    const runtime = server.worlds.get(world.id);
    if (!runtime) throw new Error('no world');
    runtime.world.islands[0]?.transit.push({ id: runtime.world.nextId, good: 'wood', amount: 1, from: 1, to: 999, arriveTick: 1 });
    runtime.world.nextId += 1;
    clock.advance(TICK_MS);
    await server.worlds.runDue();
    expect(runtime.status).toBe('paused');
    const bob = new Browser(server.url);
    expect(await bob.post('/api/register', bobSignsUp(inviteCode))).toMatchObject({ status: 503, body: { error: 'world-resting' } });
  });
});

describe('signing in', () => {
  it('gives one answer for a wrong password and an unknown name, and logs out only this device', async () => {
    const { server } = await aliceWithWorld();
    const phone = new Browser(server.url);
    const laptop = new Browser(server.url);
    expect(await phone.post('/api/login', { username: 'alice', password: 'wrong-password' })).toMatchObject({
      status: 401,
      body: { error: 'bad-credentials' },
    });
    expect((await phone.post('/api/login', { username: 'nobody', password: 'password-1' })).body).toEqual({ error: 'bad-credentials' });
    await phone.login('ALICE');
    await laptop.login('alice');
    const out = await phone.post('/api/logout');
    expect(out.setCookie).toMatch(/^island_session=; .*Max-Age=0/);
    expect((await phone.get('/api/me')).status).toBe(401);
    expect((await laptop.get('/api/me')).status).toBe(200);
  });

  it('limits login attempts per username', async () => {
    const { server } = await aliceWithWorld();
    const browser = new Browser(server.url);
    for (let i = 0; i < 9; i += 1) await browser.post('/api/login', { username: 'alice', password: 'guess' });
    expect((await browser.post('/api/login', { username: 'Alice', password: 'guess' })).status).toBe(429);
    expect(await browser.post('/api/login', { username: 'alice', password: 'password-1' })).toMatchObject({
      status: 429,
      body: { error: 'too-many-attempts' },
    });
  });

  it('changes the password and logs out every other device', async () => {
    const { server, alice } = await aliceWithWorld();
    const laptop = new Browser(server.url);
    await laptop.login('alice');
    const change = { currentPassword: 'password-1', newPassword: 'password-9' };
    expect((await alice.post('/api/password', { ...change, currentPassword: 'nope' })).body).toEqual({ error: 'bad-credentials' });
    expect((await alice.post('/api/password', change)).status).toBe(200);
    expect([(await alice.get('/api/me')).status, (await laptop.get('/api/me')).status]).toEqual([200, 401]);
    await new Browser(server.url).login('alice', 'password-9');
  });

  it('resets a forgotten password with the code the host issued', async () => {
    const { server } = await aliceWithWorld();
    const code = server.accounts.issueResetCode('alice') ?? '';
    const browser = new Browser(server.url);
    const reset = { username: 'alice', code: code.toLowerCase(), newPassword: 'password-7' };
    expect((await browser.post('/api/password-reset', reset)).status).toBe(200);
    expect(await browser.post('/api/password-reset', reset)).toMatchObject({ status: 400, body: { error: 'bad-reset-code' } });
    await browser.login('alice', 'password-7');
  });
});

describe('the endpoints', () => {
  it('refuse changes from other origins, malformed and oversized bodies, unknown paths and missing sessions', async () => {
    const { server } = await aliceWithWorld();
    const elsewhere = new Browser(server.url, 'https://evil.example');
    expect(await elsewhere.post('/api/login', { username: 'alice', password: 'password-1' })).toMatchObject({
      status: 403,
      body: { error: 'bad-origin' },
    });
    const browser = new Browser(server.url);
    expect((await browser.post('/api/login', '{"username": ')).body).toEqual({ error: 'bad-request' });
    expect((await browser.post('/api/login', { username: 'alice', password: 'password-1', admin: true })).body).toEqual({ error: 'bad-request' });
    expect((await browser.post('/api/login', { username: 'alice', password: 'x'.repeat(5_000) })).status).toBe(413);
    expect(await browser.get('/api/worlds/secret')).toMatchObject({ status: 404, body: { error: 'not-found' } });
    expect(await browser.get('/api/me')).toMatchObject({ status: 401, body: { error: 'not-signed-in' } });
  });
});

describe('worlds', () => {
  it('lets an account join with an invite code, once per world', async () => {
    const { server, inviteCode, world } = await aliceWithWorld();
    await addAccount(server, 'bob');
    const bob = new Browser(server.url);
    await bob.login('bob');
    const joined = await bob.post<JoinedResponse>('/api/worlds/join', { inviteCode, islandName: 'Coral Bay' });
    expect(joined).toMatchObject({ status: 201, body: { world: { id: world.id, slot: 1, islandName: 'Coral Bay', inviteCode: null } } });
    expect(await bob.post('/api/worlds/join', { inviteCode, islandName: 'Second Bay' })).toMatchObject({
      status: 409,
      body: { error: 'already-has-island' },
    });
  });

  it('lets only the creator regenerate the invite code, and the old code stops working', async () => {
    const { server, alice, inviteCode, world } = await aliceWithWorld();
    const bob = new Browser(server.url);
    await bob.post('/api/register', bobSignsUp(inviteCode));
    expect(await bob.post('/api/worlds/invite', { world: world.id })).toMatchObject({ status: 403, body: { error: 'not-the-creator' } });
    const regenerated = await alice.post<{ inviteCode: string }>('/api/worlds/invite', { world: world.id });
    expect(regenerated.body.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    const carol = new Browser(server.url);
    const carolSignsUp = { ...bobSignsUp(inviteCode), username: 'carol', islandName: 'Reef End' };
    expect((await carol.post('/api/register', carolSignsUp)).body).toEqual({ error: 'bad-invite-code' });
    expect((await carol.post('/api/register', { ...carolSignsUp, inviteCode: regenerated.body.inviteCode })).status).toBe(201);
  });

  it('refuses an island name the sim does not allow', async () => {
    const { alice } = await aliceWithWorld();
    expect(await alice.post('/api/worlds', { islandName: 'Two  Spaces' })).toMatchObject({ status: 400, body: { error: 'bad-island-name' } });
  });
});
