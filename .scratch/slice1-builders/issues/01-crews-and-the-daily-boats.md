# 01: Crews and the daily boats

**What to build:** a site rises only while its crew is on it. The builders' boat brings a full crew for every site
waiting for builders at 06:45, they build through the day shift and all leave at 17:15; at night sites stand still.
The builders drawn at a site are its real crew, and its card says "Waiting for builders" while the crew is away.
Spec: "Content data", "Sim: state", "Sim: the rules" (morning boat, evening boat, construction, conditions), "Client:
people and boats" (builders at sites).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Content: a crew size per building (cottage, well, fishing hut 2; lumber camp, warehouse, market, farm 4; Island
      Hall 8; dock 0), the boat's minutes (06:45, 17:15), the condition `waiting-for-builders` shown before
      `under-construction`; the Island Hall's build time 600. Content tests: every player-buildable building has a
      crew, every non-landmark build time fits in one shift.
- [ ] Sim state: each site's crew (`away`, `coming`, `site`; `null` once built), the island's free builders and the
      builders' boat's last trip (shape in the spec); change sets carry them; `validateWorld` checks them.
- [ ] `SIM_VERSION` 7 with **no migration**: a version 6 snapshot is refused with `missing-migration`.
- [ ] Rules, tests first through the sim's public API: at 06:45 every site `away` that is ready gets its crew and an
      `in` trip is recorded (none when nothing is ready; a landmark is ready when its materials are on site); a site
      progresses only with its crew on site during the shift; at 17:15 every crew goes `away` and an `out` trip is
      recorded; an unfinished site gets its crew back the next morning; a finished site's crew becomes free builders
      (they simply leave at 17:15 until ticket 02); conditions and their order.
- [ ] Client: the builders drawn at a site are its crew size while the crew is on site in the shift, none while it is
      away; the card shows "Waiting for builders" in words, before "Under construction".
- [ ] Golden scenario hashes updated deliberately, once; their readable checks still hold or are updated with the
      reason written here. Replay still matches.
- [ ] The local world database removed with the server stopped (`data/island.sqlite` and its `-wal` and `-shm` files;
      the user asked for it, 2026-10-20); `data/backups/` left alone. `pnpm admin create-account` makes a fresh
      account afterwards.
- [ ] `pnpm check` passes.
