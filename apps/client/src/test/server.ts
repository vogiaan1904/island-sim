import { Browser, ORIGIN, addAccount, startTestServer } from '../../../server/test/server.ts';
import { TICK_MS } from '../../../server/test/support.ts';
import type { IslandServer } from '../../../server/src/server.ts';
import type { OpenSocket } from '../connection/socket.ts';

// A real in-process game server for client tests that run in the node environment (`// @vitest-environment node`),
// driven the way the server's own tests drive it. Close every server in afterEach with `closeServers`.

let running: IslandServer[] = [];

export async function closeServers(): Promise<void> {
  await Promise.all(running.map((server) => server.close()));
  running = [];
}

/**
 * A server with Alice's world on seed 42 (her dock at 31,56 on slot 0) and Bob's island on slot 1. Accounts alice and
 * bob have the password 'password-1'. `tick` runs world ticks without waiting.
 */
export async function aliceServer() {
  const setup = await startTestServer();
  running.push(setup.server);
  const alice = await addAccount(setup.server, 'alice');
  const bob = await addAccount(setup.server, 'bob');
  const created = setup.server.worlds.create(alice, 'Palm Cove', 42);
  if (!created.ok) throw new Error(created.reason);
  setup.server.worlds.claim(created.runtime, bob, 'Coral Bay');
  const tick = (count = 1) => {
    for (let i = 0; i < count; i += 1) {
      setup.clock.advance(TICK_MS);
      void setup.server.worlds.runDue();
    }
  };
  return { ...setup, runtime: created.runtime, tick };
}

/** Browser-like fetch on the server: same-origin paths, the game's Origin header and a cookie jar, like a page would have. */
export function browserFetch(server: IslandServer): { fetch: typeof fetch; jar: Browser } {
  const jar = new Browser(server.url);
  const fetchLike = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('origin', ORIGIN);
    if (jar.token !== null) headers.set('cookie', `island_session=${jar.token}`);
    const res = await fetch(server.url + String(input), { ...init, headers });
    const setCookie = res.headers.getSetCookie()[0];
    if (setCookie?.startsWith('island_session=')) {
      const value = setCookie.slice('island_session='.length).split(';')[0] ?? '';
      jar.token = value === '' ? null : value;
    }
    return res;
  };
  return { fetch: fetchLike as typeof fetch, jar };
}

/** Opens sockets to the server as the browser with this cookie jar would: the game's Origin and its session cookie. */
export function browserSockets(jar: Browser): OpenSocket {
  return (url) => {
    const headers: Record<string, string> = { origin: ORIGIN };
    if (jar.token !== null) headers.cookie = `island_session=${jar.token}`;
    // Node's WebSocket takes headers as an extension; a page's sends the Origin and cookie by itself.
    return new WebSocket(url, { headers } as unknown as string[]);
  };
}

export function wsUrl(server: IslandServer): string {
  return `${server.url.replace('http', 'ws')}/ws`;
}
