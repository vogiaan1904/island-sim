# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.
Layout: **single-context**. The pnpm workspace has several packages, but they share one domain and one vocabulary.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.
- **The decisions made before this layout existed.** They act as this repo's ADRs; do not copy them into
  `docs/adr/`:
  - `docs/brainstorm/2026-10-15-island-sim-brainstorm.md`, the numbered decisions table (D1, D2, ...): product
    decisions and what was rejected.
  - `docs/design/2026-10-16-island-sim-design.md`: the design spec for the whole game. Section 8.1 defines slice 1,
    section 12 holds the resolved details.
  - The "Decisions" sections of the done plans in `docs/plans/`, and the plan index's carried-over items.
- **The project skill for the layer** (`.claude/skills/island-*`): its conventions are binding. `HARNESS.md` says
  which one to load per path.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── GLOSSARY.md            ← created lazily by /domain-modeling
├── docs/adr/              ← new decisions, created lazily
├── docs/brainstorm/       ← decisions D1, D2, ... (before this layout)
├── docs/design/           ← the design spec
├── apps/
└── packages/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids. Until a term is
in the glossary, use the word the design spec uses (Outpost, Settlement, commuters, key staff, Goods flow, ...).

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, a numbered brainstorm decision or design spec section 12, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
