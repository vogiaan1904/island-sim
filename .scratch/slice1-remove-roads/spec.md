# Slice 1 remove roads: a Remove pen for roads

Status: ready-for-agent

From the playtest brainstorm of 2026-10-19 (brainstorm decision 28, design spec 12.1). Sources: spec 12.1 (the
connector, paying for things), the skills `island-game-logic`, `island-ui`, `island-3d-client`, `island-testing`.

## Problem Statement

Since placing a building lays its connector, a road can appear where the player meant to build next, and road tiles
cannot hold buildings. There is no way to take a road away, so a connector or a hand-drawn road in the wrong place
stays forever.

## Solution

The road tool gets a Remove pen: drag over road tiles to clear them, for free. A drag that would cut a building off
from the dock is refused with "A building would lose its road to the dock", so removing a road can never strand a
building.

## User Stories

1. As a player, I want to clear road tiles I no longer want, so that I can build on that land.
2. As a player, I want to switch the road tool between drawing and removing with one button, so that I never draw
   when I meant to remove.
3. As a player, I want the drag to pick up only road tiles while removing, so that I can sweep across an area.
4. As a player, I want to see the tiles that will go highlighted before I confirm, so that I know what I remove.
5. As a player, I want removing road to be free, so that fixing a layout never costs me.
6. As a player, I want no refund for removed road, so that laying and removing road is never a way to make coins.
7. As a player, I want a removal that would cut a building off from the dock refused, with the reason, so that no
   building loses its workers or goods because of a slip.
8. As a player with a building that was already cut off before, I want that building not to block every removal, so
   that old mistakes do not lock my roads.
9. As a player, I want a removal to be refused only when no other road still joins the building to the dock, so that
   I can remove a duplicate street.
10. As a player, I want the same answer from the preview and the server, so that a removal shown as fine is never
    refused.
11. As a friend visiting, I want to see the road as it is after a removal, like any other change.

## Implementation Decisions

- A new player command `remove-road` with the same tile list shape and limit as `place-road`. Tiles that are not
  road are skipped; none left is `nothing-to-remove`. Off-map is `out-of-bounds`, malformed is `bad-input`, too many is
  `too-many-tiles`.
- The rule lives in the sim (`checkRoadRemoval`, used by the command and the client preview): the buildings that need
  road and reach the dock along roads now must all still reach it with the tiles cleared, else `cuts-off-building`.
  No money moves and nothing is refunded.
- The protocol schema gains `remove-road`; the server pipeline needs no change.
- The client road draft gains `removing`; the panel gets a Remove road toggle (eraser icon), the card says
  "Remove road" and "Removing road is free", the button says Remove. The 3D preview shows amber highlights over the
  road that will go (red when refused) and no road pieces.

## Testing Decisions

- Sim: the command through `applyCommand` (free, skips non-road, refuses and changes nothing when it cuts a building
  off, allows a second way, ignores a building already cut off, input errors) and `checkRoadRemoval` for the preview.
- Client: the removal verdict against the sim's own command on the same world; the draft takes only road tiles while
  removing; the panel sends `remove-road`.

## Out of Scope

- Placing a building straight over road tiles (the network would have to re-route).
- Refunds, and removing buildings.
