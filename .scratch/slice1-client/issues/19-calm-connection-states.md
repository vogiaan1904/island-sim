# 19: Reconnecting, resting and the other calm states

**What to build:** when the connection drops or the app comes back from the background, the client reconnects by
itself behind a small calm "reconnecting" state and starts from a fresh full state; a paused world shows "This island is
resting, back soon"; an old client is told to reload; a device without WebGL2 gets one friendly sentence. User stories
11, 12, 61 to 63.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] Reconnect with backoff on close and on the page becoming visible again; every reconnect reopens the island and
      replaces the mirror; view state survives (store test).
- [ ] The resting line, exactly as written, on a paused world and while catching up; commands are not sent meanwhile.
- [ ] Update required: one calm line with a reload button.
- [ ] No WebGL2: one friendly sentence, no technical words.
- [ ] Tests for each state, including a reconnect against a real in-process server that is closed and reopened.
