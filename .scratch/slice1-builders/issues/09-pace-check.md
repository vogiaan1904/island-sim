# 09: Pace check

**What to build:** proof that builders keep the game's pace: the pacing tool's bot, which never calls builders,
still reaches the first residents within about a real hour and Settlement within the first real day. Spec: "Pacing
tool".

**Blocked by:** 02, 04, 05.

**Status:** ready-for-agent

- [ ] The bot handles sites waiting for builders (it places and waits; it never calls); the pacing report run and
      its numbers written here.
- [ ] If a target slips: build times and crew sizes retuned in content data until both targets hold, with the
      golden hashes updated deliberately and the reason written here.
- [ ] If retuning cannot reach them: the measured times go to the user before any target changes (ready-for-human).
- [ ] `pnpm check` passes.
