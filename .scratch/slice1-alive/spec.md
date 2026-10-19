# Slice 1 alive: people, the ferry, watch mode and sound

Status: ready-for-agent

From the `/grill-with-docs` session of 2026-10-19 (24 questions, all decided). Sources: design spec 2.2, 6.1, 6.2,
8.1 (client item 9), 12.1, 12.5, 12.6; decision 26 (Mini Characters); ADR 0001 (the ferry manifest); the glossary
(Moment, Ferry manifest, Carrier); the skills `island-3d-client`, `island-ui`, `island-game-logic`, `island-testing`,
`island-blender`.

## Problem Statement

The island can be built and managed, but nothing on it moves. Nobody walks to work, no ferry comes in, goods jump from
one building's stock to another's without anyone carrying them, and the 64-tile island is bare grass between a few
buildings. The point of the game is a chill simulator to watch citizens and the town move and work, people getting on
and off ships; without that, managing well has no reward. There is also no way to just sit back and watch (no watch
mode), and the game is silent.

## Solution

The island comes alive, drawn entirely from what the sim already decides:

- **People.** Every person the sim counts is one Kenney Mini Character on screen (up to 200, nearest first): residents
  walk from home to work at the start of the day shift and back at its end, commuters walk between the dock and work,
  carriers walk goods along the roads, workers and builders work at their buildings, and after work some residents walk
  to the market. Children travel only with their families. Nobody walks at night. People show from neighborhood zoom
  in, and hide where bubbles turn into dots.
- **The ferry.** The Mainland lies due south. The ferry sails in from the south, docks at the pier at exactly the
  sim's ferry minute (07:00 and 17:00), waits while its passengers walk off and on, and sails away. Newcomers walk with
  bags to the homes they really moved into, and leavers walk from the homes they really left, because the sim now keeps
  a **ferry manifest** of each trip (ADR 0001).
- **Nature.** Trees, palms, bushes and rocks are scattered over open land and beach, never under buildings or roads.
- **The camera starts over the dock**, where the ferry comes in.
- **Watch mode.** Tap Watch (or press V): the UI fades and the camera drifts by itself between moments (a ferry
  that is due, the latest important event, otherwise a tour of busy spots) with a one-line caption. Any touch or key
  ends it. It runs at 30 fps and keeps the screen awake. It works on a friend's island too.
- **Sound.** A calm ambience of waves, birds, the town and night insects that follows the camera, three soft UI
  sounds, and the existing mute switch.

## User Stories

People on the island

1. As a player, I want to see my residents walk from their homes to work when the day shift starts, so that my town
   feels lived in.
2. As a player, I want to see them walk home again when the shift ends, so that the day has a rhythm I can watch.
3. As a player, I want hired commuters to walk from the ferry to the workplaces that really employ them, so that hiring
   shows on the island.
4. As a player, I want commuters to walk back to the dock in the evening and board the ferry, so that I see them go
   home.
5. As a player, I want each shipment on the roads to be carried by people walking with goods in their arms, so that I
   can see goods move between buildings.
6. As a player, I want a big shipment (such as bought planks for the Island Hall) to be a short line of carriers, so
   that its size shows.
7. As a player, I want carriers to arrive exactly when the goods land in the building's stock, so that what I see
   matches the numbers.
8. As a player, I want to see a couple of people working at each staffed workplace, so that I can tell at a glance
   which buildings are working.
9. As a player, I want an understaffed building to show fewer workers and an unstaffed one none, so that problems are
   visible without opening a card.
10. As a player, I want builders working at each construction site during the day, so that construction looks like
    work.
11. As a player, I want no builders at a landmark that is waiting for materials, so that I can see it is stuck.
12. As a player, I want some residents to walk to the market after work and back before dinner, so that the market
    feels used.
13. As a player, I want children to come along with their families on the ferry and on market walks, so that families
    look like families.
14. As a player, I want children never to walk to work, so that the island matches the sim's rule that children do not
    work.
15. As a player, I want the streets empty at night with lit windows, so that the island sleeps.
16. As a player, I want each home's people to look the same every day, so that I recognise the family from that
    cottage.
17. As a player, I want commuters to look the same every day per seat, so that the regulars feel familiar.
18. As a player, I want a few people in wheelchairs, so that the crowd is varied.
19. As a player, I want walkers to move at a natural pace with no foot sliding, so that it looks right up close.
20. As a player, I want walkers on the same road not to overlap or march in lockstep, so that a crowd reads as people.
21. As a player, I want more residents to add more walkers without the existing ones jumping around, so that growth
    looks smooth.
22. As a player, I want people to show from neighborhood zoom in and disappear when I zoom out to the whole island,
    so that the far view stays clean and fast.
23. As a player, I want people not to flicker when I zoom near that switch, so that zooming feels calm.
24. As a player, I want people to cast shadows on Medium and High quality, so that they sit on the ground.
25. As a player, I want the people I see to match what the sim says even after a reconnect or a refresh, so that the
    island never looks reset.

The ferry

26. As a player, I want to see the ferry sail in from the Mainland in the south every morning and evening, so that the
    island's key scene happens.
27. As a player, I want the ferry to dock at the pier at the sim's ferry time, so that the HUD's commuters and the boat
    agree.
28. As a player, I want newcomers to step off the ferry with bags and walk to the homes they moved into, so that I see
    who arrived and where they live.
29. As a player, I want leavers to walk from the homes they left to the ferry with bags, so that departures are visible
    and quiet.
30. As a player, I want the ferry to wait until the last boarding passenger reaches it, so that nobody is left walking
    to an empty pier.
31. As a player, I want the ferry to sail away south after it is done, so that each trip has an end.
32. As a player, I want the ferry to bob on the waves, so that it sits in the water.
33. As a player, I want carriers to take bought goods from the dock as the ferry docks, so that cargo arrives with the
    boat.
34. As a visitor, I want to see my friend's ferry and passengers the same way, so that visiting shows their island
    alive.

Nature and the first view

35. As a player, I want trees, palms, bushes and rocks on open land and beach, so that the big island is not empty.
36. As a player, I want nature never to stand inside a building, a road or my placement ghost, so that building stays
    clear.
37. As a player, I want the same trees in the same places every time, so that my island has a stable landscape.
38. As a player, I want the camera to start over my dock, so that the first thing I see is where the ferry comes in.
39. As a visitor, I want the camera to start over my friend's dock, so that a visit opens on the same scene.

Watch mode

40. As a player, I want a Watch button on the HUD (and V on a keyboard), so that I can sit back and watch.
41. As a player, I want the UI to fade while watching, so that the island fills the screen.
42. As a player, I want the camera to go to the pier before a ferry docks and stay through its passengers, so that I
    never miss the ferry.
43. As a player, I want the camera to visit things that just happened (a building finished, a landmark unlocked, a new
    stage), most important first, so that watching tells me the news.
44. As a player, I want a slow tour of busy places when nothing is happening, so that the view never freezes.
45. As a player, I want a short plain caption for each moment, so that I know what I am looking at.
46. As a player, I want glides between moments to be slow and gentle, so that watching is relaxing.
47. As a player, I want any touch, click or key to end watch mode without doing anything else, so that stopping is
    easy and safe.
48. As a player on a phone, I want the screen to stay awake while I watch, so that I can leave it on the table.
49. As a player on a phone, I want watch mode to run at 30 fps, so that it saves battery.
50. As a visitor, I want to watch my friend's island in watch mode, so that I can enjoy their town.

Sound

51. As a player, I want calm waves that grow louder near the coast, so that the sea feels close.
52. As a player, I want birds by day and insects at night, so that the time of day can be heard.
53. As a player, I want a soft town sound that grows where buildings and people are, so that busy places sound busy.
54. As a player, I want the sound to follow the camera smoothly, even while watching, so that moving never clicks or
    jumps.
55. As a player, I want soft sounds when I tap, when a building lands and when I collect a reward, so that the UI feels
    tactile.
56. As a player, I want one mute switch to silence everything, remembered on my device, so that I can play quietly.
57. As a player, I want no sound while the app is in the background, so that it never plays from my pocket.
58. As a player, I want sound to start after my first touch without errors, so that browsers' autoplay rules never
    break the game.

Phones

59. As a player on a phone, I want the crowds to keep the frame rate within the budget, so that the game stays smooth.
60. As a player on a 90 or 120 Hz phone, I want the game capped at 60 fps, so that it does not drain my battery.

## Implementation Decisions

### Sim: the worker assignment and the routes (no state change)

- The labor pass's staffing becomes one pure, exported **worker assignment**: given an island, the content and a
  commuter count, it returns per workplace how many residents come from which homes and how many commuters come from
  the dock, nearest homes first, by priority then id, exactly as today. The labor pass stores its result; the client
  calls the same function, so staffing is never worked out twice. Outside the day shift the function still answers as
  if the shift were on (the client uses it for the walk home).
- A pure, exported **road path** between two buildings: the tiles from one building's access tile to the other's,
  walking down the sim's own road distance field (ties broken by a fixed neighbor order). Its length matches the
  distance the sim uses for travel time, so a carrier's walk takes exactly the shipment's travel ticks.
- The needs pass's "services in reach" becomes exported, so the client knows which market serves a home.
- None of these change behavior: the state hash, the golden scenario and `pnpm pacing` stay the same in this step.

### Sim: the ferry manifest (state change)

- Each island gains a `ferry` field (in the island header, so it travels in full state and change sets like
  `commuters` and `cargo`), null until the first trip, replaced by every trip:

  ```ts
  ferry: {
    tick: number;                                   // the tick of the trip
    off: { commuters: number; homes: { home: number; people: number }[] };   // newcomers by home they moved into
    on:  { commuters: number; homes: { home: number; people: number }[] };   // leavers by home they left
  } | null
  ```

  Morning trip: `off.commuters` = commuters who came, `off.homes` = newcomers, `on` empty. Evening trip:
  `on.commuters` = commuters going home, `on.homes` = leavers, `off.homes` = evening newcomers. Homes in id order.
- `SIM_VERSION` 5 with a snapshot migration that adds `ferry: null`; `validateWorld` checks the field's shape and that
  every listed home exists or existed (a home may be removed later; the client skips unknown ids). The golden hash is
  updated deliberately; `pnpm pacing` must still meet its targets (the manifest changes no rule).
- The protocol carries it without a new message: the island header gains one field. The client's server-message guard
  accepts it. Bump the protocol version only if the protocol pins the header's shape.
- ADR 0001 records why the sim keeps a record for the client's sake.

### Client: movers (pure render data)

- One pure module turns (mirrored island, content, gliding game time, camera target) into **movers**: position,
  heading, legs clip and phase, arms clip and phase, character, scale (children about 75%), accessory (bag or
  wheelchair). Nothing is stored between frames; seeds come from stable ids (island slot, home or building id, shipment
  id, slot index) through a stateless hash, never `Math.random` or the sim's generator.
- Walking speed is the sim's road speed: one tile per game minute (`roadTicksPerTile`), which is about 1.6 m/s in real
  time. Walk phase comes from distance travelled, so feet do not slide. Walkers get a small sideways offset and a
  hashed start stagger of a few game minutes so they never overlap or march in lockstep. Movers appear at and vanish
  into a building's door: the middle of the footprint's front edge on its access side.
- Flows, all from the state and the sim helpers above:
  - **Residents' commute**: at shift start each home's workers walk to their workplaces (worker assignment on the
    current state); at shift end they walk back (worker assignment as if in shift, with the evening manifest's
    commuter count).
  - **Commuters**: in the morning off the ferry to their workplaces (the morning manifest's commuter count, worker
    assignment); in the evening from their workplaces to the ferry (the evening manifest's `on.commuters`).
  - **Carriers**: one per 5 units of a shipment, at most 4, in single file along the road path, leaving at
    `arriveTick` minus the path's travel time so the last one arrives on `arriveTick`; legs `walk`, arms
    `holding-both`. Cargo from the ferry is already a shipment from the dock, so it needs nothing extra.
  - **Workers at a workplace**: up to 2 by its front, using `interact-left` / `interact-right`, scaled down when
    understaffed and none with no workers; a worker shows here only once their commute has arrived.
  - **Builders**: 2 at each site under construction during the day shift, using the interact clips, none at a
    landmark whose materials have not all arrived.
  - **Market walk**: on a given day one adult from each home a market serves walks there and back between 17:15 and
    17:55 (start hashed per home and day); that home's children come along on some days (hashed). Everyone is home
    before the 18:00 meal.
  - **Ferry passengers**: see the ferry below. Newcomers and leavers carry bags (arms layer `holding-both` with the bag
    on the right arm); families walk together with their children.
  - Nobody walks at night.
- **Looks**: the character for a person is a hash of (home id, person index) for residents and (commuter seat index)
  for commuters, so the same people come back every day. About 3% use a wheelchair (the wheelchair clips and the
  wheelchair accessory), chosen by the same hash. No clothing tints.
- **Detail by zoom**: people are computed and drawn only below the distance where bubbles become dots (0.6 of the
  camera's farthest distance) and hidden above it, with a band (they reappear only below 0.55) so they never flicker.
  At most 200 people, nearest to the camera target first. No cheaper level of detail in this feature; one comes only if
  the phone measurement asks for it.

### Client: drawing people

- One instanced mesh per character file (12) plus one per accessory (bag, wheelchair), all on the palette material
  with a vertex shader that reads the joint-animation texture: each vertex follows its single joint, legs-layer joints
  use the legs clip's matrix, arm joints use the legs-layer torso matrix times the arms-layer arm matrix, two
  neighboring frames are fetched and blended, looping clips loop and the others hold their last frame (the model
  contract in `island-3d-client`). Per-instance attributes carry the clip rows, phases, speed and scale. Accessories
  follow their joint the same way.
- The frame loop fills the instance buffers from the movers module without allocations and without React state
  changes; one component per model type.
- Shadows: the depth material uses the same vertex animation; people cast shadows on Medium and High.

### Client: the ferry

- The Mainland lies due south. A pure **ferry pose** function of (island, content, game time) places the boat along a
  straight sea lane from far south of the pier (beyond the camera's bounds) to its berth beside the pier, with
  `marker_waterline` at the water surface and the boat bobbing with the water's wave function.
- Timeline around each trip at minute T (07:00 and 17:00, from the content's shift minutes; the boat runs every day,
  passengers or not): sails in from T - 20 game minutes, easing in to dock at T; at the berth from T until the last
  boarding walker reaches it, and at least until T + 25; then sails out south over 20 game minutes. Between trips no
  boat is visible.
- Passengers step off from the boat's `marker_deck` across the pier from T + 2, staggered; boarding walkers set off at
  T from their homes or workplaces and vanish at the deck marker.

### Client: nature and the first view

- A pure **nature scatter** from (terrain, island slot): palms and bushes on beach tiles, trees, bushes and rocks in
  clumps on grass (a low-frequency hash for clumps, a per-tile hash for placement and turn), none on a tile with a
  building or road, none within 2 tiles of the dock and pier, and hidden under the placement ghost's footprint while
  placing. Density is a first pick reviewed in the look check. One instanced draw per prop model, through the existing
  instanced path.
- The camera's start pose looks at the center of the island's dock (own island and visits); distance, tilt and azimuth
  stay as tuned.

### Client: watch mode

- View state gains a `watching` flag. Enter: the Watch button on the HUD or V. Exit: any touch, click, wheel or key,
  and that input does nothing else (no building tap, no camera move). Leaving keeps the camera where it is.
- A pure **watch director** of (island, events seen this session, game time, the moments already shown) returns the
  current moment: its kind, camera target and framing, caption, and when it ends. Order:
  1. **A ferry that is due**: from about 8 game minutes before docking, frame the pier and the incoming boat; hold until
     it sails out.
  2. **The most important unshown event** since watching started or in the last game hour (by the content's event
     importance, at least 30; each shown once): its building, or the dock for ferry events.
  3. **A tour of busy spots**: staffed workplaces, construction sites, the market during the evening walk, homes with
     lit windows at night; a hash of the game hour picks the order.
  Each held moment lasts about 25 s real with a slow orbit; glides between moments take about 4 s, gentler than
  player moves. The camera moves through the existing fly-to path.
- Caption: one line of plain text per moment (wording and look are `island-ui`, never emoji). The HUD, bubbles and
  news fade out while watching; the caption stays.
- While watching the frame loop runs at 30 fps, and the screen Wake Lock is held (requested on entry, released on exit,
  requested again when the page becomes visible; a refusal is ignored silently).
- Works on a friend's island the same way, read-only.

### Client: frame rate

- Outside watch mode the render loop is capped at 60 fps, also on 90 and 120 Hz screens. The start check's 24 ms
  step-down threshold stays until the phone measurement.

### Sound

- **Sources**: CC0 only. Candidates are gathered by the agent (Kenney audio packs for the UI sounds, OpenGameArt or
  Freesound filtered to CC0 for the ambience); the user listens and picks (a `ready-for-human` ticket). Each pick is
  recorded in `assets/SOURCES.md` with its link, license and SHA-256; raw downloads go in their own new directory
  under the ignored asset folders, treated as untrusted.
- **Recipe**: a `sounds` step of `pnpm assets` encodes the picks to AAC `.m4a` in the client's public sounds folder,
  makes loops seamless (no gap or click at the loop point), and checks format, duration and a total size budget
  (about 2 MB). The asset catalog lists every sound file; the client builds sound URLs only from it.
- **Ambience**: four looping beds, waves, birds, town and insects, in one Web Audio context outside the canvas tree. A
  pure **ambience mix** of (camera pose, time of day, a small island summary near the camera target: how much coast,
  how many buildings and people) returns four gains: waves grow near the coast and when zoomed in; birds by day,
  insects at night; the town grows with buildings and people near the target and stays distant at whole-island zoom.
  The mix is applied about four times a second with smooth ramps. The files load after the first frame.
- **UI sounds** (`island-ui`): tap (buttons, opening a card), a building landing after its placement is confirmed,
  collecting a reward.
- **Rules**: the context resumes on the first touch, click or key; it is suspended while the page is hidden; the
  existing mute switch silences ambience and UI sounds at once and stays remembered on the device. Sound is on by
  default.

### Skills

- Update `island-game-logic` (worker assignment, road path, ferry manifest, `SIM_VERSION` 5), `island-3d-client`
  (movers, people rendering, the ferry, nature, the start pose, watch mode, frame rate, ambience; close the open items
  this feature settles), `island-ui` (Watch button, caption, the fade, UI sounds) and `island-testing` (the new pure
  modules, the phone check for crowds), with the official skill-creator skill.

## Testing Decisions

Good tests check what the module's interface promises, never its internals: the state after a tick, the movers at a
game time, the moment the director picks, the gains the mix returns, the text and buttons on screen. Test first
(`island-testing`): watch each new test fail for the expected reason.

- **Sim** (prior art: the per-pass tests such as the ferry, labor and migration tests, the invariants, the golden
  scenario, `pnpm pacing`): the worker assignment returns exactly the staffing the labor pass stores, on several
  islands and priorities; the road path's length equals the sim's road distance and its tiles are connected roads;
  after a morning and an evening trip the ferry manifest lists exactly the newcomers and leavers per home and the
  commuters on and off, matching the resident counts that changed; a trip with nobody leaves an empty manifest with
  its tick; a v4 snapshot migrates to `ferry: null`; `validateWorld` rejects a malformed manifest; the golden hash is
  updated deliberately; pacing still passes.
- **Mirror**: the existing mirror tests with a real in-process server show the manifest arriving in full state and in
  updates (prior art: the mirror tests driven like `apps/server/test/player.ts`).
- **Pure client modules** (prior art: `render/*.test.ts`, `camera/controller.test.ts`): movers, ferry pose, nature
  scatter, watch director and ambience mix. For each: the same inputs give the same output; later game time moves
  things forward; frame rate changes nothing. Movers: residents leave home at shift start and reach their assigned
  workplace after their path's travel time; carriers arrive on `arriveTick`; more residents add walkers without moving
  the ones already shown; children never in work flows; nobody at night; none above the zoom switch and the band holds;
  the cap keeps the nearest 200. Ferry pose: at the berth at T, south of the island before T - 20 and after it sails
  out, waits for the last boarding walker. Nature: never on a building, road or ghost tile, the same output for the
  same terrain. Director: a due ferry wins, then events by importance each shown once, then the tour; holds and glides
  last as specified. Mix: waves louder near the coast, birds by day and insects at night, town grows with buildings
  near the target.
- **UI** (prior art: Vitest and Testing Library over the HUD and Settings): the Watch button and V start watch mode;
  the HUD fades and the caption shows; any input ends it and does nothing else; the mute switch silences sound; the
  no-emoji check covers captions.
- **Sound recipe** (prior art: the `tools/assets` catalog and check tests): the catalog lists every sound; the check
  refuses a wrong format, an over-long file or a total over budget.
- **Not tested by code**: the shader, what reaches the speakers, the Wake Lock and the frame rate on a phone. These
  are the user's `ready-for-human` tickets: pick the sounds, the look check (people, ferry, nature), and the crowd
  frame rate on the user's phone at the worst view (street zoom, rush hour) per quality tier.

## Out of Scope

- Friends' islands as far-away shapes and the visit flight from them: the world summary has no positions, and the
  archipelago spacing is smaller than the 64-tile islands (noted for slice 2 in the plan index). Visits keep starting
  from the world screen.
- Vehicles and drivers (trucks arrive with Village), fishing boats and other ships.
- Chimney smoke, street-light glows, dust and other effects.
- A cheaper level of detail for distant people, clothing tints, glasses, canes and other aids.
- Starting watch mode automatically when the player is idle.
- Music.
- Plan 6: the service worker and caching, context-loss recovery as a tested feature, Playwright and screenshot
  checks, the real-phone checklist beyond the crowd measurement, deployment.
- New player commands.

## Further Notes

- The ferry manifest makes the visible passengers follow the sim by up to about 25 game minutes (about one real
  minute); that is deliberate (ADR 0001).
- A game day is one real hour, so a player sees the ferry twice an hour.
- Slice 1 islands hold well under 200 people, so drawing everyone is affordable; the cap and the zoom switch protect
  later stages until a level of detail is measured.
- Branch: `slice1-alive`. One commit per ticket; ask before merging into `main`.
