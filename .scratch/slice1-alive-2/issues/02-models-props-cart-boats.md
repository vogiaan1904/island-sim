# 02: Models: goods props, cart, boats, chopping block, log pile

**What to build:** the new models the other tickets draw. Spec: "Blender"; `island-blender`.

**Blocked by:** none.

**Status:** done

**Needs:** Blender open with the MCP server started (ask the user to save their Blender work first).

- [x] Goods props on the palette: logs, a crate of vegetables, a basket of fish, sized for a Mini Character's hands.
- [x] A hand cart (Fantasy Town Kit cart) sized for one person to push, with a load spot for props.
- [x] A fishing boat and a cargo boat from the Watercraft Kit, scaled against the characters and the pier, each with
      `marker_waterline` and `marker_deck`.
- [x] A chopping block and a log pile.
- [x] Listed in `tools/assets/src/catalog.ts`; recipes in `tools/blender`; `pnpm assets check` passes; renders of
      each shown to the user for a quick yes.

## Comments

- Done, approved on renders 2026-10-20. Goods props are accessories on `arm-right`: `accessory_logs_a`,
  `accessory_vegetable-crate_a`, `accessory_fish-basket_a`, built upright between the hands in the last frame of
  `holding-both` and moved into the rest pose (`recipes/accessories.held`). To load one on a cart or a boat, apply that
  pose's `arm-right` matrix, then set it on the marker. No pack has a basket: it is an open box made in Blender.
- `prop_hand-cart_a` (Fantasy Town `cart` at 1.3, handles at +Y): `marker_load` on the bed, `marker_handle` at the
  handles' ends for the pusher's hands. `prop_chopping-block_a`, `prop_log-pile_a`.
- `ship_fishing-boat_a` (Watercraft `boat-row-small`, 2.4 long): `marker_deck` is the rower's seat.
  `ship_cargo-boat_a` (Watercraft `ship-cargo-c` at 0.6, 6.3 long, bridge forward): `marker_deck` is the middle of
  the open deck aft. Tugs have no deck; tow boats and the other cargo ships are over the ship budget.
