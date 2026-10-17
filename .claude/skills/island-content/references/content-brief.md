# The content brief (step 1)

Write the brief before any model, data or code. It is short (one screen), lives in the plan, the task or the
conversation (no new repo file needed), and every later step reads from it. Its main job is to catch design
problems while they are cheap: wrong stage, nothing to watch, a way to lose, a missing Fix.

## Template

Copy this and fill every line. Write "to be decided" rather than guessing; mark first-guess numbers as such.

```
Content brief: <name>

Kind(s):           building / good / recipe / house type / landmark / need / key staff trait (list all involved)
Stage:             <stage> (from the spec's stage table, or "new: needs the user's agreement")
Purpose:           which need, chain or stage goal it serves, in one sentence
Chain:             inputs -> outputs per cycle (goods by name; numbers are first guesses or "to be decided")
Where it sits:     what feeds it, where its output goes (warehouse, market, homes, Mainland, a landmark)
People:            who works here (commuters, laborers, skilled, engineers) or who lives here (house types)
Shift:             day shift, or around the clock (port, power; the night shift needs residents)
Cost and levels:   price paid up front; levels 1-3 and what each upgrade adds (jobs, storage or output),
                   or "no levels" for homes
Placement:         footprint in tiles (from the model), placement rules shown on the ghost (for example
                   "Road access", "Too close to the farm")
Adds to watch:     whole island: ...
                   neighborhood: ...
                   street: ... (with clips: walk, interact-left/right, pick-up, holding-both, sit, drive, ...)
                   night: ...
Watch moments:     events worth a watch mode moment or a news line, each type with an importance; stage goals
                   and rewards (or "none new")
Conditions:        each condition it can have, in the spec's order -> what the player sees on the building ->
                   bubble -> Fix (one action, or camera to the cause with the reason)
Wishes:            wish bubbles it causes or answers (for example "homes want a park"), or "none"
Goods data:        for each new good: Mainland price, floor price, color, needs it serves
Chill check:       answers to the questions in design-rules.md
Assets:            candidate pack models and how they are assembled, new packs needed, icons or portraits to
                   render, stage bundle
New commands:      none expected / <the new player action>
Layers touched:    blender, content, sim, server?, 3d, ui, pacing, asset checks
Open questions:    anything not answered by the spec
```

## How to fill it well

- **Stage.** Look it up in `stages.md`. If the spec doesn't list the content, propose a stage with the rules in
  "Assigning new content to a stage" and flag it for the user.
- **Purpose.** One sentence a player would understand ("makes fish so the first residents have food"). If you can't
  write it, the content may not be needed.
- **Chain.** Name the goods. If an input does not exist yet, the brief now covers a new good too: list it under
  Kind(s) and fill its goods data.
- **People.** In Outpost every worker is a commuter (a Mainland laborer), limited by ferry seats shared with
  newcomers. Commuter work runs at a neutral 100% productivity (they have no happiness); a mixed workforce uses
  the average over all workers. Residents include
  children who don't work, so a house's workers are fewer than its residents. Which jobs need skilled workers or
  engineers is not decided in the spec; propose and flag it.
- **Shift.** Most jobs are day shift, and in slice 1 every building is. Only buildings that clearly run all night
  (port, power) are around the clock, and their night shift needs residents, never commuters. The shift decides how
  many recipe cycles run per game day and what the building looks like at night.
- **Cost and levels.** Workplaces and services get levels 1 to 3 from slice 2; homes never level up. In slice 1
  everything is level 1.
- **Adds to watch.** Fill all four lines. Whole-island zoom draws no people, so the first line must name something
  else (smoke, lights, vehicles, ships, stacked goods, a scaffold). Every line must map to a sim flow or state; see
  the watching goal in `design-rules.md`.
- **Conditions.** Go through the list in `design-rules.md` (under construction, damaged, waiting for money, no
  workers, understaffed, missing input, no power, output full, running) and list the ones that apply. "No power"
  applies only to workshops, factories and apartments from Town on.
- **Chill check.** Answer the questions; do not just write "passes".
- **New commands.** Placing, upgrading, hiring, collecting rewards and buying missing landmark materials will be
  general commands, so a new building should not need its own (confirm against the real command set). A new kind of
  player action (a new rule template, a new order) is the usual reason for server work.

## A filled example

See `example-fishing-hut.md` (production building and a good) and `example-island-hall.md` (landmark and stage gate).
Both are illustrative: no code exists yet, and their numbers are placeholders.
