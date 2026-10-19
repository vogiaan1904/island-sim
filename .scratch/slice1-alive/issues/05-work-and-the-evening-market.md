# 05: Work and the evening market

**What to build:** people working at their buildings and builders at construction sites during the day, and residents
walking to their market after work. Spec: "Client: movers" (workers, builders, market walk).

**Blocked by:** 03.

**Status:** done

- [x] Up to 2 workers by a staffed workplace's front using `interact-left` / `interact-right`, fewer when understaffed,
      none with no workers; a worker shows there only once their commute has arrived.
- [x] 2 builders at each site under construction during the day shift, none at a landmark whose materials have not
      all arrived.
- [x] Market walk: on a given day one adult from each home a market serves (services in reach) walks there and back
      between 17:15 and 17:55, start hashed per home and day; that home's children come along on some days (hashed);
      everyone home before the 18:00 meal.
- [x] Unit tests: worker counts follow staffing; no builders at night or at a landmark waiting for materials; market
      walkers only from served homes, home before the meal, children only with their adult.

## Comments

- Done. The crowd plan has stations (people working in one spot between two minutes) beside walks. Workers stand 1 m
  outside a workplace's front facing it, from when its first commuter arrives until the shift ends; builders the same
  at sites for the whole shift. Interact clips play at their own speed (75 frames a tick) and restart.
- The market walk leaves between 17:15 and 17:26 (hashed per home and day), stays 5 minutes inside, and is home
  before the meal; children come along on about 40% of days.
- Checked in headless Chrome: two workers by the farm's front at noon.
