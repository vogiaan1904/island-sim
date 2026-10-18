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

  it('reports an unreachable server instead of throwing', async () => {
    const api = createApi(() => Promise.reject(new TypeError('fetch failed')));
    expect(await api.me()).toEqual({ ok: false, reason: 'unreachable', status: 0 });
  });
});
