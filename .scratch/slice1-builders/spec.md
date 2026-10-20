# Slice 1 builders: crews from the Mainland put up the buildings

Status: ready-for-agent

From the `/grill-with-docs` and `/grill-me` session of 2026-10-20 (plan 7, chosen by the user over shipping: "I still
need more things about logic game"; shipping moves to plan 8). The user's idea: "when we place some building, it needs
the specific builders (with builder uniform), and they only come from mainland on specific time, like every morning
to build. If we want to call them for now, user can click on the place of that not-built building, to pay more money,
then after short time, the ship will bring the builders to build. Each building scale has its size of builders."
Sources: design spec 2.3 (chill rules), 6.2, 8.1, 12.1, 12.5; ADR 0001 (ferry manifest, the pattern for the
builders' boat's last trip); the glossary (Builder, Crew, Builders' boat, Waiting for builders, Call builders, Moment,
Connector); the skills `island-game-logic`, `island-3d-client`, `island-ui`, `island-server`, `island-blender`,
`island-content`, `island-testing`.

## Problem Statement

Construction today is a countdown and nothing more. A building is paid for when it is placed and then rises by
itself, day and night, at the same speed, whatever happens on the island. The builders a player sees at a site are
decoration: the sim does not know they exist, so a building keeps rising through the night with nobody on it, and no
one ever arrives to build or goes home afterwards. Building has no rhythm, nothing to wait for and nothing to watch
arrive, and the player has no choice to make about it once the building is placed.

## Solution

Builders become real people of the sim: a crew from the Mainland, in an orange uniform with a hard hat, who come on
their own boat.

- **The builders' boat** ties up at the pier every morning at 06:45, before the ferry, and brings a full crew for
  every site waiting for builders. The builders walk to their sites, build through the day shift (07:00 to 17:00) and
  walk back to leave on the boat at 17:15. A site rises only while its crew is on it; at night it waits.
- **A crew per building, by size:** 2 builders for a cottage, a well or a fishing hut, 4 for a lumber camp, a
  warehouse, a market or a farm, 8 for the Island Hall. A site starts only with its full crew.
- **Builders move on:** when a site finishes during the shift, its crew walks to the next site waiting for builders
  (the oldest first) if they make up its crew, including one placed that day; otherwise they wait at the pier for
  the evening boat. An unfinished site gets its crew back on the next morning's boat by itself.
- **Call builders:** tapping a site waiting for builders shows when they come and a Call builders button. For a fee
  of a quarter of the building's price, the boat brings its crew about 30 game minutes later. Builders can be called
  from 06:00 to 15:00; at night they rest.
- **The welcome crew:** the very first building on a new island gets its crew at once and for free, at any hour, and
  they build it through to the end, even at night. The port master announces them.
- **The price is unchanged** and already pays for the builders; calling is the only extra cost. Roads, the
  connector included, stay instant. The Island Hall still waits for its wood; its crew comes once the wood is on site
  or arriving on that morning's ferry. Its build time becomes 600 working minutes, so its crew can finish it in one
  shift.
- **Watching:** the builders' boat arriving with its crew is a new watch-mode moment, the news says "Builders
  arrived" for a called or welcome crew, and the building card shows "Waiting for builders" first.

## User Stories

The builders' boat

1. As a player, I want a boat of builders to arrive at the pier each morning when a site is waiting, so that I see
   the people who will build my island.
2. As a player, I want the builders' boat to arrive at 06:45, before the ferry, and leave at 17:15, after it, so
   that the two boats never meet at the pier and I see two arrivals in a row.
3. As a player, I want the builders to wear an orange uniform with a hard hat, so that I can tell them from
   commuters and residents at a glance.
4. As a player, I want builders to walk from the pier to their site along the roads in the morning and back in the
   evening, so that their day reads like a commute.
5. As a player, I want no builders' boat on a morning with no site waiting, so that the boat always means work.
6. As a player, I want builders never to take ferry seats, so that hiring commuters and welcoming newcomers work as
   before.

Building with a crew

7. As a player, I want a site to rise only while its crew is on it, so that what I see matches what happens.
8. As a player, I want sites to stand still at night, so that the island has a day rhythm.
9. As a player, I want bigger buildings to need bigger crews, so that a farm site looks busier than a cottage site.
10. As a player, I want a site to start only with its full crew, so that crews are never split confusingly.
11. As a player, I want every slice 1 building but the Island Hall to be finishable within one day shift, so that a
    building placed in the morning is done by the evening.
12. As a player, I want an unfinished site to get its crew back the next morning without doing anything, so that I
    never have to re-order a building.
13. As a player, I want a crew whose site is finished to walk to the next waiting site (the oldest first) if they
    make up its crew, so that a building I place at midday can still start that day.
14. As a player, I want builders with nothing to do to wait at the pier for the evening boat, so that idle builders
    are visible and not lost.
15. As a player, I want the price I pay when placing a building to cover its builders, so that a half-built house
    never stalls for money.
16. As a player, I want roads, including the road a building lays to the dock, to stay instant, so that a building
    never waits twice.

Calling builders

17. As a player, I want to tap a site waiting for builders and see when they come, so that I know how long it waits.
18. As a player, I want a Call builders button with its price on that card, so that I can pay to skip the wait.
19. As a player, I want the called crew to arrive by boat about 30 game minutes later, so that calling feels quick
    and I see them come.
20. As a player, I want to call builders only from 06:00 to 15:00, with the card saying they rest at night and when
    they come, so that the day rhythm holds and I understand why I cannot call.
21. As a player, I want calling to cost a quarter of the building's price, so that it is a real choice but never a
    big one.
22. As a player, I want the call refused with a clear reason when I am short of coins, so that I know how many more
    coins I need.
23. As a player, I want no Call builders button when the crew is already on its way or on site, so that I cannot pay
    twice.
24. As a player, I want the Fix button of a site waiting for builders to call them when it can, and otherwise move to
    the cause and say why, so that Fix behaves as on every other card.
25. As a visiting friend, I want to see the builders' boat and crews but no Call builders button, so that visiting
    stays read-only.

The welcome crew

26. As a new player, I want my very first building to get its crew at once, at any hour and for free, so that my
    first visit never shows a site waiting for hours.
27. As a new player, I want the welcome crew to build my first building through to the end, even at night, so that I
    see it finished on my first visit.
28. As a new player, I want the port master to announce the welcome crew, so that I know who they are.
29. As a player, I want only the very first building to get a welcome crew, so that the day rhythm holds afterwards.

The Island Hall

30. As a player, I want the Island Hall's crew of 8 to come only once its wood is on site or arriving on that
    morning's ferry, so that builders never stand around a site with no materials.
31. As a player, I want bought wood arriving on the 07:00 ferry to still count for that morning's builders' boat, so
    that buying the materials never costs me a day.
32. As a player, I want the Island Hall to be built in one working day by its crew, so that I can watch the whole
    landmark go up and the celebration that follows.

News, cards and watch mode

33. As a player, I want the news to say "Builders arrived" only for a called or welcome crew, so that the news is not
    filled every morning.
34. As a player, I want "Waiting for builders" shown on a site's card before "under construction", so that the cause
    of a still site is the first thing I read.
35. As a player, I want watch mode to show the morning builders' boat arriving with its crew whenever a site is
    waiting, so that watching has one more morning moment.
36. As a player, I want the bubble over a waiting site to stay calm (not a problem) at night, so that the night does
    not look broken.

Pacing and existing islands

37. As a player, I want the first residents to still come within about a real hour and Settlement within the first
    real day, so that builders make growing calmer but not slower overall.
38. As a player with an island already growing, I want my sites under construction to wait for builders and get a
    crew on the next morning's boat, so that an update never loses my buildings.

Checking

39. As the user, I want `pnpm preview` to show a builders' boat arriving at 06:45, crews at work, a crew moving on and
    the evening boat, so that I can check it all without growing an island.

## Implementation Decisions

### Content data

- Each building gains a crew size: cottage, well and fishing hut 2; lumber camp, warehouse, market and farm 4; the
  Island Hall 8. A content test requires a crew of at least 1 for every player-buildable building and 0 for the dock.
- The Island Hall's build time becomes 600 ticks, which now count working minutes. The other build times stay
  (60 to 240); a content test keeps every non-landmark build time within one shift.
- New rules: the builders' boat's arrival minute (06:45) and departure minute (17:15), the call window (06:00 to
  15:00), the call delay (30 ticks) and the call fee (250 permille of the building's price).
- New event types: `builders-arrived` (for a called or welcome crew; it carries which) with an importance between
  `construction-finished` and `newcomers-arrived`. New condition: `waiting-for-builders`, shown before
  `under-construction`. New ledger reason: `builders-called`. New reason codes for the call (below).

### Sim: state (a state change; `SIM_VERSION` 7 with a migration)

Every site under construction carries where its crew is, and the island carries its free builders and the builders'
boat's last trip, the way the ferry manifest records the ferry's (ADR 0001), so a player who opens the island later
sees the same boat and walkers:

```ts
// BuildingState gains (null once built):
crew: CrewState | null;
type CrewState =
  | { at: 'away' }                                                       // waiting for builders
  | { at: 'coming'; arriveTick: number; reason: 'called' | 'welcome' }   // the boat is on its way
  | { at: 'site'; welcome: boolean };                                    // building

// IslandState gains:
freeBuilders: number;                    // on the island, not at a site; they leave on the evening boat
buildersBoat: BuildersBoatTrip | null;   // the last trip, replaced by each trip
interface BuildersBoatTrip { tick: number; way: 'in' | 'out'; builders: number; sites: number[] }
```

- The migration from version 6 gives every site under construction `{ at: 'away' }`, every built building `null`,
  every island `freeBuilders: 0` and `buildersBoat: null`. Change sets carry the new fields; `validateWorld` checks
  them (a crew only on a site, arrive ticks not in the past, a trip's sites existing, free builders not negative).
- Golden hashes change deliberately, once; the readable checks of the golden scenarios must still hold.

### Sim: the rules

A new builders pass runs before construction, every tick:

- **Morning boat (06:45):** every site `away` that is ready gets `{ at: 'site' }`; a landmark is ready when its
  materials are on site or will be with the cargo of that morning's ferry. If any crew came, the trip is recorded
  (`in`, builders, sites). No site ready, no trip.
- **Called and welcome crews:** a site `coming` whose arrive tick is now gets `{ at: 'site' }`, records an `in` trip
  and emits `builders-arrived`.
- **Moving on:** during the shift, free builders take sites `away` that are ready, oldest site first, each only if
  the free builders make up its whole crew; a site that does not fit is skipped, and later ones can still be taken.
- **Evening boat (17:15):** every crew on site that is not a welcome crew goes `away`, and with the free builders
  leaves; the trip is recorded (`out`). No builders on the island, no trip.
- **Construction:** a site gets one tick closer to finished only while its crew is on site, and only during the day
  shift unless it is a welcome crew; a landmark still waits for all its materials. When a site finishes, its crew
  becomes free builders (a welcome crew finishing outside the shift leaves at once, recorded as an `out` trip), and
  the site's crew becomes `null`.
- **The welcome crew:** placing a building on an island that has no building but the dock gives that site
  `{ at: 'coming', reason: 'welcome' }` after the call delay, free, at any hour; the port master's news announces it
  through `builders-arrived` when they step off.
- **Conditions:** a site whose crew is not on site shows `waiting-for-builders` before `under-construction` (and a
  landmark short of materials also `missing-input`, as today).
- **The `call-builders` command** (`slot`, `buildingId`): refused with `no-such-building`, `already-built`,
  `builders-not-needed` (the crew is coming or on site), `builders-resting` (outside the call window),
  `missing-materials` (a landmark whose materials are not all on site), or `not-enough-coins` with the shortfall. Accepted, it pays the fee (`builders-called`) and sets `{ at: 'coming', reason: 'called' }`
  with the arrive tick after the call delay.
- Placing a building, the connector, prices, staffing, the ferry and everything else stay as they are.

### Protocol and server

- The protocol's command schema gains `call-builders` with a whole `buildingId`. The server's pipeline (schema,
  access check that the island is the sender's, rate limit, apply through the sim, ok or reason code) is unchanged.

### Pacing tool

- The bot never calls builders, so the report shows the slowest path. If the targets slip (first residents within
  about an hour, Settlement within the first day), the numbers are retuned (build times, crew sizes) and the targets
  stay; if retuning cannot reach them, the measured times go to the user before any target changes.

### Client: people and boats (pure render data)

- The builders drawn at sites come from the sim's crews instead of being made up: a crew on site shows its full size
  during the shift (a welcome crew at any hour while it builds), half hammering at the scaffold and half fetching
  logs, as the drawing does today; no builders at a site whose crew is away or coming.
- Builders walk from the pier to their site along the roads after the morning or called boat's `in` trip, and back
  to the pier before the evening `out` trip; free builders wait on the pier. Walks start and end on the trip's tick;
  the sim counts no walking time.
- Builders use one character in an orange tint with a hard hat, if a hat from the packs fits the Mini Characters;
  otherwise the tint alone.
- **The builders' boat** moors along the pier's side opposite the cargo boat, clear of the ferry's berth, comes in
  from the Mainland lane before an `in` trip and leaves after an `out` trip, and bobs on the waves like the other
  boats. It is a Watercraft Kit boat in the builders' orange, from an `island-blender` recipe.

### Client: UI

- The building card of a site waiting for builders says when they come ("Builders arrive at 06:45", "Builders are on
  their way, arriving at 10:30") and shows Call builders with its price in coins. Outside the window the button is
  off and the card says builders rest at night and come at 06:45. Refusals are shown in words. The Fix button calls
  builders when it can, otherwise it moves to the cause and says why. Visitors see no button.
- The news shows `builders-arrived`; for the welcome crew the port master says it. The bubble over a site waiting for
  builders is not a problem bubble.
- Icons only, no emoji (`island-ui`).

### Client: watch mode

- A new timed moment: the morning builders' boat arriving with its crew, when any site is waiting at 06:45; it ranks
  after a due ferry, like the other boat moments. Called and welcome arrivals reach watch mode through their event.

### Preview and Blender

- The preview village gains a site waiting for builders at 06:40, one under way with a crew that finishes during the
  morning and moves on to a second waiting site, and the evening boat. The look-check ticket lists the minutes.
- New model: the builders' boat; the hard hat if a pack has one that fits. Checked by `pnpm assets check` and listed in
  the catalog. Blender must be open with the MCP server started.

### Docs and skills

- The design spec: 12.1 (builders, the crew sizes, calling, the welcome crew, the Island Hall's build time), 8.1 item
  9 (builders arriving by boat), 12.5 (construction shows the real crew), and one line in 8.2 under Village: a
  builders' yard that trains residents as builders, so the island stops waiting for the Mainland.
- The skills `island-game-logic`, `island-3d-client`, `island-ui`, `island-server`, `island-blender`,
  `island-content` (a new building needs a crew size) and `island-testing`, written with `/skill-creator`.

## Testing Decisions

- Test what a player sees through the highest existing seams, never how it is computed:
  - **The sim's public API**: build a world with the sim's own commands, run ticks, read the island state and events.
    Prior art: the command tests, the tick tests, the golden scenarios and the pacing tool.
  - **The client's pure render functions** at pinned game times: islands in, plain data out. Prior art: the crowd,
    boat and ferry tests, the card conditions test, the watch director tests.
  - **The protocol schema test and one server integration case** with real WebSocket clients.
- Sim cases: no progress at night or without a crew; the 06:45 boat brings crews only for ready sites and records its
  trip; a site waits for its full crew; a finished crew moves on to the oldest site it fits and skips one it does not;
  idle builders leave at 17:15 with the crews; an unfinished site's crew returns the next morning; the welcome crew
  only for the first building, at any hour, building through the night and leaving when done; calling inside and
  outside the window, twice, short of coins, at a landmark without its materials; the Island Hall's crew with wood on
  site or on the morning ferry's cargo; conditions and their order; the migration from version 6; `validateWorld`;
  replay; golden hashes updated deliberately once; the pacing targets still met.
- Client cases: builders shown from crews (full crew, none while away, a welcome crew at night); their walks start on
  the trip's tick; the builders' boat comes in and leaves on the trips and never takes the ferry's berth; the card's
  wording and button in and outside the window, on a visit and while the crew is coming; Fix calls builders; the
  watch moment once per morning and after a due ferry; the draw-call count on the preview village stays under 150.
- Server case: `call-builders` accepted for the owner and refused at night, refused for a visitor.
- The look of the crew, the uniform and the boat go to the user (look-check ticket); never claim them from a test or a
  screenshot.

## Out of Scope

- Plan 8, shipping: deployment, the installable app, Playwright and screenshot checks, the real-phone run.
- A daily limit of builders from the Mainland or a queue the player orders (noted as a later option if building feels
  too easy).
- Builders' wages, builders taking ferry seats, builders for roads.
- The builders' yard and island-trained builders (a later stage, Village or after).
- Removing or cancelling a site; demolition.
- New character clips or new sounds for builders or the boat.

## Further Notes

- Branch: `slice1-builders`. One commit per ticket; ask before merging into `main`.
- Plan 6's look check (`slice1-alive-2` ticket 11) is still the user's to do; this feature changes the construction
  drawing it checks, so doing it first keeps its notes from mixing with this feature's.
- If the pacing tool shows calls are never worth it or always needed, revisit the fee and the call delay with the
  user rather than the targets.
