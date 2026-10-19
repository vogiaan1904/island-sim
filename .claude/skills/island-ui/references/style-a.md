# Style A "Cozy and bright": visual language

Read this when you style anything: colors, shapes, buttons, cards, motion, sound.

Contents: what it should feel like / shapes and surfaces / mockup palette / type / building blocks / motion /
sound / tokens.

## What it should feel like

Chosen by the user on 2026-10-15 (D23) from three mockups: A cozy and bright (Township, Hay Day, SimCity BuildIt),
B calm diorama (Islanders, Townscaper), C busy and detailed (Anno). The comparison described A as "the most game
feeling and the easiest to learn", with one warning: **it can get busy, and it needs care so it doesn't look like
a pay-to-win mobile game.** So:

- Friendly and toy-like, but calm. The island is the star; the UI is a light frame around it.
- No pay-to-win tropes: no flashing offers, countdown pressure, piles of red notification dots, or "Hurry!" copy.
- From C, only the Goods flow view was taken. Not C's slim dark HUD, top data bar or dense production chain card.

## Shapes and surfaces

- **Round and rounded.** Bottom buttons are circles; counters are pills; cards and panels have large corner radii;
  picture tiles have medium radii.
- **No dark outline** (decision 30, 2026-10-19, which replaced the approved mockups' thick ink outlines after the
  first phone playtest: they looked heavy over the soft 3D island). Buttons, pills, cards, panels and bubbles have
  none; a `button` has no border unless its own rule gives it an edge.
- **Soft lift**: a soft blurred shadow (`--lift`; `--lift-pressed` while pressed, with a small move down) lifts a
  piece off the island and keeps it pressable-looking.
- **Light edge** (`--edge`) only where a boundary carries use: text fields, switches and rows inside a panel. A state
  that is told by a border color (a goal that needs something, a waiting chip, an empty slot) keeps a transparent
  border that the state colors.
- **Surfaces** are white or warm cream; color comes from accents, icons and the island itself.
- Text on top of the island (labels under bottom buttons) is white with a soft dark text shadow so it reads on any
  terrain.

## Mockup palette (starting point, not final)

These values come from the approved mockup (`a-merged.html`), and `styles/tokens.css` carries them (the solid teal
`#0f8577`, the Build gradient ends and the muted `#4b5a63`; the second muted gray is not a token). The user's look
review (ticket 21) may still change them. Use them through the tokens, never as one-off hex values in components.

| Role | Mockup value | Used for |
|---|---|---|
| Ink (dark text) | `#24323b` | text, icon color on white |
| Surface | `#ffffff` | buttons, pills, bubbles |
| Card surface | `#fffdf7` (cream) | building card, placement panel |
| Muted text | `#6b7780`, `#4b5a63` | small labels, descriptions, "1 / 3" |
| Teal (stage, staff) | `#63d8c8` to `#0f8577` gradient; `#0f8577` solid | stage badge disc, key staff name tag |
| Yellow (selected, progress, Build) | `#ffd54a`; Build gradient `#ffe27a` to `#f5b52a` | "on" state, active view ribbon, progress ring, Build button |
| Green (go) | `#3cc46b` | Place, Show me, progress bars in goal icons |
| Red (close, cancel, new) | `#ff5a5f` | card close button, Cancel in placement, "New" tag |
| Waiting status | background `#fff1dc`, border `#f59e0b`, text `#9a3412` | status chip such as "Waiting for flour" |
| Problem hint | background `#fff4f2`, border `#ff8a80` | the "cause + Fix" box on a card |
| Tile backgrounds | `#fff3d1` (goods), `#dff3fb` (building picture) | recipe tiles, card picture frame |
| Stars | fill `#ffc83d`, empty `#e2e8ec` | level stars |

Never rely on color alone: every status also has an icon and words, and broken links in Goods flow are dashed as
well as red.

## Type

- One rounded, friendly sans-serif. The mockups used **Fredoka** (weights 500, 600, 700). **Built:** the system
  rounded stack (`--font`: `ui-rounded`, `SF Pro Rounded`, `Nunito`, `Segoe UI`, `system-ui`), so no font file is
  loaded; whether to self-host Fredoka is part of the look review (ticket 21).
- Bold (700) for titles and counters, semi-bold (600) for buttons and labels, medium (500) for sentences.
- If a web font is added, self-host it: the game is meant to work from its cache as a PWA (plan 6), so no font CDN at
  runtime.
- Sizes: see `layout-and-input.md` (text must be readable without zoom).

## Building blocks

All seen in the approved mockups. Sizes in the mockups were drawn on a 260 px wide phone; scale them up for real
screens and keep the touch-target rules.

| Block | Look | Where |
|---|---|---|
| Round button with label | white circle, soft lift, line icon inside, white label below | bottom bar, compass, Watch |
| Small round button | the same, smaller, no label (hit area still 44 px) | the gear (Settings) next to the compass |
| Build button | the biggest circle, yellow gradient, larger icon | bottom center |
| Selected state | yellow fill (`#ffd54a`) | the bottom button whose panel is open, the active view |
| Go button | green, white bold text with icon, rounded rectangle | Place, Show me |
| Plain pill button | white, soft lift | Next, secondary actions |
| Round cancel | red circle with an X icon | Cancel in placement |
| Close button | small red circle with an X icon, overlapping the card's top-right corner | cards |
| Counter pill | white pill, icon on the left, bold number | coins, residents, commuters |
| Stage badge | teal disc inside a progress ring (dark track, yellow fill), with the stage name in a small label beside or under it (the mockup put the island name there; that moved to the world and visit screens) | top left |
| Goal icon | white rounded square, colored line icon or picture, thin progress bar along the bottom, optional red "New" tag | left edge |
| Picture tile | rounded square with a tinted background, picture inside, small count badge at the corner | recipe on cards |
| Status chip | small pill with icon and a few words, tinted by meaning | one status on a card |
| Disabled button | the same shape with a muted fill and no shadow, still readable, the reason in words on or under it ("Need N more coins") | Place, Upgrade, Build picker items the player can't afford |
| Hint box | soft red tinted box: small picture of the cause, one sentence, Fix button | problem on a card |
| Name tag | small teal label with the staff member's name and role | news, Staff |
| Portrait | circle with a white ring; the picture is rendered in Blender from the Mini Characters with accessories (spec 12.4) | key staff in news, Staff, manager slots |
| Empty slot | dashed outline circle | open worker slot, empty manager slot |
| Hint pill | dark translucent pill with white text and an icon, centered near the top | "Drag to move" during placement |
| Ribbon | yellow label with the view's icon and name and a small close X | active view, top center |
| Bubble | white circle with a soft lift and a tail (or a thought-bubble trail for wishes), one picture inside | over buildings; kinds in `screens.md` |
| Speech panel | white rounded panel with the portrait overlapping its left edge and the name tag on top | news from key staff |

## Motion

Small, soft, quick to finish. Starting values (tune on the user's real phones):

- **Touch feedback**: on press, the button squashes slightly toward its shadow; on release it bounces back
  (about 150 to 250 ms). Every tappable element gets this.
- **Sparkle**: the spec asks for "a small bounce or sparkle on touch". Give every tap the bounce, and add a few
  small sparkles where something good happened (a reward, a finished goal, a successful placement), so sparkles
  keep meaning something.
- **Bubbles** for problems and rewards bob gently (the mockup: 2 px up and down over about 1.6 s, ease-in-out);
  wish bubbles stay still.
- **Coins fly** from what you collected to the coin counter, then the counter glides up. Save flying coins for
  moments the player caused (collecting a reward); ordinary income just glides the counter.
- **Counters glide** between ticks instead of jumping (spec 6.2).
- **Cards** slide up from the bottom (narrow) or in from the right (wide) and settle with a slight overshoot.
- **Placement**: after Place, the ghost shows a short "placing" state (the Place button can show a small busy
  state too). When the server accepts, the building lands with a bounce and a puff of dust (drawn in 3D by
  `island-3d-client`) and the UI plays the sound and closes the panel (spec 12.4).
- **Stage change** is a small celebration: the badge pops and shows the new stage name, a short sparkle, the key
  staff member says a line.
- **Watch mode**: the UI fades out softly and back in when the player touches.
- **Never**: screen shake, flashing, strobing, fast infinite loops on idle UI, bouncing that delays the next tap.
- **Reduced motion**: when the system asks for reduced motion (`prefers-reduced-motion`), replace bounces, bobbing
  and flying coins with simple fades. The game must stay fully usable.

## Sound

Spec 6.2 and 12.5: the island ambience that follows the camera belongs to `island-3d-client`; **button and UI
sounds belong to this skill**. Every press, placement and collection gets a soft, short sound; nothing harsh or
alarm-like. The one mute control is the sound option in Settings (the gear next to the compass, spec 12.4), and
every UI sound respects it.

## Tokens

Keep every color, radius, outline width, shadow, font and duration in one shared set of design tokens so a palette
decision changes one file. **As built:** `apps/client/src/styles/tokens.css` (CSS custom properties; the list is in
`SKILL.md`, "As built") and `styles/global.css`; each component's CSS sits beside it.