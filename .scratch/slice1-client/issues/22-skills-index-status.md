# 22: Update the skills, the plan index and the status

**What to build:** the project skills describe the real client, so the next feature (`slice1-alive`) builds on facts,
not plans.

**Blocked by:** 01 to 21.

**Status:** done

- [x] With `anthropic-skills:skill-creator`: `island-3d-client`, `island-ui`, `island-testing`, `island-server` and
      `island-game-logic` updated with the real folders, APIs, commands, chosen thresholds, icon set and test patterns;
      their "Still open" lists trimmed to what is still open.
- [x] `HARNESS.md` project map: `apps/client` described.
- [x] Plan index: `slice1-client` done; `slice1-alive` next, with its open questions (crowd scale-down, the ferry,
      watch mode moments, sound sources, friends' islands far away, the crowd frame rate on a phone).
- [x] The status line in `CLAUDE.md` updated.
- [x] `/code-review` of the whole feature run; its findings fixed or listed.

## Comments

- The plan index says `slice1-client` is built, not finished: tickets 08 (camera feel on a real phone) and 21 (look
  review) are the user's checks. Numbers in the skills marked "ticket 08" or "ticket 21" (camera `TUNING`, the terrain
  colors, the tokens, the bubble anchor heights) may change after them, and the skills must be corrected then. Plan 5
  stays "in progress" until `slice1-alive` is built.
- The `/code-review` box is ticked on the strength of the review fix commits already on the branch (4b4013f,
  c363132, 13bd8ca, 8e54cca, dc3430e, 4d40f41, b5bf32b); this ticket's author did not run a review.
- Not covered by this ticket, still saying "planned": `island-content` (its banner and file-location section) and the
  `island-blender` references' "Still open" lists.
