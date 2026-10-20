# 11: Look check: work, construction, carts, boats

**What to build:** the user plays the preview and reviews everything this feature drew; fixes follow their notes.

**Blocked by:** 03, 04, 05, 06, 07, 08, 09, 10.

**Status:** ready-for-human

How: `pnpm client:build`, then `pnpm preview <minute>` and sign in as alice / password-1 (ticket 10 lists the minutes).

- [ ] Workers: lumber camp, farm, fishing hut.
- [ ] A building rising, builders, the scaffold coming down.
- [ ] Carriers holding goods; a cart.
- [ ] The fishing boat out and back; a cargo boat after a sale; the ferry undisturbed.
- [ ] The camera at the closest zoom over buildings; the four rough spots; the new watch moments.
- [ ] The user's verdict and notes recorded under Comments, and follow-up work made from them.

## Minutes to open

`pnpm preview <minute>` opens the village at that minute of the day (07:00 is 420). With the default 415:

- 07:00 (420): the morning ferry docks, framed with its lane in watch mode; newcomers walk home with bags, then to work
  (07:15 or so); commuters step off and walk round the dock.
- 07:00 and every hour on the hour: auto-sell sells the wood, and a cargo boat leaves from beside the pier, out south
  for 20 minutes and back for 20 (watch mode shows it).
- 07:01 to 07:23: the hand cart of 20 vegetables on the road from the farm to the dock.
- From about 07:15: workers at the lumber camp (trees), the farm (furrows) and the fishing hut (cleaning fish); the
  rower walks to the boat and rows out 07:10 to 07:25.
- 07:00 to 07:55: builders at the cottage site, rising inside its scaffold; it finishes at 07:55 (an hour after the
  opening minute), scaffold down with a puff of dust, shown in watch mode.
- 16:44 to 16:59: the fishing boat rows home (watch mode shows it); the rower walks in with a basket.
- 17:00 (1020): the evening ferry. Any time: the camera at the closest zoom over the roofs.

## Comments

- 2026-10-20, before the user's check (Claude, screenshots of the preview): the fishing boat was moored on beach-height
  ground and the moored cargo boat partly too (the beach slopes up into the first water tile, and a water tile with
  land on two sides is filled in). Fixed: `groundHeight` in `render/terrain.ts` is the drawn terrain's height (tested
  against every mesh triangle); boats moor where it leaves their hull afloat, the fishing boat a little further out
  and the rower walking down the beach to the water's edge, the cargo boat a little out along the pier. The village
  gave the island a second port master (the claim makes one); removed. `PREVIEW_PORT` lets a second preview run beside
  one already open.
- Note for the check: the preview world pauses while nobody watches and catches up on the real time that passed when
  it is opened again, so reopen it right after starting it to see the listed minutes.
