# Economy, chill rules, key staff, events

Spec 2.3, 2.4, 2.5, 4.5, 4.6, 12.1, 12.2 and 12.3. All names are planned.

Contents: money - paying - the ledger and invariants - the Mainland market - friends and active islands - chill
rules - safety rules - key staff - automation rules - the event log - open points.

## Money

- Money is whole **cents**. The client shows whole coins (spec 12.4); formatting is `island-ui`'s job.
- **Income:** exports to the Mainland, rent and taxes (both scaled by happiness, `citizens.md`), and collected
  rewards (the "collect" command, `content-and-buildings.md`).
- **Costs:** construction and upgrades, wages, upkeep, imports.
- **Never below zero.** There are no loans, no debt and no bankruptcy.

## Paying

Spec 12.1:

- **Purchases are up front** (spec 2.3, 12.1). Placing a building or starting an upgrade costs its price at once;
  roads are paid per tile when placed; buying missing landmark materials is paid when bought. If it is not
  affordable, the command is rejected with a reason code carrying the shortfall, the client disables Place with
  "Need N more coins", and nothing is queued.
- **Running costs never push money below zero.** When wages or upkeep cannot be paid, the building slows down and
  gets the "waiting for money" condition. It recovers by itself when money is there again. Fewer commuters come when
  their wages cannot be paid.
- When money is short and several running costs are due at once, the order in which buildings are paid is a rule.
  The spec does not give it; decide it, keep it gentle and deterministic (id tie-break), and record it here.
- When wages, upkeep, rent and taxes are charged (every tick, per game hour, per day) is still open.

## The ledger and invariants

- Spec 12.2: **every tick the sim returns a ledger of every money and goods movement**: production, consumption,
  purchases, sales, wages, rent and taxes, construction, upkeep, rewards, deliveries in and out of storage. Code that
  writes a balance or a stock number without a ledger entry bypasses the invariant checks and is a bug.
- Invariants, checked every tick in tests using the ledger (spec 9, 12.2):
  - no negative stock anywhere (storage, in transit, construction materials);
  - money and goods change only through ledger entries, so the totals reconcile (goods in transit counted);
  - money never below zero (chill rule).
- Whether the server keeps the ledger beyond the tick is up to `island-server`; the sim only returns it.

## The Mainland market

- An NPC market that is **always there and buys and sells every good**, so solo play never depends on friends.
- Prices are in cents. They **drift** (randomness from the seeded generator) and **react to the trades of every island
  in the world**.
- It is a world-level system: it runs after all islands in the world tick (`time-and-commands.md`), so prices stay
  fixed while the islands run and no island gains from its place in the order.
- Landmark materials you lack can be bought from the Mainland with a button on the landmark's card, a player
  command (spec 12.1); they arrive on the next ferry and are carried to the site.
- **Every sale to the Mainland, manual or automatic, respects a floor price per good** (spec 12.1). While the
  Mainland price of a good is under its floor, nobody sells it: auto-sell skips it, and a manual sale command is
  refused with a reason code that the client shows as "The Mainland pays too little right now" (one check, shared
  by both).
- The drift and reaction formulas are still open; keep them whole-number.

## Friends and active islands

- **Trade by ship** (from Village, slice 3): send goods to a friend's island; ships between islands are a world-level
  system with travel time.
- **Shared world projects** (from Town, slice 4): every island contributes goods; requirements scale per **active
  island** so one player can finish them alone.
- **Active island** (spec 12.1): when an owner opens their island, the server applies a logged **"check-in"
  command**. The sim records the tick of the last check-in, and an island is active if that was within 7 real days
  (241,920 ticks). Because the check-in is in the command log, replay sees exactly the same activity; the sim never
  reads login times or the clock (`determinism.md`).
- A world has 1-10 islands (spec 2.5); one player is fully playable. Friends add options, never requirements.

## Chill rules

The game is deep management at a chill pace with no harsh failure (D24). In rules:

| Rule | What it means for code |
|---|---|
| Money never below zero | Purchases up front or rejected; running costs slow the building down instead |
| Nothing is queued | An unaffordable purchase is rejected, not saved for later |
| Problems are gentle and repairable | Example: a storm damages the pier ("damaged"); the player repairs it. No permanent loss, no cascade |
| Stages never go back | An unlocked landmark stays unlocked even if residents leave |
| The island never declines because you are away | Safety rules cover every consumed need; no rule reads presence or time away |
| Basic safety rules always work without setup | Built-in rules run on every island from the first tick |
| No losing | No bankruptcy, riots, ruinous disasters. Unhappy residents just leave by ferry |

When a new mechanic could hurt an island, ask: could a player come back after 8 hours (8 game days) to something
ruined by it? If yes, soften it (cap it, make it repairable, add a safety rule) before building it.

## Safety rules

Island-wide rules that are always on, with no key staff needed (spec 2.3, 12.1):

- **They cover every need that residents consume**, so an island cannot decline only because its owner is away (the
  spec's example: "keep enough food for residents", so for example auto-sell must not sell the food residents need).
- **No sale to the Mainland, manual or automatic, goes below a floor price per good.** Floor prices are balancing
  numbers like the others.

They are part of the tick, deterministic, and write ledger entries like everything else. Their exact list follows
from the needs in content; their numbers come from the pacing harness.

## Key staff

- A few **named characters with traits**, for example *Port master Lena, Shrewd: +10% export prices*. They are the
  **only individuals the sim tracks**.
- Hired from a **rotating candidate pool**. The rotation runs on game time and the seeded generator.
- **Each is assigned to one building** and adds automation rule slots and bonuses there (spec 2.4). **Some roles
  cover the whole island:** the port master handles all trade. Bonuses are whole-number modifiers on the sim's
  percentage scale; trait definitions live in content as data.
- They deliver the "while you were away" news with their portrait (`island-ui`; portraits from `island-blender`).
- Slice 1 has one: the port master, present from the start, who delivers the news and offers one basic rule,
  auto-sell surplus. More key staff arrive in Village (slice 3).

## Automation rules

- **Templates, not scripts.** A rule is a template with parameters, such as stock thresholds, auto-sell surplus or a
  minimum treasury. No user code, no expressions, no scripting language.
- They run **inside the tick** from state, in a fixed order, so replay reproduces them without any command-log entry.
  Never let the server run them: that would put game rules outside the sim.
- They obey the same constraints as player actions: money never below zero, no negative stock, the safety rules and
  floor prices, ledger entries for every movement.
- Slice 1 has only the port master's auto-sell surplus rule. The automation rule system (more templates and slots)
  arrives in slice 2 (Settlement). The order in which several rules are evaluated, and their cadence, is still
  open.

## The event log

- The sim writes events for notable moments. The spec's examples: a ferry arrived with newcomers, a building
  finished, a landmark started, a storm, a stage celebration. (Watch mode also uses time-of-day moments such as the
  morning and evening ferries and rush hour, which the client takes from the clock; spec 12.5.)
- Every event has a **stable key (tick, source, index)** (spec 12.3). Source is the command's sequence number for
  events a command writes, or the tick itself for events the tick writes; index is the event's position within that
  source. Keys never collide and replay never duplicates them, as long as events are emitted in a fixed order.
- **Each event type has an importance in content data** (spec 12.4). The news picks the most important events since
  the player's last visit by it; a new event type needs its importance set.
- The log feeds the "while you were away" news (the top five by importance since the player's last visit, grouped,
  each with "Show me"), the Log history, watch mode moments with a one-line caption, and later push
  notifications. The server stores the log and each player's "last seen event" marker
  (`island-server`).
- Give each event what its consumers need: what happened, when (tick), on which island, and where (so "Show me" and
  watch mode can find it). The exact shape is still open.
- Write events for moments, not for every tick. Aggregate when it reads better ("12 newcomers arrived"); citizens are
  counts, so events are too.
- Storms and other gentle weather come from the seeded generator and follow the chill rules. They are a cross-cutting
  roadmap item, not required in slice 1.

## Open points

- Which building is paid first when money is short; when running costs, rent and taxes are charged.
- Market drift and reaction formulas; floor price values.
- Rule evaluation order and cadence.
- The event shape.
