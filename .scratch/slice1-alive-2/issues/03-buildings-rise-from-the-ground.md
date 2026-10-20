# 03: Buildings rise from the ground

**What to build:** a site shows the real model growing up inside its scaffold with the sim's progress, builders at
work, and the scaffold coming down with dust. Spec: "Client: construction".

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] A per-instance cut height on the palette material: fragments above it discarded, back faces a flat darker
      shade; the shadow pass uses the same cut. The four steps and the height scaling are removed.
- [ ] The cut follows `(buildTicks - constructionLeft) / buildTicks`, updated each tick; a landmark short of
      materials holds.
- [ ] Builders: two per site, four at a landmark, in the day shift (none at a landmark waiting for materials); some
      hammer at the scaffold, some carry logs from a pile at the site's road side.
- [ ] On the finish tick the scaffold goes and `dustPuff` plays at the footprint.
- [ ] Unit tests on the pure parts (cut height, builders, finish); a headless smoke check that a site draws.

## Comments
