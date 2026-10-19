# Slice 1 soft UI: no dark outlines

Status: ready-for-agent

From the playtest brainstorm of 2026-10-19 (brainstorm decision 30, which amends decision 23). Sources: decision 23,
the skill `island-ui` (style A), `docs/mockups/`.

## Problem Statement

Every button, pill, card and panel has a thick dark outline and a hard offset shadow. On the phone, over the soft
golden 3D island, the outlines look heavy and do not match the game's look.

## Solution

No UI piece has a dark outline. A soft blurred shadow (`--lift`, and `--lift-pressed` while pressed) lifts it off the
island instead; fills and colors stay as they are. A sample (the HUD's counter pills and round bottom-bar buttons) is
restyled first and shown to the player; once they approve it, every component follows.

## User Stories

1. As a player, I want buttons without heavy dark outlines, so that the UI matches the soft look of the island.
2. As a player, I want every button and pill still easy to see over grass, sand and water, so that nothing gets lost.
3. As a player, I want pressing a button to still feel like pressing, so that touch feedback stays.
4. As a player, I want the same soft style on cards, panels, bubbles and screens, so that the UI is one style.
5. As a player, I want text fields to still show where to type, so that sign-in stays easy.
6. As a player using the keyboard, I want the focus ring kept, so that I can see where I am.

## Implementation Decisions

- Tokens in `styles/tokens.css`: `--lift` and `--lift-pressed`. Components use them; no dark `solid var(--ink)`
  borders and no hard `0 Npx 0 var(--shadow)` shadows remain.
- Text fields keep a light border from the shared tokens (an edge for where to type, not an outline); the focus ring
  (`outline: 3px solid var(--teal)`) stays.
- Problem and waiting states keep their colored borders (they carry meaning), softened in width if needed.
- The island-ui skill and decision 23's record describe the soft look.

## Testing Decisions

- A before/after screenshot of the sample on a phone-sized page (`docs/mockups/soft-ui-sample.png`) for the player's
  OK; after the rollout, screenshots of the HUD, a card, the Build picker and the sign-in screen.
- The existing UI tests (no emoji, roles and names) stay green; a grep finds no `solid var(--ink)` left in the CSS.

## Out of Scope

- New colors, fonts or layouts.
