import {
  CLOSE_CODES,
  ClientMessage,
  PROTOCOL_VERSION,
  PlayerCommand,
  toSimCommand,
  type EventKey,
  type ServerMessage,
  type ServerReason,
} from '@island/protocol';
import * as v from 'valibot';
import type { WebSocket } from 'ws';
import { RateLimiter } from '../accounts/rate-limit.ts';
import type { AccountRecord } from '../accounts/store.ts';
import type { Clock } from '../clock.ts';
import type { ServerConfig } from '../config.ts';
import type { Log } from '../log.ts';
import type { Worlds } from '../worlds/registry.ts';
import type { RuntimeEvent, WorldRuntime } from '../worlds/runtime.ts';
import type { WorldStore } from '../worlds/store.ts';
import { islandChanges, islandEntities, islandEvents } from './views.ts';

export interface ConnectionDeps {
  config: Pick<ServerConfig, 'helloTimeoutMs'>;
  clock: Clock;
  log: Log;
  worlds: Worlds;
  store: WorldStore;
}

/** The owner's check-in is logged at most once per game hour, however often a phone reconnects. */
export const CHECK_IN_EVERY_TICKS = 60;
/** The news on opening your own island: at most this many of the newest events since the last-seen marker. */
const NEWS_LIMIT = 100;
/** A connection with more than this waiting to be sent cannot keep up; it is closed and reconnects (sync-protocol.md). */
const MAX_BUFFERED_BYTES = 1_000_000;

interface OpenIsland {
  runtime: WorldRuntime;
  slot: number;
  own: boolean;
  leave: () => void;
}

/**
 * One player's WebSocket (spec 5.3). The account comes from the session the upgrade checked, never from a message.
 * Nothing a client sends can throw out of here: bad input gets a reason code, garbage closes this connection only.
 */
export class Connection {
  readonly account: AccountRecord;
  readonly tokenHash: string;
  /** Cleared on each heartbeat ping, set again by the pong. */
  alive = true;
  private readonly socket: WebSocket;
  private readonly deps: ConnectionDeps;
  private greeted = false;
  /** Set when the server closes this connection or the socket closes: ws keeps delivering messages while CLOSING. */
  private closed = false;
  private open: OpenIsland | null = null;
  private readonly helloTimer: ReturnType<typeof setTimeout>;
  private readonly commands: RateLimiter;
  private readonly messages: RateLimiter;

  constructor(socket: WebSocket, session: { account: AccountRecord; tokenHash: string }, deps: ConnectionDeps) {
    this.socket = socket;
    this.account = session.account;
    this.tokenHash = session.tokenHash;
    this.deps = deps;
    this.commands = new RateLimiter(30, 10_000, deps.clock);
    this.messages = new RateLimiter(60, 10_000, deps.clock);
    this.helloTimer = setTimeout(() => this.close(CLOSE_CODES.badHello), deps.config.helloTimeoutMs);
    socket.on('message', (data, isBinary) => {
      try {
        this.receive(data.toString(), isBinary);
      } catch (error) {
        deps.log.error('message failed', { account: this.account.id, error: error instanceof Error ? error.stack : String(error) });
        this.close(CLOSE_CODES.badData);
      }
    });
    socket.on('pong', () => {
      this.alive = true;
    });
    socket.on('close', () => this.cleanUp());
    // ws emits an error for an oversized frame, invalid UTF-8 or a bad opcode and closes the socket itself; without a
    // listener the emit is an uncaught exception that would stop every world.
    socket.on('error', (error) => {
      deps.log.warn('socket error', { account: this.account.id, error: error.message });
      this.cleanUp();
    });
  }

  close(code: number): void {
    this.cleanUp();
    this.socket.close(code);
  }

  /** Closes at once, without the closing handshake: for a connection that stopped answering. */
  terminate(): void {
    this.cleanUp();
    this.socket.terminate();
  }

  ping(): void {
    this.alive = false;
    this.socket.ping();
  }

  private receive(text: string, isBinary: boolean): void {
    if (this.closed || this.socket.readyState !== this.socket.OPEN) return;
    let json: unknown;
    try {
      json = isBinary ? undefined : JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (json === undefined) {
      this.close(CLOSE_CODES.badData);
      return;
    }
    if (!this.greeted && isOtherVersionHello(json)) {
      // Before the strict parse: a newer client's hello may carry fields this version does not know, and it must
      // still learn here that it must update, not get a bad-hello close.
      this.hello(json.protocolVersion);
      return;
    }
    const parsed = v.safeParse(ClientMessage, json);
    if (!this.greeted) {
      if (!parsed.success || parsed.output.type !== 'hello') this.close(CLOSE_CODES.badHello);
      else this.hello(parsed.output.protocolVersion);
      return;
    }
    if (!parsed.success) {
      this.error('bad-message');
      return;
    }
    const message = parsed.output;
    if (message.type !== 'command' && !this.messages.take('all')) {
      this.error('rate-limited');
      return;
    }
    switch (message.type) {
      case 'hello':
        this.error('bad-message');
        return;
      case 'open-island':
        this.openIsland(message.world, message.slot);
        return;
      case 'close-island':
        this.leave();
        return;
      case 'command':
        this.command(message.requestId, message.command);
        return;
      case 'mark-seen':
        this.markSeen(message.key);
        return;
    }
  }

  /** The first message checks the protocol version (spec 5.3); an old cached app learns here that it must update. */
  private hello(protocolVersion: number): void {
    clearTimeout(this.helloTimer);
    if (protocolVersion !== PROTOCOL_VERSION) {
      this.send({ type: 'update-required', protocolVersion: PROTOCOL_VERSION });
      this.close(CLOSE_CODES.updateRequired);
      return;
    }
    this.greeted = true;
    this.send({ type: 'welcome', protocolVersion: PROTOCOL_VERSION, account: { id: this.account.id, username: this.account.username } });
  }

  /**
   * Opens an island of a world the account has an island in: its own, or a friend's to visit read-only (spec 12.3).
   * Opening your own island checks you in (spec 12.1), unless the world is paused or catching up (it happens on the
   * next open then).
   */
  private openIsland(worldId: string, slot: number): void {
    const runtime = this.deps.worlds.get(worldId);
    if (!runtime && this.deps.worlds.failed.has(worldId) && this.deps.worlds.membershipsOf(this.account.id).some((m) => m.worldId === worldId)) {
      // A world that could not be loaded rests like a paused one until the host acts.
      this.error('world-paused');
      return;
    }
    if (!runtime || runtime.slotOf(this.account.id) === null) {
      this.error('not-a-member');
      return;
    }
    const island = runtime.world.islands[slot];
    if (!island || island.owner === null) {
      this.error('island-not-claimed');
      return;
    }
    this.leave();
    const own = island.owner === this.account.id;
    const lastCheckIn = island.lastCheckInTick;
    if (own && runtime.status === 'running' && (lastCheckIn === null || runtime.world.tick - lastCheckIn >= CHECK_IN_EVERY_TICKS)) {
      const result = runtime.apply({ type: 'check-in', slot }, this.account.id);
      if (!result.ok) this.deps.log.warn('check-in refused', { world: runtime.id, slot, reason: result.reason });
    }
    const leave = runtime.subscribe((event) => this.hear(event));
    this.open = { runtime, slot, own, leave };
    this.sendIsland();
  }

  private sendIsland(): void {
    if (!this.open) return;
    const { runtime, slot, own } = this.open;
    const { store } = this.deps;
    const news = own ? store.eventsAfter(runtime.id, slot, store.lastSeen(this.account.id, runtime.id), NEWS_LIMIT) : [];
    this.send({
      type: 'island',
      world: runtime.id,
      slot,
      own,
      tick: runtime.world.tick,
      status: runtime.status,
      entities: islandEntities(runtime.world, slot),
      summary: runtime.summary(),
      news,
    });
  }

  private hear(event: RuntimeEvent): void {
    if (!this.open) return;
    const { runtime, slot } = this.open;
    if (event.kind === 'resync') {
      this.sendIsland();
    } else if (event.kind === 'status') {
      this.send({ type: 'status', world: runtime.id, status: event.status });
    } else {
      const { changed, removed } = islandChanges(event.changes, slot);
      this.send({
        type: 'update',
        world: runtime.id,
        tick: event.tick,
        source: event.source,
        changed,
        removed,
        events: islandEvents(event.events, slot),
        ...(event.summary ? { summary: event.summary } : {}),
      });
    }
  }

  /**
   * The command pipeline (island-server): the message envelope (receive), access (your own island, open), the rate
   * limit, the command schema, then the sim through the world, which logs an accepted command before this reply.
   * Access comes before the command schema, so any payload gets a fixed no-island-open or not-your-island answer.
   * Refusals go to the server log only.
   */
  private command(requestId: number, raw: unknown): void {
    const refuse = (reason: ServerReason) => this.send({ type: 'result', requestId, ok: false, reason, shortfallCents: 0 });
    if (!this.open) return refuse('no-island-open');
    if (!this.open.own) return refuse('not-your-island');
    if (!this.commands.take('all')) return refuse('rate-limited');
    const parsed = v.safeParse(PlayerCommand, raw);
    if (!parsed.success) return refuse('bad-command');
    const { runtime, slot } = this.open;
    const result = runtime.apply(toSimCommand(parsed.output, slot), this.account.id);
    if (result.ok) {
      this.send({ type: 'result', requestId, ok: true, data: result.data });
    } else {
      this.deps.log.info('command refused', { world: runtime.id, account: this.account.id, command: parsed.output.type, reason: result.reason });
      this.send({ type: 'result', requestId, ok: false, reason: result.reason, shortfallCents: result.shortfallCents });
    }
  }

  private markSeen(key: EventKey): void {
    if (!this.open?.own) {
      this.error('no-island-open');
      return;
    }
    this.deps.store.markSeen(this.account.id, this.open.runtime.id, key);
  }

  private leave(): void {
    this.open?.leave();
    this.open = null;
  }

  private error(reason: Extract<ServerMessage, { type: 'error' }>['reason']): void {
    this.send({ type: 'error', reason });
  }

  private send(message: ServerMessage): void {
    if (this.socket.readyState !== this.socket.OPEN) return;
    if (this.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      this.terminate();
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  private cleanUp(): void {
    this.closed = true;
    clearTimeout(this.helloTimer);
    this.leave();
  }
}

/** A hello of another protocol version, whatever else it carries. */
function isOtherVersionHello(json: unknown): json is { type: 'hello'; protocolVersion: number } {
  if (typeof json !== 'object' || json === null) return false;
  const { type, protocolVersion } = json as { type?: unknown; protocolVersion?: unknown };
  return type === 'hello' && typeof protocolVersion === 'number' && protocolVersion !== PROTOCOL_VERSION;
}
