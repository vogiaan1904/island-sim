# 03: Call builders

**What to build:** on the card of a site waiting for builders, the player sees when they come and can call them for
a quarter of the building's price; the builders' boat brings the crew about 30 game minutes later, and the news says
"Builders arrived". Builders can be called from 06:00 to 15:00. Spec: "Sim: the rules" (called crews, the
`call-builders` command), "Protocol and server", "Client: UI".

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] Content: the call window (06:00 to 15:00), the call delay (30 ticks), the fee (250 permille of the price), the
      ledger reason `builders-called`, the event `builders-arrived` (called or welcome) with its importance between
      `construction-finished` and `newcomers-arrived`.
- [ ] Sim, tests first: `call-builders` pays the fee and sets the crew `coming` with its arrive tick; on that tick the
      crew is on site, an `in` trip is recorded and `builders-arrived` emitted; refusals `no-such-building`,
      `already-built`, `builders-not-needed` (coming or on site), `builders-resting` (outside the window),
      `not-enough-coins` with the shortfall. A called crew arriving before 07:00 starts at 07:00 and leaves at 17:15
      like the others.
- [ ] Protocol: the command schema accepts `call-builders` with a whole `buildingId`. Server, one integration case
      with real WebSocket clients: accepted for the owner by day, refused at night, refused for a visitor.
- [ ] Client: the card says "Builders arrive at 06:45" or "Builders are on their way, arriving at <time>"; Call
      builders with its price in coins; outside the window the button is off and the card says builders rest at night
      and come at 06:45; refusals in words; Fix calls builders when it can, otherwise moves to the cause and says why;
      no button on a visit or while the crew is coming. The news shows "Builders arrived". No emoji.
- [ ] `pnpm check` passes.
