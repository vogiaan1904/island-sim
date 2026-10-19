# 11: Sound recipe and ambience

**What to build:** the picked sounds processed and shipped, and a calm ambience that follows the camera. Spec: "Sound".

**Blocked by:** 10.

**Status:** ready-for-agent

- [ ] A sounds step of `pnpm assets` encodes the picks to AAC `.m4a` in the client's public sounds folder, makes loops
      seamless, and checks format, duration and a total budget of about 2 MB; the asset catalog lists every sound and
      the client builds sound URLs only from it; `assets/SOURCES.md` records each source with its SHA-256.
- [ ] A pure ambience mix of (camera pose, time of day, island summary near the target) to four gains: waves near the
      coast and zoomed in, birds by day, insects at night, town with buildings and people near the target and distant
      at whole-island zoom.
- [ ] One Web Audio context outside the canvas tree; files load after the first frame; the mix applies about four
      times a second with smooth ramps; it follows the camera in watch mode too.
- [ ] The context resumes on the first touch, click or key and is suspended while the page is hidden; the mute switch
      silences it at once and is remembered; sound is on by default.
- [ ] Tests: the recipe's checks refuse a wrong format, an over-long file and an over-budget total; the mix's curves
      (unit); mute silences (Testing Library or a fake audio context).
