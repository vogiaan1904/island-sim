import { CLOSE_CODES, type PlayerCommand, type RegisterRequest, type ServerMessage, type WorldInfo } from '@island/protocol';
import type { Api, ClientApiReason } from '../connection/api.ts';
import { connectGame, type GameConnection, type OpenSocket } from '../connection/socket.ts';
import type { GameClock } from '../glide/clock.ts';
import type { GameStore } from '../store/store.ts';

// The app's wiring from signed-out to a live island: the API says who is signed in, the socket opens their island,
// every server message goes into the store and moves the gliding clock. Screens read the store; they call these
// actions. Later tickets add theirs here (visit, reconnect). Actions that can be refused return null on success and
// the reason otherwise, for the screen to say in words.

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
  /** Asks the server who is signed in; opens their island, shows their worlds, or asks for a log-in. */
  start(): Promise<void>;
  /** Null on success (the island then opens), else why the log-in was refused. */
  logIn(username: string, password: string): Promise<ClientApiReason | null>;
  /** A new account with an island in the world the invite code belongs to; null on success (the island then opens). */
  register(request: RegisterRequest): Promise<ClientApiReason | null>;
  /** Makes a world with the player's island in it; null on success. The world screen then shows its invite code. */
  createWorld(islandName: string): Promise<ClientApiReason | null>;
  /** Claims an island in the world the code belongs to; null on success (the island then opens). */
  joinWorld(inviteCode: string, islandName: string): Promise<ClientApiReason | null>;
  /** Opens the player's own island in one of their worlds (from the world screen). */
  openWorld(worldId: string): void;
  /** Leaves the open island for the world screen, with the list of worlds fresh from the server. */
  showWorlds(): Promise<void>;
  /** A new invite code for a world the player created; null on success (the store's world list then has it). */
  regenerateInvite(worldId: string): Promise<ClientApiReason | null>;
  /** Ends this device's session and returns to the log-in screen; null on success. */
  logOut(): Promise<ClientApiReason | null>;
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
  /** Counts connections, so the messages and the close of an older one are ignored. */
  let generation = 0;

  const receive = (message: ServerMessage) => {
    if (message.type === 'island') clock.reset(message.tick, services.now());
    if (message.type === 'update') clock.arrive(message.tick, services.now());
    store.getState().receive(message);
    if (message.type === 'island' && store.getState().session.phase === 'opening') store.getState().setSession({ phase: 'playing' });
  };

  /** Drops the open connection without touching the store: the caller moves the session on. */
  const closeConnection = () => {
    generation += 1;
    connection?.close();
    connection = null;
  };

  const connectAndOpen = async (world: WorldInfo) => {
    closeConnection();
    const mine = generation;
    store.getState().clearIsland();
    store.getState().setSession({ phase: 'opening' });
    const options = {
      url: services.socketUrl,
      openSocket: services.openSocket,
      handlers: {
        onMessage: (message: ServerMessage) => {
          if (mine === generation) receive(message);
        },
        onClose: (code: number) => {
          if (mine !== generation) return;
          connection = null;
          if (code === CLOSE_CODES.sessionEnded) {
            store.getState().clearIsland();
            store.getState().setSession({ phase: 'signed-out', account: null, worlds: [] });
          }
          // Reconnecting with backoff is ticket 19.
        },
      },
      ...(services.protocolVersion === undefined ? {} : { protocolVersion: services.protocolVersion }),
    };
    const result = await connectGame(options);
    if (stopped || mine !== generation) {
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

  /** The player's account and worlds from the server, into the store; the reason when the server cannot say. */
  const refreshWorlds = async (): Promise<ClientApiReason | null> => {
    const me = await services.api.me();
    if (!me.ok) return me.reason;
    store.getState().setSession({ account: me.value.account, worlds: me.value.worlds });
    return null;
  };

  /** Where a signed-in player goes: straight to their only island, else the world screen. */
  const enter = async (): Promise<ClientApiReason | null> => {
    const reason = await refreshWorlds();
    if (reason !== null) return reason;
    const worlds = store.getState().session.worlds;
    const only = worlds.length === 1 ? worlds[0] : undefined;
    if (only === undefined) store.getState().setSession({ phase: 'worlds' });
    else void connectAndOpen(only);
    return null;
  };

  /** An island was just claimed (sign-up, create, join): refresh the list, then open it or stay on the world screen. */
  const claimed = async (world: WorldInfo, open: boolean): Promise<void> => {
    await refreshWorlds();
    // The list is the server's; if the refresh failed, the response still has the new world.
    const known = store.getState().session.worlds;
    if (!known.some((w) => w.id === world.id)) store.getState().setSession({ worlds: [...known, world] });
    if (open) void connectAndOpen(world);
    else store.getState().setSession({ phase: 'worlds' });
  };

  return {
    async start() {
      const reason = await enter();
      if (reason !== null) store.getState().setSession({ phase: 'signed-out' });
    },
    async logIn(username, password) {
      const login = await services.api.login(username, password);
      if (!login.ok) return login.reason;
      return enter();
    },
    async register(request) {
      const registered = await services.api.register(request);
      if (!registered.ok) return registered.reason;
      store.getState().setSession({ account: registered.value.account });
      await claimed(registered.value.world, true);
      return null;
    },
    async createWorld(islandName) {
      const created = await services.api.createWorld(islandName);
      if (!created.ok) return created.reason;
      await claimed(created.value.world, false);
      return null;
    },
    async joinWorld(inviteCode, islandName) {
      const joined = await services.api.joinWorld(inviteCode, islandName);
      if (!joined.ok) return joined.reason;
      await claimed(joined.value.world, true);
      return null;
    },
    openWorld(worldId) {
      const world = store.getState().session.worlds.find((w) => w.id === worldId);
      if (world !== undefined) void connectAndOpen(world);
    },
    async showWorlds() {
      closeConnection();
      store.getState().clearIsland();
      store.getState().setSession({ phase: 'worlds' });
      await refreshWorlds();
    },
    async regenerateInvite(worldId) {
      const result = await services.api.regenerateInvite(worldId);
      if (!result.ok) return result.reason;
      const { worlds } = store.getState().session;
      store.getState().setSession({ worlds: worlds.map((w) => (w.id === worldId ? { ...w, inviteCode: result.value.inviteCode } : w)) });
      return null;
    },
    async logOut() {
      const result = await services.api.logout();
      if (!result.ok) return result.reason;
      closeConnection();
      store.getState().clearIsland();
      store.getState().setSession({ phase: 'signed-out', account: null, worlds: [] });
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
      closeConnection();
    },
  };
}
