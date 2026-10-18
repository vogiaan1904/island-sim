# 16: Staff and Trade

**What to build:** the Staff panel hires Mainland commuters (limited by ferry seats, which newcomers share) and
introduces the port master with portrait, name, role and trait, with their auto-sell surplus rule; the Trade panel shows
goods as picture tiles with Mainland prices and sells, saying plainly when the floor price stops a sale. User stories 50
to 53.

**Blocked by:** 11.

**Status:** done

- [x] Staff: hiring sends `hire-commuters` and shows the seats limit in words; the port master card uses the rendered
      portrait; the auto-sell rule sends `set-auto-sell`.
- [x] Trade: goods tiles with price badge and any trend as an icon, never a chart; Sell sends `sell`; a refusal below
      the floor shows "The Mainland pays too little right now".
- [x] Two clear choices with pictures, not tabs, not tables.
- [x] Testing Library tests for hire, auto-sell, sell and the floor refusal; no-emoji.
