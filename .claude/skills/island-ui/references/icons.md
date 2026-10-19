# Icons only, never emoji

Read this whenever you add an icon, a symbol, any player-facing text, or review a UI change.

## The rule and why

User rule from 2026-10-15 (D22), and its own non-goal in spec 1 ("including symbol characters that some
phones draw as emoji"): **no emoji in the UI, only icons.** It applies to the game, to mockups and to docs.
Two reasons it matters beyond taste:

- Emoji look different on every phone and break the style A look (one palette, one line weight).
- Many ordinary-looking **symbol characters are drawn as colored emoji on some phones**, depending on the font
  and on invisible variation selectors. A check mark that is a neat glyph on a laptop can be a green box on an
  iPhone. So "it's just a symbol, not an emoji" is not a safe argument: draw it as an icon.

## Icon families

| Family | What | Source | Where it's used |
|---|---|---|---|
| **UI chrome icons** | SVG line icons | **Lucide** (ISC license), as path data in the one module `apps/client/src/ui/icons.tsx` (`<Icon name size />`; add an icon by adding a key to `LINE_ICONS`). License text: `apps/client/src/ui/icons.LICENSE.md`. | Bottom buttons, compass, Watch, close, rotate, check on Place, eye on Show me, statuses, hints, Views options, arrows in recipes |
| **Building and goods pictures** | Small renders of the real 3D models from a fixed angle | Rendered in Blender by the asset pipeline (`island-blender`), shipped in `apps/client/public/icons/` (listed in `tools/assets/src/catalog.ts`) | Build picker, building card picture, recipe tiles, goods in bubbles, trade, Goods flow legend |
| **Key staff portraits** | Renders of the Mini Characters (spec 12.4), head and upper body: `portrait_<name>_a.png` | Rendered in Blender (`island-blender`) | News, Log, Staff panel, manager slots |

Which one to use:

- A building or a good: always its **rendered picture**, so the UI matches what the player sees on the island.
  Do not draw a line icon of wheat when a rendered wheat exists.
- An idea that is not a building or good (workers, power, road access, happiness, traffic, coins, time): a
  **line icon**. The coin is a small filled illustration in the mockups; treat it as part of the UI icon set.
- A bubble about a missing good shows that good's picture; a bubble about missing workers or power shows a line icon.
- Missing render for a new building or good: that is an `island-content` / `island-blender` task. Do not fill
  the gap with an emoji or a text symbol, and do not ship a blank square.

## Display sizes for rendered pictures (for island-blender)

Decided in slice 1 plan 4 (2026-10-18): every picture and portrait is a **256 x 256 RGBA PNG with a transparent
background**, rendered from one orthographic camera 30 degrees down at the front-right corner, framed with a 6% margin
(portraits: the head and upper body). One render serves every place below: it was checked at 24 and 90 CSS px on a
light and a dark background. Names share the model's base name: `building_farm_a.png`, `good_wood_a.png`,
`portrait_lena_a.png`.

| Where | Displayed size, CSS px (estimate) |
|---|---|
| Building picture on the card | about 90 |
| Building picture in the placement panel | about 80 |
| Goods inside recipe tiles | about 30 (tile about 55) |
| A good or a building (a wished park) inside a bubble | about 24 |
| Key staff portrait in the news | about 90 |
| Key staff portrait in a manager slot | about 58 |
| Build picker | not designed yet; likely close to the card size |

The pixel ratio is capped at 2 (spec 6.2), so render at least twice the largest size an image is shown at. One
render per building can serve every place if it stays crisp when scaled down to about 24 px; check that with
`look` on a small size before deciding.

## Line icon style

As in the mockups, and as built in `ui/icons.tsx` (Lucide shapes):

- 24 x 24 grid, 2 px stroke, round caps and joins, no fill, color from `currentColor`.
- One stroke weight across the UI; a slightly heavier stroke (about 2.4 to 3) only for small bold glyphs such as the
  X on a close button or the check on Place.
- Icons sit inside the style A shapes (circle, pill, tile); they are not used bare as buttons.
- Use the icon set from one place: `apps/client/src/ui/icons.tsx`, `<Icon name size />`, keys in `LINE_ICONS`. Never
  paste ad hoc SVG paths into a screen. License: Lucide (ISC), text in `ui/icons.LICENSE.md`.

## Accessibility

- Icon-only buttons get an accessible name (`aria-label`) in plain words ("Build", "Face north", "Close").
- Decorative icons next to a word are hidden from screen readers (`aria-hidden="true"`).
- Meaning never depends on color alone: pair the color with an icon, a shape (dashed red link) or a word.

## Characters not allowed in player-facing text

Player-facing text may contain letters, digits and plain punctuation only. These are fine:

- `. , : ; ! ? ' " ( ) / - + % &`, curly quotes and apostrophes, en and em dashes, the ellipsis
- U+00B7 MIDDLE DOT as a separator between a name and a role (the name tag "Lena", middle dot, "Port master")
- U+00D7 MULTIPLICATION SIGN in sizes ("Takes 2 x 2 tiles", with the sign in place of the x)

Everything pictorial is an icon. In particular, **never put these in text**, even if they look plain where you
are typing (listed by code point so this file stays emoji-free):

| Kind | Examples (code points) |
|---|---|
| All emoji | U+1F000 to U+1FAFF, and anything with emoji presentation |
| Check marks and crosses | U+2713, U+2714, U+2705, U+2716, U+2717, U+2718, U+274C, U+274E |
| Warning and info signs | U+26A0 WARNING SIGN, U+2757, U+2753, U+2139 INFORMATION SOURCE, U+203C, U+2049 |
| Arrows of every kind | U+2190 to U+21FF (including U+2192 RIGHTWARDS ARROW), U+27A1, U+2B05 to U+2B07, U+2934, U+2935 |
| Stars, hearts, weather, objects | U+2600 to U+26FF (for example U+2605 star, U+2600 sun, U+2693 anchor, U+2665 heart), U+2B50, U+2764 |
| Shapes and triangles | U+25A0 to U+25FF (for example U+25B6 play triangle), U+2B55 |
| Dingbats | U+2700 to U+27BF |
| Clocks and media symbols | U+2300 to U+23FF (for example U+231A watch, U+23F3 hourglass) |
| Circled letters and numbers | U+2460 to U+24FF (for example U+24C2) |
| Legal signs | U+00A9 copyright, U+00AE registered, U+2122 trade mark |
| Emoji modifiers | U+FE0F variation selector 16, U+20E3 keycap (turns "3" into a keycap emoji) |

If you need a check, a warning, an arrow between recipe tiles, a star rating or an up/down trend, draw the icon.

## The check (built)

`apps/client/src/test/no-emoji.ts` is the one place the list lives (do not copy the pattern into another test):

- `EMOJI_OR_SYMBOL`, one regular expression for every range in the table above; the allowed characters pass.
- `findEmoji(text)` returns the first finding with its code point, or null.
- `playerFacingText(element)` collects what a player sees or hears: text nodes and the attributes `alt`, `aria-label`,
  `aria-description`, `aria-placeholder`, `aria-valuetext`, `title`, `placeholder` and `value` (script, style and
  template contents skipped).
- `expectNoEmoji(stringOrElement)` throws naming the code point. Every UI test renders its screen and calls
  `expectNoEmoji(container)`; a test string that needs an emoji writes it with `\u{...}`.

Run it before calling any UI task done (`island-testing`). A screenshot check (plan 6) catches the visual side.

## Player-typed text

Text the player types is the one place emoji can enter the UI without a developer writing it.

- **Usernames** use ASCII letters, digits, "-" and "_" only, compared in lowercase but shown as typed (spec 12.3),
  so they cannot hold emoji. The server enforces it (`island-server`); the sign-up form says so in plain words
  before the player types and shows a friendly message instead of silently stripping characters.
- **Island names**: the player names their island when claiming it (spec 12.4): 2 to 24 characters of ASCII
  letters, digits, spaces, "-" and "'" (spec 12.3), so they cannot hold emoji either. The server enforces it; the
  claim field says the rule up front and explains a refusal kindly. The name shows on the world and visit
  screens.
- Rendered player text (usernames, island names) is checked by the Playwright text check too (`island-testing`).

## Mockups and docs

D22 covers mockups too. When you make an HTML mockup for the user, use SVG icons inline, never emoji or symbol
characters, and keep the same style A look so the user reviews the real thing.
