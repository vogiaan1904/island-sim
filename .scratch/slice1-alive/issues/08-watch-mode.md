# 08: Watch mode

**What to build:** tap Watch or press V, the UI fades, and the camera drifts by itself between moments with a caption;
any input ends it. Spec: "Client: watch mode", "Client: frame rate"; glossary "Moment".

**Blocked by:** 06.

**Status:** done

- [x] View state gains `watching`. The Watch button on the HUD and V enter; any touch, click, wheel or key exits, and
      that input does nothing else; the camera stays where it is.
- [x] A pure watch director of (island, events seen this session, game time, moments shown): a due ferry first (from
      about 8 game minutes before docking until it sails out), then the most important unshown event of importance 30
      or more (each once), then a tour of busy spots (staffed workplaces, sites, the market during the evening walk,
      lit homes at night). Holds about 25 s real with a slow orbit; glides of about 4 s through the fly-to path.
- [x] One plain-text caption per moment (`island-ui` wording, never emoji); the HUD, bubbles and news fade out.
- [x] While watching: 30 fps and a screen Wake Lock (requested on entry, released on exit, requested again when the
      page becomes visible; a refusal is ignored). Outside it the loop is capped at 60 fps, also on 90 and 120 Hz
      screens.
- [x] Works on a friend's island, read-only.
- [x] Tests: director order, each event once, hold and glide lengths (unit); the button and V start it, the HUD fades,
      the caption shows, any input ends it without a tap or a camera move, no emoji (Testing Library).

## Comments

- Done. `camera/watch.ts` `pickMoment` (ferry from 8 game minutes before docking until 5 after it sails, events of
  importance 30 or more each once, else a tour per 10-tick window); `ui/watch/Watch.tsx` (V and the HUD's Watch
  button with the eye icon, any pointer, touch, wheel or key ends it and is stopped, Wake Lock, a step every 500 ms
  that flies to the moment and turns 0.015 rad); `ui/watch/caption.ts`; the HUD fades with `data-watching`. Watch mode
  uses the existing `cameraMode: 'watch'` and the rig glides with a 1.2 s smooth time while watching.
- Frame pacing: the canvas runs with `frameloop="never"` and `FrameDriver` draws each due frame from
  requestAnimationFrame: 60 fps cap, 30 while watching, none while hidden.
- Checked in headless Chrome: the HUD fades, the caption reads "By the dock" and then "The evening ferry comes in" at
  the pier.
- For ticket 13: while the ferry comes in, the pier framing leaves the boat just below the screen for the first
  minutes; framing between the pier and the boat may look better.
