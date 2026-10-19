# 01: The connector in the sim

**What to build:** the placement check finds a building's connector (the cheapest road to the dock, reusing roads),
counts its tiles in the price, and `place-building` paves it. User stories 1-3, 8-13, 19-25.

**Blocked by:** none.

**Status:** done

- [x] `checkPlacement` reports the connector's new tiles and cost; road access means a connector within the
      tiles-per-command limit; affordability uses the total.
- [x] `place-building` paves the connector and books `building-purchase` and `road-purchase`.
- [x] Tests first in `placement.test.ts` and `placeBuilding.test.ts`; determinism, replay, golden and pacing checks
      pass, any golden hash change explained.
