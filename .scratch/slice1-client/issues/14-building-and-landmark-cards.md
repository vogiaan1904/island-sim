# 14: Building and landmark cards with Fix

**What to build:** tapping a building opens its card at once: picture, its most important condition in words, what it
makes as pictures, its workers, and the cause of a problem with Fix. The Island Hall's card lists its materials and buys
the missing ones from the Mainland. User stories 42 to 46.

**Blocked by:** 09, 11.

**Status:** ready-for-agent

- [ ] Taps on a building open its card; the card comes up from the bottom on narrow layouts and on the right on wide.
- [ ] The condition comes from the sim's `shownStatus` on the island assembled from the mirror, in words per
      `island-ui`'s text tone.
- [ ] Fix sends the one action when there is one (`set-priority`, `hire-commuters`), otherwise flies the camera to the
      cause and says why (also when the action is not possible right now).
- [ ] Landmark card: materials with what is stored, on their way and missing; Buy sends `buy-materials`; bought ones
      show as on their way until the next ferry.
- [ ] Android's back button closes the open card first.
- [ ] Testing Library tests for each condition in the spec 12.1 order, Fix in both modes, the landmark card, no-emoji.
