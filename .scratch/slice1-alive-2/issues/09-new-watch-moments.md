# 09: New watch-mode moments

**What to build:** watch mode also shows a cargo boat leaving, the fishing boat coming home and a building finished.
Spec: "Client: watch mode".

**Blocked by:** 03, 06.

**Status:** done

- [x] The three moments in `camera/watch.ts`, ranked after a due ferry, each shown once, with captions (`island-ui`
      tone, no emoji).
- [x] Tests in the watch director's style: ranking, shown once, same output for the same inputs.

## Comments

- Built in `camera/watch.ts`: `cargoMoment` (from a sale manifest entry's tick for 8 minutes, held 12, at the cargo
  mooring facing south), `fishingMoment` (the row home until landing plus 2 minutes, framing the spot and the mooring),
  `finishMoment` (a site 3 ticks or fewer from finishing and not waiting for materials, held 4 ticks after, for the
  puff). `WatchInput` gained `boats`; `showsOnce(kind)` tells `Watch.tsx` which keys go into `shown`.
- Ranking: a due ferry; then a timed moment that is current holds; then one that is happening takes over from news or
  the tour (it would be missed otherwise); then the current moment's hold, news, the tour. A building seen finishing is
  not shown again from its `construction-finished` event.
- Captions (`ui/watch/caption.ts`): "A boat takes vegetables to the Mainland", "A fishing boat comes home",
  "The cottage is finished".
