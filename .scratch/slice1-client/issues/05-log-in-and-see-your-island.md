# 05: Log in and see your island

**What to build:** the tracer bullet. A player with an account logs in, the client opens their island over the
WebSocket and shows it in 3D: terrain, water and the dock, kept live by the server's updates, seen from a fixed
camera. Spec: "Client stack and shape" (Connection, Mirror store, Render data, Scene).

**Blocked by:** 03, 04.

**Status:** done

- [x] A plain log-in screen (username, password) using `/api/login` and `/api/me`; a signed-in player skips it.
- [x] Connection: one WebSocket to `/ws` with hello, open-island and the update-required answer; commands carry
      request ids.
- [x] Mirror store: a pure `applyMessage` for `island`, `update`, `status` and `result`; view state lives beside the
      mirror and survives a new full state.
- [x] Store tests use message sequences from a real in-process server, driven the way the server's test player does:
      the island assembled from the mirror (ticket 03) equals the server's island after the full state and after
      several ticks and a command; a second full state leaves no stale entity and keeps view state.
- [x] Render data (no React or three imports, unit-tested): terrain chunks and the dock instance at its footprint
      center and rotation, same output for the same input.
- [x] Scene: terrain with vertex colors following the look, one water surface with a cheap wave, the dock drawn
      instanced with `palette.png` bound by the model contract (nearest filtering, sRGB), one sun from the look's
      values. Models load only from the asset catalog's list.
- [x] The gliding game clock exists and drives the water; it is the single animation time source.
