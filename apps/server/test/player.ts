import { PROTOCOL_VERSION, type IslandMessage, type ResultMessage, type ServerMessage, type WelcomeMessage } from '@island/protocol';
import { applyChanges } from '@island/sim';
import { WebSocket } from 'ws';
import type { IslandServer } from '../src/server.ts';
import { ORIGIN, type Browser } from './server.ts';

type Of<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;

interface Waiter {
  test: (message: ServerMessage) => boolean;
  resolve: (message: ServerMessage) => void;
}

/**
 * A game client on a real WebSocket, signed in with a browser's session cookie. Like the real client's store, it keeps
 * a mirror of the open island: the full state, then every update applied in order.
 */
export class Player {
  readonly socket: WebSocket;
  readonly closed: Promise<{ code: number }>;
  mirror = new Map<string, unknown>();
  /** Every message received, in order. */
  readonly received: ServerMessage[] = [];
  private readonly queue: ServerMessage[] = [];
  private readonly waiting: Waiter[] = [];
  private nextRequestId = 1;

  static connect(server: IslandServer, browser: Browser, options: { origin?: string; autoPong?: boolean } = {}): Promise<Player> {
    const headers: Record<string, string> = { origin: options.origin ?? ORIGIN };
    if (browser.token !== null) headers.cookie = `island_session=${browser.token}`;
    const socket = new WebSocket(`${server.url.replace('http', 'ws')}/ws`, { headers, autoPong: options.autoPong ?? true });
    return new Promise((resolve, reject) => {
      socket.once('open', () => resolve(new Player(socket)));
      socket.once('unexpected-response', (_req, res) => reject(new Error(`upgrade refused with ${res.statusCode}`)));
      socket.once('error', reject);
    });
  }

  private constructor(socket: WebSocket) {
    this.socket = socket;
    this.closed = new Promise((resolve) => socket.on('close', (code) => resolve({ code })));
    socket.on('message', (data) => this.receive(JSON.parse(data.toString()) as ServerMessage));
  }

  send(message: unknown): void {
    this.socket.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  /** The first message, received or to come within two seconds, of a type that matches; it is taken from the queue. */
  next<T extends ServerMessage['type']>(type: T, match: (message: Of<T>) => boolean = () => true): Promise<Of<T>> {
    const test = (message: ServerMessage) => message.type === type && match(message as Of<T>);
    const index = this.queue.findIndex(test);
    if (index >= 0) return Promise.resolve(this.queue.splice(index, 1)[0] as Of<T>);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no ${type} message came`)), 2_000);
      this.waiting.push({
        test,
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message as Of<T>);
        },
      });
    });
  }

  hello(): Promise<WelcomeMessage> {
    this.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION });
    return this.next('welcome');
  }

  open(world: string, slot: number): Promise<IslandMessage> {
    this.send({ type: 'open-island', world, slot });
    return this.next('island');
  }

  command(command: unknown): Promise<ResultMessage> {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    this.send({ type: 'command', requestId, command });
    return this.next('result', (message) => message.requestId === requestId);
  }

  private receive(message: ServerMessage): void {
    this.received.push(message);
    if (message.type === 'island') this.mirror = new Map(message.entities.map(({ key, value }) => [key, value]));
    if (message.type === 'update') applyChanges(this.mirror, { changed: message.changed, removed: message.removed });
    const index = this.waiting.findIndex((waiter) => waiter.test(message));
    if (index < 0) {
      this.queue.push(message);
      return;
    }
    const [waiter] = this.waiting.splice(index, 1);
    waiter?.resolve(message);
  }
}
