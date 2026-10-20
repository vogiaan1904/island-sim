# 03: Buildings rise from the ground

**What to build:** a site shows the real model growing up inside its scaffold with the sim's progress, builders at
work, and the scaffold coming down with dust. Spec: "Client: construction".

**Blocked by:** 02.

**Status:** done

- [x] A per-instance cut height on the palette material: fragments above it discarded, back faces a flat darker
      shade; the shadow pass uses the same cut. The four steps and the height scaling are removed.
- [x] The cut follows `(buildTicks - constructionLeft) / buildTicks`, updated each tick; a landmark short of
      materials holds.
- [x] Builders: two per site, four at a landmark, in the day shift (none at a landmark waiting for materials); some
      hammer at the scaffold, some carry logs from a pile at the site's road side.
- [x] On the finish tick the scaffold goes and `dustPuff` plays at the footprint.
- [x] Unit tests on the pure parts (cut height, builders, finish); a headless smoke check that a site draws.

## Comments

- Done. `render/construction.ts` `constructionRise(constructionLeft, buildTicks)` is the share done, every tick;
  `ModelInstances` writes `rise x model height` into the per-instance `aCut` attribute, and the palette material
  (`scene/palette.ts`) discards above it and shades back faces under a cut flat and darker; `paletteDepthMaterial()`
  cuts the shadow the same way. 0 means no cut, so every other model draws whole without the attribute.
- Builders (`render/crowd.ts` `builders`): two per site, four at a landmark, none while a landmark waits for
  materials. Half hammer at the scaffold's front; half go round a `WorkLoop` (pick-up at the site's log pile, walk with
  logs, set down at the front, walk back), the generic loop ticket 04 reuses. The log pile (`prop_log-pile_a.glb`,
  `sitePileInstances`) stands just past the site's front, toward its right-hand corner. People carry `Carried`
  (`bag` or `logs`), one accessory mesh each.
- Finish: `finishedSites` and `finishPuffTime` (`render/ghost.ts`) from the mirrored `construction-finished` events;
  `scene/SiteDust.tsx` draws the landing's puff, only while it plays.
- Smoke check (2026-10-20): `pnpm preview 720` now leaves its last cottage half built; headless Chrome signed in,
  opened the world and screenshotted it: the cottage cut inside its scaffold, a builder hammering, one carrying logs,
  the pile, finished buildings whole. A one-off script (no browser automation in the repo until plan 7's Playwright).
