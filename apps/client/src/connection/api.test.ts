// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { aliceServer, browserFetch, closeServers } from '../test/server.ts';
import { createApi } from './api.ts';

afterEach(closeServers);

describe('the HTTP API client', () => {
  it('logs in with the username in any letter case, then knows the account and its worlds', async () => {
    const { server, runtime } = await aliceServer();
    const api = createApi(browserFetch(server).fetch);
    expect(await api.me()).toEqual({ ok: false, reason: 'not-signed-in', status: 401 });

    const login = await api.login('ALICE', 'password-1');
    expect(login).toMatchObject({ ok: true, value: { account: { username: 'alice' } } });

    const me = await api.me();
    if (!me.ok) throw new Error(me.reason);
    expect(me.value.account.username).toBe('alice');
    expect(me.value.worlds).toEqual([expect.objectContaining({ id: runtime.id, slot: 0, islandName: 'Palm Cove', status: 'running' })]);
  });

  it('says why a log-in was refused', async () => {
    const { server } = await aliceServer();
    const api = createApi(browserFetch(server).fetch);
    expect(await api.login('alice', 'wrong-password')).toEqual({ ok: false, reason: 'bad-credentials', status: 401 });
  });

  it("signs up with a world's invite code and gets an island there", async () => {
    const { server, runtime } = await aliceServer();
    const api = createApi(browserFetch(server).fetch);
    const registered = await api.register({ username: 'Cara', password: 'password-3', inviteCode: runtime.record.inviteCode, islandName: 'Sunny Bay' });
    expect(registered).toMatchObject({ ok: true, value: { account: { username: 'Cara' }, world: { id: runtime.id, islandName: 'Sunny Bay', creator: 'alice', inviteCode: null } } });
    const me = await api.me();
    expect(me).toMatchObject({ ok: true, value: { worlds: [expect.objectContaining({ id: runtime.id })] } });
  });

  it('says why a sign-up was refused', async () => {
    const { server, runtime } = await aliceServer();
    const api = createApi(browserFetch(server).fetch);
    const request = { username: 'Cara', password: 'password-3', inviteCode: runtime.record.inviteCode, islandName: 'Sunny Bay' };
    expect(await api.register({ ...request, inviteCode: 'ZZZZZZZZZZ' })).toMatchObject({ ok: false, reason: 'bad-invite-code' });
    expect(await api.register({ ...request, username: 'alice' })).toMatchObject({ ok: false, reason: 'username-taken' });
  });

  it('creates a world, joins another with a code, and lets only the creator regenerate the invite code', async () => {
    const { server, runtime } = await aliceServer();
    const api = createApi(browserFetch(server).fetch);
    await api.login('bob', 'password-1');
    const created = await api.createWorld('Bob Bay');
    if (!created.ok) throw new Error(created.reason);
    expect(created.value.world).toMatchObject({ islandName: 'Bob Bay', creator: 'bob' });
    const code = created.value.world.inviteCode;
    expect(code).toMatch(/^[A-Z0-9]{10}$/);

    const regenerated = await api.regenerateInvite(created.value.world.id);
    if (!regenerated.ok) throw new Error(regenerated.reason);
    expect(regenerated.value.inviteCode).not.toBe(code);

    expect(await api.regenerateInvite(runtime.id)).toMatchObject({ ok: false, reason: 'not-the-creator' });
    expect(await api.joinWorld(runtime.record.inviteCode, 'Bob Again')).toMatchObject({ ok: false, reason: 'already-has-island' });
  });

  it('logs out this device', async () => {
    const { server } = await aliceServer();
    const api = createApi(browserFetch(server).fetch);
    await api.login('alice', 'password-1');
    expect(await api.logout()).toMatchObject({ ok: true });
    expect(await api.me()).toMatchObject({ ok: false, reason: 'not-signed-in' });
  });

  it('reports an unreachable server instead of throwing', async () => {
    const api = createApi(() => Promise.reject(new TypeError('fetch failed')));
    expect(await api.me()).toEqual({ ok: false, reason: 'unreachable', status: 0 });
  });
});
