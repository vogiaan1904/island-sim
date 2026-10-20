# The sim keeps a sale manifest so the client can send a cargo boat for each sale

A sale to the Mainland (the sell command or the port master's hourly auto-sell) removes goods from the island's
stores in one tick, and nothing in the island state says afterwards that it happened. The client draws everything as a
pure function of island state and game time (`island-3d-client`, rule 4), so each island now keeps a **sale manifest**:
its sales of the last game hour, one entry per tick and good (tick, good, amount), appended by every sale and pruned of
entries older than 60 ticks when a new one is added. The client sends one cargo boat from the pier for each entry,
loaded with that good. Decided in the `slice1-alive-2` grilling, 2026-10-20; the field arrives with `SIM_VERSION` 6 and
a snapshot migration (an empty manifest).

## Considered options

- **Only the latest sale**, replaced by each sale, like the ferry manifest (ADR 0001): a manual sale while the boat of
  the hourly auto-sell is still out would make that boat jump back to the pier. Keeping the hour's sales gives each
  sale its own trip.
- **A cargo boat on a fixed timetable**, no sim change: the boat would not follow real sales, so what the player sees
  would not match the coins.
- **Crate stacks at the dock that follow its stock**, no boat: sales would show only as crates vanishing.
- Events alone were not enough: events are not part of the state, so a reconnect or a visitor would miss the boat
  (the same reason as in ADR 0001).
