# 13: Drawing roads

**What to build:** the player drags along the grid to lay a road, sees its tiles and cost as they drag, and confirms;
the road appears joined to its neighbors. User story 37.

**Blocked by:** 12.

**Status:** ready-for-agent

- [ ] The road drag snaps to grid tiles and previews the pieces it will make.
- [ ] The placement module gives the cost per tile and the `place-road` command, respecting the sim's tiles-per-command
      limit; tests agree with the sim's own command on the same state.
- [ ] Too few coins shows "Need N more coins" and disables confirm; a refusal shows its reason.
- [ ] Road drags do not move the camera.
