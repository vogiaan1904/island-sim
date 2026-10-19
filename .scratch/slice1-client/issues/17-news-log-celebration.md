# 17: News, Log and the stage celebration

**What to build:** on return, the port master shows what happened while the player was away (the most important events
grouped, at most five, one at a time with "Show me"); the Log keeps the history of news and events, each with "Show
me"; reaching Settlement plays a small celebration. Mainland help appears as news. User stories 54 to 57.

**Blocked by:** 01, 11.

**Status:** done

- [x] The news picks by each event type's importance from content data, groups, takes the top five; Done (and Close)
      send `mark-seen` for the newest event of the news (see the note under Comments).
- [x] "Show me" flies the camera to the event's place (ticket 07's fly-to).
- [x] Log: newest first, a picture, one sentence and "Show me" per item; friendly items, never a table.
- [x] The stage celebration: badge pop with the new stage name, short sparkle, a line from the port master; it does not
      block play.
- [x] One sentence in words for every event type in content data, including `mainland-help`; a test fails if a type
      has none.
- [x] Testing Library tests for the top-five pick, Show me, the Log and the celebration; no-emoji.

## Comments

- Wording fixed at the final review. The first draft of the criterion said Done sends `mark-seen` for "the last one
  shown". Done and Close mark the newest event of the whole news seen (`newestKey`, `news/pick.ts`), including what the
  top five left out. The reason: `mark-seen` is one key and the server returns every event after it, so marking only
  the last one shown would bring newer, less important events back as news on the next visit.
