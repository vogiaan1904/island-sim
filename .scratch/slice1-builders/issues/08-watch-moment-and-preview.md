# 08: Watch moment, preview village, draw calls

**What to build:** watch mode shows the morning builders' boat arriving with its crew whenever a site is waiting;
`pnpm preview` opens a village with all of it to look at; the draw-call count stays in budget. Spec: "Client: watch
mode", "Preview and Blender".

**Blocked by:** 05, 07.

**Status:** ready-for-agent

- [ ] Watch mode, tests first: a timed moment for the morning builders' boat when a site is waiting at 06:45, shown
      once per morning, ranked after a due ferry; called and welcome arrivals come through their event.
- [ ] The preview village: a site waiting for builders at 06:40, a site under way whose crew finishes in the morning
      and moves on to a second waiting site, builders on the pier, the evening boat; the minutes to open listed in the
      look-check ticket (11).
- [ ] The draw-call count on the preview village (the builders' boat and the builders included) stays under 150.
- [ ] `pnpm check` passes.
