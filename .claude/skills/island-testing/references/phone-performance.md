# Real-phone performance checklist

Headless browsers render WebGL in software. They cannot measure a phone's GPU, heat or battery, so speed is checked
on the user's real phones with this checklist (spec 9). **You cannot run it yourself.** Ask the user, record what they
report, and never claim phone performance from a desktop or headless run. What you can check automatically is the
draw-call count at the fixed camera spots (`client-tests.md`).

Contents: targets - when to ask - setup - the route - pass and fail - recording results.

## Targets (spec 6.2; owned by `island-3d-client`)

- 60 fps on a mid-range phone from about 3 years ago; never below 30.
- Watch mode runs at 30 fps.
- Under about 150 draw calls; pixel ratio capped at 2.
- Low, Medium and High quality picked automatically, and changeable.
- Nothing rendered while the app is in the background.
- Full characters only at street zoom, about 200 on screen at most.

## When to ask for a run

- Before a slice is called done.
- After changes likely to cost frame time: a new model type, crowd, vehicle or ship changes, the water or foam
  shader, shadows, day and night lighting, the quality-level logic, more people on screen.
- When the automated draw-call count moves noticeably.

When you ask, list exactly what changed and which steps of the route matter most, and say in your report that the
check is pending until the user answers.

## Setup

- **Phones:** the user's own. Record model, release year, OS version, browser, and whether the game ran from the home
  screen (installed) or a browser tab. If none of the phones is roughly "mid-range from about 3 years ago", say that
  the target class was not tested: a recent flagship at 60 fps proves little.
- **Readout:** a debug overlay showing fps, frame time, draw calls, triangles, quality level and people on screen
  (planned; to be decided in slice 1 with `island-3d-client`). Without it: Safari Web Inspector on a Mac for an
  iPhone, or Chrome remote debugging (`chrome://inspect`) for Android.
- **Same island every time:** a test world at a known state (for example the Settlement checkpoint of the golden
  scenario), so runs can be compared. How to load it on a phone is to be decided in slice 1.
- **Same conditions:** phone at room temperature, battery above 50% and not charging (charging adds heat), low-power
  mode off, brightness fixed.

## The route (about 15 minutes)

1. Open the game; note the time to the first frame.
2. Whole-island view by day: fps and draw calls.
3. Pinch to neighborhood zoom, then to street level at the busiest spot (the dock at the morning ferry, rush hour):
   fps and people on screen.
4. At street level, twist a full 360 and tilt from straight down to near eye level. Note the lowest fps seen.
5. Pinch in and out quickly for 10 seconds: any stutter, any drop below 30?
6. Build: drag the ghost around, place a building (a short "placing" state, then the bounce and dust once the
   server accepts), drag a road and confirm.
7. Open a building card, the news and the Log (from slice 3 on, also a view such as Goods flow).
8. Wait for night (or load a night state): lit windows and street lights; fps.
9. Watch mode for 5 minutes: fps holds at about 30, the screen stays awake, a touch stops it.
10. In Settings (the gear next to the compass), switch Low, Medium, High: which one was picked automatically, and
    fps on each.
11. Send the app to the background for a minute and return: it reconnects, shows the full island, the 3D view still
    draws (iOS may have dropped the context), no error.
12. Back at the step 2 view: fps again (a drop since step 2 means the phone is throttling from heat). Heat by hand
    (cool, warm, hot) and battery percent used since the start.

Once per phone, also check: no browser pinch-zoom or pull-to-refresh on the game; the installed app avoids Safari's
swipe-back; on Android the back button closes an open card first; the layout respects the notch in both
orientations; "Add to Home Screen" works and the installed app opens full screen.

## Pass and fail

- **Fail:** fps below 30 for more than a moment, anywhere on the route; watch mode clearly above or below 30;
  draw calls over about 150; anything rendering in the background; the 3D view not coming back after step 11.
- **Target miss (record and fix, not a floor failure):** below 60 fps on a mid-range phone from about 3 years ago.
  Fixes belong to `island-3d-client` (and `island-blender` for heavy models).
- **Heat and battery:** the spec sets no numbers. Record them every run so trends show, and propose thresholds to the
  user after the first few measurements (to be decided).

## Recording results

Where results live is to be decided in slice 1 (for example one dated file per run under `docs/`). Template:

```
Date / build (commit) / test island state
Phone: model, year, OS, browser, installed or tab
Quality picked automatically:
Step 2 whole island: fps, draw calls
Step 3 street level busiest: fps, people on screen
Step 4 lowest fps during twist and tilt:
Step 5 stutter or drops:
Step 9 watch mode fps; screen stayed awake:
Step 10 fps on Low / Medium / High:
Step 11 background and return: ok or problem
Step 12 fps again; heat; battery used:
Once-per-phone checks:
Verdict: pass / fail / target miss, with notes
```
