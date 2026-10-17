# Ambience sound

Planned design from spec 6.2 and 12.5. No code and no sound files exist yet. Proposals are marked as such.

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

## Open items

- Sound sources, file format, location and loop lengths.
- The exact mix curves and the island summary they read.
- Whether night or weather changes the beds beyond the bird and town levels.
