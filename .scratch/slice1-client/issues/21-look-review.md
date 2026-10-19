# 21: Look review

**What to build:** the user reviews the first lit island at every zoom and time of day, and the screens that had no
approved mockup (sign-in, world screens, Build picker, Staff, Trade, Log, Settings, visiting); fixes follow their notes.

**Blocked by:** 06, 10, 12, 16, 17, 18, 20.

**Status:** ready-for-human

- [ ] The user sees the island on their phone: terrain and water colors against the golden look, lighting, shadows,
      day and night, scaffolds.
- [ ] The user sees each unmocked screen in narrow and wide layouts.
- [ ] Changes from their notes are made; the agreed look is recorded for the skill update (ticket 22).
- [ ] The user's verdict recorded under Comments.

## Comments

- 2026-10-19, first phone playtest: the coast steps tile by tile, so a diagonal shore is a staircase. Agreed fix
  (client only): a water tile whose two land sides meet at a corner gets that corner's half as flat beach, split along
  the diagonal that cuts it off; land tiles stay whole and the sim's grid is unchanged. Done in `render/terrain.ts`.
  Recorded for the skill update: spec 12.5 terrain look.
