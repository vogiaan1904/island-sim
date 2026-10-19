# Layouts and input

Read this when you place anything on screen, size a control, or handle touch, mouse or keyboard input in the UI.
Camera gestures on the island itself belong to `island-3d-client`.

## Two layouts, chosen by screen shape

Spec 6.1 "Layouts". The game is played mostly on phones (D12); desktop is also supported.

| Layout | When | Cards and panels | HUD |
|---|---|---|---|
| **Narrow** | phone upright, any tall and thin screen | come up from the bottom, full width with a small margin; while a card is open it covers the bottom bar | as in SKILL.md |
| **Wide** | phone sideways, tablet, desktop | the same cards on the **right**, full height with a margin, so the island stays visible | the bottom bar centers in the space left of the card; counters move left of the card |

- Decide by **shape** (aspect ratio or orientation plus available width), with CSS media queries or a single
  shared hook. Never by device type or user agent: a sideways phone gets the wide layout, a narrow desktop window
  the narrow one.
- It is the **same component** in both layouts, only placed differently. Don't build two versions of a card.
- An open card stays open when the phone rotates; it just moves.
- **Android's back button closes the open card first** (spec 12.5), then any open panel or mode, and only then
  leaves the game. The installed app avoids Safari's swipe-back.
- The breakpoint (set in slice 1, ticket 11): **wide is aspect ratio at least 5 to 4** (`@media (min-aspect-ratio: 5/4)`, in `Hud.css` and `PanelHost.css`); everything else is narrow.
- The first draft's three-height bottom sheet (peek, half, full, drag to resize) was superseded. Don't build it by
  default.

## Safe areas

The layout respects the notch (spec 6.2). Keep every HUD element and card inside the safe area
(`env(safe-area-inset-*)` with `viewport-fit=cover`): the badge and counters below the notch or status bar, the
bottom bar above the home indicator, and side elements clear of rounded corners and a sideways notch.

## Touch targets and thumb reach

Starting rules (tune on the user's real phones, which are the speed and feel reference in spec 9):

- **Hit area at least 44 x 44 CSS px** for anything tappable, even when the drawn icon is smaller (pad the hit
  area). Keep about 8 px between neighboring targets.
- **Build is the biggest target** and sits bottom center, where the thumb rests.
- **Act at the bottom, read at the top.** Frequent actions (Build, Place, Show me, Fix, Next) live in the bottom
  part of the screen within one-thumb reach. The top holds information you look at (badge, counters). Don't put a
  frequent action in a top corner.
- Card actions sit at the card's bottom edge on narrow screens.
- Cancel and close look clearly different from the confirm action (the approved placement panel uses a round red
  Cancel and a wide green Place), with enough space between them that a slip of the thumb doesn't hit the wrong
  one. The close button on a card is small in the mockups: pad its hit area to the full 44 px.
- Nothing important needs a long press, a double-tap or a precise drag on UI controls.
- **A tap on a building opens its card at once** (spec 12.5): never wait to see whether a double-tap follows.
  Double-tap zoom works on open ground only (`island-3d-client`).
- The gear next to the compass is small to look at; its hit area is still the full 44 px.

## Text size

Browser pinch-zoom is disabled on the game (spec 6.2), so the player can't zoom to read. Starting sizes in real CSS
px: labels under buttons about 12 px at minimum, sentences on cards and in news 14 to 16 px, titles and counters
larger and bold. Check on a real phone held at arm's length.

## Touches: UI versus island

- A touch that starts on a UI element belongs to the UI. It must not pan, zoom or turn the camera behind it.
  Stop it at the UI layer (pointer events and `touch-action` on the UI elements).
- A touch that starts on the island belongs to the camera, even if the finger then passes under a HUD element.
- Keep the HUD layer itself click-through (`pointer-events: none` on the empty overlay, re-enabled on each
  control) so the island remains touchable between controls.
- Swiping on a card scrolls the card if it scrolls; it never moves the camera.

## Desktop extras

Spec 6.1: desktop adds **hover hints** and **keyboard shortcuts**.

- **Hover hints**: a short label on hover for buttons, goal icons and bubbles. They are an extra: everything a
  hint says must also be reachable by tapping, because touch has no hover.
- **Keyboard shortcuts already taken by the camera** (spec 6.1): W A S D and the arrow keys (move), Q and E
  (turn), V (watch mode, not bound yet). Do not reuse them. **Built:** Escape drops an aiming placement ghost
  (`ui/build/PlacementPanel.tsx`). Shortcuts for the bottom buttons and cards are not decided; list them here when
  they are. Goal icons carry a `title` as their hover hint.
- Visible keyboard focus on every control (a clear outline in the style A ink color).
- Mouse: pointer cursor on tappable things; scrolling over a card scrolls the card. Over the island (spec 6.1
  and 12.5), a mouse wheel or a trackpad pinch zooms and a trackpad two-finger swipe moves; that is
  `island-3d-client`'s gesture layer.
- When trackpad or mouse detection guesses wrong, the **controls** option in Settings switches it (spec 12.4),
  worded plainly ("Trackpad" / "Mouse").

## Performance on phones

The 3D island takes most of the phone's budget (spec 6.2: 60 fps target, never under 30). The UI must not eat it:

- React components read small slices of the store, so a tick does not re-render the whole HUD. The 3D side reads
  mutable buffers, not React state (spec 6.2).
- Animate with transforms and opacity only; avoid backdrop blur over the canvas. The soft lift is a small blurred
  shadow on static pieces; never animate its size.
- Counters glide with a light animation, not a re-render per frame.
