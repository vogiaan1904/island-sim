# 02: Builders move on

**What to build:** when a site finishes during the shift, its crew walks on to the next site waiting for builders,
the oldest first, if they make up its whole crew, a site placed that day included; builders with nothing to do wait
on the pier and leave on the 17:15 boat. Spec: "Sim: the rules" (moving on), "Client: people and boats" (free
builders on the pier).

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] Tests first through the sim's public API: a finished crew takes the oldest ready site it fits; a site too big
      for the free builders is skipped and a later one that fits is taken; a site placed during the shift is taken by
      free builders; free builders are counted in the 17:15 `out` trip and are 0 after it; outside the shift nobody
      moves on.
- [ ] Client: free builders stand on the pier until the evening boat; a crew that moved on shows at its new site.
- [ ] `pnpm check` passes.
