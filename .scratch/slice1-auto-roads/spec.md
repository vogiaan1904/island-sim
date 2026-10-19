# Slice 1 auto-roads: every building reaches the dock

Status: ready-for-agent

A small feature between `slice1-client` and `slice1-alive`, from the auto-roads grilling of 2026-10-19 (brainstorm
decision 27, design spec 12.1). Sources: design spec 4.4, 6.1, 12.1; the skills `island-game-logic`,
`island-3d-client`, `island-ui`, `island-testing`.

## Problem Statement

On a phone, laying roads by dragging tile by tile is fiddly, and nothing stops a player from building a road that
leads nowhere. A building beside such a road passes the "road access" check, but commuters start at the dock, so it
never gets workers and its bought goods never ship. It just shows "no workers" and never says why. The first playtest
on a real phone ended with a loose stretch of road and two buildings whose connection to the dock could not be told
from the island.

## Solution

Placing a building also lays its **connector**: the cheapest road from the building to the dock, reusing every road
tile already there and paving only what is missing. The ghost shows the connector's road pieces while the player aims,
the panel's price includes its tiles, and the one Place pays for both. A building that already touches a road joined
to the dock needs no connector and costs what it did before. A spot no road can join to the dock is refused with
"No road can reach the dock". Drawing roads by hand stays as it is, for shaping the town.

## User Stories

1. As a player on a phone, I want to place a building without drawing its road first, so that building takes one
   gesture instead of a precise drag and a mode switch.
2. As a player, I want every building I place to be joined to the dock by road, so that commuters can always walk to
   it.
3. As a player, I want goods bought from the Mainland to reach every building I place, so that a site never waits
   forever for materials.
4. As a player aiming a building, I want to see the road it will lay as see-through road pieces, so that I know what
   my island will look like before I pay.
5. As a player aiming a building, I want the connector's pieces to join the roads beside them in the preview, so that
   the preview looks like the result.
6. As a player, I want the price on the Place panel to include the connector's tiles, so that I am never surprised by
   what was taken from my coins.
7. As a player short of coins for the building plus its road, I want "Need N more coins" for the whole amount, so that
   I know how much to wait for.
8. As a player aiming next to a road already joined to the dock, I want no extra road and no extra cost, so that
   building along my own streets works as before.
9. As a player aiming next to a loose road I drew earlier, I want the connector to join that road to the dock, so that
   my earlier road becomes useful instead of a dead end.
10. As a player, I want the connector to reuse existing roads wherever it can, so that I pay for as few new tiles as
    possible.
11. As a player, I want the connector never to pass through a building, the water or the footprint I am placing, so
    that it can always be built.
12. As a player aiming at a spot no road can join to the dock (walled in by buildings or water), I want the ghost red
    with "No road can reach the dock", so that I know to aim elsewhere.
13. As a player whose connector would need more road than one command may lay, I want the same refusal, so that a
    building never lays a road across the whole island by surprise.
14. As a player, I want the label to say "Road access" when no road is needed and "Road to the dock: N tiles" when
    one is, so that I can tell the two apart.
15. As a player, I want the road pieces of the connector to appear with the building when the server takes it, so
    that what I saw is what I got.
16. As a player, I want the same answer from the ghost and the server on every tile, so that a green ghost is never
    refused.
17. As a player, I want to keep drawing roads by hand, so that I can lay out streets ahead of my buildings.
18. As a friend visiting, I want to see the connectors like any other road, so that a visited island looks the same as
    its owner sees it.
19. As a player whose island is running while I am away, I want nothing to change about roads I already have, so that
    my island never rebuilds itself.
20. As a player on an island built before this change, I want my buildings left as they are, so that nothing is
    rebuilt or charged without my action.
21. As the island's money history, I want the building's price and the connector's tiles booked as a building purchase
    and a road purchase, so that the ledger tells them apart like before.
22. As a developer, I want the connector to be computed by the sim's placement check alone, so that the client and
    server share one rule and the place-building command keeps its shape.
23. As a developer, I want the connector to be the same for the same island and aim on every machine, so that replay
    and the state hash stay deterministic.
24. As a developer, I want the shore-only dock to stay exempt, so that claiming an island still places the dock with
    no road.
25. As a developer, I want the pacing harness's bot to keep working, so that the stage-time targets still hold.

## Implementation Decisions

- **The rule lives in the sim's placement check.** The placement report of a building that needs road gains the
  connector: its new road tiles (ascending tile indexes, possibly none) and their cost. The "road-access" check passes
  when a connector exists within the tiles-per-command limit; the "affordable" check and the shortfall use the
  building's price plus the connector's cost. A building that needs no road has an empty connector.
- **The connector.** The cheapest path, counted in new road tiles, from a tile beside the footprint to a tile beside the
  dock's footprint. It may cross land tiles that hold no building and are outside the footprint being placed; a road
  tile costs nothing, any other such tile costs one. Every tile on the chosen path that is not road yet becomes road.
  Ties are broken by a fixed search order (start tiles ascending, then the sim's neighbor order), so the answer is a
  pure function of the island and the aim. An island without a dock has no connector, so a building that needs road
  cannot be placed there (every claimed island has a dock).
- **The limit.** A connector may lay at most `maxRoadTilesPerCommand` new tiles, the limit a hand-drawn road already
  has. Longer is refused as no road access.
- **The command.** `place-building` keeps its shape and reason codes. On success it paves the connector, pays the
  building price as `building-purchase` and the connector as `road-purchase` (only when it has tiles), then starts the
  site. No new event: the roads string already travels in the change set.
- **Snapshots.** No state shape changes, so no migration. Existing roads and buildings are untouched.
- **Client.** The placement verdict takes the connector from the sim's report: the cost it shows is the total, and the
  road label is "Road access", "Road to the dock: N tiles" or "No road can reach the dock". The building ghost draws
  the connector with the road drag's preview (pieces shaped by their neighbors, a highlight per new tile), tinted like
  the ghost.
- **Hand-drawn roads** keep their rules (`place-road` unchanged).

## Testing Decisions

- Test external behavior at the highest seam: the sim's `checkPlacement` report and the `place-building` command
  through `applyCommand`, and on the client the placement verdict against the sim's own command on the same world
  (the existing pattern of the verdict tests), plus the pure road preview of the connector.
- Sim tests, written first: a building beside the dock's road needs no connector; a building away from roads gets the
  cheapest connector, reuses a loose road and pays only new tiles; the total price decides affordability with the
  exact-coin and one-cent-short cases; walls of water or buildings refuse with `no-road-access`; a connector over the
  limit is refused; the command paves the tiles and books two ledger entries; the dock needs none.
- Determinism, replay, invariants and golden scenarios run unchanged; a golden hash that moves is examined and updated
  only if the move is explained by the new rule.
- Prior art: `placement.test.ts`, `placeBuilding.test.ts`, the client's `verdict.test.ts` and `roadPreview.test.ts`.

## Out of Scope

- Routing a hand-drawn road for the player (tap start and end).
- Requiring hand-drawn roads to join the dock, or a "not connected" building status for islands built before this.
- Removing or moving roads.
- Straightening the stepped coastline: that is a look note under `slice1-client` ticket 21.

## Further Notes

- The connector reuses roads at no cost, so a player who draws streets first still decides the town's shape; the
  connector only fills the gap to the dock.
