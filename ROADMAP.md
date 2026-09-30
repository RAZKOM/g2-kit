# ROADMAP

Prioritised work after 0.1.1. Each item says how to verify it. Hardware items need the user's G2 glasses;
prepare the example, then ask the user to run it (`npm run dev:<name>` + `npx evenhub qr --port <port>`).

## 1. Hardware verification (open questions)

| # | Question | How |
|---|---|---|
| H1 | Image send speed after Even App v2.3.2 ("2× faster image updates"): can `gapMs` drop below 100 ms without frames getting stuck? | New example `hub-bench`: sends N frames at several `gapMs` values, shows measured `updateImageRawData` round-trip and frames/s on the phone page; user reports numbers. Then consider `gapMs: 'auto'` (see F4). |
| H2 | Do images larger than 288×144 work on hardware? (Glyph uses 576×72, 144×288, 426×288 tiles; the SDK types say 20–288 × 20–144; the simulator doesn't enforce limits.) | Add a hub-lens step that builds an oversized image page with `PageBuilder.build({ allowOversize })` (new escape hatch, off by default) and records what shows. If hardware accepts them, open up new tile layouts. |
| H3 | Swipe throughput: does every fast swipe arrive while tiles are sending? | `hub-picker` carousel; count events vs swipes (add a counter to the phone page). |
| H4 | Long-press timing: delay from touch to `hold`; is `HoldToConfirm` progress smooth? | New widget from F3 in `hub-picker`; log timestamps on the phone page. |
| H5 | Phone render time per tile (target < 10 ms). | Example pages already show the median; collect numbers. |
| H6 | Raw `gray4` / `gray8` image formats on hardware (skip PNG encoding). | hub-lens step sending the same tile in each `format`. |
| H7 | One-lens-after-rebuild issue (STATUS.md): if it recurs, run hub-lens S9/S10 before restarting the glasses. | User reports; update STATUS.md. |

## 2. Features

| # | Feature | Notes |
|---|---|---|
| F1 | **Ink metric** | `inkRatio(fb)` = fraction of lit pixels (each lit pixel hides the world). Show it per sample in the gallery and bench; test that flags samples above a budget (e.g. 25 %). Idea from Glyph (outline styling halved their ink). |
| F2 | **Outline surface option** | `theme.surface: 'filled' | 'outline'`: bars, buttons, toggles use outlines/hatch instead of solid fills. Compare ink in the gallery. |
| F3 | **`promptText(g2, opts)`** | One-call text entry: rebuilds to `layouts.textWithTile`, runs `GridKeyboardState`, updates the text line via `setText`, resolves `string` on OK / `null` on cancel, then the caller re-shows its page. Needs `g2.modal(handler)`: while set, gestures go only to the modal (unconsumed events fall through, so double-tap still exits). Replace the picker's keys screen with it. |
| F4 | **Adaptive send pacing** | Measure send round-trip in `ImageQueue` (stats: last/median ms); `gapMs: 'auto'` once H1 says what is safe. |
| F5 | **View stack within one layout** | `g2.views`: push/pop named views that share a layout (no rebuilds), each with its own mounts and gesture handler. The dashboard example is the pattern to generalise. |
| F6 | **Throttled animation helper** | `g2.animate(fn, { maxFps })` that schedules frames within the send budget (spinner, ticker, hold ring, countdown). |
| F7 | **Contrast lint (debug)** | Opt-in check in `drawText`: warn when the glyph level minus the level underneath is below a threshold. For app-drawn screens. |
| F8 | **Layout helpers** | `row` / `column` with fixed + flexible children returning rects (today there are `splitColumns` / `splitRows` / `cut`). |
| F9 | **HoldToConfirm visual** | `HoldRing` widget (progress ring + label) wired to `HoldToConfirm`. |
| F10 | **API reference** | Generated reference (e.g. TypeDoc) published with the demo site. |
| F11 | **Simulator in CI** | Run `sim:check` headless on Linux (xvfb) in CI for the examples; fail on console errors. |

## 3. New components

Remaining P2 items from the original catalogue, plus ideas:

| Group | Components |
|---|---|
| Charts | Gantt strip · polar / radar (3–6 axes) · two-column sankey / flow bars · step chart (line with steps) |
| Controls | Radial / pie menu (4–8 wedges) · grid picker (4×4, snake-order focus) · stepper with confirm (multi-step form) · emoji/scale rating · number pad |
| Data faces | Mini-map (route polyline + position marker) · stopwatch / lap list · teleprompter page (big text + progress) · heart-rate zone bands · attitude indicator · wind indicator · speed-limit sign |
| Game kit | Playing cards (rank + suit at small size) · clicker "big button" with press feedback · sprite animation helper (frames + flip) |
| Chrome | Notification stack · breadcrumb / page title bar · empty state |

For each: gallery sample, recommended size in DESIGN.md, README table entry, CHANGELOG line.

## 4. Housekeeping

- Keep README table, `npm run docs:images` output (incl. `showcase.png`) and CHANGELOG in sync with components.
- Report the one-lens issue to Even Realities (Discord #dev-chat) with `hub-lens`; record replies in STATUS.md.
