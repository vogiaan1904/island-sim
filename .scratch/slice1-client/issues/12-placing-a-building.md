# 12: Placing a building

**What to build:** the player opens Build, picks a building and places it: a see-through ghost snaps to the grid just
above the finger with labels from the sim's own placement check, Rotate, Cancel and Place, a short "placing" state
until the server answers, then a bounce and a puff of dust on success, or the reason in words on a refusal. User
stories 30 to 36.

**Blocked by:** 09, 11.

**Status:** ready-for-agent

- [ ] Build picker: each building's rendered icon, name and cost; unaffordable ones say "Need N more coins"; locked
      ones say what unlocks them.
- [ ] Placement module (pure): mirror, building, tile and rotation give the sim's verdict, the labels in words, the cost
      and the `place-building` command. Tests on mirrors built with the sim's own commands: the verdict agrees with what
      the sim's command decides on the same state, for a valid spot and each refusal reason.
- [ ] Place disabled with "Need N more coins" when short; the ghost follows the finger with an offset so it stays
      visible; placement drags do not move the camera.
- [ ] The landing bounce plays only on the server's ok; a refusal keeps the ghost with the reason (Testing Library test
      for both).
