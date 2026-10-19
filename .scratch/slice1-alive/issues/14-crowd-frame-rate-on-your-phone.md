# 14: Crowd frame rate on your phone

**What to build:** the user measures the worst view on their phone so the crowd budget rests on real numbers. Spec:
"Client: frame rate", "Detail by zoom"; `island-testing` phone checklist.

**Blocked by:** 04, 05, 06, 08.

**Status:** wontfix

How: `pnpm client:build`, then `pnpm preview 415 --lan` (rush hour at 07:00) on the Mac, and open the printed address on the phone on the same Wi-Fi; sign in as alice / password-1. Plain http over the network allows no Wake Lock, so check the screen staying awake later on the deployed https build (plan 6).

- [ ] Street zoom at rush hour (shift start or end, ferry docked), per quality tier: frame rate, and the draw calls
      and frame time from the debug readout, noted here.
- [ ] Whether the start check's 24 ms step-down picks a sensible tier on the phone.
- [ ] Watch mode holds 30 fps and the screen stays awake.
- [ ] If the budget is missed, the cap or a cheaper level of detail is decided here as follow-up work.

## Comments

- 2026-10-19: not done in plan 5; moved into plan 6 (ship slice 1) at the user's choice, which already holds the
  real-phone checklist and the final look. See "Plan 6, ship slice 1" in `docs/plans/2026-10-17-slice1-index.md`.
