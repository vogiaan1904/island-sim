import { CLOSE_CODES, PROTOCOL_VERSION, type AccountInfo, type ClientMessage, type PlayerCommand, type ServerMessage } from '@island/protocol';
import { parseServerMessage } from './messages.ts';

/** Opens the one WebSocket to /ws. A page passes `(url) => new WebSocket(url)`; the browser adds the Origin and cookie. */
export type OpenSocket = (url: string) => WebSocket;

export interface ConnectionHandlers {
  /** Every server message after the welcome, in order. */
  onMessage(message: ServerMessage): void;
  /** The socket closed after the welcome, with its close code (1006 when it just dropped). */
  onClose(code: number): void;
}

export interface GameConnection {
  readonly account: AccountInfo;
  /** Opens an island: the account's own, or a friend's for a read-only visit. The full state arrives as `island`. */
  open(world: string, slot: number): void;
  /** Sends a command for the own open island and returns its request id; the `result` carries the same id. */
  command(command: PlayerCommand): number;
  close(): void;
}

export type ConnectResult =
  | { ok: true; connection: GameConnection }
  /** 'update-required': the server needs a newer client (reload); 'closed': no welcome came (no session, server gone). */
  | { ok: false; reason: 'update-required' | 'closed'; code: number };

export interface ConnectOptions {
  url: string;
  openSocket: OpenSocket;
  handlers: ConnectionHandlers;
  /** Only tests change it, to play an older client. */
  protocolVersion?: number;
  /** Request ids continue from here (a reconnect keeps them apart from the commands sent before). */
  firstRequestId?: number;
}

/** Opens the socket, says hello and resolves on the welcome, or with why there is no connection. */
export function connectGame(options: ConnectOptions): Promise<ConnectResult> {
  const socket = options.openSocket(options.url);
  let nextRequestId = options.firstRequestId ?? 1;
  let welcomed = false;
  const send = (message: ClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  return new Promise((resolve) => {
    let updateRequired = false;
    socket.onopen = () => send({ type: 'hello', protocolVersion: options.protocolVersion ?? PROTOCOL_VERSION });
    socket.onmessage = (event: MessageEvent) => {
      const message = parseServerMessage(event.data);
      if (message === null) return;
      if (welcomed) {
        options.handlers.onMessage(message);
        return;
      }
      if (message.type === 'update-required') updateRequired = true;
      if (message.type !== 'welcome') return;
      welcomed = true;
      const connection: GameConnection = {
        account: message.account,
        open: (world, slot) => send({ type: 'open-island', world, slot }),
        command: (command) => {
          const requestId = nextRequestId;
          nextRequestId += 1;
          send({ type: 'command', requestId, command });
          return requestId;
        },
        close: () => socket.close(1000),
      };
      resolve({ ok: true, connection });
    };
    socket.onclose = (event: CloseEvent) => {
      if (welcomed) {
        options.handlers.onClose(event.code);
        return;
      }
      const reason = updateRequired || event.code === CLOSE_CODES.updateRequired ? 'update-required' : 'closed';
      resolve({ ok: false, reason, code: event.code });
    };
  });
}
