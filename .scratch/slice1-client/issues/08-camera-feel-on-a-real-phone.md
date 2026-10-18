# 08: Camera feel on a real phone

**What to build:** the user tries the camera on their own phone and on a Mac trackpad and says whether it feels calm
and natural; tuning follows their notes. Real touch cannot be proven by code.

**Blocked by:** 07.

**Status:** ready-for-human

- [x] The dev server reachable from the user's phone on the local network (steps written down for the user).
- [ ] The user checks move, pinch zoom, twist, two-finger tilt, double-tap, momentum, limits, the compass, and that the
      browser does not zoom, refresh or swipe back.
- [ ] Thresholds and limits tuned from the user's notes; the controller's unit tests updated to match, never weakened.
- [ ] The user's verdict recorded under Comments.

## Steps for the user

Phone and Mac must be on the same Wi-Fi. The phone only talks to the Vite dev server; Vite forwards `/api` and `/ws` to
the game server on the Mac, which can keep listening on `127.0.0.1`.

1. Find the Mac's address on the local network: `ipconfig getifaddr en0` (Wi-Fi; try `en1` if it prints nothing). Call
   it `<ip>` below, for example `192.168.1.23`.
2. Terminal 1, the game server, told to accept the phone's origin (the WebSocket Origin check compares it to the page
   address) and plain-HTTP cookies:

   ```
   ISLAND_ORIGIN=http://<ip>:5173 ISLAND_SECURE_COOKIES=0 pnpm server
   ```

   This is `pnpm server:dev` with the origin changed; `pnpm server:dev` itself only accepts `http://localhost:5173`.
   The first time, create an account with `pnpm admin` (see `island-server`), or sign up in the page with an invite.
3. Terminal 2, the client with hot reload, open to the network:

   ```
   pnpm client --host
   ```

   Vite prints a `Network:` URL. If it shows a different address than `<ip>`, use that one in step 2 and restart the
   server. The port is fixed at 5173 (`strictPort`), so a busy port stops it instead of moving.
4. On the phone open `http://<ip>:5173`, sign in and open your island.
5. If the page does not load: allow incoming connections for `node` when macOS asks (System Settings, Network,
   Firewall), and check the phone is not on a guest network that isolates devices.
6. Try the camera, and write what you feel under Comments. Things to check, in this order: one-finger drag (does the
   ground stay under the finger?), pinch zoom (toward the fingers?), two-finger twist (which way does the island turn?
   it should follow your fingers), two fingers moving up or down side by side (tilt: up should lower the view toward
   the horizon; does it start by accident while pinching or twisting?), double-tap on open ground, how long a fling
   keeps gliding, the stop at the edge of the island and at street level, the compass, and that the browser never
   zooms the page, refreshes or swipes back. Also try a Mac trackpad: a two-finger swipe moves, a pinch zooms; if a
   mouse wheel is taken for a trackpad (or the reverse), tell me which device and what the wheel did.

The numbers to tune are in `TUNING` in `apps/client/src/camera/controller.ts` and `SMOOTH_TIME` in
`apps/client/src/scene/CameraRig.tsx`.
