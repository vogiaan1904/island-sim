# 07: Builders walk, and the boat on the water

**What to build:** builders in uniform step off the builders' boat, walk along the roads to their sites, and walk
back to the pier for the evening boat; the boat comes in from the Mainland lane before each `in` trip and leaves
after each `out` trip, moored on the pier's side opposite the cargo boat. Spec: "Client: people and boats".

**Blocked by:** 02, 04, 06.

**Status:** ready-for-agent

- [ ] Pure render data, tests first at pinned game times: walks from the pier to each site start on the `in` trip's
      tick (morning, called and welcome); walks back end at the pier by the `out` trip; free builders wait on the
      pier; the same island and time give the same builders for every watcher.
- [ ] The builders' boat: comes in before an `in` trip, leaves after an `out` trip, bobs on the waves, never takes
      the ferry's berth or the cargo boat's mooring.
- [ ] Builders drawn in the orange uniform (with the hard hat if ticket 06 made one), at street and neighborhood
      zoom like other people.
- [ ] `pnpm check` passes.
