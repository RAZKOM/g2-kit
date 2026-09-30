# ROADMAP

Prioritised work after 0.1.1. Each item says how to verify it. Hardware items need the user's G2 glasses;
prepare the example, then ask the user to run it (`npm run dev:<name>` + `npx evenhub qr --port <port>`).

## 1. Hardware verification (open questions)

| # | Question | How |
|---|---|---|
| H1 | ~~Image send speed: can `gapMs` drop below 100 ms without frames getting stuck?~~ | **Answered 2026-09-30** (STATUS.md): sends take ~300–370 ms (dense tiles ~450 ms), gap 0 left no frame stuck on simple tiles, 0 failures. Follow-ups: H1b, F4. |
| H1b | ~~What drives the ~350 ms send?~~ | **Answered 2026-09-30** (STATUS.md): ~200 ms fixed per send, plus time for picture detail (edges, texture); bytes and format barely matter; the outline chart sends ~10 % slower than the filled one. Follow-up: H1c. |
| H1c | Can the outline surface be cheap to send? | **Ready to run:** `npm run dev:bench`, sweep "surface": bar chart and progress bar, each filled, outline, and outline with plain frames (`surfaceTexture: false`). If plain frames send like filled, make them the outline default. |
| H1d | Is a firmware text update faster than an image send? | **Ready to run:** `npm run dev:bench`, sweep "text": the same progress as an image tile vs as firmware text (`textContainerUpgrade`). Decides F12. |
| H2 | Do images larger than 288×144 work on hardware? (Glyph uses 576×72, 144×288, 426×288 tiles; the SDK types say 20–288 × 20–144; the simulator doesn't enforce limits.) | Add a hub-lens step that builds an oversized image page with `PageBuilder.build({ allowOversize })` (new escape hatch, off by default) and records what shows. If hardware accepts them, open up new tile layouts. |
| H3 | Swipe throughput: does every fast swipe arrive while tiles are sending? | `hub-picker` carousel; count events vs swipes (add a counter to the phone page). |
| H4 | Long-press timing: delay from touch to `hold`; is `HoldToConfirm` progress smooth? | New widget from F3 in `hub-picker`; log timestamps on the phone page. |
| H5 | Phone render time per tile (target < 10 ms). | Example pages already show the median; collect numbers. |
| H6 | ~~Raw `gray4` / `gray8` image formats on hardware~~ | **Answered 2026-09-30:** png, png4, gray8 and gray4 all display correctly; none sends faster. Keep `png`. |
| H7 | One-lens-after-rebuild issue (STATUS.md): if it recurs, run hub-lens S9/S10 before restarting the glasses. | User reports; update STATUS.md. |

## 2. Features

| # | Feature | Notes |
|---|---|---|
| F1 | ~~**Ink metric**~~ | Done: `inkRatio`, `INK_BUDGET`; gallery, bench and a budget test with listed exceptions. |
| F2 | ~~**Outline surface option**~~ | Done: `theme.surface: 'outline'` / `outlineTheme`, `drawBlock`; 13 samples, 30 % → 14 % ink; "Filled vs outline" in the gallery. Not yet looked at on glasses. |
| F3 | ~~**`promptText(g2, opts)`**~~ | Done: `promptText` + `g2.modal`; hub-picker's keys screen uses it (simulator-checked). |
| F4 | **Send pacing from H1** | Default `gapMs` lowered 100 → 25 ms (done). Next: send round-trip stats in `ImageQueue` (last / median ms) so apps can see their frame budget. |
| F5 | **View stack within one layout** | `g2.views`: push/pop named views that share a layout (no rebuilds), each with its own mounts and gesture handler. The dashboard example is the pattern to generalise. |
| F6 | **Throttled animation helper** | `g2.animate(fn, { maxFps })` that schedules frames within the send budget (spinner, ticker, hold ring, countdown). |
| F7 | **Contrast lint (debug)** | Opt-in check in `drawText`: warn when the glyph level minus the level underneath is below a threshold. For app-drawn screens. |
| F8 | **Layout helpers** | `row` / `column` with fixed + flexible children returning rects (today there are `splitColumns` / `splitRows` / `cut`). |
| F9 | **HoldToConfirm visual** | `HoldRing` widget (progress ring + label) wired to `HoldToConfirm`. |
| F10 | **API reference** | Generated reference (e.g. TypeDoc) published with the demo site. |
| F12 | **Text-only components** | Firmware text updates cost no image send, and may be much faster (H1d measures it). Components that only need characters could render to a text container instead of a tile: spinner (rotating `/ - \` characters), progress / loading bar (`[#####-----] 50%`), slider and value readouts, ticker, toast, status line. A `TextComponent` contract (props → string, ≤ 999 bytes) plus `g2.drawText(container, …)` that skips unchanged strings, like `Surface` does for tiles. Trade-offs: firmware font only (no levels, no shapes), and the text container is also the input capture, so layout and scrolling need care. |
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
