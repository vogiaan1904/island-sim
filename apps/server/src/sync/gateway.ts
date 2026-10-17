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
    if (new URL(req.url ?? '/', 'http://host').pathname !== '/ws') return refuse(socket, 404);
    if (!fromOrigin(req, this.deps.config.origin)) return refuse(socket, 403);
    const token = cookieValue(req, SESSION_COOKIE);
    const session = token === null ? null : this.deps.accounts.session(token);
    if (!session) return refuse(socket, 401);
    this.server.handleUpgrade(req, socket, head, (ws) => {
      const connection = new Connection(ws, session, this.deps);
      this.connections.add(connection);
      ws.on('close', () => this.connections.delete(connection));
    });
  }

  /** Closes every connection; clients reconnect with backoff to the next server. */
  close(): void {
    clearInterval(this.heartbeat);
    this.stopListening();
    for (const connection of this.connections) connection.close(CLOSE_CODES.shuttingDown);
    this.server.close();
  }
}

function refuse(socket: Duplex, status: number): void {
  socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}
