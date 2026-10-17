import type { StageId } from '@island/content';
import type { EntityChange, ReasonCode, SimEvent } from '@island/sim';
import * as v from 'valibot';
import { MAX_COUNT, Slot, WorldId, whole } from './fields.ts';
import type { AccountInfo } from './http.ts';

// WebSocket messages (spec 5.3). The client's messages are schema-checked by the server; the server's are typed only,
// since the client trusts its own server and the protocol version catches a mismatch.

const EventKey = v.strictObject({
  tick: whole(Number.MAX_SAFE_INTEGER),
  source: whole(Number.MAX_SAFE_INTEGER),
  index: whole(Number.MAX_SAFE_INTEGER),
});

export const ClientMessage = v.variant('type', [
  /** The first message on every connection. */
  v.strictObject({ type: v.literal('hello'), protocolVersion: whole(MAX_COUNT) }),
  /** Opens an island of a world the account has an island in: its own, or a friend's for a read-only visit. */
  v.strictObject({ type: v.literal('open-island'), world: WorldId, slot: Slot }),
  v.strictObject({ type: v.literal('close-island') }),
  /** A command for the account's own island, which must be open. The command is checked on its own, so even a bad one
   * gets a result with its request id. */
  v.strictObject({ type: v.literal('command'), requestId: whole(MAX_COUNT), command: v.unknown() }),
  /** The player has seen the news up to this event of the open island's world. */
  v.strictObject({ type: v.literal('mark-seen'), key: EventKey }),
]);

export type ClientMessage = v.InferOutput<typeof ClientMessage>;
export type EventKey = v.InferOutput<typeof EventKey>;

/** A paused world is shown as "This island is resting, back soon" (spec 12.3); a catching-up one accepts no commands. */
export type WorldStatus = 'running' | 'paused' | 'catching-up';

export interface IslandSummary {
  slot: number;
  name: string;
  /** The owner's username, as typed. */
  owner: string;
  stage: StageId;
  residents: number;
}

/** The other islands of the world, sent with the full state and with an update whenever it changes. */
export interface WorldSummary {
  islands: IslandSummary[];
}

export type ServerReason =
  | 'bad-message'
  | 'bad-command'
  | 'rate-limited'
  | 'no-island-open'
  | 'not-your-island'
  | 'not-a-member'
  | 'world-paused'
  | 'world-catching-up'
  | 'server-error';

/** Why a command was refused: by the server (access, limits) or by the sim (game rules). */
export type Reason = ServerReason | ReasonCode;

export interface WelcomeMessage {
  type: 'welcome';
  protocolVersion: number;
  account: AccountInfo;
}

export interface UpdateRequiredMessage {
  type: 'update-required';
  protocolVersion: number;
}

/** The full state of one island, sent when it is opened and again after the world catches up. */
export interface IslandMessage {
  type: 'island';
  world: string;
  slot: number;
  /** True for the account's own island; a visit is read-only. */
  own: boolean;
  tick: number;
  status: WorldStatus;
  /** Every entity of the island and the market, keyed as the sim's change sets are: the client's mirror starts here. */
  entities: EntityChange[];
  summary: WorldSummary;
  /** The owner's news: this island's events after the last-seen marker, oldest first. Empty on a visit. */
  news: SimEvent[];
}

/** What a tick or an accepted command changed on the open island, and its events. */
export interface UpdateMessage {
  type: 'update';
  world: string;
  /** The tick the world is at after the change. */
  tick: number;
  /** 0 for a tick (the sim's TICK_SOURCE), else the sequence number of the command. */
  source: number;
  changed: EntityChange[];
  removed: string[];
  events: SimEvent[];
  /** Present only when the world summary changed. */
  summary?: WorldSummary;
}

export interface StatusMessage {
  type: 'status';
  world: string;
  status: WorldStatus;
}

export type ResultMessage =
  | { type: 'result'; requestId: number; ok: true; data: Record<string, number> }
  | { type: 'result'; requestId: number; ok: false; reason: Reason; shortfallCents: number };

export interface ErrorMessage {
  type: 'error';
  reason: ServerReason;
}

export type ServerMessage =
  | WelcomeMessage
  | UpdateRequiredMessage
  | IslandMessage
  | UpdateMessage
  | StatusMessage
  | ResultMessage
  | ErrorMessage;
