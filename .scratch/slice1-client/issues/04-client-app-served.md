# 04: The client app, served by the game server

**What to build:** opening the game's address shows the client's first screen (a calm style A loading page), served
by `pnpm server` from the same origin as `/api` and `/ws`; in development the client's dev server runs with hot reload
and reaches the real server through a proxy. Spec: "Serving the client" and "Client stack and shape".

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `apps/client` in the pnpm workspace: Vite, React, TypeScript under the repo's lint and typecheck, Vitest with
      jsdom and Testing Library. Each new dependency has its reason in the commit message and works on Node 24.
- [x] The server serves the client's build output: right content types, `index.html` for unknown non-API paths, long
      caching for hashed asset files only, `/api` and `/ws` untouched.
- [x] Safe path lookup: no path outside the build folder, no dotfiles; server integration tests on a real HTTP server
      prove traversal attempts and dotfiles are refused.
- [x] Dev: the Vite dev server proxies `/api` and `/ws` to `pnpm server`, which runs with `ISLAND_ORIGIN` set to the
      dev origin; a root script starts the client in dev and one builds it. The commands go into `HARNESS.md`.
- [x] A first UI test renders the loading page and runs the no-emoji check over its text (the check is reusable by
      every later UI test).
