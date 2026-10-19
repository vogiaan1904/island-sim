# 08: Watch mode

**What to build:** tap Watch or press V, the UI fades, and the camera drifts by itself between moments with a caption;
any input ends it. Spec: "Client: watch mode", "Client: frame rate"; glossary "Moment".

**Blocked by:** 06.

**Status:** ready-for-agent

- [ ] View state gains `watching`. The Watch button on the HUD and V enter; any touch, click, wheel or key exits, and
      that input does nothing else; the camera stays where it is.
- [ ] A pure watch director of (island, events seen this session, game time, moments shown): a due ferry first (from
      about 8 game minutes before docking until it sails out), then the most important unshown event of importance 30
      or more (each once), then a tour of busy spots (staffed workplaces, sites, the market during the evening walk,
      lit homes at night). Holds about 25 s real with a slow orbit; glides of about 4 s through the fly-to path.
- [ ] One plain-text caption per moment (`island-ui` wording, never emoji); the HUD, bubbles and news fade out.
- [ ] While watching: 30 fps and a screen Wake Lock (requested on entry, released on exit, requested again when the
      page becomes visible; a refusal is ignored). Outside it the loop is capped at 60 fps, also on 90 and 120 Hz
      screens.
- [ ] Works on a friend's island, read-only.
- [ ] Tests: director order, each event once, hold and glide lengths (unit); the button and V start it, the HUD fades,
      the caption shows, any input ends it without a tap or a camera move, no emoji (Testing Library).
