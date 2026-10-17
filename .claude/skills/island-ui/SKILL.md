---
name: island-ui
description: Rules and approved visual style for the 2D game UI of Island Sim (apps/client, HTML/CSS/React over the 3D canvas). Style A "Cozy and bright", icons only and never emoji, the HUD layout, bubbles over buildings, key-staff news, building cards, Views, the placement panel, Settings and Log, narrow and wide layouts, touch targets, button sounds and the tone of UI text. Use this skill whenever you design, build, change, mock up or review anything the player sees as 2D UI in Island Sim - a HUD element, button, card, panel, menu, popup, bubble, label, settings, the sign-in, world or visit screens, UI CSS or animation, an icon, or any player-facing wording - even if the request only says "show X to the player", "display the stats", "add a screen for Y" or "make a mockup". Also use it to check a UI change for emoji, dashboard-style tables, tabs or charts. Not for 3D rendering, camera or crowds (island-3d-client), game rules (island-game-logic) or rendering icons from the models (island-blender).
---

# Island Sim: 2D UI

The 2D UI is everything drawn in HTML/CSS/React on top of the 3D island in `apps/client` (planned: Vite + React +
React Three Fiber). This skill holds the approved look and the rules every screen must follow.

**Status: first draft, written from the design spec before any code exists.** Paths marked *planned* do not exist
yet. Slice 1 settles the open points listed at the end; update this skill then (spec section 8.1, step 10).

## Sources of truth

1. `docs/superpowers/specs/2026-10-16-island-sim-design.md`: section 6.1 (screens and controls) and **section 12
   "Resolved details"** (12.4 client and UI is this skill's; also 12.1 game rules, 12.3 server, 12.5 input and
   sound), plus 1 (non-goals), 2.4 (key staff) and 6.2 (state, PWA). **Where anything here disagrees with the spec,
   the spec wins.** Fix this skill when you notice.
2. `docs/brainstorm/2026-10-15-island-sim-brainstorm.md`, Section 4a and decisions 22-25: why things are the way
   they are, and what was rejected.
3. Optional: `.superpowers/brainstorm/*/content/a-merged.html`, `game-feel-v2.html` (style A column) and
   `camera.html` are the approved HTML mockups. They are git-ignored and may be missing. Never depend on them. They
   predate section 12, so where they differ the spec wins: no "Mayor" greeting, no level number in the stage badge,
   and the "following a person" screen in `camera.html` was **rejected**.

## What this skill owns, and what it hands off

| Topic | Owner |
|---|---|
| Look, layout, wording and behavior of HUD, bubbles, cards, panels, news, Log, Settings, Views picker and legend, placement panel and labels, watch-mode caption, sign-in, world and visit screens; button sounds | **island-ui** (this skill) |
| Anything drawn inside the 3D canvas: placement ghost, Goods flow lines, island fade in a view, crowds, camera moves ("Show me", Fix moving to the cause, compass, watch mode, the flight to a friend), gestures on the island, island ambience | `island-3d-client` |
| What a status, problem, need, wish, goal or placement rule *is*, prices and what a Fix does | `island-game-logic` |
| Commands, server replies and reason codes, reconnecting, accounts, username and island-name rules, paused worlds | `island-server` |
| Building and goods pictures and key staff portraits rendered from the 3D models | `island-blender` |
| Adding a building or good end to end, including its card and icon | `island-content` |
| Component tests, end-to-end and screenshot checks | `island-testing` |

The UI never decides game outcomes. It shows the state from the client store (one Zustand store mirroring the
island, spec 6.2), previews with the shared `sim` rules, sends commands, and treats the server's answer as final.

## The rule behind everything: it's a game, not a dashboard

The user's feedback on the first draft (2026-10-15): **"this is a game, so don't display it like statistics and
menus."** That draft had key/value rows, tabs, sparklines and a data top bar, and read like an analytics app.

Ruled out as the way the game presents itself (spec non-goals):

- key/value tables and rows of numbers ("Production: 12/h, Stock: 340")
- tabs and tab bars (inside cards too)
- sparklines, charts and graphs
- a data top bar (money, population, happiness, clock and alerts in one strip)
- lists of warnings sorted by severity, per-good production-vs-consumption reports

The simulation stays deep. Only the presentation changes: the depth is shown on the island, in pictures, by
characters, and in Views. **Numbers appear only when you ask**, small, and attached to a picture (a count badge on
a goods tile, a cost on a button), never as a wall.

## Seven principles (from the research in brainstorm 4a)

1. **The island is the main display.** Show state on the buildings (smoke, lights, crates piling up, idle workers),
   not in rows. The UI covers as little of the island as it can.
2. **Bubbles over the world.** Problems and wishes float over the building they belong to (SimCity BuildIt only
   became readable after adding more of them).
3. **Characters deliver news.** Key staff speak with a portrait and a line of text instead of a report.
4. **Goals on the board.** Goals are small icons on the left edge and wishes in the world, not a quest menu.
5. **The most frequent action must feel best.** Placing, collecting and tapping bubbles get a small animation and
   a soft sound every time, calm in tone. No screen shake.
6. **Depth behind lenses.** Detail lives in Views that recolor the island by topic, not in tables.
7. **Restrained HUD.** The UI must not compete with the island for attention. Always-visible parts are few.

## Style A "Cozy and bright", in short

Chosen 2026-10-15 (D23), plus the Goods flow view borrowed from direction C. Take only C's view, not C's slim dark
HUD or its data bar. Feels like Township, Hay Day, SimCity BuildIt, but calm, and never like a pay-to-win mobile game.

- Chunky round buttons and rounded cards with **thick dark outlines** and a hard drop shadow.
- Bright colors on white or cream surfaces; one rounded, friendly font.
- A **small bounce or sparkle on touch** with a soft button sound; bubbles bob gently; coins fly to the counter.
- Calm: no screen shake, no flashing, no urgent timers or nagging badges.
- Palette and font in the mockups are a starting point only. **The final palette is decided in slice 1 after the
  art-direction pass (Q10); update this skill then.**

Details, mockup color values, button kinds, motion and sound: `references/style-a.md`.

## Icons only, never emoji

A strict user rule (D22, and its own non-goal in spec 1), for the game, mockups and docs alike.

- **UI chrome** (buttons, statuses, hints): an SVG line-icon set. The exact library is **to be decided in slice 1;
  update this skill then.** The mockups used Lucide-style 24 px line icons.
- **Buildings, goods and key staff portraits**: pictures rendered in Blender from the 3D models (portraits from
  the Mini Characters with accessories), `island-blender`, planned in `apps/client/public/icons/`.
- **Symbol characters count as emoji**, because some phones draw them as colored emoji: check marks, crosses,
  warning signs, stars, hearts, arrows, play triangles, the copyright and trademark signs and similar. Draw them as
  icons. Player-facing text holds letters, digits and plain punctuation only.

Full rules, the blocked character ranges, a check you can run, and player-typed names: `references/icons.md`.

## HUD layout (approved)

```
+-------------------------------------------------+
| (stage badge + ring)            [coin]  12,480  |
|  "Outpost"                      [people]    42  |
|                                 [commuters]  8  |  <- commuters only during Outpost
| [goal]                         (gear) (compass) |
| [goal]                                  (Watch) |
|                                                 |
|          the island is the main display         |
|          bubbles float over buildings           |
|                                                 |
|   (Staff)  (Trade)  ( BUILD )  (Views)  (Log)   |
+-------------------------------------------------+
```

- **Stage badge**, top left, showing the **stage name**, with a ring showing progress to the next stage: first
  residents toward the target, then the landmark. Never a level number, never the player's title (there is none).
- **Counters**, top right: whole coins and residents; commuters too during Outpost. They glide between ticks.
- **Goal icons**, left edge: the next stage target and current needs, each with a small progress bar.
- **Compass**, a small **gear** next to it (opens Settings), and **Watch**, right side.
- **Bottom round buttons**: Staff (hire commuters and key staff), Trade, **Build** (big, center), Views, Log.
  **No tab bar.** These buttons open a card, panel or mode over the island; they do not switch pages. The **Views
  button appears with the first view** (Goods flow, slice 3); until then it is not shown.
- Nothing else is always visible. Adding a new always-visible element changes an approved layout: ask the user.

All screens and pieces in detail: `references/screens.md`.

## The other pieces at a glance

| Piece | Essentials |
|---|---|
| Bubbles | Problems (the most important condition), wishes (unmet needs) and rewards to tap; zoomed out, small dots and only problems |
| Coins | Fly from a collected reward to the coin counter |
| News | On return, a key staff member with portrait; the top five grouped events since the last visit by their content-data importance, one at a time, "Show me" |
| Log | The history of news and events, each with "Show me" |
| Building card | Picture, one status in words (the most important condition), recipe as pictures, workers, problem cause + Fix (raise priority, hire commuters, repair, or go to the cause), manager slot; level stars and Upgrade from slice 2 (workplaces and services only) |
| Views | Goods flow (slice 3), Workers, Happiness, Traffic; the island fades slightly while one is on |
| Placement | See-through ghost above the finger, labels like "Road access", Rotate / Cancel / Place; Place disabled with "Need N more coins"; roads paid per tile; a short "placing" state until the server accepts |
| Settings | From the gear: sound, quality, controls (trackpad or mouse), account (username, change password), log out |
| Watch mode | UI fades, one-line caption, touch to take control again |

All of them in detail: `references/screens.md`.

## Layouts and input

- **Narrow** (phone upright): cards come up from the bottom. **Wide** (phone sideways, tablet, desktop): the same
  cards sit on the right so the island stays visible. Chosen by **screen shape, never by device type**.
- A tap on a building opens its card at once. Android's back button closes the open card first.
- Desktop adds **hover hints** and **keyboard shortcuts**; neither may be the only way to do something.
- Phones: touch targets at least 44 x 44 CSS px, main actions within thumb reach at the bottom, layout clear of
  the notch and home indicator, text readable without zoom (browser pinch-zoom is off).

Details: `references/layout-and-input.md`.

## No per-person cards

Citizens are crowds, not individuals (rejected in 4a: "too detailed"). Never build a tap-a-person card, a name
tag, a daily schedule or a "follow this person" control. The little worker heads on a building card are slot
counts drawn as pictures, not people you can open. **Key staff are the only named individuals**; they appear in
the news, the Staff panel and manager slots.

## Text tone

Plain, short, friendly. Say what is happening on the island, in words a player uses ("Waiting for flour", not
"Input deficit"). Give the cause and the way out ("The windmill has no workers." + Fix). Nothing alarming: problems
are gentle and repairable, and nothing is ever lost. No title for the player; the island has the name the player
gave it. Names of buildings and goods are looked up by content id, never hardcoded; every server reason code gets
friendly words. Full guide with examples: `references/text-tone.md`.

## Workflow: building or changing a screen

1. Read the spec parts above that touch your screen, section 12 included. If the spec and this skill disagree,
   follow the spec.
2. Find the approved piece in `references/screens.md`. If the screen has no approved design yet (see the list at
   the end), design it in style A from the parts that exist, and when the user is available, show a quick mockup
   first, the way every approved screen was agreed.
3. Split the work by owner: 2D here; anything in the canvas goes to `island-3d-client`; rules, statuses and prices
   come from `sim` (`island-game-logic`); pictures and portraits from `island-blender`.
4. Build both layouts (narrow and wide) from the start, with real touch targets.
5. Write the wording with `references/text-tone.md`; take names from content data.
6. Add component tests and, for visible changes, a screenshot check (`island-testing`). Include the no-emoji check
   from `references/icons.md`.
7. Go through the checklist below. Fix every "no" before calling it done.

## Review checklist for any new screen

**Game, not dashboard**
- [ ] No key/value table, rows of figures, tabs, tab bar, sparkline, chart or data bar.
- [ ] State is shown as pictures, on the island, or by a character; numbers only on request, attached to a picture.
- [ ] The island stays visible (narrow: the card covers only the bottom; wide: the card sits on the right).
- [ ] Nothing new is always visible without the user's approval; nothing is shown before its feature exists.

**Style A**
- [ ] Round or rounded shapes, thick dark outline, hard drop shadow, bright colors from the shared tokens (no
      one-off hex values).
- [ ] A small bounce or sparkle and a soft sound on touch; calm motion; no shake, flashing or urgent timers.
- [ ] Honors reduced motion and the sound setting.

**Icons, not emoji**
- [ ] Every symbol is an SVG icon or a rendered picture.
- [ ] No emoji and no emoji-prone symbol characters in any player-facing text (the check in `icons.md` passes).
- [ ] Icon-only buttons have an accessible name; meaning never depends on color alone (icon, shape or word too).

**Layout and input**
- [ ] Works in narrow and wide layouts, switching by screen shape; an open card survives the switch.
- [ ] Touch targets at least 44 x 44 px with space between them; frequent actions at the bottom within thumb reach.
- [ ] Respects safe areas (notch, home indicator); Android back closes the open card first.
- [ ] Touches on the UI do not move the camera; touches on the island still do.
- [ ] Desktop: hover hints and any shortcuts are extras, never the only way; no clash with camera keys.

**Content and behavior**
- [ ] No per-person card, name or schedule for citizens; no title for the player.
- [ ] One status in words (the most important condition); problems show the cause and a Fix.
- [ ] Rules, statuses and prices come from `sim`, not re-implemented in the UI; actions are sent as commands and a
      rejection is shown in plain words.
- [ ] Money shows as whole coins; anything unaffordable says "Need N more coins".
- [ ] Owner controls are hidden while visiting a friend's island.
- [ ] Text is plain, short and friendly; names come from content data.
- [ ] Solo play works: nothing on the screen needs a friend (D11).
- [ ] Component test and screenshot check added or updated.

## Still open (update this skill when settled)

- Final palette and font (slice 1, after the art-direction pass Q10).
- The SVG line-icon library and the file location of the UI icon set.
- Where the UI code and design tokens live in `apps/client` (suggested, not fixed: `apps/client/src/ui/`).
- The exact narrow/wide breakpoint and the desktop shortcuts for the bottom buttons.
- Rendered picture size and format, and whether the card picture is a separate render (with `island-blender`).
- Where display names live (content data by default; confirm with `island-game-logic`).
- Screens with no approved mockup yet: Staff, Trade, Build picker, Log, Settings, sign-in, world and claim
  screens, visiting a friend's island.
