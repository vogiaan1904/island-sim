# 02: Waiting for money slows a building down

**What to build:** a building whose upkeep could not be paid keeps its workers and produces at reduced output instead
of stopping, so commuters who were paid still produce goods the player can sell. Matches spec 12.1 ("slows down").
Spec: "Sim: waiting for money slows down".

**Blocked by:** 01 (both bump `SIM_VERSION` and the golden hashes; sequenced to avoid two conflicting bumps).

**Status:** ready-for-agent

- [ ] New content rule `waitingOutputPermille` (first guess 500).
- [ ] The labor pass staffs a building waiting for money like any other built building; production runs at the reduced
      rate; upkeep is still retried every hour and the condition clears on the first successful payment.
- [ ] Failing tests first: a building waiting for money keeps its workers, produces at the reduced rate, returns to full
      rate after payment; buildings under construction still get nobody.
- [ ] `SIM_VERSION` bumped with an identity migration; golden hashes updated deliberately; `pnpm pacing` rerun and
      reported.
- [ ] `island-game-logic` updated where it describes waiting for money.
