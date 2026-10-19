# Text tone

Read this before writing any player-facing words: labels, statuses, card text, news lines, captions, errors,
button labels.

## The voice

**Plain, short, friendly.** Like a helpful neighbor on the island, not a control panel. The game is chill (D24):
nothing is ever lost, problems are gentle and repairable, so the words never alarm.

- Say what is happening **on the island**, in words a player uses. Not sim terms.
- **One idea per line.** Statuses are a few words; a sentence fits in one or two lines on a phone.
- Give the **cause and the way out** together: "The windmill has no workers." next to a Fix button.
- **Sentence case** everywhere. No ALL CAPS, no exclamation chains, no "CRITICAL", "ERROR" or "WARNING".
- **Buttons are short verbs**: Build, Place, Rotate, Cancel, Fix, Upgrade, Show me, Next, Close.
- **Numbers only when they help**, small and next to a picture: a cost, a count on a goods tile, "1 / 3". Prefer
  words to percentages ("Needs 2 more workers", not "Staffing 60%").
- No jargon: never "tick", "delta", "throughput", "utilization", "input deficit", "entity", "sync".

## Instead of, write

| Instead of | Write |
|---|---|
| Input deficit: flour (0/h) | Waiting for flour |
| Staffing 3/5 (60%) | Needs 2 more workers |
| Output buffer full | Storage is full |
| Status: CONSTRUCTING 42% | Being built |
| Insufficient funds | Need 200 more coins |
| Wage payment failed | Waiting for money |
| Placement invalid: adjacency rule 4 | Too close to the farm |
| Road connectivity: true | Road access |
| ERROR: connection lost | Reconnecting... |
| World paused: tick exception | This island is resting, back soon |
| Population growth +6 | Six newcomers came on the ferry |

These are illustrative, except the lines the spec fixes (below). The card shows only the most important
condition, in the order of spec 4.2 and 12.1: under construction, damaged, waiting for money, no workers,
understaffed, missing input, no power, output full, running. Give each one plain words (the table in `screens.md` section 5) and name the
missing thing ("Waiting for flour", not "Missing input").

## Wording the spec fixes

Use these as written (sentence case on screen):

| Where | Text | Spec |
|---|---|---|
| Place, Upgrade or a Build picker item the player can't afford | Need N more coins (N in whole coins) | 12.1 |
| A building whose running costs can't be paid | Waiting for money | 12.1 |
| A world paused after an error | This island is resting, back soon | 12.3 |
| The ghost between Place and the server's answer | a short "placing" state (for example "Placing...") | 12.4 |
| Placement labels | Road access; Too close to the farm (examples from spec 6.1) | 6.1 |

## Who speaks

- **Key staff** deliver news and tips in first person plural, warm and brief: "We sold 400 fish while you were
  away, but the bakery ran out of flour." A trait can color the voice a little; keep it light.
- **The UI itself** (labels, statuses, buttons) is neutral and minimal.
- **Watch mode captions** describe what you see, present tense: "The morning ferry brings six newcomers."
- **No story framing** (spec non-goals): no narrator, letters, governor or investors. Talk about the island.
- **No title for the player** (spec 12.4): the mockup's "Welcome back, Mayor!" is dropped. Address the player as
  "you". The island has the name the player gave it when claiming it; use it where it helps ("Welcome back to Palm
  Cove" is fine as an illustration).

## Rejections and errors

- The server answers commands with ok or a reason code (`island-server`); placement previews report the same
  checks from `sim` (`island-game-logic`). Reason codes are stable ids and the sim holds no player-facing text,
  so the client turns each code into words (and an icon where it helps). Keep that mapping in one place, cover
  every code (a test can check that), and add the words in the same change that adds a code. Never show the raw
  code.
- Errors that are not the player's fault (connection, server restart) are calm and self-healing in tone:
  "Reconnecting...", then nothing once it works.
- Sign-in and sign-up errors are specific but kind: "That invite code doesn't work. Check it with your friend."
- Say the username rule before the player types (spec 12.3: ASCII letters, digits, "-" and "_"), for example
  "Letters, numbers, - and _ only".
- Same for the island name (spec 12.3: 2 to 24 characters of ASCII letters, digits, spaces, "-" and "'"), for
  example "2 to 24 letters or numbers".

## Names and content text

- Names and one-line descriptions of buildings, goods, key staff and traits are looked up by their stable content
  id, never hardcoded in components and never shown as the raw id. The spec has the client import
  `packages/content` for UI (spec 3), so content data was the default home for display names. **Decided in slice 1:** content has ids only, and the names
  live in one client table keyed by id, `apps/client/src/ui/names.ts` (typed `Record`s, so a new content id fails the
  build until it has a name). Renaming for players changes the display name, never the id.
  Write them in this same tone (`island-content`).
- A building description says what it does for the island and its size, in one or two short sentences: "Sells
  food and goods to the homes around it. Takes 2 x 2 tiles." (on screen, the multiplication sign U+00D7 in place of the x)
- English only for now; the spec mentions no other languages.

## Characters

Letters, digits and plain punctuation only. No emoji and no symbol characters such as check marks, warning signs,
stars or arrows: they are icons (see `icons.md`). The middle dot (U+00B7) and the multiplication sign (U+00D7) are fine.
