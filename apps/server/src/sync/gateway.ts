import { STATUS_CODES, type IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { CLOSE_CODES } from '@island/protocol';
import { WebSocketServer } from 'ws';
import type { Accounts } from '../accounts/accounts.ts';
import type { ServerConfig } from '../config.ts';
import { SESSION_COOKIE, cookieValue, fromOrigin } from '../http/request.ts';
import { Connection, type ConnectionDeps } from './connection.ts';

export interface GatewayDeps extends ConnectionDeps {
  config: Pick<ServerConfig, 'origin' | 'helloTimeoutMs' | 'heartbeatMs'>;
  accounts: Accounts;
}

/** Client messages are commands and subscription changes; a long road is the largest. */
const MAX_MESSAGE_BYTES = 16 * 1_024;

/** At shutdown a client gets this long to answer the close frame; one that vanished is cut off after it. */
const CLOSE_GRACE_MS = 2_000;

/**
 * Accepts WebSocket upgrades on /ws (spec 5.3): only from the game's own Origin (spec 12.3: the cookie alone is not
 * enough) and with a valid session cookie, whose account every message then acts as.
 */
export class Gateway {
  private readonly deps: GatewayDeps;
  private readonly server = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: true });
  private readonly connections = new Set<Connection>();
  private readonly heartbeat: ReturnType<typeof setInterval>;
  private readonly stopListening: () => void;
  private closing = false;
  /** Set while close() waits for the connections to go; called when the last one has. */
  private drained: (() => void) | null = null;

  constructor(deps: GatewayDeps) {
    this.deps = deps;
    // Phones often vanish without a close frame: one that did not answer the last ping is dropped (sync-protocol.md).
    this.heartbeat = setInterval(() => {
      for (const connection of this.connections) {
        if (connection.alive) connection.ping();
        else connection.terminate();
      }
    }, deps.config.heartbeatMs);
    this.stopListening = deps.accounts.onSessionsEnded((ended) => {
      for (const connection of this.connections) {
        if (ended(connection.tokenHash, connection.account.id)) connection.close(CLOSE_CODES.sessionEnded);
      }
    });
  }

  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    // Once upgraded, Node leaves the raw socket without an 'error' listener: a client that resets would crash the process.
    socket.on('error', () => {});
    try {
      if (this.closing) return refuse(socket, 503);
      // Not URL parsing: Node accepts request targets such as "//" that `new URL` throws on.
      if ((req.url ?? '/').split('?')[0] !== '/ws') return refuse(socket, 404);
      if (!fromOrigin(req, this.deps.config.origin)) return refuse(socket, 403);
      const token = cookieValue(req, SESSION_COOKIE);
      const session = token === null ? null : this.deps.accounts.session(token);
      if (!session) return refuse(socket, 401);
      this.server.handleUpgrade(req, socket, head, (ws) => {
        const connection = new Connection(ws, session, this.deps);
        this.connections.add(connection);
        ws.on('close', () => {
          this.connections.delete(connection);
          if (this.connections.size === 0) this.drained?.();
        });
      });
    } catch (error) {
      this.deps.log.error('upgrade failed', { error: error instanceof Error ? error.stack : String(error) });
      refuse(socket, 500);
    }
  }

  /**
   * Closes every connection; clients reconnect with backoff to the next server. Resolves when they are all gone: the
   * ones that did not answer the close frame within the grace are cut off, so a phone that vanished cannot hold the
   * shutdown up (a socket otherwise waits 30 s for the closing handshake).
   */
  close(): Promise<void> {
    this.closing = true;
    clearInterval(this.heartbeat);
    this.stopListening();
    for (const connection of [...this.connections]) connection.close(CLOSE_CODES.shuttingDown);
    this.server.close();
    if (this.connections.size === 0) return Promise.resolve();
    return new Promise((resolve) => {
      const cutOff = setTimeout(() => {
        for (const connection of [...this.connections]) connection.terminate();
      }, CLOSE_GRACE_MS);
      this.drained = () => {
        clearTimeout(cutOff);
        resolve();
      };
    });
  }
}

function refuse(socket: Duplex, status: number): void {
  socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`, () => socket.destroy());
}
