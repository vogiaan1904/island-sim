# 10: Day and night, and quality tiers

**What to build:** the sun, sky, light and shadows follow the game clock, windows glow at night, and the game picks Low,
Medium or High for the device. User stories 17 to 19.

**Blocked by:** 09.

**Status:** ready-for-agent

- [ ] The night state is a pure function of game time (unit-tested at sunrise, noon, sunset and midnight).
- [ ] One sun and a sky fill that follow the clock from the look's values; lit windows from palette slot 0 at night;
      no point or spot lights.
- [ ] One shadow map near the camera; Low turns it off and lowers the pixel ratio; the pixel ratio never exceeds 2.
- [ ] The tier is picked by a quick check at start and kept in view state for Settings (ticket 18).
- [ ] Nothing renders while the page is hidden.
