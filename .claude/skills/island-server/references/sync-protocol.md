# Sync protocol: packages/protocol and the WebSocket connection

Planned design; no code exists yet. Source: spec 3, 5.3, 6.2 (client state), 12.2, 12.3; brainstorm Section 3.
Message names and shapes are **still open**: choose them in slice 1 and record them here.

Contents: the protocol package - transport - connection lifecycle - message kinds - full state and per-tick
changes - visiting - phones and reconnects - validation - versioning - illustrative schema.

## The protocol package

`packages/protocol` (planned) is the one shared definition of the wire format:

- the protocol version constant;
- Valibot schemas for every client-to-server and server-to-client message, with TypeScript types inferred from them
  (never a hand-written type beside a schema);
- server-level reason codes (invalid message, rate limited, not your island, world paused, world catching up, and so
  on). Game reason codes come from the sim (`island-game-logic`); the client turns both into words (`island-ui`).

Both the server and the client import it, so it must not use Node-only or browser-only APIs.

Division of work (spec 12.2): `sim` defines the command types and produces the per-tick changes; `protocol` wraps
commands and changes in messages with Valibot schemas. The sim's types are the source of truth, so check each
schema's inferred type against the sim type it wraps at compile time; a drift then fails the build instead of a
replay. Schemas for the HTTP account requests (login, register, reset) may live here too, since the client uses
them; still open.

## Transport

- JSON over WebSocket using the `ws` library, with compression (permessage-deflate, which `ws` supports). Compression
  costs memory and CPU per connection; with small private worlds that is fine, but measure in slice 1.
- Set a small maximum message size on the server (`ws` has a `maxPayload` option), so no client can send a huge
  message. Client messages are small: commands and subscription changes.
- The page and the WebSocket share one origin (the same server serves the built client), so the session cookie set at
  login is sent with the upgrade request.
- Account actions (register, log in, log out, reset password) are HTTPS requests, not WebSocket messages, because only
  an HTTP response can set an httpOnly cookie. See `accounts-and-security.md`.

## Connection lifecycle

Illustrative sequence:

1. **Upgrade.** The browser opens the WebSocket with the session cookie. The server checks the session and the Origin
   header before accepting; otherwise it refuses the upgrade.
2. **Version check.** The first client message carries the protocol version. Match: the server confirms. Mismatch: it
   tells the client to update and closes. Any other first message: close. Suggested: close if no first message arrives
   within a few seconds.
3. **Open an island.** The client asks for one island of one of the account's worlds (an account can be in several,
   spec 12.3): its own, or a friend's for a read-only visit. The server checks membership and sends the island's
   full state, tagged with its tick number. When the owner opens their own island, the server also applies the
   logged "check-in" command (spec 12.1), unless the world is paused or catching up, in which case it waits for the
   next open (spec 12.3). One island at a time per connection (brainstorm Section 1, "clients subscribe to one
   island").
4. **Each tick.** Connections with an island open receive that tick's changes, the world summary and new events,
   tagged with the tick number. Connections without an open island receive nothing.
5. **Commands.** Command message in, ok or reason code out, matched by a request id (suggested).
6. **Close the island or the socket.** Nothing more is sent.

## Message kinds

Conceptual list; names, fields and grouping are still open.

| Direction | Kind | Carries |
|---|---|---|
| client -> server | hello | protocol version (first message only) |
| client -> server | open island / close island | which island of the world |
| client -> server | command | request id, command type, payload |
| client -> server | regenerate invite code | the world (creator only, spec 12.3); server metadata, not a sim command |
| server -> client | hello reply | ok, or "update the client" |
| server -> client | full island state | tick, island state, world summary, recent events (decide which) |
| server -> client | tick changes | tick, changed entities, removed ids, world summary, new events |
| server -> client | command result | request id, ok or reason code |
| server -> client | notice | world paused (shown as "This island is resting, back soon", spec 12.3), catching up, session ended (exact set still open) |

## Full state and per-tick changes

- **Correctness rule:** the full state plus every later change, applied in order, must equal the server's state. The
  client mirror test in `island-testing` checks exactly this after N ticks by comparing the per-island state hash
  (a stable hash of the canonical serialized state with sorted keys, spec 12.2).
- **The sim produces the changes** (spec 12.2): each tick, and each accepted command, returns the set of changed and
  removed entities. The server only wraps them in a message per open island and sends them; it never diffs states
  itself.
- **From the sim (plan 2):** `packages/sim/src/changes.ts` defines the entities and their keys (`island/<slot>`,
  `terrain/<slot>`, `roads/<slot>`, `building/<slot>/<id>`, `transit/<slot>/<id>`, `market`). Keep the
  `captureEntities(world)` result per world; after each tick or accepted command, `diffEntities(capture, world)`
  returns `{ changes: { changed, removed }, capture }`. Filter by the slot in the key to send one island.
- **Changed entities and removed ids.** The natural reading of the spec: each changed entity is sent whole and
  replaces the client's copy; removed entities are sent as ids. Island-wide values (money, tick, counts) need a place
  in the changes too. The exact shape is still open.
- **Tick numbers on everything.** The full state and each change message carry their tick, so the client can drop
  changes older than its full state and spot a gap. On a gap the client asks for the full state again, or reconnects.
- **Command effects:** `applyCommand` returns its own changes, ledger entries and events, like the tick (spec
  12.2). The ok reply goes out at once (the client plays the landing bounce on accept, spec 12.4). Whether the
  command's changes are sent to open connections at once or folded into the next tick's changes is still open;
  either way they must keep the correctness rule above.
- **World summary:** small, sent with each tick: the other islands of the world and Mainland market prices. Keep it
  small; it goes to phones every 2.5 s.
- **Events:** new events for the open island, plus world events, keyed by (tick, source, index). The "while you were
  away" news uses each player's "last seen event" marker (`persistence.md`). Which events a visitor receives is still
  open.
- **Slow connections:** do not queue unbounded data for a connection that cannot keep up (`ws` reports how much is
  still buffered). Suggested: close it; the client reconnects and gets a fresh full state.

## Visiting

- A visit is a read-only subscription to another island in the same world. Visitors get the same island state as the
  owner (full state, then the same changes); the UI hides owner controls (spec 12.3, `island-ui`).
- The server refuses every command sent for an island the sender does not own, with a reason code. Hiding controls
  in the UI is a convenience, not the protection.

## Phones and reconnects

- When the app goes to the background, the client closes the socket and nothing is sent. On return it reconnects
  with backoff and gets the full state again (spec 5.3). The client side of this, including backoff with some random
  jitter so many phones don't reconnect in lockstep after a restart, belongs to `island-3d-client`.
- The server keeps nothing per connection that must survive a reconnect. A connection's subscription and rate-limit
  state are thrown away when it closes.
- Phones often vanish without a close frame. Suggested: a ping and pong heartbeat (the pattern documented for `ws`)
  that closes sockets which stop answering, so the server stops sending to them.
- Changes are only sent while an island is on screen, which keeps mobile data low.

## Validation

- Every incoming message is parsed and schema-checked before anything else (spec 5.3). `JSON.parse` can throw: catch
  it. Use Valibot's non-throwing parse and handle failure with a reason code, or close the connection for garbage.
- Strict objects (unknown fields rejected), bounded strings and arrays, whole numbers where the sim expects them,
  literal unions for enums.
- Pass only the schema's parsed output onward. Never merge raw client objects into anything.
- A schema checks shape only. Whether a tile is free or a building exists is a game rule, so the sim checks it.

## Versioning

- One protocol version constant in `packages/protocol`. Bump it for any change an older client or server would
  misread.
- The server and the client are built and deployed together, but an installed PWA can keep running an old cached
  build. The version check in the first message is how it learns to update; the update flow itself belongs to
  `island-3d-client`.
- Whether unknown message types are ignored (allowing additive changes without a bump) or rejected is still open;
  write the rule here once chosen.

## Illustrative schema

Illustrative only: the names, fields and structure are still open.

```ts
import * as v from 'valibot';

export const PROTOCOL_VERSION = 1;

const Hello = v.strictObject({
  type: v.literal('hello'),
  protocolVersion: v.pipe(v.number(), v.integer()),
});

const OpenIsland = v.strictObject({
  type: v.literal('openIsland'),
  slot: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(9)),
});

export const ClientMessage = v.variant('type', [Hello, OpenIsland /* , Command, CloseIsland */]);
export type ClientMessage = v.InferOutput<typeof ClientMessage>;

// Server side: never throws on bad input.
// const result = v.safeParse(ClientMessage, parsedJson);
// if (!result.success) -> reply with a reason code, or close the connection
```
