# Ambience sound

Design from spec 6.2 and 12.5, **built in `slice1-alive`** (tickets 09 to 12): the files in
`apps/client/public/sounds/` (built by `pnpm assets sounds` from the picks in `assets/SOURCES.md`), `audio/mix.ts`,
`audio/engine.ts`, `audio/Ambience.tsx` and `audio/UiSounds.tsx`. "As built" below gives the values.

## What and who

- Spec 6.2: "calm island ambience (waves, birds, the distant town) that follows the camera, soft UI sounds, one mute
  button."
- Spec 12.5: sound belongs to `island-3d-client` (the ambience, which follows the camera) and `island-ui` (button
  sounds). The mute switch lives in Settings (spec 12.4), drawn by `island-ui`; both kinds of sound obey it.
- Calm means calm: no music stings, no alarms, nothing that startles. It should sound like sitting on a quiet island.

## How the mix follows the camera (proposal)

- A few looping beds, not one sound per person, vehicle or wave: waves, birds, the distant town.
- Each bed's volume is a pure function of the camera pose (target, distance, tilt), the time of day and a small
  summary of the island (how much coast is in view, how built-up the area under the camera is):
  - waves louder near the coast and when zoomed in near the shore;
  - birds by day, more near nature, quieter at night;
  - the town hum grows with buildings and residents near the camera target, and stays distant at whole-island zoom.
- Update the mix a few times a second, not every frame, and ramp gains smoothly so moving the camera never clicks or
  jumps. No per-source 3D panning is needed for beds; add it only if a measured need appears.
- The same mix works in watch mode, where the camera drifts by itself.
- Keep the mix function free of audio APIs so it can be unit-tested (camera pose and game time in, volumes out).

## Browser rules

- Use the Web Audio API with one audio context for the whole app.
- Browsers, iOS Safari above all, start audio only after a user gesture: resume the context on the first touch,
  click or key press, and never assume sound is playing before that.
- Background: on `visibilitychange` to hidden, suspend the context; on visible, resume it (`state-and-pwa.md`).
- After a WebGL context loss and canvas remount, the audio context does not need to restart; keep it outside the
  canvas tree.
- Mute stops output immediately and is remembered on the device (Settings, `island-ui`).

## Files and budget

- Small, compressed loops, loaded after the first frame so they never delay the island appearing, and cached by the
  service worker like the models.
- Sources must be CC0 (or another license the user approves), recorded in `assets/SOURCES.md` like the model packs,
  and treated as untrusted downloads until processed. No sound pack has been picked yet.
- Where the processed files live in `apps/client/public/` and their format are open.
- Screenshot and end-to-end tests run with sound off (`state-and-pwa.md`, test hooks).

## As built

- **Files:** four ambience loops (waves, birds, town, a night frog chorus; CC0 and public domain from Wikimedia
  Commons) and three button sounds (Kenney Interface Sounds), AAC `.m4a` (every phone browser decodes it). Loops are
  26 to 32 s, their last 2 s crossfaded into their start and their length a whole number of AAC frames, so they
  repeat without a gap; ambience at -26 LUFS, button sounds peaking at -6 dB. 1.5 MB in all; `pnpm assets check`
  holds them to the catalog, 20 to 40 s per loop, under 1 s per button sound and 2 MB in all.
- **Mix (`audio/mix.ts`):** from the camera's target, its distance, the daylight's `night` and the island within 10
  tiles of the target (the share of water, buildings and residents): waves 0.15 + 0.85 x coast x (0.4 + 0.6 x close),
  birds by day, the night chorus at night, the town with how built-up it is, quieter by night and from afar. Applied
  every 250 ms with a 0.4 s time constant, also while watch mode drifts the camera.
- **Engine (`audio/engine.ts`):** one context, made on the first pointer, key or touch (never before), the beds
  looping under their gains, a master gain that mute sets to 0 at once, suspended while the page is hidden, silent
  where there is no Web Audio (jsdom). Button sounds play at half gain through it (`island-ui`).

## Open items

- Weather beds, and how the beds change as the island grows past Settlement.
- The user's ear on the picks (`slice1-alive` ticket 13).
