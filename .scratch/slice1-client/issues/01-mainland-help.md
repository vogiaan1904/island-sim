# 01: Mainland help for a stuck island

**What to build:** an island that spent every coin before it had residents or anything to sell gets a small grant
from the Mainland on the next morning ferry, so it can hire commuters again, with a news event saying so. Works while
the owner is away. Spec: "Sim: Mainland help" and "Sim: both tickets".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] New content rule `mainlandHelpCents` (first guess 10,000), a new ledger reason and a new `mainland-help` event
      type with an importance in content data.
- [ ] At the morning ferry, before commuters board, a stuck island is credited the grant: no residents, coins below
      one commuter's day wage, no goods in any store, nothing in transit or cargo, no reward waiting to be collected.
- [ ] Failing tests first, per pass: a stuck island gets exactly one grant per morning ferry and one event; an island
      with a resident, enough coins for one wage, a stored good, goods in transit, cargo on the way or a waiting reward
      gets none; commuters hired that same morning can board with the grant.
- [ ] `SIM_VERSION` bumped with an identity snapshot migration; invariants hold every tick.
- [ ] A new golden scenario: an island that spends everything, gets stuck, gets help and recovers. The existing golden
      hash is updated deliberately, never copied from a received value, with the reason in the commit.
- [ ] `pnpm pacing` rerun; the stage-time targets still hold (report the numbers).
- [ ] Spec 12.1 already states the rule; `island-game-logic` gets the rule and its numbers.
