# 02: Ferry manifest

**What to build:** each island remembers its last ferry trip, so the client can show newcomers walking into the homes
they really moved into and leavers leaving from the homes they really left. Spec: "Sim: the ferry manifest";
ADR 0001; glossary "Ferry manifest".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The island header gains `ferry` (null before the first trip): the trip's tick, `off` (commuters and newcomers per
      home) and `on` (commuters and leavers per home), homes in id order, replaced by every trip (the type shape is in
      the spec).
- [ ] Morning trip: `off.commuters` = commuters who came, `off.homes` = newcomers, `on` empty. Evening trip:
      `on.commuters` = commuters going home, `on.homes` = leavers, `off.homes` = evening newcomers.
- [ ] Tests first: after each trip the manifest matches the resident counts that changed and the commuters on and
      off; a trip with nobody leaves an empty manifest carrying its tick.
- [ ] `SIM_VERSION` 5 with a snapshot migration adding `ferry: null`; `validateWorld` rejects a malformed manifest.
- [ ] The field travels in full state and change sets like `commuters`; the client's message guard accepts it; the
      mirror test with a real in-process server shows it arriving in full state and in an update. The protocol version
      is bumped only if the protocol pins the island header's shape.
- [ ] Invariants every tick hold; the golden hash is updated deliberately (say why in the commit); `pnpm pacing` still
      meets its targets.
