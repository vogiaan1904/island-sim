# 07: The camera stays above roofs

**What to build:** the closest zoom never puts the camera inside a building. Spec: "Client: camera".

**Blocked by:** none.

**Status:** done

- [x] A pure height lookup of building tops (instances and model heights); the controller keeps the eye above it plus
      a margin, as it keeps it above the ground.
- [x] Unit tests in `camera/controller.test.ts`: zooming in over a cottage stops above its roof; open ground is
      unchanged.

## Comments

- Built: `render/roofs.ts` (`roofsOf`: the top over each tile, from `BUILDING_TOPS` measured off the `.glb` bounds,
  plus 1 m of scaffold over a site; `roofTop` looks within 1 m of eaves). `Limits` gained `roofs` and
  `roofClearance` (2 m); `normalize` backs the eye away along its line of sight until it is above the roofs.
  `camera/limits.ts` `limitsFor(island)` adds the island's roofs, once per island state; the store's gestures and
  momentum use it. Everything else still reads `ISLAND_LIMITS` (the pose does not depend on the roofs).
- A building finished under a resting camera lifts it at the next gesture, not by itself.
