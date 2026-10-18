# 06: Sign up, worlds and invite codes

**What to build:** a new player signs up with a friend's invite code and names their island; a player creates a world,
joins another with a code, picks between worlds, and the creator shares or regenerates the invite code. Log out ends
this device's session. User stories 1 to 10.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] Sign-up: username (rules shown next to the field before typing), password, invite code, island name, using
      `/api/register`; the island opens on success.
- [ ] Kind, specific errors for each refusal reason: bad code, world full ("This world is full"), world resting
      ("This world is resting, try again soon"), username taken, invalid names.
- [ ] World list from `/api/me`: each world with its islands by name and owner; pick one to open.
- [ ] Create a world (with the island name) and join a world (code plus island name).
- [ ] The creator sees the invite code with a copy button and can regenerate it.
- [ ] Log out (`/api/logout`) returns to the log-in screen.
- [ ] Testing Library tests for each flow and error against a stubbed API typed with the protocol's response types;
      no-emoji check.
