# 15: Bubbles and rewards

**What to build:** bubbles over buildings show problems, wishes and rewards; tapping a reward collects it and the coins
fly to the counter; zoomed out to the whole island, bubbles shrink to dots and only problems remain. User stories 47 to
49.

**Blocked by:** 14.

**Status:** done

- [x] Bubble anchors come from render data (unit-tested); bubbles follow their buildings as the camera moves.
- [x] A problem bubble opens the building's card; a reward bubble sends `collect`; coins fly to the counter on the
      server's ok only.
- [x] Wish bubbles for unmet needs from the mirror.
- [x] Zoomed out, bubbles become dots and only problems remain.
- [x] Testing Library tests for each bubble kind and the collect flow; no-emoji.
