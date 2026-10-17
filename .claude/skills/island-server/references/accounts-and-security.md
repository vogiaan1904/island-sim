# Accounts and security

Planned design for `apps/server`; no code exists yet. Source: spec 5.3, 5.4, 12.3; decision D21 (username and password,
chosen because it works the same on phone, desktop and an installed iPhone PWA, which has its own storage).
Rejected: browser token plus recovery code, Discord, email magic link.

Contents: usernames and passwords - sessions and cookies - the WebSocket upgrade - registration and invite codes -
password reset - rate limits - HTTPS - security checklist for every server change.

## Usernames and passwords

- **Username:** unique, made of ASCII letters, digits, "-" and "_" only (no emoji, no spaces), compared in lowercase
  but shown as typed (spec 12.3). Store the name as typed (for display) and its lowercased form with a unique index,
  and always look up by the lowercased form. The schema rejects anything else before any lookup. Minimum and maximum
  length are still open.
- **Password:** at least 8 characters (spec). Also set a maximum length so nobody can submit megabytes to the hasher
  (number still open).
- **Hashing:** argon2id. The library and its cost parameters are still open. Always use the asynchronous API:
  hashing deliberately takes time, and doing it on the main thread would stall every world's ticks.
- Never log, store or send the plain password. Never send the hash to a client.
- On a failed login, give one generic message that does not reveal whether the username exists.

## Sessions and cookies

- Login creates a new session for that device; a player signed in on a phone and a laptop has two sessions.
- The session token is a long random value from Node's `crypto` module. Suggested: store only a hash of the token,
  so a leaked database file does not hand out live sessions.
- Cookie: httpOnly (spec), Secure (HTTPS is required), a SameSite setting (Lax or Strict: still open), path `/`.
- **90-day sliding expiry:** each use pushes the expiry 90 days ahead. Writing that on every connection is fine at
  this scale, or limit it to once a day. Expired sessions are refused and can be deleted.
- **Logout ends only that device's session:** delete that one session and clear its cookie. Other devices stay
  signed in. Suggested: also close the WebSocket connections opened with that session.

## The WebSocket upgrade

- The upgrade request carries the same session cookie. Check the session before accepting the upgrade; with no valid
  session, refuse it (no socket is opened).
- **Check the Origin header** on the upgrade and accept only the game's own origin (spec 12.3: the session cookie
  alone is not enough). Browsers do not apply the same-origin policy to WebSockets, and depending on the cookie's
  SameSite setting and the browser, an upgrade started by another page can carry the player's cookie. Without this
  check another page could open a socket as the signed-in player (cross-site WebSocket hijacking). The Origin check
  is the defence to rely on, not SameSite alone.
- Bind the connection to that session's account. Every command's actor comes from here, never from the message.

## Registration and invite codes

- Each world has exactly one invite code (spec 12.3). It does two things: it lets someone without an account
  register, and it lets an existing account join that world. So strangers who find the URL cannot sign up, and a
  friend who receives the code can register and claim an island.
- **Registering with a world's code also claims an island in that world** (spec 12.3). The registration request
  therefore carries the island name too (2 to 24 characters of ASCII letters, digits, spaces, "-" and "'"). The claim
  itself is a sim command, applied and logged like any other (`world-runtime.md`). The account and the claim are
  created together (spec 12.3): do both in one synchronous step, so if the world is full or resting nothing is
  created and the player is told why ("This world is full", "This world is resting, try again soon"; look and
  wording per `island-ui`).
- The world's creator can regenerate the code from the world screen, and the host can with an admin command
  (`operations.md`). Only the creator's session may regenerate it from the client. The old code then stops working
  for both registering and joining; accounts that already joined are unaffected.
- One account can be in several worlds, one island per world.
- The very first account is created by the host with an admin command on the server machine. No web route creates
  an account without a valid invite code.
- Rate-limit registration attempts per IP (suggested), so invite codes cannot be guessed by brute force.

## Changing a password

- Players can change their password from Settings, under account (spec 12.4). It is an HTTPS request on the signed-in
  session, not a WebSocket message.
- It ends the account's sessions on every other device (spec 12.4); the current device stays signed in. Also close
  the WebSocket connections opened with those sessions.
- Suggested: require the current password, apply the same rules as registration (at least 8 characters, the maximum
  length), hash asynchronously, and rate-limit attempts per account.

## Password reset

- There is no email. The host runs an admin command that issues a one-time reset code for a username and passes it
  to the player out of band (for example in a chat).
- The player enters username, code and a new password. The code works once, is stored hashed, expires (expiry still
  open), and attempts are rate-limited.
- A reset ends all of the account's sessions (spec 12.4); a password change ends every session except the
  current device's.
- Email recovery can be added later (brainstorm Section 3); nothing in the design depends on it.

## Rate limits

| What | Keyed by | Source |
|---|---|---|
| Login attempts | username and IP, separately | spec 5.4 |
| Commands | connection | spec 5.3 |
| Registration attempts | IP | suggested |
| Reset code attempts | username and IP | suggested |

- Numbers, windows and back-off are still open. With one process, in-memory counters are enough (they reset on
  restart, which is acceptable for a private game).
- Behind a reverse proxy the client IP arrives in a forwarded header. Trust that header only when the request comes
  from the known proxy; otherwise anyone can fake their IP and dodge the limit.

## HTTPS

Required (spec 5.4). TLS is terminated in front of the server (the setup depends on the hosting provider, still to be
chosen in slice 1). Cookies are Secure, so they are never sent over plain HTTP. Suggested: an HSTS header. The local
development setup is still open.

## Security checklist for every server change

Run through this for any change to `apps/server` or `packages/protocol`:

- [ ] Every new input (WebSocket message, HTTP body, query parameter, any header relied on) has a schema with bounds.
- [ ] The acting account and island come from the session, not from the input.
- [ ] No game decision in server code; the sim decides and the server relays.
- [ ] Only a schema-checked command payload reaches the sim from a client: no client-sent times, tick numbers,
      prices, results or other players' ids that the server would act on unchecked.
- [ ] Anything a client can repeat cheaply is rate-limited.
- [ ] A malformed input yields a reason code or closes that one connection; it cannot throw out of a handler or
      crash the process.
- [ ] The server checks ownership before calling the sim; visitors can read another island but never change it.
- [ ] The WebSocket upgrade still checks the session and the Origin header.
- [ ] Player-entered text shown to others (island names, usernames) passes its character rules in the schema and is
      always displayed as text, never as HTML.
- [ ] SQL uses prepared statements with bound parameters.
- [ ] No secrets in logs: passwords, session tokens, cookies, reset codes, invite codes.
- [ ] New HTTP endpoints that change something check the Origin and rely on the SameSite cookie, so other sites
      cannot trigger them.
- [ ] Slow CPU work (hashing, large serialization) stays off the main thread or is measured.
