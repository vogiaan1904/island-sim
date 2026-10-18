import { CLOSE_CODES, type MeResponse, type PlayerCommand, type ServerMessage } from '@island/protocol';
import type { Api, ClientApiReason } from '../connection/api.ts';
import { connectGame, type GameConnection, type OpenSocket } from '../connection/socket.ts';
import type { GameClock } from '../glide/clock.ts';
import type { GameStore } from '../store/store.ts';

// The app's wiring from signed-out to a live island: the API says who is signed in, the socket opens their island,
// every server message goes into the store and moves the gliding clock. Screens read the store; they call these
// actions. Later tickets add theirs here (sign up, pick a world, visit, reconnect, log out).

export interface SessionServices {
  api: Api;
  openSocket: OpenSocket;
  /** The socket address: same origin as the page, path /ws. */
  socketUrl: string;
  /** Wall-clock milliseconds for the gliding clock; performance.now() on a page. */
  now: () => number;
  /** Only tests change it. */
  protocolVersion?: number;
}

export interface Session {
  /** Asks the server who is signed in; opens their island, or asks for a log-in. */
  start(): Promise<void>;
  /** Null on success (the island then opens), else why the log-in was refused. */
  logIn(username: string, password: string): Promise<ClientApiReason | null>;
  /** Sends a command for the own open island and returns its request id; null when no own island is open. */
  command(command: PlayerCommand): number | null;
  stop(): void;
}

/** A real page's services: the socket on the page's own origin, performance.now() for the gliding clock. */
export function pageServices(api: Api): SessionServices {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return {
    api,
    openSocket: (url) => new WebSocket(url),
    socketUrl: `${protocol}//${window.location.host}/ws`,
    now: () => performance.now(),
  };
}

export function createSession(store: GameStore, clock: GameClock, services: SessionServices): Session {
  let connection: GameConnection | null = null;
  let stopped = false;

  const receive = (message: ServerMessage) => {
    if (message.type === 'island') clock.reset(message.tick, services.now());
    if (message.type === 'update') clock.arrive(message.tick, services.now());
    store.getState().receive(message);
    if (message.type === 'island' && store.getState().session.phase === 'opening') store.getState().setSession({ phase: 'playing' });
  };

  const openIsland = async (me: MeResponse) => {
    store.getState().setSession({ account: me.account, worlds: me.worlds });
    // The world list and picking a world come with ticket 06; until then the first world opens.
    const world = me.worlds[0];
    if (world === undefined) {
      store.getState().setSession({ phase: 'no-island' });
      return;
    }
    store.getState().setSession({ phase: 'opening' });
    const options = {
      url: services.socketUrl,
      openSocket: services.openSocket,
      handlers: {
        onMessage: receive,
        onClose: (code: number) => {
          connection = null;
          if (code === CLOSE_CODES.sessionEnded) store.getState().setSession({ phase: 'signed-out', account: null, worlds: [] });
          // Reconnecting with backoff is ticket 19.
        },
      },
      ...(services.protocolVersion === undefined ? {} : { protocolVersion: services.protocolVersion }),
    };
    const result = await connectGame(options);
    if (stopped) {
      if (result.ok) result.connection.close();
      return;
    }
    if (!result.ok) {
      store.getState().setSession({ phase: result.reason === 'update-required' ? 'update-required' : 'signed-out' });
      return;
    }
    connection = result.connection;
    connection.open(world.id, world.slot);
  };

  return {
    async start() {
      const me = await services.api.me();
      if (!me.ok) {
        store.getState().setSession({ phase: 'signed-out' });
        return;
      }
      await openIsland(me.value);
    },
    async logIn(username, password) {
      const login = await services.api.login(username, password);
      if (!login.ok) return login.reason;
      const me = await services.api.me();
      if (!me.ok) return me.reason;
      void openIsland(me.value);
      return null;
    },
    command(command) {
      const island = store.getState().island;
      if (connection === null || island === null || !island.own) return null;
      const requestId = connection.command(command);
      store.getState().commandSent(requestId, command);
      return requestId;
    },
    stop() {
      stopped = true;
      connection?.close();
      connection = null;
    },
  };
}
