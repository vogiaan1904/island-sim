# The sim keeps a ferry manifest so the client can show the right passengers

The sim's ferry happens in one tick: at the start and end of the day shift, newcomers move into homes, unhappy
residents leave and commuters come and go, and nothing in the island state says afterwards which homes gained or lost
people. The client must draw people as a pure function of island state and game time (`island-3d-client`, rule 4), so
each island now keeps a **ferry manifest** of its last trip (newcomers and leavers per home, commuters on and off),
replaced by every trip, and the visible boat docks at the sim's minute and waits while passengers walk off and on. On
screen, passengers follow the sim by up to about 25 game minutes (about one real minute). Decided in the `slice1-alive`
grilling, 2026-10-19; the field arrives with `SIM_VERSION` 5 and a snapshot migration.

## Considered options

- **Homes picked by a hash of the event's count**, no sim change: a family can visibly walk into a cottage whose
  resident count did not change, and leavers cannot be placed at all.
- **The client predicts the ferry before it happens** (people walk to the dock ahead of the sim): fragile, because
  happiness updates in the same tick as the evening ferry, so a predicted leaver may not leave.
- Events carrying per-home data were not enough on their own: events are not part of the state, so a reconnect or a
  visitor would miss the walk.
