import { CLOSE_CODES, type PlayerCommand, type RegisterRequest, type ServerMessage, type WorldInfo } from '@island/protocol';
import type { Api, ClientApiReason } from '../connection/api.ts';
import { connectGame, type ConnectResult, type GameConnection, type OpenSocket } from '../connection/socket.ts';
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
  /** Milliseconds to wait before reconnect attempt number `attempt` (0 is the first). Defaults to `reconnectDelayMs`. */
  backoffMs?: (attempt: number) => number;
  /** Calls the listener when the page is hidden (false) and shown again (true); returns how to stop listening. */
  onVisibilityChange?: (listener: (visible: boolean) => void) => () => void;
  /** Wall-clock milliseconds, which keep running while the page sleeps (performance.now() may not). Defaults to Date.now. */
  wallNow?: () => number;
}

/** Away from the page for this long and the old socket is not trusted: the phone may have dropped it without a word. */
export const LONG_AWAY_MS = 20_000;

/** Waits 0.5 s, then 1 s, 2 s, and so on up to 15 s, each with up to a quarter more or less so phones do not reconnect in lockstep. */
export function reconnectDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(15_000, 500 * 2 ** Math.min(attempt, 10));
  return Math.round(base * (0.75 + random() * 0.5));
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
    onVisibilityChange: (listener) => {
      const changed = () => listener(document.visibilityState === 'visible');
      document.addEventListener('visibilitychange', changed);
      return () => document.removeEventListener('visibilitychange', changed);
    },
  };
}

export function createSession(store: GameStore, clock: GameClock, services: SessionServices): Session {
  let connection: GameConnection | null = null;
  let stopped = false;
  /** Which socket is current; handlers of an older one are ignored. */
  let generation = 0;
  /** The island to open again after a dropped connection: the one the player is looking at. */
  let opened: { world: string; slot: number } | null = null;
  /** Request ids continue across sockets, so a late result of an old command never settles a new one. */
  let nextRequestId = 1;
  let attempt = 0;
  let attempting = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hiddenAt: number | null = null;
  const wallNow = services.wallNow ?? Date.now;
  const backoff = services.backoffMs ?? reconnectDelayMs;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const later = (action: () => void) => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      action();
    }, backoff(attempt));
    attempt += 1;
  };
  /** Ends talking to the current socket; whatever it still says is ignored. */
  const retire = () => {
    generation += 1;
    const old = connection;
    connection = null;
    old?.close();
  };
  const end = (phase: 'signed-out' | 'update-required') => {
    clearTimer();
    opened = null;
    store.getState().setSession(phase === 'signed-out' ? { phase, account: null, worlds: [], reconnecting: false } : { phase, reconnecting: false });
  };

  const receive = (message: ServerMessage) => {
    if (message.type === 'island') {
      clock.reset(message.tick, services.now());
      clearTimer();
      attempt = 0;
    }
    if (message.type === 'update') clock.arrive(message.tick, services.now());
    store.getState().receive(message);
    if (message.type === 'island') {
      const { phase } = store.getState().session;
      store.getState().setSession(phase === 'opening' || phase === 'resting' ? { phase: 'playing', reconnecting: false } : { reconnecting: false });
    }
    if (message.type === 'error' && message.reason === 'world-paused') worldIsResting();
  };

  /** The world is paused or could not be loaded: it rests, and the island is asked for again until it is back. */
  const worldIsResting = () => {
    const state = store.getState();
    if (opened === null) return;
    if (state.island === null || state.island.world !== opened.world) state.setSession({ phase: 'resting', reconnecting: false });
    else {
      state.receive({ type: 'status', world: opened.world, status: 'paused' });
      state.setSession({ reconnecting: false });
    }
    later(() => {
      if (connection !== null && opened !== null) connection.open(opened.world, opened.slot);
    });
  };

  const onDropped = (code: number) => {
    connection = null;
    store.getState().commandsLost();
    if (code === CLOSE_CODES.sessionEnded) return end('signed-out');
    if (code === CLOSE_CODES.updateRequired) return end('update-required');
    reconnect();
  };

  /** Opens a socket and says hello. Null when this socket was replaced or the session stopped meanwhile. */
  const connectSocket = async (): Promise<ConnectResult | null> => {
    generation += 1;
    const mine = generation;
    const result = await connectGame({
      url: services.socketUrl,
      openSocket: services.openSocket,
      handlers: {
        onMessage: (message) => {
          if (mine === generation) receive(message);
        },
        onClose: (code) => {
          if (mine === generation) onDropped(code);
        },
      },
      firstRequestId: nextRequestId,
      ...(services.protocolVersion === undefined ? {} : { protocolVersion: services.protocolVersion }),
    });
    if (stopped || mine !== generation) {
      if (result.ok) result.connection.close();
      return null;
    }
    return result;
  };

  /** Shows the calm reconnecting state and tries again after the backoff. */
  const reconnect = () => {
    if (stopped || opened === null) return;
    store.getState().setSession({ reconnecting: true });
    later(() => void tryReconnect());
  };

  const tryReconnect = async () => {
    if (stopped || opened === null || attempting) return;
    attempting = true;
    clearTimer();
    try {
      const result = await connectSocket();
      if (result === null || opened === null) return;
      if (result.ok) {
        connection = result.connection;
        connection.open(opened.world, opened.slot);
        return;
      }
      if (result.reason === 'update-required') return end('update-required');
      // No welcome: the server is away, or this device is no longer signed in.
      const me = await services.api.me();
      if (stopped || opened === null) return;
      if (!me.ok && me.reason === 'not-signed-in') return end('signed-out');
      reconnect();
    } finally {
      attempting = false;
    }
  };

  const unwatchVisibility = services.onVisibilityChange?.((visible) => {
    if (!visible) {
      hiddenAt = wallNow();
      return;
    }
    const away = hiddenAt === null ? 0 : wallNow() - hiddenAt;
    hiddenAt = null;
    if (stopped || opened === null || attempting) return;
    if (connection === null) {
      // Waiting out a backoff: the player is back, so try now.
      if (timer !== null) void tryReconnect();
    } else if (away >= LONG_AWAY_MS) {
      retire();
      store.getState().commandsLost();
      store.getState().setSession({ reconnecting: true });
      void tryReconnect();
    }
  });

  /** Leaves the open island without a word to the store: no reconnecting, no pending attempt. */
  const leave = () => {
    clearTimer();
    opened = null;
    retire();
  };

  const connectAndOpen = async (world: WorldInfo) => {
    leave();
    attempt = 0;
    store.getState().clearIsland();
    store.getState().setSession({ phase: 'opening', reconnecting: false });
    opened = { world: world.id, slot: world.slot };
    const result = await connectSocket();
    if (result === null) return;
    if (!result.ok) {
      opened = null;
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
      leave();
      store.getState().clearIsland();
      store.getState().setSession({ phase: 'worlds', reconnecting: false });
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
      leave();
      store.getState().clearIsland();
      store.getState().setSession({ phase: 'signed-out', account: null, worlds: [], reconnecting: false });
      return null;
    },
    command(command) {
      const state = store.getState();
      const island = state.island;
      if (connection === null || island === null || !island.own || island.status !== 'running' || state.session.reconnecting) return null;
      const requestId = connection.command(command);
      nextRequestId = requestId + 1;
      state.commandSent(requestId, command);
      return requestId;
    },
    stop() {
      stopped = true;
      clearTimer();
      unwatchVisibility?.();
      retire();
    },
  };
}
