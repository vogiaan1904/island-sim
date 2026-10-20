# 05: Goods in hand, and carts

**What to build:** carriers hold what they carry, and big shipments go by hand cart. Spec: "Client: goods, carriers
and carts"; glossary "Carrier", "Cart".

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] A goods table maps each good to its prop, tested to cover every good; the prop follows `arm-right`.
- [ ] A shipment under 4 units: carriers as today, holding the prop. 4 or more: one cart pushed by one person, loaded
      with props, on the same path, arriving on `arriveTick`.
- [ ] Tests: the threshold, arrival timing, same output for the same inputs.

## Comments
