import type { PlayerCommand, Reason, ServerMessage, WorldStatus, WorldSummary } from '@island/protocol';
import { applyChanges, islandFromEntities, type IslandState, type SimEvent } from '@island/sim';
import { initialView, type ViewState } from './view.ts';

/** The island on screen, as the server last described it. Only server messages change it. */
export interface IslandMirror {
  world: string;
  slot: number;
  /** False on a read-only visit to a friend's island. */
  own: boolean;
  /** The tick the world is at, after the last message. */
  tick: number;
  status: WorldStatus;
  /** Every entity of the island and the market, keyed as the sim's change sets are. Never mutated: replaced. */
  entities: ReadonlyMap<string, unknown>;
  /** The island assembled from `entities` by the sim, once per change, for the sim's helpers and the render data. */
  state: IslandState;
  summary: WorldSummary;
  /** The owner's news from the full state (what happened while away); empty on a visit. */
  news: readonly SimEvent[];
  /** Events of the updates since the full state, oldest first. */
  events: readonly SimEvent[];
}

/** A command the player sent, by request id: pending until the server's result settles it. */
export type CommandState =
  | { requestId: number; command: PlayerCommand; status: 'pending' }
  | { requestId: number; command: PlayerCommand; status: 'ok'; data: Record<string, number> }
  | { requestId: number; command: PlayerCommand; status: 'refused'; reason: Reason; shortfallCents: number };

export interface ClientState {
  /** Null until an island opens. */
  island: IslandMirror | null;
  commands: Readonly<Record<number, CommandState>>;
  view: ViewState;
}

export function initialClientState(view: ViewState = initialView()): ClientState {
  return { island: null, commands: {}, view };
}

/**
 * The store's core: the client state after one server message. `island` replaces the mirror, `update` applies its
 * changes with the sim's own `applyChanges`, `status` sets the world status, `result` settles the matching command.
 * View state is never touched. Other messages (welcome, errors) leave the state as it is.
 */
export function applyMessage(state: ClientState, message: ServerMessage): ClientState {
  switch (message.type) {
    case 'island': {
      const entities = new Map(message.entities.map(({ key, value }) => [key, value]));
      const island: IslandMirror = {
        world: message.world,
        slot: message.slot,
        own: message.own,
        tick: message.tick,
        status: message.status,
        entities,
        state: islandFromEntities(entities, message.slot),
        summary: message.summary,
        news: message.news,
        events: [],
      };
      return { ...state, island };
    }
    case 'update': {
      const island = state.island;
      if (island === null || island.world !== message.world) return state;
      const next: IslandMirror = { ...island, tick: message.tick };
      if (message.changed.length > 0 || message.removed.length > 0) {
        // A copy, so earlier states (and React selectors holding them) keep their own entities.
        const entities = new Map(island.entities);
        applyChanges(entities, { changed: message.changed, removed: message.removed });
        next.entities = entities;
        next.state = islandFromEntities(entities, island.slot);
      }
      if (message.events.length > 0) next.events = [...island.events, ...message.events];
      if (message.summary !== undefined) next.summary = message.summary;
      return { ...state, island: next };
    }
    case 'status': {
      if (state.island === null || state.island.world !== message.world) return state;
      return { ...state, island: { ...state.island, status: message.status } };
    }
    case 'result': {
      const sent = state.commands[message.requestId];
      if (sent === undefined) return state;
      const settled: CommandState = message.ok
        ? { requestId: sent.requestId, command: sent.command, status: 'ok', data: message.data }
        : { requestId: sent.requestId, command: sent.command, status: 'refused', reason: message.reason, shortfallCents: message.shortfallCents };
      return { ...state, commands: { ...state.commands, [message.requestId]: settled } };
    }
    default:
      return state;
  }
}

/** Records a command sent with its request id, pending until its result arrives. */
export function commandSent(state: ClientState, requestId: number, command: PlayerCommand): ClientState {
  return { ...state, commands: { ...state.commands, [requestId]: { requestId, command, status: 'pending' } } };
}

/** Forgets the commands still pending, whose results can no longer come (the connection they were sent on is gone). */
export function commandsLost(state: ClientState): ClientState {
  const settled = Object.entries(state.commands).filter(([, command]) => command.status !== 'pending');
  if (settled.length === Object.keys(state.commands).length) return state;
  return { ...state, commands: Object.fromEntries(settled) };
}
