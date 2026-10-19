# Slice 1 big island: 64 x 64 tiles

Status: ready-for-agent

From the playtest brainstorm of 2026-10-19 (brainstorm decision 29, design spec 12.6). Sources: spec 4.2, 6.2, 12.1,
12.6; the skills `island-game-logic`, `island-3d-client`, `island-testing`.

## Problem Statement

The island is 32 x 32 tiles of 4 m, about 128 m across. On a phone it feels cramped: a handful of Outpost buildings
and their roads already fill it, and there is no room left for the later stages.

## Solution

Islands are 64 x 64 tiles (4x the land, about 256 m across). The coast keeps its character at the new size: its rim
reaches in and out by up to an eighth of the map, blended between random points an eighth of the map apart, so an
island has broad bays and headlands, and enclosed ponds are filled. One road command, hand-drawn or a connector, may
lay up to 128 tiles so every spot can reach the dock. The terrain is drawn in 32-tile chunks, so it is still 4 draw
calls. Existing worlds cannot grow: a new world is started for the playtest.

## User Stories

1. As a player, I want a much bigger island, so that my town has room to spread out and grow through the stages.
2. As a player, I want the bigger island to have bays and headlands, so that it is not a plain circle.
3. As a player, I want no stray inland ponds, so that the coast reads as one shore.
4. As a player, I want to place a building anywhere on the island and still get a road to the dock, so that the far
   side of the island is usable.
5. As a player, I want to draw longer roads in one go, so that a street across the island takes one drag.
6. As a player on a phone, I want the bigger island to render as smoothly as before, so that the game stays chill.
7. As a player, I want zooming out to still show the whole island, so that I can watch the whole town.
8. As the pacing harness, I want the stage times to stay on target on the bigger island, so that pacing holds.

## Implementation Decisions

- Content: `islandSize` 64, `maxRoadTilesPerCommand` 128. The protocol limits follow the content.
- Terrain generator: whole numbers only; band and patch spacing are an eighth of the map (at least 2); the rim's reach
  is blended bilinearly between patch points; four smoothing passes; one central piece; ponds filled.
- Client: terrain chunks of 32 tiles; camera limits already follow the island size.
- Worlds made before this cannot load (their terrain is 32 x 32): the playtest world is removed by hand and a new one
  created; accounts and sessions stay.

## Testing Decisions

- Every test with coordinates on seed 42 moves to the new island (Alice's dock is at 31,56); the golden scenarios are
  re-recorded from the pacing bot on the new island, and their hashes updated with this explanation.
- The pacing harness runs on all seeds and both patterns: every milestone on target.
- The client's verdict-against-sim sweep covers the dock and road area fully and every fourth tile elsewhere, to
  stay fast at 4x the tiles.

## Out of Scope

- Migrating a 32-tile world into a 64-tile one.
- Starting the camera over the dock instead of the island's middle (a follow-up if the first view feels empty).
