# 11: Sound recipe and ambience

**What to build:** the picked sounds processed and shipped, and a calm ambience that follows the camera. Spec: "Sound".

**Blocked by:** 10.

**Status:** done

- [x] A sounds step of `pnpm assets` encodes the picks to AAC `.m4a` in the client's public sounds folder, makes loops
      seamless, and checks format, duration and a total budget of about 2 MB; the asset catalog lists every sound and
      the client builds sound URLs only from it; `assets/SOURCES.md` records each source with its SHA-256.
- [x] A pure ambience mix of (camera pose, time of day, island summary near the target) to four gains: waves near the
      coast and zoomed in, birds by day, insects at night, town with buildings and people near the target and distant
      at whole-island zoom.
- [x] One Web Audio context outside the canvas tree; files load after the first frame; the mix applies about four
      times a second with smooth ramps; it follows the camera in watch mode too.
- [x] The context resumes on the first touch, click or key and is suspended while the page is hidden; the mute switch
      silences it at once and is remembered; sound is on by default.
- [x] Tests: the recipe's checks refuse a wrong format, an over-long file and an over-budget total; the mix's curves
      (unit); mute silences (Testing Library or a fake audio context).

## Comments

- Done. `pnpm assets sounds` (`tools/assets/src/sounds.ts`): cuts each pick, crossfades its last 2 s into its start,
  snaps loops to whole AAC frames (no end padding, so no gap), sets the ambience to -26 LUFS and the button sounds'
  peak to -6 dB (too short to measure loudness), and encodes AAC `.m4a` (ambience stereo 96k, buttons mono 64k).
  1.5 MB in all. `pnpm assets check` checks the catalog, the MP4 container, 20 to 40 s per loop, under 1 s per button
  sound and the 2 MB budget.
- Client: `audio/mix.ts` (pure gains from the camera's target, distance, daylight and the island within 10 tiles),
  `audio/engine.ts` (one context made on the first gesture, beds ramped with a 0.4 s time constant, master gain for
  mute, suspend while hidden, silent where there is no Web Audio), `audio/Ambience.tsx` (mix every 250 ms), mounted
  beside watch mode, so the mix follows the drifting camera too.
- Checked in headless Chrome: after the first click all 7 sounds load, with no errors. How it sounds is for ticket 13.
