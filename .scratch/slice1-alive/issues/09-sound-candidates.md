# 09: Sound candidates

**What to build:** CC0 candidates for the four ambience loops (waves, birds, town, night insects) and the three UI
sounds (tap, a building landing, collecting a reward), ready for the user to listen to. Spec: "Sound" (sources).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Two to four candidates per sound from Kenney's audio packs (UI) and OpenGameArt or Freesound filtered to CC0
      (ambience), each with its link and license; Freesound downloads that need the user's sign-in are listed for the
      user to fetch.
- [x] Downloads go into their own new directories under the ignored asset folders, treated as untrusted; nothing
      inside them is run.
- [x] A small local listening page (not shipped) plays each candidate side by side, looping the ambience ones.

## Comments

- Done, with one change of source: OpenGameArt answered HTTP 500 for every page on 2026-10-19 (the whole site was
  down), so the ambience candidates come from Wikimedia Commons, where files marked CC0 or public domain download
  without a sign-in. Public domain is not literally CC0: the user confirms it in ticket 10.
- Kenney Interface Sounds and UI Audio (CC0) are in `assets/packs/` and extracted to `assets/raw/kenney_*` (only
  `.ogg`, `.txt` and `.url` files), recorded in `assets/SOURCES.md`. The Commons files are in
  `assets/raw/commons-sounds/` with `list.tsv` (kind, license, name, URL).
- Candidates: waves "Ocean Waves on a Tropical Beach" (CC0, 384 s); birds "Birds singing in garden" (PD, 49 s),
  "Réveil des oiseaux" (CC0, 174 s), "20090610 0 ambience" (PD, 123 s); night "Pseudacris triseriata chorus" (frogs,
  CC0, 30 s), "Edible frogs" (PD, 24 s), "Cicada orni" (PD, 63 s; cicadas sing by day); town "Karlova 0001" (Prague
  street, PD, 335 s), "Flea market in the rain" (PD, 199 s), "Sound of church bells and birds" (PD, 102 s). UI from
  Kenney: tap click_001, click_003, select_001, ui-audio click1; building lands drop_001, drop_002, pluck_001,
  bong_001; collect confirmation_001, confirmation_002, glass_001, maximize_006.
- No CC0 crickets were found; the frog choruses stand in for night. Freesound (sign-in needed) has more if none fit.
- Listening page (not shipped): the scratchpad `listen/index.html`, 45 s loudness-matched `.m4a` previews.
