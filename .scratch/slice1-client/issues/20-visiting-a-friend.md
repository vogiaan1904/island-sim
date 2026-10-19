# 20: Visiting a friend's island

**What to build:** from the world screen a player visits a friend's island: a short camera flight with a fade, the
same island the friend sees, its name and owner shown, every owner control hidden, and an easy way home. User stories 64
and 65.

**Blocked by:** 06, 13, 15, 16, 17.

**Status:** done

- [x] Opening another slot uses the island message's `own` flag; the HUD, cards, bubbles and panels hide Build, Staff
      and Trade actions, Fix, Upgrade, manager slots and reward collecting.
- [x] The island's name and owner shown; a Home button reopens the player's own island.
- [x] Testing Library tests: every owner control absent on a visit, present at home.

Built: the world screen lists the other islands of each world opened this session (from the island message's
`summary`, kept in `session.summaries`) with a Visit button; `session.visit` / `session.home` reuse the open socket;
`Arrival` plays the fade and flight; `VisitBanner` shows the island name, owner and Home.
