// @vitest-environment node
import { CLOSE_CODES, PROTOCOL_VERSION, type ServerMessage } from '@island/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aliceServer, browserFetch, browserSockets, closeServers, wsUrl } from '../test/server.ts';
import { connectGame } from './socket.ts';

afterEach(closeServers);

async function signedIn() {
  const setup = await aliceServer();
  const { jar } = browserFetch(setup.server);
  await jar.login('alice');
  const received: ServerMessage[] = [];
  const closes: number[] = [];
  const handlers = { onMessage: (m: ServerMessage) => received.push(m), onClose: (code: number) => closes.push(code) };
  return { ...setup, jar, received, closes, handlers };
}

describe('the game connection', () => {
  it('says hello, opens the island and sends commands with increasing request ids', async () => {
    const { server, runtime, jar, received, handlers } = await signedIn();
    const result = await connectGame({ url: wsUrl(server), openSocket: browserSockets(jar), handlers });
    if (!result.ok) throw new Error(result.reason);
    expect(result.connection.account.username).toBe('alice');

    result.connection.open(runtime.id, 0);
    await vi.waitFor(() => expect(received.some((m) => m.type === 'island')).toBe(true));
    expect(received.find((m) => m.type === 'island')).toMatchObject({ world: runtime.id, slot: 0, own: true });

    const first = result.connection.command({ type: 'place-road', tiles: [[14, 26]] });
    const second = result.connection.command({ type: 'hire-commuters', count: 2 });
    expect([first, second]).toEqual([1, 2]);
    await vi.waitFor(() => expect(received.filter((m) => m.type === 'result')).toHaveLength(2));
    expect(received.filter((m) => m.type === 'result')).toEqual([
      { type: 'result', requestId: 1, ok: true, data: { tilesBuilt: 1 } },
      { type: 'result', requestId: 2, ok: true, data: { hired: 2 } },
    ]);
    result.connection.close();
  });

  it('answers update-required when the server needs another protocol version', async () => {
    const { server, jar, handlers } = await signedIn();
    const result = await connectGame({ url: wsUrl(server), openSocket: browserSockets(jar), handlers, protocolVersion: PROTOCOL_VERSION + 1 });
    expect(result).toEqual({ ok: false, reason: 'update-required', code: CLOSE_CODES.updateRequired });
  });

  it('reports a refused connection without a session', async () => {
    const { server, jar, handlers } = await signedIn();
    jar.token = null;
    const result = await connectGame({ url: wsUrl(server), openSocket: browserSockets(jar), handlers });
    expect(result).toMatchObject({ ok: false, reason: 'closed' });
  });

  it('tells its handler the close code when the server ends the session', async () => {
    const { server, jar, closes, handlers } = await signedIn();
    const result = await connectGame({ url: wsUrl(server), openSocket: browserSockets(jar), handlers });
    if (!result.ok) throw new Error(result.reason);
    // Logging out this jar's session closes its sockets with "session ended".
    const same = browserFetch(server);
    same.jar.token = jar.token;
    await same.fetch('/api/logout', { method: 'POST' });
    await vi.waitFor(() => expect(closes).toEqual([CLOSE_CODES.sessionEnded]));
  });
});
