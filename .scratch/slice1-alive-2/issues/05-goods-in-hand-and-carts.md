# 05: Goods in hand, and carts

**What to build:** carriers hold what they carry, and big shipments go by hand cart. Spec: "Client: goods, carriers
and carts"; glossary "Carrier", "Cart".

**Blocked by:** 02.

**Status:** done

- [x] A goods table maps each good to its prop, tested to cover every good; the prop follows `arm-right`.
- [x] A shipment under 4 units: carriers as today, holding the prop. 4 or more: one cart pushed by one person, loaded
      with props, on the same path, arriving on `arriveTick`.
- [x] Tests: the threshold, arrival timing, same output for the same inputs.

## Comments

- Done 2026-10-20. `GOOD_PROPS` in `render/crowd.ts` maps each good to its prop (wood `logs`, vegetables
  `vegetable-crate`, fish `fish-basket`), tested to cover every content good. A shipment under `CART_FROM` (4) units
  is one carrier holding the good's prop; 4 or more is one person pushing a hand cart (`Mover.cart` is the load,
  `holding-both` arms, walk legs), same path and timing, arriving on `arriveTick`. Today's one-carrier-per-5-units
  single file is gone: under 4 units it was always one carrier.
- The cart and its load ride the accessory path in `scene/People.tsx`, following the pusher's root like the
  wheelchair: the cart's `marker_handle` is put at the hands (`HANDS_AHEAD`, 0.35 m in front), and the load is the
  good's prop posed once with `heldPose` (the right arm in the last `holding-both` frame, read from the baked
  animation in `render/clips.ts`) and set at `marker_load`. Both markers are read from the model at load. Draw calls:
  one for carts and one per good with a cart on screen.
- Checked in `pnpm preview 720`: the preview's 20-unit vegetable shipment is a cart pushed along the farm road, the
  crate on its bed. Look and feel are for ticket 11.

