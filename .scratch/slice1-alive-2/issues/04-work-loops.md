# 04: Work loops

**What to build:** workers do their building's work instead of standing at its front wall. Spec: "Client: work loops";
glossary "Work loop".

**Blocked by:** 02.

**Status:** done

- [x] A work-loop table keyed by building id (`lumber-camp` trees, `farm` field, `fishing-hut` boat), with a test that
      every building with jobs has an entry.
- [x] Trees: walk to the nearest scatter trees within about 3 tiles, chop, pick up, carry logs to the log pile; the
      chopping block when none is in reach. One trip per `recipe.cycleTicks`, phases hashed per worker.
- [x] Field: work along the rows inside the footprint with pick-up stops, carry a crate to the front.
- [x] Fishing hut: the second worker cleans fish at the door with a basket (the rower is ticket 06).
- [x] Staffing decides who shows, as today; only the chosen clips.
- [x] Tests at pinned game times, as `render/crowd.test.ts` does.

## Comments

- Done 2026-10-20. `render/work.ts` holds the places: `WORK_LOOPS` (keyed by building id, tested to cover every
  building with jobs), `lumberTrees` (nature-scatter trees within 3 tiles of a camp's front and at least 1 m past it,
  nearest first), `campPile` / `choppingBlock` (the front's right and left corners, `frontCorner` in `instances.ts`,
  shared with the site pile), `onBuilding` (a point in a building's own frame), the farm's `FURROWS` (beds at model
  x -5, -3, -1, 1; rows run front to back) and the hut's `FISH_RACK` / `HUT_DOOR`, all read from the Blender recipes.
  `workPropInstances` draws a log pile by every built camp and a chopping block only where no tree is in reach
  (merged in `islandInstances`; the Settlement island's instanced draw calls go from 13 to 15).
- The loops are `WorkLoop`s in `crowd.ts` (`workLoops`, replacing the front-wall `stations`): trees (walk from the
  pile to a tree, chop with `interact-*`, pick up, carry `logs` back, set down), field (into the worker's own furrow,
  three tend-and-pick-up stops, out past the front with a `vegetable-crate`), fish (the second worker cleans at the
  rack and takes a `fish-basket` to the door). The chop or tend time fills the rest of `recipe.cycleTicks`, so one
  round is one cycle; phases hashed per worker. `interact-*` steps in a loop now loop their clip (pick-ups still play
  once). Loop walks go through their exact points (`walkThrough`), so walkers meet their spots; builders use it too.
- `hash32` and `unit` moved to `render/hash.ts` (nature, crowd and watch import it), to keep `work.ts -> nature.ts`
  free of an import cycle.
- Until ticket 06, a fishing hut's first worker (the rower) is not drawn: an understaffed hut shows nobody, a fully
  staffed one shows the cleaner.
- Checked in `pnpm preview 720` (headless shots): the camp's two workers chop at its block (no tree in front of it),
  a farm worker works in the field. Look and feel are for ticket 11.

