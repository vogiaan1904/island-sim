# 04: The welcome crew

**What to build:** the very first building on a new island gets its crew at once, for free and at any hour; they
build it through to the end, at night too, then go home. The port master announces them. Spec: "Sim: the rules" (the
welcome crew), "Client: UI" (the port master's news).

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] Sim, tests first: placing a building on an island with no building but the dock sets its crew `coming` with
      reason `welcome` after the call delay, charging nothing; the second building gets no welcome crew; a welcome
      crew builds outside the shift; it is not sent home at 17:15; finishing outside the shift it leaves at once with
      an `out` trip; finishing in the shift its builders become free builders; `builders-arrived` says welcome.
- [ ] Client: the welcome crew is drawn at its site at night while it builds; the news has the port master announce
      the welcome crew. No emoji.
- [ ] `pnpm check` passes.
