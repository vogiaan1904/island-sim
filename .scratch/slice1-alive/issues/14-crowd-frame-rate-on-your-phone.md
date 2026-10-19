# 14: Crowd frame rate on your phone

**What to build:** the user measures the worst view on their phone so the crowd budget rests on real numbers. Spec:
"Client: frame rate", "Detail by zoom"; `island-testing` phone checklist.

**Blocked by:** 04, 05, 06, 08.

**Status:** ready-for-human

How: `pnpm client:build`, then `pnpm preview 415 --lan` (rush hour at 07:00) on the Mac, and open the printed address on the phone on the same Wi-Fi; sign in as alice / password-1. Plain http over the network allows no Wake Lock, so check the screen staying awake later on the deployed https build (plan 6).

- [ ] Street zoom at rush hour (shift start or end, ferry docked), per quality tier: frame rate, and the draw calls
      and frame time from the debug readout, noted here.
- [ ] Whether the start check's 24 ms step-down picks a sensible tier on the phone.
- [ ] Watch mode holds 30 fps and the screen stays awake.
- [ ] If the budget is missed, the cap or a cheaper level of detail is decided here as follow-up work.
