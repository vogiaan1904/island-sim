# 12: UI sounds

**What to build:** soft sounds when tapping a button or opening a card, when a building lands after its placement is
confirmed, and when collecting a reward. Spec: "Sound" (UI sounds); `island-ui`.

**Blocked by:** 11.

**Status:** ready-for-agent

- [ ] The three sounds play through the shared audio context at the right moments (the landing only after the server
      confirms the placement).
- [ ] The mute switch silences them; nothing plays before the first gesture or while hidden.
- [ ] Tests (Testing Library with a fake audio player): each action plays its sound once; muted plays nothing.
