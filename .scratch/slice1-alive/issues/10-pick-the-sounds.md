# 10: Pick the sounds

**What to build:** the user listens to the candidates and picks one per sound. Calm means calm: nothing startling.

**Blocked by:** 09.

**Status:** done

- [x] One pick for each of waves, birds, town, night insects, tap, building landing and collect, noted in this ticket.
- [x] Any sound the user wants replaced is noted with what is wrong with it.

## Comments

- 2026-10-19: the user asked the agent to choose. The agent cannot listen, so it chose by license (CC0 first) and by
  measurement: the 32 s stretch with the most even loudness (per-second RMS) and no sharp peaks, and for the button
  sounds the warmest (lowest spectral centroid) and shortest. The user accepted public-domain recordings by delegating.
  - Waves: "Ocean Waves on a Tropical Beach" (CC0), from 92 s.
  - Birds: "20090610 0 ambience" (public domain), from 0 s; far more even than the CC0 "Réveil des oiseaux".
  - Night: "Pseudacris triseriata chorus" (frogs, CC0), from 0 s.
  - Town: "Karlova 0001" (Prague street, public domain), from 8 s.
  - Tap: Kenney Interface Sounds `select_002`; building lands: `drop_002`; collect: `confirmation_001` (CC0).
- The look check (ticket 13) is where the user hears them in the game; any sound can be swapped there.
