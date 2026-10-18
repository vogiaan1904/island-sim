# 20: Visiting a friend's island

**What to build:** from the world screen a player visits a friend's island: a short camera flight with a fade, the
same island the friend sees, its name and owner shown, every owner control hidden, and an easy way home. User stories 64
and 65.

**Blocked by:** 06, 13, 15, 16, 17.

**Status:** ready-for-agent

- [ ] Opening another slot uses the island message's `own` flag; the HUD, cards, bubbles and panels hide Build, Staff
      and Trade actions, Fix, Upgrade, manager slots and reward collecting.
- [ ] The island's name and owner shown; a Home button reopens the player's own island.
- [ ] Testing Library tests: every owner control absent on a visit, present at home.
