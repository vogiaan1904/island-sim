# 10: The preview village shows it all, and the draw-call count

**What to build:** `pnpm preview` shows every new thing, and a test counts the draw calls of that village. Spec:
"Preview"; "Testing Decisions" (draw calls).

**Blocked by:** 01.

**Status:** done

- [x] The village is built by an exported function; it gains a site under construction, a staffed fishing hut, a
      lumber camp beside trees where the scatter allows, an auto-sell rule that sells each hour, and a shipment of 4
      or more on the road.
- [x] A client Vitest builds that village and counts draw calls (each model type with instances, people, boats, carts,
      props; the shadow pass counted again): under 150.
- [x] The minutes to open for each thing are written in ticket 11.

## Comments

- Built: `apps/server/src/dev/village.ts` (`previewVillage(world, minute)`, `VILLAGE_CAMP` (25, 44), `VILLAGE_HUT`
  (38, 54)); `dev/preview.ts` now only starts the server and calls it. New in the village: the lumber camp at a spot
  with 5 trees in reach (found by trying every spot; a test keeps it true), the fishing hut with open water off its
  front, a port master with auto-sell of all wood (30 in the dock to start), 6 hired commuters (10 jobs: all three
  workplaces fully staffed).
- `render/village.test.ts` builds the village on Alice's world (seed 42, the same island as Palm Cove), checks each
  thing is there, that wood sells in each of 4 game hours, and counts the draw calls of a working day every 5 minutes
  with the camera at the dock: the busiest frame is 45 (07:16), 90 with the shadow pass, under 150.
- The count comes from the render data, not a GPU capture; zero-instance meshes cost nothing in three.js
  (`renderInstances` returns on 0), so only model types with instances count. The phone frame rate stays plan 7.
