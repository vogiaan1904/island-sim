# 12: UI sounds

**What to build:** soft sounds when tapping a button or opening a card, when a building lands after its placement is
confirmed, and when collecting a reward. Spec: "Sound" (UI sounds); `island-ui`.

**Blocked by:** 11.

**Status:** done

- [x] The three sounds play through the shared audio context at the right moments (the landing only after the server
      confirms the placement).
- [x] The mute switch silences them; nothing plays before the first gesture or while hidden.
- [x] Tests (Testing Library with a fake audio player): each action plays its sound once; muted plays nothing.

## Comments

- Done. `audio/UiSounds.tsx`: a tap for any button press (a click listener on the document) and for a card opening
  from the island (`view.tappedBuilding` set), the landing when the draft turns to `landing` (the server accepted it),
  the chime when a `collect` command settles ok. All through the shared engine, so mute, the first-gesture rule and the
  hidden page apply; button sounds play at half gain over the ambience.
- A Collect press plays its tap and, once the server accepts, the chime.
