# Sync protocol: packages/protocol and the WebSocket connection

The design, built in slice 1 plan 3; "As built" gives the real messages. Source: spec 3, 5.3, 6.2 (client state),
12.2, 12.3; brainstorm Section 3.

Contents: as built - the protocol package - transport - connection lifecycle - message kinds - full state and
per-tick changes - visiting - phones and reconnects - validation - versioning - illustrative schema.

## As built (plan 3)

`packages/protocol/src/messages.ts` and `apps/server/src/sync/`. `PROTOCOL_VERSION` is 1.

| Direction | Message | Carries |
|---|---|---|
| client -> server | `hello` | `protocolVersion`; the first message, within 5 s (`helloTimeoutMs`) |
| client -> server | `open-island` | `world`, `slot`: an island of a world the account has an island in |
| client -> server | `close-island` | nothing |
| client -> server | `command` | `requestId`, `command` (a `PlayerCommand`, checked on its own) |
| client -> server | `mark-seen` | `key` (tick, source, index): the news was seen up to there |
| server -> client | `welcome` / `update-required` | the account / the server's version, then close 4001 |
| server -> client | `island` | world, slot, `own`, tick, status, `entities` (the island's and the market), `summary`, `news` |
| server -> client | `update` | world, tick, `source` (0 a tick, else the command's sequence), `changed`, `removed`, `events`, `summary` when it changed |
| server -> client | `status` | world, `running`, `paused` or `catching-up` |
| server -> client | `result` | `requestId`, ok with the sim's `data`, or a `Reason` and `shortfallCents` |
| server -> client | `error` | a `Reason`, for a refused message that is not a command |

- **Close codes** (`CLOSE_CODES`): 1001 server stopping, 4001 update required, 4002 no hello or a bad first message,
  4003 session ended, 4005 not JSON. A connection with more than 1 MB waiting to be sent, or that did not answer the
  last ping (every 30 s), is dropped without a close frame (1006 on the client) and reconnects.
- **Unknown or malformed messages** are refused with `error` / `bad-message` and the connection stays open; only
  text that is not JSON closes it. So a new client message always needs a version bump.
- **Command changes are sent at once:** the update with the command's sequence goes to every open copy of the island
  before the sender's `result`.
- **Every tick sends an update** to each open island, even an empty one: it carries the tick the client's clock and
  day and night follow. The summary (claimed islands: slot, name, owner's username, stage, residents) comes with
  `island` and with an update only when it changed; prices travel in the `market` entity.
- **News:** only when opening your own island: that island's newest 100 events after the account's marker, oldest
  first. Visitors get `news: []` but the visited island's events in every update (watch mode).
- **Catch-up:** open islands get `status` `catching-up`, no updates, then `status` `running` and a fresh `island`.
  A pause is different: it sends only `status` `paused` (the world rebuilt in memory, nothing to resend); the fresh
  `island` follows the catch-up of the host's `resume`.
- **A world that failed to load** (`Worlds.failed`) shows to its members as `paused` in `/api/me`, and `open-island`
  for it answers `error` / `world-paused`; `not-a-member` is for worlds the account has no island in.
- **The client mirror** applies `island.entities`, then each update with the sim's `applyChanges`; the server test
  client (`apps/server/test/player.ts`) does exactly this, and so does the client store (`apps/client/src/store/
  mirror.ts`, `applyMessage`). There is no schema for server messages: the client checks what arrives with its own
  guard (`connection/messages.ts`) and casts to the protocol's types. The island on screen is assembled from the
  mirrored entities with the sim's `islandFromEntities`.
- **Hello versions:** before the strict parse, a first message that is a `hello` with another `protocolVersion` is
  answered `update-required` and closed with 4001, whatever other fields it carries, so a later `hello` with a new
  field still tells an older cached client to update (not 4002).
- **Failures stay on one socket:** every socket has an `error` listener, so an oversized frame, invalid UTF-8 or a
  reset closes that socket only (a `socket error` log line). The server ignores messages from a connection it already
  closed. The upgrade path is compared as a string, not parsed as a URL (`//` gets 404, `new URL` would throw), and
  a refused upgrade is answered (401, 403, 404, or 503 while shutting down) and then destroyed.
- **Shutdown:** `Gateway.close()` sends 1001 to every connection and resolves when they are gone; those that have
  not answered after 2 s are terminated.
- **Sizes:** client messages up to 16 KiB (`maxPayload`); a road command up to 1,024 tiles by schema (the sim's own
  limit answers `too-many-tiles`).

## The protocol package

`packages/protocol` is the one shared definition of the wire format:

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
them; they do (`http.ts`).

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
   tells the client to update and closes. Any other first message: close. A connection with no first message within
   5 s is closed too.
3. **Open an island.** The client asks for one island of one of the account's worlds (an account can be in several,
   spec 12.3): its own, or a friend's for a read-only visit. The server checks membership and sends the island's
   full state, tagged with its tick number. When the owner opens their own island, the server also applies the
   logged "check-in" command (spec 12.1), unless the world is paused or catching up, in which case it waits for the
   next open (spec 12.3). One island at a time per connection (brainstorm Section 1, "clients subscribe to one
   island").
4. **Each tick.** Connections with an island open receive that tick's changes, the world summary and new events,
   tagged with the tick number. Connections without an open island receive nothing.
5. **Commands.** Command message in, ok or reason code out, matched by a request id.
6. **Close the island or the socket.** Nothing more is sent.

## Message kinds

Conceptual list; the real messages are in the table under "As built". Invite codes are regenerated over HTTP
(`POST /api/worlds/invite`), not as a WebSocket message.

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
| server -> client | notice | `status`: paused (shown as "This island is resting, back soon", spec 12.3), catching up; a session that ended closes the socket with 4003 |

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
  replaces the client's copy; removed entities are sent as ids. Island-wide values (money, tick, counts) are in the `island/<slot>`
  entity.
- **Tick numbers on everything.** The full state and each change message carry their tick, so the client can drop
  changes older than its full state and spot a gap. On a gap the client asks for the full state again, or reconnects.
- **Command effects:** `applyCommand` returns its own changes, ledger entries and events, like the tick (spec
  12.2). The ok reply goes out at once (the client plays the landing bounce on accept, spec 12.4). The
  command's changes are sent to open connections at once, before the reply, and keep the correctness rule above.
- **World summary:** small, sent with each tick: the other islands of the world and Mainland market prices. Keep it
  small; it goes to phones every 2.5 s.
- **Events:** new events for the open island, plus world events, keyed by (tick, source, index). The "while you were
  away" news uses each player's "last seen event" marker (`persistence.md`). A visitor receives the visited island's events in every update, and no news.
- **Slow connections:** do not queue unbounded data for a connection that cannot keep up (`ws` reports how much is
  still buffered). The server drops it (more than 1 MB waiting); the client reconnects and gets a fresh full state.

## Visiting

- A visit is a read-only subscription to another island in the same world. Visitors get the same island state as the
  owner (full state, then the same changes); the UI hides owner controls (spec 12.3, `island-ui`).
- The server refuses every command sent for an island the sender does not own, with a reason code. Hiding controls
  in the UI is a convenience, not the protection.

## Phones and reconnects

- A phone that was away comes back to a socket it cannot trust, and gets the full state again (spec 5.3). **As built,
  the client** keeps the socket in the background, and on return after 20 s or more drops it and reconnects at once;
  a socket that closes by itself is retried after 0.5 s, 1 s, 2 s and so on up to 15 s, each with up to a quarter more
  or less, so phones do not reconnect in lockstep after a restart (`island-3d-client`, `state-and-pwa.md`, section 5).
- The server keeps nothing per connection that must survive a reconnect. A connection's subscription and rate-limit
  state are thrown away when it closes.
- Phones often vanish without a close frame. A ping and pong heartbeat (the pattern documented for `ws`, every 30 s)
  terminates sockets which stop answering, so the server stops sending to them.
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
  build. The version check in the first message is how it learns to update. **As built,** the client shows its
  "update required" screen (session phase `update-required`) and asks the player to reload; wording is `island-ui`.
- An additive field in an HTTP response needs no bump (an older client ignores it): `WorldInfo.islands` (the claimed
  islands of the world: slot, name, owner as typed; filled in `/api/me`, `/api/register`, `/api/worlds` and
  `/api/worlds/join`) was added that way. The world screen lists friends to visit from it; the live `summary` of an
  opened world replaces it.
- Unknown message types are rejected with `error` / `bad-message`, never ignored, so any new client message needs a
  bump (SKILL.md, add a message type).

## Illustrative schema

Illustrative only; the real schemas are in `packages/protocol/src/messages.ts`.

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
