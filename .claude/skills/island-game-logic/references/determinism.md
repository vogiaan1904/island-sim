# Determinism in the sim

Spec 4.1, 5.2, 9 and 12.2. Read this before writing any code in `packages/sim` (planned).

Contents: why it matters - the three inputs - the rules - state hash - versions and migrations - JavaScript traps -
debugging a divergence - open points.

## Why it matters

The same seed and the same commands must always produce the same world, bit for bit. Five features depend on it:

- **Crash recovery.** The server saves a snapshot every 5 minutes and on shutdown, and logs every accepted command
  with the tick it followed and a per-world sequence number. After a crash, snapshot plus replay must rebuild the
  exact state, or players lose actions.
- **Paused worlds.** When a tick or command throws, the server rebuilds the world from its snapshot and log up to the
  last good tick and pauses it (spec 12.3). That rebuild only works if replay is exact.
- **Bug reproduction.** A command log from the live server replayed locally must hit the same bug.
- **Fast-forward.** Tests run a game month in seconds; catch-up after downtime (or after resuming a paused world)
  runs up to 24 hours of ticks at once.
  Neither may differ from a world that ran live at 2.5 s per tick.
- **Shared preview.** The client runs the same sim code to preview a build. It only agrees with the server if the
  code depends on nothing but state and content.

## The three inputs

A tick or a command may read only:

1. the previous world state, which includes the tick counter and the random generator's state,
2. the content data (`packages/content`),
3. the command being applied (for `applyCommand`), with its per-world sequence number from the ordered command log.

If a value is not one of these, it must not influence a result. Typical leaks: the current time, the scheduler speed,
whether the owner is online or watching, login dates, server load, environment variables, the order network messages
arrived in (the server fixes order with the command sequence; the sim just follows it).

The spec's "active island" (used to scale world projects) shows how to bring an outside fact in: when an owner opens
their island, the server applies a logged "check-in" command, and an island is active if its last check-in was within
7 real days (241,920 ticks). The sim compares tick numbers; it never reads login times (spec 12.1). Use the same
pattern for any future outside fact: a logged command, never a lookup.

## The rules

1. **Whole numbers only.** State and rule math use integers. Money is in cents. Amounts of goods are whole units.
   Durations are game minutes (ticks). Bonuses and percentages are whole numbers on one fixed scale (which scale, for
   example whole percent or a finer one, is still open; use one scale everywhere, including content).
   - When scaling, multiply first and divide last, and use one rounding rule for the whole sim (still open).
   - Where rounding would lose value over time (production progress, partial payments), carry the remainder in
     state instead of dropping it. Example, illustrative only: a recipe with a 60-minute cycle needs 6,000 progress
     points; at full effectiveness it adds 100 points per tick, at 70% it adds 70, so the cycle simply finishes later
     and no fraction is ever stored.
   - Keep values inside `Number.MAX_SAFE_INTEGER` (about 9 x 10^15), including intermediate products.
2. **Randomness only from the seeded generator, and its state lives in the world state.** Snapshots must carry it so
   replay continues the same stream. Never `Math.random()`, `crypto.getRandomValues()`, `crypto.randomUUID()` or any
   library that uses them. New ids come from a counter in state, not from random UUIDs. The seeded archipelago
   generator that runs when a world is created is part of the sim too (spec 12.2).
   - The order of draws is part of the result. Adding or removing one draw shifts every later draw and changes golden
     hashes. That is fine when intended; note it in the commit.
   - Whether there is one stream per world or separate streams per island or system is still open. Separate streams
     keep a change in one system from reshuffling the others, at the cost of a little more state.
3. **No wall-clock time.** No `Date`, `Date.now()`, `performance.now()`, `process.hrtime()`, `setTimeout` or
   `setInterval` in sim code. Game time is the tick counter; the time of day and the day shift come from it (see
   `time-and-commands.md`).
4. **No I/O and nothing asynchronous.** No file system, network, database, environment variables, or logging in
   committed sim code; no `async`, `await` or promises. Something worth telling the player becomes an event instead.
   The sim may depend on `packages/content`; it must never import from `apps/server`, `apps/client` or
   `packages/protocol` (the sim defines the command types, and `protocol` wraps them, spec 12.2).
5. **A fixed order everywhere.** Iterate islands, buildings, houses and routes in a defined order (for example by id).
   Every comparison that can tie needs a final tie-break (for example the lower id wins): labor assignment by
   priority, wage and distance; matching supply to demand; shortest paths of equal length; which building is paid
   first when money is short. Events get a stable key (tick, source, index), where source is the command's sequence
   number or the tick itself, so the order they are emitted in matters too.
6. **Caches are shortcuts, never sources.** The path cache (and any other cache) must give the same answer cold as
   warm. After a snapshot loads, the cache is empty, and results must not change. Recompute paths only when roads
   change, and make the tie-break part of the path search, not an accident of cache contents. Whether caches are
   saved in snapshots or rebuilt is still open; results may not depend on it.
7. **No dependence on speed or presence.** No rule may read the real tick interval, distinguish catch-up from live
   ticks, or know whether anyone is online. This is also how the chill rule "the island never gets worse just
   because you're away" is guaranteed.
8. **Plain data, canonically serialized.** The server snapshots state and sends it as JSON. Keep state to plain
   objects, arrays, strings, integers and booleans. `JSON.stringify` drops `undefined` fields, turns `NaN` into
   `null` and `-0` into `0`, and cannot store `Map`, `Set` or class instances as they are, so live state and restored
   state would differ. Never keep `undefined` in state.

## State hash

- Spec 12.2: a stable hash of the canonical serialized state, with sorted keys. There is one for the whole world and
  one per island (the client mirror test compares a client's island with the server's).
- Sorted keys make the hash independent of the order fields were added. They do not make results independent of
  iteration order: code that loops over an object's keys can still behave differently. Rule 5 still applies.
- Anything that must not change the hash (caches, timing data) does not belong in the hashed state.
- The hash function itself is still open.

## Versions and migrations

Spec 12.2:

- Each snapshot stores the **sim version**, and each logged command records the sim version that applied it.
- A graceful shutdown always writes a snapshot, so the replay window after a deploy is empty.
- **An old snapshot with nothing logged after it is simply migrated** (see the next point) and the world carries on.
- **Only when logged commands written by another sim version still need replaying** (a crash, then a deploy) does
  the server refuse, and tell the host to run the previous version once to write a clean snapshot
  (`island-server`). Commands are never replayed under rules other than the ones that applied them.
- **New state fields get their starting values from versioned snapshot migrations in `packages/sim`.** Loading an
  older snapshot runs the migrations in order up to the current version. Migrations are pure and deterministic like
  everything else.
- When a change alters the shape of saved state, bump the sim version and add its migration in the same change, with
  a test that loads a snapshot of the previous version (`island-testing`).
- When a change alters results but not the shape (a new formula), golden hashes move; existing worlds simply continue
  under the new rules from their latest snapshot.

## JavaScript traps

| Trap | Why it breaks determinism | Do instead |
|---|---|---|
| `Math.sin`, `Math.exp`, `Math.log`, `Math.pow` with fractions, `Math.hypot` | Results may differ between JavaScript engines (Node on the server, the phone's browser for previews) | Integer math; distances as walking distance in whole tiles |
| Floats sneaking in through `/` | `7 / 2` is `3.5`, and then everything after is a float | Integer division with the sim's single rounding rule |
| `Math.random()`, `crypto.randomUUID()` | Not seeded, not in state | The seeded generator in state; ids from a counter |
| `Date.now()`, timers | Depends on when and how fast the code runs | The tick counter |
| Object key order | Integer-like keys come first in numeric order, other keys in insertion order: easy to get a different order after a reload | Arrays sorted by id, or an explicit sorted id list |
| `array.sort` with a comparator that can tie | Sorting is stable, but ties then depend on the input order, which may differ after a reload | Always end the comparator with an id comparison |
| `undefined` versus a missing field | Lost in serialization | Use explicit values, never `undefined` in state |
| Reading the cache to decide something | A cold cache after a restart gives a different answer | Treat the cache as a pure speed-up |
| Throwing on bad command input | A throw pauses the whole world | Return a reason code |
| Locale functions (`toLocaleString`, `Intl`) | Depend on the machine | Formatting belongs in the client (`island-ui`) |

## Debugging a divergence

When two runs that should match do not (live versus replay, two machines, a golden scenario that changed):

1. Record the state hash after every tick in both runs and find the first tick where they differ. The per-island
   hashes narrow it to one island.
2. Diff the state at that tick section by section (buildings, citizens, money, market, random generator state) to
   see which system moved first. The ledger of that tick shows which movement differs.
3. List the commands applied just before that tick and replay them alone.
4. Check the trap table above against the code of the system that moved first. The usual causes are an untied sort,
   a float, an unseeded random call, a cache that answered differently, or state that did not survive serialization.

The test patterns for this (determinism test, replay test, golden scenarios, mirror test) are in `island-testing`.

## Open points

- The random generator algorithm, and one stream versus several.
- The whole-number scale for percentages and the single rounding rule.
- The state hash function.
- Whether caches are saved in snapshots or rebuilt on load.
