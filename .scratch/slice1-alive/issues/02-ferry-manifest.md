# 02: Ferry manifest

**What to build:** each island remembers its last ferry trip, so the client can show newcomers walking into the homes
they really moved into and leavers leaving from the homes they really left. Spec: "Sim: the ferry manifest";
ADR 0001; glossary "Ferry manifest".

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The island header gains `ferry` (null before the first trip): the trip's tick, `off` (commuters and newcomers per
      home) and `on` (commuters and leavers per home), homes in id order, replaced by every trip (the type shape is in
      the spec).
- [x] Morning trip: `off.commuters` = commuters who came, `off.homes` = newcomers, `on` empty. Evening trip:
      `on.commuters` = commuters going home, `on.homes` = leavers, `off.homes` = evening newcomers.
- [x] Tests first: after each trip the manifest matches the resident counts that changed and the commuters on and
      off; a trip with nobody leaves an empty manifest carrying its tick.
- [x] `SIM_VERSION` 5 with a snapshot migration adding `ferry: null`; `validateWorld` rejects a malformed manifest.
- [x] The field travels in full state and change sets like `commuters`; the client's message guard accepts it; the
      mirror test with a real in-process server shows it arriving in full state and in an update. The protocol version
      is bumped only if the protocol pins the island header's shape.
- [x] Invariants every tick hold; the golden hash is updated deliberately (say why in the commit); `pnpm pacing` still
      meets its targets.

## Comments

- Done. Every ferry trip writes `island.ferry`; `moveInNewcomers` and `moveOutUnhappy` now return people per home.
  `SIM_VERSION` 5, `migrateV4` adds `ferry: null`. The protocol does not pin the island header, so its version stays 1.
- Golden hashes moved only because every island carries the new field (empty islands `ferry: null`): first buildings
  `0cf149ea3391f7` to `1089f80d373364`, Outpost to Settlement `1c642b051d11dc` to `17a20b4aa04260`, stuck island
  `0fe591e72a7994` to `12fdddc2ed089e`, `createWorld(42)` `1e6115671104c9` to `0160af1f3010f9`. Every readable check
  before each hash (buildings, goals, Settlement at tick 14,468, the grant) is unchanged.
- `pnpm pacing --fast` (sim 5): first residents at 28 min on every seed; Settlement at 7 h 28 min to 9 h 3 min, all on
  target.
- Note for ticket 08: `ViewState` already has `cameraMode` with a `'watch'` value; use it instead of a new flag.
