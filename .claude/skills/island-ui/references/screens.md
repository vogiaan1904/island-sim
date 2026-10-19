# Screens and pieces

Read the section for the piece you are working on. Approved pieces come from spec 6.1, spec 12 (resolved details)
and the approved mockups; pieces marked **not designed yet** have no approved mockup and need the user's look when
they are available. **Built in slice 1:** every screen except Views (6, slice 3), watch mode (8), the Add to Home Screen hint and the button sounds;
`SKILL.md`, "As built", lists the files. Where a section below still says "not designed
yet", the screen was built from style A blocks and waits for the user's look review (ticket 21).

Contents:
1. HUD
2. Bubbles over buildings
3. Coins flying to the counter
4. "While you were away" news
5. Building card
6. Views
7. Placing a building, and roads
8. Watch mode (UI side)
9. Panels: Staff, Trade, Build picker, Log, Settings
10. Other screens and states: sign-in, worlds and claiming, visiting a friend, loading, reconnecting, resting
    world, no WebGL2, Add to Home Screen, celebrations

Throughout: the approved mockups never show two cards or modes at once. Keep it that way: opening a card, a view
or placement replaces what was open before.

## 1. HUD

Spec 6.1 and 12.4, approved in 4a. Always visible during normal play, and nothing else is.

- **Stage badge**, top left. Shows the **stage name** (Outpost, Settlement, Village, Town, Modern island, then the
  late game), not a level number (the mockups' "7" is gone) and not a title for the player (there is none, 12.4).
  Around it, a ring shows progress to the next stage in two phases: first residents toward the target (for example
  10 residents in Outpost), then the landmark (materials gathered, then construction). Stages and unlocks never go
  back (12.1): once the landmark is unlocked, the ring stays in the landmark phase even if residents leave. How the
  ring marks the switch between phases is not designed yet. Tapping the badge can explain the next step in words
  and pictures ("10 residents unlock the Island Hall").
- The **island name** is not on the HUD; it shows on the world and visit screens (12.4, section 10).
- **Counters**, top right, stacked pills: coins (whole coins, section 3), then residents (everyone who lives on the
  island, children included, 12.1). **During Outpost**, also commuters (nobody lives on the island yet).
  Counters glide between ticks and never flicker. No clock, happiness or alerts up here: that was the rejected data
  top bar. The time of day shows on the island (day and night).
- **Goal icons**, left edge under the badge: the next stage target and the current needs. Goal definitions are
  content data per stage; their progress and any reward not yet collected are world state (12.1), so an
  uncollected reward is still waiting after a reload or on another device. Each is a small rounded square with an icon or picture and a thin progress bar; a new one gets a small
  "New" tag. Keep them few (the mockups show two or three). Tapping one explains it in a sentence with a picture
  and, where it makes sense, "Show me". Finishing one creates a reward bubble.
- **Compass**, a small **gear** next to it, and **Watch**, right side under the counters. The compass shows which
  way the camera faces; tapping it turns to face north. The gear opens Settings (section 9). Watch starts watch
  mode. Camera behavior is `island-3d-client`'s.
- **Bottom round buttons**, left to right: **Staff** (hire commuters and key staff), **Trade**, **Build** (big,
  center), **Views**, **Log**, each with a short label under it. The button whose panel is open shows the
  selected (yellow) state. **No tab bar.**
- **The Views button appears with the first view** (Goods flow, slice 3, spec 12.4). Before that it is not shown;
  the bar has four buttons with Build still in the center. The same idea holds for anything else: never show a
  control that opens an empty panel.
- Accessible names equal the visible labels; the compass is "Face north", the gear "Settings".

## 2. Bubbles over buildings

Spec 6.1 "In the world", 12.1 and 12.4. Research principle 2. The main way the island tells you what it needs.

| Kind | Comes from | Look in the approved mockup | Tap |
|---|---|---|---|
| Problem | the building's most important condition (12.1): the bakery needs flour, the windmill has no workers | white round bubble with a soft lift, tail pointing down at the building, the missing thing in warm red-orange (the good's picture, or a line icon for workers, power or money), a small red badge on its corner; bobs gently | opens that building's card |
| Wish | an unmet need (12.1): homes want a park | thought bubble (a trail of small circles instead of a tail), white with a soft lift, the wished thing in green; calm, no bob | opens the card of the homes, which explains the wish |
| Reward | a finished goal (12.1) | yellow round bubble with a tail, gift icon, a small sparkle; bobs gently | sends the "collect" command; on accept, coins fly to the counter |

- Every bubble floats above its building and carries the soft lift like everything else in style A. The
  colors follow the final palette once slice 1 sets it.
- **One problem bubble per building**: it shows the same single condition as the card's status (the priority list
  is in section 5).
- **Zoomed out to the whole island**, bubbles shrink to small dots and only problems remain (12.4). Wishes and
  rewards come back when you zoom in.
- Bubbles hold a picture, not sentences. The words live on the card.
- Problems are gentle and repairable (spec 2.3); a problem bubble never looks like an alarm.
- Bubbles, flying coins and placement labels are 2D elements. In the `island-3d-client` draft, the 3D side gives
  them world anchors projected to the screen each frame and says when an anchor is off screen or behind the
  camera; hide the bubble then.
- What counts as a problem, wish or reward comes from `sim` (`island-game-logic`), not from UI logic.

## 3. Coins flying to the counter

When the player collects a reward, a few coins fly from it to the coin counter in an arc, the counter pops
slightly and glides up, with a soft sound. Ordinary income only glides the counter. With reduced motion, the
counter just updates with a short fade.

**Money is shown as whole coins; the sim keeps cents** (12.4, spec 4.5). So coins = cents / 100. Suggested:
round down, so the counter never shows money the player doesn't have. Use one shared number formatter with a
fixed locale (the mockups use "12,480"), not the device's locale, so every player and every screenshot check
sees the same text.

## 4. "While you were away" news

Spec 6.1 "News", 12.3 and 12.4, D23. Replaced the rejected plain "Log card" with time away and money change.

- On return, a **key staff member** (in slice 1, the port master) appears above the bottom bar: a round
  **portrait** on the left (rendered in Blender from the Mini Characters, 12.4), a **name tag** (name and role,
  for example Lena and "Port master" separated by a middle dot), and a speech panel with one short sentence.
- It shows **the most important events since the player's last visit, grouped, at most five** (12.4). "Since the
  last visit" is the server's per-player "last seen event" marker (12.3). Grouping means one item per kind of
  thing: "We sold 400 fish while you were away" is one item, not 40. **Each event type has an importance in
  content data; the client picks the top five by it** (12.4). Don't hardcode an importance order in the UI.
- **One item at a time.** Buttons: **Show me** (green, eye icon; the camera glides there, `island-3d-client`),
  **Next**, and a small "1 / 5" style counter. After the last item the panel closes. Everything stays available
  later in the Log (section 9).
- Tone: the staff member speaks for the island in first person plural, warm and short. Good news first is fine,
  but never hide a problem; pair it with Show me. Nothing is ever ruined (spec 2.3).
- No story framing (spec non-goals): no letters, narrator or lore, and no title for the player.

## 5. Building card

Spec 6.1 "Building card", 12.1 and 12.4. A tap on a building opens its card at once (12.5), as does a tap on its
bubble. Narrow: from the bottom. Wide: on the right.

Top to bottom, as in the approved mockup:

1. **Header**: the building's **picture** (rendered from its 3D model), its **name**, **level stars** (from slice
   2, see below), and **one status in words** as a chip with an icon ("Waiting for flour"). Close button on the
   corner.
2. **What it makes**, as pictures: input goods tiles, an arrow icon, output goods tiles, each with a small count
   badge. No rows of figures.
3. **Workers**: little heads, filled for each worker and dashed for each open slot. They are counts drawn as
   pictures, not people you can tap.
4. **Problem**: if there is one, a hint box with a picture of the **cause** and one sentence ("The windmill has no
   workers.") and a **Fix** button. Show the root cause, which may be another building, not just the symptom.
5. **Actions**: **Upgrade** with its coin cost (from slice 2), and a **manager slot** (a dashed circle labeled
   "Manager"; filled with the key staff member's portrait when one is assigned).

**Status: the most important condition only.** A building keeps a set of conditions; the card and the bubble show
the first one in this order (spec 4.2 and 12.1):

| Priority | Condition | Words on the card (illustrative except where quoted from the spec) |
|---|---|---|
| 1 | under construction | Being built |
| 2 | damaged | Damaged, needs repair |
| 3 | waiting for money | "Waiting for money" (spec wording) |
| 4 | no workers | No workers |
| 5 | understaffed (some workers missing, runs slower) | Needs 2 more workers |
| 6 | missing input | Waiting for flour (name the missing good) |
| 7 | no power (from Town, for workshops, factories and apartments) | No power |
| 8 | output full | Storage is full |
| 9 | running | Working |

A damaged building also looks broken on the island (smoke, missing planks; 3D side, 12.5).

**Fix** (12.4): when there is one action that fixes it, the button does it, as a command to the server. The
actions are: **raise this building's priority** (so the labor pass sends it workers first), **hire commuters**,
and **repair**. Otherwise it moves the camera to the cause (`island-3d-client`), for example to the windmill that
has no workers. Which action fixes which condition is a game rule (`island-game-logic`). Say what Fix will do in
the hint sentence or a hover hint, so the tap is never a surprise.

**Levels and Upgrade** (12.1): workplaces and services have levels 1 to 3, shown as the stars; an upgrade adds
jobs, storage or output. **Homes never level up** (better homes are different house types), so a home's card has
no stars and no Upgrade. **Levels arrive in slice 2**: the slice 1 card shows neither stars nor Upgrade. The
Settlement's "bigger market" is market level 2, so it is an Upgrade on the market's card, not a new building in
the Build picker. A higher level also shows on the island itself (for example an extra floor or a side building;
the exact look comes from the art-direction task, 3D side), so the stars are never the only sign of a level.

**Paying up front** (12.1): an upgrade costs its price up front. If the player can't afford it, Upgrade is disabled
and says "Need N more coins"; nothing is queued. Running costs never push money below zero: a building that can't
be paid slows down and shows "waiting for money".

**Manager slot** (spec 2.4): each key staff member is assigned to one building and adds rule slots and bonuses
there; some roles cover the whole island (the port master handles all trade). Rules are templates, so show them as
one plain sentence with the staff portrait (illustrative: "Lena sells fish above 200"), never as a form or a
script. Slice 1 has only the port master's auto-sell rule; the automation rule system (more templates and
slots) arrives in slice 2. Where rule slots appear (this card or the Staff panel) is not designed yet.

**Landmark card** (12.1; layout not designed): its material list as goods tiles with "have / need" counts.
Materials come from storage and are carried to the site; missing ones can be bought from the Mainland with **a
button on the landmark's card** (a player command), showing the coin cost and "Need N more coins" when short.
Bought materials **arrive on the next ferry** and are then carried to the site (12.1), so after buying, the card
says so in words ("Coming on the next ferry") instead of counting them as delivered at once.

No tabs inside the card. If it doesn't fit, it's too much for one card.

## 6. Views

Spec 6.1 "Views", 12.4, research principle 6. Lenses that recolor the island by topic.

- The **Views button appears with the first view**: Goods flow, in slice 3 (Village). Workers, Happiness and
  Traffic come later; their exact coloring is not designed yet.
- Tap **Views** (it turns yellow): a small panel above the bottom bar with the available options as round buttons:
  **Goods flow** (route icon), **Workers** (people icon), **Happiness** (smile icon), **Traffic** (car icon).
- Choosing one: the island fades slightly (3D side), a yellow **ribbon** at the top center shows the view's icon
  and name with a small close X, and a small **legend** sits in the panel.
- **Goods flow** (from direction C): moving colored lines per good from building to building, broken links marked
  red and dashed. The lines are drawn by `island-3d-client`; the UI owns the picker, ribbon and legend (good
  picture + its line color + the "stopped" style). **Each good carries its color in content data** (12.4); the
  legend reads it from there, never from a UI table. Tapping a line or bubble opens that building.

## 7. Placing a building, and roads

Spec 6.1 "Placing a building", 12.1 and 12.4. The most frequent action, so it must feel best (principle 5).

- Pick a building in **Build**. The bottom bar is replaced by the **placement panel**: building picture, name,
  coin cost pill, one sentence on what it does and its size ("Sells food and goods to the homes around it. Takes
  2 x 2 tiles."), and three controls: round **Rotate**, round red **Cancel** (X icon), green **Place** (check icon
  and word).
- A dark **hint pill** near the top says "Drag to move".
- The see-through ghost snaps to the grid just above the finger so the finger never hides the spot (3D:
  `island-3d-client`). On it, **labels** say what's right or wrong: green "Road access", red "Too close to the
  farm". The road label has three forms: "Road access" (already joined to the dock), "Road to the dock: N tiles" (it
  lays a connector, spec 12.1, whose tiles are in the price) and red "No road can reach the dock".
- The road panel has a **Remove road** toggle (eraser icon) beside Look around: while it is on, the drag picks up only
  road tiles, the card says "Remove road" and "Removing road is free", the button says Remove, and a refusal says
  "A building would lose its road to the dock". Labels are short words, one idea each. The ghost's valid and invalid tints use the same green and red as
  the labels, from the shared tokens, so 2D and 3D agree.
- The labels come from the same `sim` rules the server uses. The UI only displays the reasons; it never
  re-implements a rule. Place is not available while a rule blocks the spot (`sim` decides which reasons block).
- **Price up front** (12.1): if the player can't afford the building, Place is disabled and says **"Need N more
  coins"**. Nothing is queued.
- On Place, the command goes to the server and the ghost shows a short **"placing" state** (12.4). **The landing
  bounce, the puff of dust and the sound play when the server accepts the build.** If the server refuses (rare,
  since the preview uses the same rules), go back to the ghost and say why in plain words.
- **Roads**: drag along the grid, see the cost, confirm. Same panel style and labels. **Roads are paid per tile
  when placed** (12.1): the cost grows as you drag, and if it is more than you have, confirm is disabled with
  "Need N more coins".

## 8. Watch mode (UI side)

Spec 6.1 "Watch mode", 12.5. The camera drift and the choice of moments (event log plus morning and evening
ferries and rush hour) are `island-3d-client`'s.

- Tap **Watch** (or press V on desktop): the whole UI fades out.
- A **one-line caption** at the bottom says what you are seeing, in plain words ("The morning ferry brings six
  newcomers."). The mockup also showed a small "Watching" marker top left and a way out top right; keep any such
  marker tiny.
- Touch anywhere (any input on desktop) to stop: the UI fades back in.

## 9. Panels: Staff, Trade, Build picker, Log, Settings

What each panel holds is settled; none has an approved mockup yet. Build them from the style A blocks, and when
the user is available show a mockup first. These are the screens most likely to slide into a table or a menu, so
keep the game-not-dashboard rule in mind.

- **Staff**: hire commuters and key staff. Commuters are laborers from the Mainland who need wages and a ferry
  seat (12.1); hiring is limited by ferry seats, which newcomers share and board first. Key staff come from a
  rotating candidate pool, each with a portrait, name, role and trait (spec example: "Port master Lena, Shrewd:
  +10% export prices"). Two clear choices with pictures, not tabs.
- **Trade**: sell to and buy from the Mainland (always there, so solo play never needs friends), and from Village
  on, send goods to a friend's island by ship. Goods as picture tiles with a price badge; any trend as an icon,
  not a chart. **Every sale to the Mainland, manual or automatic, stops at a floor price per good** (12.1); when a
  sale is limited by it, say so in plain words instead of failing silently.
- **Build picker**: buildings as their rendered pictures with name and cost; locked ones show what unlocks them in
  words; unaffordable ones show "Need N more coins". Picking one starts placement (section 7).
- **Log** (12.4): the history of news and events, newest first, each item a picture, one sentence and **Show
  me**. It is where everything from the news stays available. Friendly items, never a table.
- **Settings** (12.4), from the gear next to the compass:
  - **sound**: the one mute control (spec 6.2)
  - **quality**: Low / Medium / High, picked automatically and changeable (spec 6.2)
  - **controls**: trackpad or mouse, for when detection guesses wrong (12.5)
  - **account**: the username and **change password**
  - **log out**: ends only this device's session (spec 5.4)

  Plain words, big toggles and choices, no nested menus. Forgotten passwords stay an admin command (spec 5.4);
  Settings only changes a password the player knows.

## 10. Other screens and states

- **Sign-in** (slice 1, spec 5.4, 12.3): sign up with an invite code, log in. **Usernames use ASCII letters,
  digits, "-" and "_" only, compared in lowercase but shown as typed** (so "Lena" and "lena" are the same
  account, and it displays as "Lena" if that is how it was registered); say so next to the field in plain words,
  before the player types. **Registering with a world's code also claims an island in
  that world**, so sign-up also asks for the island's name. Errors are kind and specific ("That invite code
  doesn't work. Check it with your friend."). Not designed yet.
- **Worlds and claiming** (slice 1, spec 8.1, 12.3, 12.4): create a world, share its invite code, claim an island
  (a sim command; the world state decides who owns which island). **Creating a world also claims an island in it
  for its creator**, so the create-world flow asks for the island's name too. **The player names their island when claiming
  it: 2 to 24 characters of ASCII letters, digits, spaces, "-" and "'"** (12.3). The island names show on the
  world screen. The world's creator can regenerate the invite code there. One account can be in several worlds,
  one island per world, so the world screen also lets the player pick a world. Not designed yet.
- **Visiting a friend's island** (spec 2.5, 12.3, 12.5): the camera makes a short flight with a fade (3D side).
  Visitors see the same island, read-only, and **the UI hides owner controls** (Build, Staff, Trade actions, Fix,
  Upgrade, manager slots, collecting rewards). Show **the island's name** and whose it is, and give an easy way
  home. Not designed yet.
- **Loading**: the first load, a later stage's models loading in the background, and visiting a friend who is at a
  later stage (their stage's models load first). Calm, in style A, with the island or a simple picture, never a
  bare spinner on a blank page. Not designed yet.
- **Reconnecting** (spec 5.3): on phones the connection closes in the background and the client reconnects with a
  fresh full state. Show a small, calm reconnecting state, never an error wall.
- **Resting world** (12.3): when a world pauses after an error, its players see **"This island is resting, back
  soon"**. Use exactly that line, calm, with no technical detail.
- **No WebGL2**: what to show on a device without WebGL2 is not in the spec; the message is ours, decided in
  slice 1 with `island-3d-client`. One friendly sentence, no technical terms.
- **Add to Home Screen** hint on iPhone (spec 6.2): friendly, dismissible, not repeated on every visit.
- **Stage celebration** (spec 2.1): small and happy. Badge pop with the new stage name, short sparkle, a line from
  a key staff member. Not a full-screen interruption that blocks play for long.
