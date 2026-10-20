# 06: Fishing and cargo boats

**What to build:** a fishing boat per staffed fishing hut, and a cargo boat from the pier for each sale. Spec:
"Client: boats"; ADR 0002.

**Blocked by:** 01, 02.

**Status:** done

- [x] Fishing boat: moored at the hut's water side; the rower walks to it, rows 3 to 5 tiles out (hashed direction, on
      water, off the ferry lane), sits until the return, rows back by the shift's end, carries a basket in.
- [x] Cargo boat: moored along the pier's side, clear of the ferry berth; per sale manifest entry it sails south
      (offset from the ferry lane) over 20 game minutes with props of the sold good, and back over the next 20. The
      mooring is empty while a trip is out; overlapping trips are separate boats.
- [x] Both sit at `marker_waterline` and bob with `render/waves.ts`; visitors see the same.
- [x] Tests: out and back within the shift; one boat per entry, two overlapping entries give two boats; never in the
      ferry's berth.

## Comments

- Done 2026-10-20. `render/boats.ts` plans and poses every boat from the island state and game time (`boatPlan`,
  `boatsAt`, no allocation per frame); `scene/Boats.tsx` draws one instanced mesh per boat model and per good on a
  cargo deck, at each model's waterline, bobbing with `waveHeight`. The plan is part of the crowd plan
  (`CrowdPlan.boats`), so visitors and watch mode get the same boats.
- Fishing: a boat per built fishing hut with a worker shown (`workersShown` in `work.ts`, now shared with the work
  loops), moored bow out on the hut's water side (`waterSide` in `instances.ts`, which the pier uses too). The first
  worker (`workerKey(…, 0)`) walks from the door to the shore when they arrive, sits in the boat (`sit`, its last
  frame; `Mover.y` is new for this) while it rows out over 15 minutes to a spot 3 to 5 tiles out (direction hashed,
  every metre on water, more than 8 m from the ferry lane; up to 8 tries, else it stays moored and nobody rows),
  turns round there, rows back by the shift's end and walks in with a `fish-basket`.
- Cargo: moored beside the pier on whichever side is open water (bow and stern checked), clear of the ferry berth.
  Each sale manifest entry sails out from its tick, clear of the pier and then down a lane 12 m off the ferry's, over
  20 minutes with two props of the sold good on the deck (posed with `heldPose`, now `useHeldPose`), turns round out
  of sight and comes back empty over the next 20, steering a little ahead so it rounds corners. The moored boat shows
  only while no trip is out; overlapping sales are separate boats. Tests check that headings never jump.
- `CARRIED_MODELS` moved to `render/models.ts` (People and Boats both use it).
- Checked in `pnpm preview 720` with a fishing hut and a sale added for the shot (not committed; ticket 10 adds them
  to the preview village): the cargo boat moored by the pier, the fishing boat offshore with its rower seated. Look
  and feel are for ticket 11.

