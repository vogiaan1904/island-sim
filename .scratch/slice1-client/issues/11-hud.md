# 11: The HUD

**What to build:** the approved HUD over the island: the stage badge with its progress ring, coin and resident counters
(commuters too during Outpost) that glide between ticks, goal icons for the next stage target and current needs, the
compass and Settings gear on the right, and the round bottom buttons Staff, Trade, Build (big, center) and Log. User
stories 38 to 41.

**Blocked by:** 07.

**Status:** done

- [x] The SVG line-icon set is chosen (license recorded) and every icon-only button has an accessible name.
- [x] Money shows as whole coins (cents divided by 100, rounded down).
- [x] The stage ring shows residents toward 10, then the landmark, from the mirror.
- [x] Narrow and wide layouts follow `island-ui`; touch targets meet its size rule.
- [x] Testing Library tests: values from a store state, the commuter counter only during Outpost, counters after the
      glide (fake timers), Views and Watch absent, no player title, no-emoji check.
- [x] The buttons open empty panels for now; tickets 12, 16, 17 and 18 fill them.
