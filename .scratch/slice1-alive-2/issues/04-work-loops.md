# 04: Work loops

**What to build:** workers do their building's work instead of standing at its front wall. Spec: "Client: work loops";
glossary "Work loop".

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] A work-loop table keyed by building id (`lumber-camp` trees, `farm` field, `fishing-hut` boat), with a test that
      every building with jobs has an entry.
- [ ] Trees: walk to the nearest scatter trees within about 3 tiles, chop, pick up, carry logs to the log pile; the
      chopping block when none is in reach. One trip per `recipe.cycleTicks`, phases hashed per worker.
- [ ] Field: work along the rows inside the footprint with pick-up stops, carry a crate to the front.
- [ ] Fishing hut: the second worker cleans fish at the door with a basket (the rower is ticket 06).
- [ ] Staffing decides who shows, as today; only the chosen clips.
- [ ] Tests at pinned game times, as `render/crowd.test.ts` does.

## Comments
