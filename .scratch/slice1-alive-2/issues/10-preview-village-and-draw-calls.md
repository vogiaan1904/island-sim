# 10: The preview village shows it all, and the draw-call count

**What to build:** `pnpm preview` shows every new thing, and a test counts the draw calls of that village. Spec:
"Preview"; "Testing Decisions" (draw calls).

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] The village is built by an exported function; it gains a site under construction, a staffed fishing hut, a
      lumber camp beside trees where the scatter allows, an auto-sell rule that sells each hour, and a shipment of 4
      or more on the road.
- [ ] A client Vitest builds that village and counts draw calls (each model type with instances, people, boats, carts,
      props; the shadow pass counted again): under 150.
- [ ] The minutes to open for each thing are written in ticket 11.

## Comments
