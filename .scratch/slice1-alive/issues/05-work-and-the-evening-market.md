# 05: Work and the evening market

**What to build:** people working at their buildings and builders at construction sites during the day, and residents
walking to their market after work. Spec: "Client: movers" (workers, builders, market walk).

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] Up to 2 workers by a staffed workplace's front using `interact-left` / `interact-right`, fewer when understaffed,
      none with no workers; a worker shows there only once their commute has arrived.
- [ ] 2 builders at each site under construction during the day shift, none at a landmark whose materials have not
      all arrived.
- [ ] Market walk: on a given day one adult from each home a market serves (services in reach) walks there and back
      between 17:15 and 17:55, start hashed per home and day; that home's children come along on some days (hashed);
      everyone home before the 18:00 meal.
- [ ] Unit tests: worker counts follow staffing; no builders at night or at a landmark waiting for materials; market
      walkers only from served homes, home before the meal, children only with their adult.
