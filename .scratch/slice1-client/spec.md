# Slice 1 client, part 1: the playable island

Status: ready-for-agent

Plan 5 of the slice 1 index (`docs/plans/2026-10-17-slice1-index.md`), first of two features. This one makes the island
playable on a phone from sign-up to Settlement. The second, `.scratch/slice1-alive/`, makes it alive: crowds of Mini
Characters, the ferry, watch mode and sound. It gets its own `/grill-with-docs` on top of this feature's code.

Sources: design spec 6.1, 6.2, 8.1, 12.1, 12.4, 12.5, 12.6; the skills `island-3d-client`, `island-ui`,
`island-testing`, `island-game-logic`; the mockups in `docs/mockups/`. Where this spec and those disagree, the design
spec wins, except for the two sim rules settled below, which also go into spec 12.1.

## Problem Statement

The server runs islands around the clock, but nobody can see or play them: there is no client. A player has no way
to sign up with a friend's invite code, see their island in 3D, move the camera around it, build, hire commuters,
sell goods, or watch it grow to Settlement on their phone. A friend cannot visit.

Two sim gaps also block playtesting. An island that spends every coin before it has residents or anything to sell
stays stuck forever, because commuters only come when their wage can be paid. And a building waiting for money stops
completely: its paid commuters stand idle, so an island just short of money drains itself into that stuck state.
The design spec says such a building slows down, not stops.

## Solution

A phone-first web client in `apps/client`, served by the game server from the same origin as `/api` and `/ws`:

- Sign-up with an invite code (which claims an island), log in, create a world (which claims an island), join a world,
  pick a world, share and regenerate the invite code.
- The island in 3D with the "golden" look: terrain, water, the Kenney models instanced on the grid, roads that turn
  to fit their neighbors, construction scaffolds, day and night from the game clock with lit windows.
- The full free camera on touch, trackpad, mouse and keyboard, with the compass and "Show me" fly-tos.
- Build mode: a see-through ghost checked by the sim's own placement rules, Rotate, Cancel, Place; road drag with
  its cost.
- The style A UI: HUD, building and landmark cards with Fix, bubbles, coins flying to the counter, the "while you
  were away" news from the port master, Staff, Trade, Build picker, Log, Settings, the stage celebration, and calm
  states for loading, reconnecting, a resting world and a device without WebGL2.
- Visiting a friend's island read-only, from the world screen.

In the sim, two rules make an island always recoverable:

- **Mainland help.** At the morning ferry, before commuters board, a stuck island gets a small grant from the
  Mainland and an event that says so.
- **Waiting for money slows a building down.** It keeps its workers and runs at reduced output instead of stopping.

## User Stories

Getting in

1. As a new player with a friend's invite code, I want to sign up with a username, a password, the code and a name
   for my island, so that I get an account and an island in my friend's world in one step.
2. As a new player, I want the username rules (letters, digits, "-" and "_") shown next to the field before I type,
   so that I don't get refused after typing.
3. As a new player, I want a kind, specific message when the invite code doesn't work, the world is full or the world
   is resting, so that I know what to do next and no half-made account is left behind.
4. As a returning player, I want to log in with my username in any letter case, so that "Lena" and "lena" are the
   same account.
5. As a returning player on the same phone, I want to stay signed in for weeks, so that opening the game goes straight
   to my island.
6. As a player, I want to create a new world and name my island in it, so that I can start a world of my own and
   invite friends.
7. As a world's creator, I want to see the world's invite code with a way to copy it, so that I can send it to a
   friend.
8. As a world's creator, I want to regenerate the invite code, so that an old code that leaked stops working.
9. As a player already in one world, I want to join another world with its invite code and name my island there, so
   that I can play with different friends.
10. As a player in several worlds, I want to pick which world to open, with each world's islands listed by name and
    owner, so that I can switch between them.
11. As a player, I want a calm loading screen in style A while the island and its models load, so that I never stare
    at a blank page or a bare spinner.
12. As a player on a device without WebGL2, I want one friendly sentence saying the game can't run here, so that I
    am not left with a broken page.

Seeing the island

13. As a player, I want to see my island in 3D with terrain, water and every building on its tile, so that the island
    itself is the main display.
14. As a player, I want buildings drawn with the chosen golden look and one shared palette, so that the island looks
    finished and runs smoothly on my phone.
15. As a player, I want roads to join up into straights, corners, junctions and ends on their own, so that my road
    network looks right without effort.
16. As a player, I want a building under construction to show a scaffold and rise in steps, so that I can watch
    progress on the island instead of reading a bar.
17. As a player, I want the sun, sky and shadows to follow the game clock, with lit windows at night, so that the
    island has a day and a night.
18. As a player, I want the island to keep moving smoothly between the server's ticks, with the clock and counters
    gliding, so that it never looks like it jumps every few seconds.
19. As a player, I want the quality level picked for my device and changeable in Settings, so that the game stays
    smooth on my phone and looks best on a strong device.

The camera

20. As a phone player, I want to move the view with a one-finger drag, so that I can look around the island.
21. As a phone player, I want to zoom from the whole island down to street level with a pinch or a double-tap on open
    ground, so that I can see both the big picture and the details.
22. As a phone player, I want to turn the view a full 360 degrees with a two-finger twist, so that I can see the
    island from any side.
23. As a phone player, I want to tilt from straight down to near eye level by moving two fingers up or down side by
    side, so that I can look across the island like a visitor.
24. As a desktop player, I want to move with drag, WASD or the arrow keys, zoom toward the cursor with the wheel or a
    trackpad pinch, and turn and tilt with right-drag or Q and E, so that every input I have works.
25. As a Mac trackpad player, I want a two-finger swipe to move and a pinch to zoom, with a Settings switch if the
    game guesses my device wrong, so that the trackpad feels natural.
26. As a player, I want every camera movement to glide to a stop and zooming in to tilt a little by itself, so that
    the camera feels calm.
27. As a player, I want the camera to stay around the island and never go below the ground, so that I can't get lost.
28. As a player, I want a compass that shows north and faces north when tapped, so that I can always reorient.
29. As a player, I want "Show me" to fly the camera to the place it is about, so that I can find what the news, the
    Log or a card points to.

Building

30. As a player, I want a Build picker with each building's picture, name and cost, so that I can choose what to
    build.
31. As a player who can't afford a building, I want it marked "Need N more coins" and Place disabled, so that nothing
    is queued that I can't pay for.
32. As a player, I want a see-through copy of the building to snap to the grid just above my finger, so that my finger
    never hides where it goes.
33. As a player, I want labels on the ghost saying what is right or wrong there ("Road access", "Too close to the
    farm"), checked by the same rules as the server, so that what the ghost allows is what the server accepts.
34. As a player, I want Rotate, Cancel and Place buttons while placing, so that I can turn the building, give up or
    confirm.
35. As a player, I want the ghost to show a short "placing" state until the server answers, then land with a bounce
    and a puff of dust, so that I see the building is really placed.
36. As a player whose placement the server refused, I want the ghost to stay with the reason in plain words and no
    bounce, so that I am never shown a building that isn't there.
37. As a player, I want to draw roads by dragging along the grid, see the cost as I drag and confirm, so that roads
    are quick to lay and I know what they cost.

The HUD and cards

38. As a player, I want a stage badge with the stage name and a ring showing progress to the next stage (residents,
    then the landmark), so that I always know what I am working toward.
39. As a player, I want coin and resident counters, and a commuter counter during Outpost, in whole coins, so that I
    can see the island's state at a glance.
40. As a player, I want goal icons on the left edge for the next stage target and current needs, so that I know what
    to do next without a menu.
41. As a player, I want round bottom buttons for Staff, Trade, Build and Log, with Build big in the center, so that the
    main actions are one thumb tap away.
42. As a player, I want to tap a building and see its card at once, so that I can check on any building.
43. As a player, I want the card to show the building's picture, its most important condition in words, what it makes
    as pictures and its workers, so that I understand it without numbers tables.
44. As a player, I want the card to show the cause of a problem with a Fix button that does the fix when there is one
    action (raise priority, hire commuters) and otherwise moves the camera to the cause and says why, so that problems
    are one tap from being solved.
45. As a player, I want the Island Hall's card to list its materials and offer to buy the missing ones from the
    Mainland, with bought ones shown on their way until the next ferry, so that I can finish the landmark.
46. As a phone player holding the phone upright, I want cards to come up from the bottom, and sideways or on a tablet
    or desktop to appear on the right, so that the island stays visible.
47. As a player, I want bubbles over buildings for problems, wishes and rewards, so that I see what needs attention on
    the island itself.
48. As a player, I want to tap a reward bubble to collect it and see the coins fly to the counter, so that rewards feel
    like rewards.
49. As a player zoomed out to the whole island, I want bubbles to shrink to small dots with only problems left, so
    that the view stays clean.

Staff, trade and the port master

50. As a player, I want to hire Mainland commuters in the Staff panel and see that ferry seats limit them, so that I
    can staff my buildings before I have residents.
51. As a player, I want to meet the port master in the Staff panel with a portrait, name, role and trait, and turn on
    their auto-sell surplus rule, so that my surplus sells while I am away.
52. As a player, I want the Trade panel to show my goods as picture tiles with Mainland prices and let me sell, so that
    I can earn coins.
53. As a player, I want a sale limited by the floor price to say so in plain words ("The Mainland pays too little right
    now"), so that a refused sale never fails silently.

News, log and celebrations

54. As a returning player, I want the port master to show what happened while I was away, the most important events
    grouped and at most five, one at a time with "Show me", so that I catch up quickly.
55. As a player, I want a Log with the history of news and events, newest first, each with a picture, one sentence and
    "Show me", so that nothing from the news is lost.
56. As a player reaching Settlement, I want a small happy celebration (the badge pops with the new stage name, a short
    sparkle, a line from the port master) that doesn't block play, so that the moment feels earned.
57. As a player whose island got stuck, I want the news to tell me the Mainland sent help, so that I understand where
    the coins came from and that the island is moving again.

Settings and account

58. As a player, I want a gear next to the compass that opens Settings with sound, quality, controls, my account and
    log out, so that everything I can change is in one plain place.
59. As a player, I want to change my password in Settings, which signs out my other devices, so that I can secure my
    account.
60. As a player, I want log out to end only this device's session, so that my other devices stay signed in.

Connection and resting worlds

61. As a phone player coming back to the app, I want it to reconnect by itself with a small calm "reconnecting" state,
    so that a dropped connection never shows an error wall.
62. As a player whose world paused after an error, I want to see "This island is resting, back soon", so that I know
    it is the server's problem and it will come back.
63. As a player on an old version of the app, I want to be told to reload when the server needs a newer client, so
    that I never play against a protocol that doesn't match.

Visiting

64. As a player, I want to visit a friend's island from the world screen with a short camera flight and fade, so that
    I can watch how their island is doing.
65. As a visitor, I want to see their island's name and owner, the same island they see, with every owner control
    hidden and an easy way home, so that visiting is safe and simple.

Always recoverable (sim)

66. As a player who spent every coin before having residents, I want the Mainland to send a small grant on the
    morning ferry, so that I can hire commuters again instead of being stuck forever.
67. As a player just short of money, I want a building waiting for money to keep working at reduced output, so that
    the commuters I paid still produce goods I can sell.
68. As a player away from my phone, I want both rules to work without me, so that the island never gets stuck just
    because I am away.

Playing the game end to end

69. As a solo player in a world of my own, I want everything above to work with no friends, so that one player is a
    complete game.
70. As a phone player, I want to grow my island from empty to Settlement using only touch, so that the phone is a full
    way to play.
71. As a player, I want no emoji or emoji-like symbols anywhere, only real icons, so that the UI looks the same on
    every phone.
72. As a player opening the game's address, I want the page, `/api` and `/ws` to come from the same server, so that
    sign-in cookies and the WebSocket just work.

## Implementation Decisions

### Sim: Mainland help (ticket 01)

- A new step in the morning ferry, before commuters board: if the island is stuck, credit `mainlandHelpCents`
  (a new content rule, first guess 10,000 cents: about a day's wages for four commuters plus a day of a workplace's
  upkeep) with a new ledger reason, and emit a new `mainland-help` event type with its importance in content data.
- "Stuck" is exact and checked only at the morning ferry: no residents, coins below one commuter's day wage, no goods
  in any store, nothing in transit or cargo, and no reward waiting to be collected. Hired commuters may be zero; the
  grant still comes, and the news tells the player to hire.
- Because it is checked once per morning ferry, it comes at most once per game day.

### Sim: waiting for money slows down (ticket 02)

- A building waiting for money is staffed by the labor pass like any other built building, and produces at a new
  content rule `waitingOutputPermille` (first guess 500) of its normal rate. Upkeep is still retried every hour; the
  condition clears on the first successful payment.
- This replaces "gets nobody" in the labor pass and the production skip, and matches spec 12.1 ("slows down").

### Sim: both tickets

- Both are behavior changes: bump `SIM_VERSION` (no state shape change, so the snapshot migration is an identity
  step), update the golden hashes deliberately with the reason in the commit, and rerun `pnpm pacing` against the
  stage-time targets. Spec 12.1 and `island-game-logic` record the rules.

### Sim: the island from its entities

- The sim's placement check, `shownStatus`, `residentsOf` and the other helpers take an island state, but the mirror
  holds entities. The sim gains the inverse of `worldEntities` for one island: a pure function that assembles the
  island state from its `island`, `terrain`, `roads`, `building` and `transit` entities, next to `worldEntities` and
  round-trip tested against it. The client calls it once per update and hands the result to the sim's helpers, so no
  rule is copied into the client.

### Serving the client (server)

- The game server serves the built client from the same origin as `/api` and `/ws`: static files from the client's
  build output, with a safe path lookup (no path outside the build folder, no dotfiles), the right content types, an
  `index.html` fallback for unknown non-API paths, and long caching for hashed asset files only.
- In development the Vite dev server proxies `/api` and `/ws` to `pnpm server`, which runs with `ISLAND_ORIGIN` set to
  the dev server's origin so the WebSocket Origin check passes.

### Client stack and shape

- `apps/client`: Vite, React, React Three Fiber, drei, Zustand, `@use-gesture/react`, camera-controls through drei's
  `<CameraControls>` with its own input off. It imports `@island/protocol`, `@island/sim` and `@island/content` and
  never copies their rules.
- Layers, each a deep module with a small interface:
  - **Connection**: one WebSocket to `/ws` (hello, open-island, commands with request ids, mark-seen), reconnecting
    with backoff when it drops or the page comes back from the background; every reconnect starts from a fresh full
    state. An HTTP client for the `/api` routes (register, login, logout, me, password, worlds, join, invite). Both
    validate what they receive with the protocol's types.
  - **Mirror store**: one Zustand store. Its core is a pure `applyMessage(state, message)`: `island` replaces the
    mirror, `update` applies changes with the sim's `applyChanges`, appends events and takes the summary, `status`
    sets the world status, `result` settles the matching pending command. View state (camera mode, quality, controls
    choice, placement draft, open card) lives beside the mirror, so a new full state never wipes it.
  - **Glide**: one gliding game clock and gliding counters derived from tick numbers and arrival times, the single
    time source for every animation.
  - **Render data**: plain TypeScript with no React or three imports. It turns the mirror and the game time into
    instance lists per model type (buildings at footprint center and rotation, road pieces turned by their neighbors,
    scaffolds and construction steps, terrain chunks), the night state and the anchors for bubbles.
  - **Placement**: given the mirror, a building or road drag, a tile and a rotation, returns the sim's own verdict,
    the labels in words, the cost and the command to send. It calls the sim's placement check on the mirrored state;
    it never re-implements a rule.
  - **Camera controller**: pure. Camera state plus a normalized gesture (drag, pinch, twist, two-finger tilt, wheel,
    trackpad swipe, key, double-tap, fly-to, face north) gives the next target state, with the limits (stays around
    the island, never below the ground, tilt range), auto-tilt and momentum. The `@use-gesture` and keyboard binding
    only normalizes events and feeds it; camera-controls only smooths toward its target. The tilt lock follows spec
    12.5.
  - **Scene**: R3F components, one per model type, filling instanced meshes imperatively from render data; terrain,
    water with a cheap wave and shore foam, one sun, one shadow map near the camera (off on Low), lit windows from
    palette slot 0. It follows the model contract in `island-3d-client` and loads only what the asset catalog lists.
  - **UI**: React over the canvas in style A, built from `island-ui`. Screens: sign-in and sign-up, world list,
    create and join, invite code, loading, island (HUD, cards, bubbles, panels), visit, Settings, and the calm
    states (reconnecting, resting, update required, no WebGL2).
- The commands the UI sends are the sim's: `place-building`, `place-road`, `hire-commuters`, `set-priority`,
  `set-auto-sell`, `sell`, `buy-materials`, `collect`. The check-in is the server's job when the island opens.
  Refusals show the reason code in plain words (`island-ui` text tone), with "Need N more coins" from the shortfall.
- Money shows as whole coins (cents divided by 100, rounded down). Display names of buildings and goods come from
  content data or one client table keyed by id, not scattered strings.
- Bubbles, cards and Fix read the building's conditions in the spec 12.1 order. Fix with one action sends it; otherwise
  it flies the camera to the cause and says why.
- Quality tiers: Low, Medium and High, picked by a quick check at start and changeable in Settings. Low turns shadows
  off and lowers the pixel ratio; the pixel ratio never goes above 2. Nothing renders while the page is hidden.
- The Watch button and Views stay out of this feature: Watch arrives with watch mode in `slice1-alive`; Views with
  Goods flow in slice 3.
- Screens with no approved mockup (Staff, Trade, Build picker, Log, Settings, sign-in, world screens, visiting) are
  built from the style A blocks and reviewed by the user in the look review ticket.

## Testing Decisions

Good tests check what a player or the server can observe through the module's interface, never its internals: the
mirror after a message sequence, the verdict for a placement, the camera target after a gesture, the text and buttons
on screen. Test first (`island-testing`): watch each new test fail for the expected reason.

- **Sim rules (tickets 01, 02)**: per-pass unit tests in `packages/sim` like the existing ferry, labor, production and
  upkeep tests: a stuck island gets exactly one grant per morning ferry and an event; an island with a resident, a
  coin for one wage, a stored good, cargo on the way or a waiting reward gets none; a building waiting for money keeps
  its workers and produces at the reduced rate, then full rate after payment. Plus the invariants every tick, the
  golden scenario with its hash updated deliberately, a new golden for a stuck island that recovers, and
  `pnpm pacing`.
- **Serving the client**: server integration tests on a real HTTP server like `apps/server/test/http-api.test.ts`:
  files served with the right types, `index.html` fallback, `/api` and `/ws` untouched, path traversal and dotfiles
  refused.
- **Mirror store**: Vitest on `applyMessage` with message sequences from a real in-process server, driven the way
  `apps/server/test/player.ts` does it (sign up, open the island, place, tick, take the messages). The island
  assembled from the mirror must equal the server's island state; a second full state replaces everything and keeps view state; a pending command
  settles from its result.
- **Render data**: unit tests on the pure functions: the same mirror and game time give the same output; road pieces
  and rotations for each neighbor pattern; buildings at footprint center and the sim's rotation; construction steps
  advance with progress; night follows the clock.
- **Placement**: unit tests on mirrors built with the sim's own commands: the verdict and labels agree with what the
  sim's `place-building` command decides on the same state (valid and each refusal reason), road cost per tile, the
  command produced.
- **Camera controller**: unit tests per input kind: each gesture moves the target the right way, limits hold (never
  below the ground, stays around the island, tilt range), the two-finger tilt lock triggers only for side-by-side
  vertical moves, momentum decays to rest, auto-tilt on zoom, face north, fly-to.
- **UI**: Vitest and Testing Library in jsdom, components fed a store state, found by role and accessible name: HUD
  values and the Outpost-only commuter counter, the card's most important condition and Fix, "Need N more coins", the
  placing state and no bounce on a refusal, news top five by importance, the Log, Settings, the sign-up errors, the
  resting and reconnecting states, owner controls hidden on a visit, the absence of Views and Watch, and the
  no-emoji check over all rendered text.
- **Not tested by code in this feature**: 3D visuals, frame rate and real touch, checked by the user in the
  `ready-for-human` tickets (the look review, and camera feel on a real phone). Playwright, screenshot checks and the
  real-phone checklist belong to plan 6.

## Out of Scope

- Everything in `slice1-alive`: crowds of Mini Characters, carriers and workers on the island, the ferry boat with
  commuters and newcomers, watch mode and the Watch button, ambience and UI sounds, friends' islands far away as
  shapes, the crowd level of detail measured on a phone.
- Plan 6: the PWA (manifest, service worker, "Add to Home Screen" hint, Wake Lock), context-loss recovery as a tested
  feature, two-player Playwright, screenshot checks, the real-phone checklist, deployment.
- Later slices: building levels and Upgrade, the damaged look and repair, Views and Goods flow, more key staff,
  sending goods to friends.
- New player commands or protocol messages. If the client needs one, stop and raise it.

## Further Notes

- Ticket 01 (Mainland help) and 02 (waiting for money) have no client blockers and land first, before the client is
  playtested. The plan index's soft lock item is closed by them.
- Mainland help can be gamed by spending the grant on buildings each morning. In a private world of friends that is
  harmless; revisit it only if pacing or playtests show it matters.
- The `/to-tickets` breakdown ends with tickets that update `island-3d-client`, `island-ui`, `island-testing`,
  `island-server` and `island-game-logic` with real paths and APIs (using `anthropic-skills:skill-creator`), the plan
  index status and the status line in `CLAUDE.md`.
- `ready-for-human` tickets: the look review of the first lit island and the unmocked screens, and camera feel on the
  user's real phone. The crowd frame rate on a phone belongs to `slice1-alive`.
