# 08: The four rough spots

**What to build:** the four fixes the user took from the plan 5 look check. Spec: "Client: the four rough spots".

**Blocked by:** none.

**Status:** done

- [x] People leave and enter by the building's front and walk round the footprint to the road tile.
- [x] Ferry passengers walk round the dock's footprint.
- [x] On arrival day a family's working adults walk ferry, home (with bags), then work; not in that morning's plain
      commute.
- [x] The ferry moment in watch mode frames the pier and the sea lane south of it.
- [x] Tests: walker paths stay outside footprints (dock included); a new family's adults walk once; the ferry framing
      keeps the lane in view.

## Comments

- Built: `render/around.ts` (`roundFootprint`: the corners to walk by, the shorter way round, 0.8 m off the walls).
  `door` in `render/crowd.ts` is now the middle of the building's front; `lineBetween` walks out of the front, round
  the footprint to the first road tile, and round the destination into its front. Ferry passengers start and end at
  the pier's middle and go round the dock. The rower walks from the hut's door to its front edge and round to the
  shore (`FishingTrip.ashore`; the walk minutes come from that path).
- Showing twice: `ferryPassengers` notes when each newcomer of working age is home (`settled`); their commute walks
  that set off before then leave out that day (`Start.skipDay`), and after a morning ferry they walk home to work once,
  3 minutes after getting home.
- Watch framing: the ferry moment looks at the middle of the pier and where the boat is as the moment starts, from
  over the island facing south (`Moment.azimuth`, null for the other moments, which keep the player's turn), far
  enough back to hold both (at least 1.4 times that span). `WATCH_TILT` moved to `camera/watch.ts`.
- Tests changed with the new paths: carriers to the dock are checked on the road at 17 of their 20 minutes (they then
  go round the dock to its front); a child on the market walk may be at the door a moment after its adult went in;
  the hand-back test compares turns by a whole circle.
- To look at (ticket 11): carriers to the dock go round to its sea-side front; a side step can bring a walker up to
  0.6 m inside a wall corner.
