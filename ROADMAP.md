# ROADMAP

Prioritised work after 0.3.0. Each item says how to verify it. Hardware items need the user's G2 glasses;
prepare the example, then ask the user to run it (`npm run dev:<name>` + `npx evenhub qr --port <port>`).
H3–H5 are in `hub-probe` (`npm run dev:probe`, port 5192): one page, results saved to the PC.

## 1. Hardware verification (open questions)

| # | Question | How |
|---|---|---|
| H1 | ~~Image send speed: can `gapMs` drop below 100 ms without frames getting stuck?~~ | **Answered 2026-09-30** (STATUS.md): sends take ~300–370 ms (dense tiles ~450 ms), gap 0 left no frame stuck on simple tiles, 0 failures. Follow-ups: H1b, F4. |
| H1b | ~~What drives the ~350 ms send?~~ | **Answered 2026-09-30** (STATUS.md): ~200 ms fixed per send, plus time for picture detail (edges, texture); bytes and format barely matter; the outline chart sends ~10 % slower than the filled one. Follow-up: H1c. |
| H1c | ~~Can the outline surface be cheap to send?~~ | **Answered 2026-09-30** (STATUS.md): outline bars cost ~10 % more with or without textures (the frames are the cost); outline progress costs ~10 % more only because of its hatch. Defaults unchanged; `surfaceTexture: false` for fast outline progress. |
| H1d | ~~Is a firmware text update faster than an image send?~~ | **Answered 2026-09-30:** yes, ~4×: 61 ms vs 259 ms median, 10 updates/s. F12 is worth building. |
| H1e | ~~Does a non-capture text container update as fast? Do text components read well?~~ Yes: 60 ms; the ASCII versions read well on glasses (2026-09-30). | |
| H1f | ~~Do the Unicode glyphs look right on the glasses?~~ Yes (user, 2026-09-30, `hub-text`). | |
| H2 | ~~Do images larger than 288×144 work on hardware?~~ | **Answered 2026-10-01: no, and dangerous.** Rebuilding to a page with one 576×72 image crashed the app and the glasses (hub-probe H2, first oversize case). The simulator refuses the rebuild instead. PageBuilder keeps enforcing 288×144; there is no escape hatch. |
| H3 | ~~Swipe throughput: does every fast swipe arrive while tiles are sending?~~ | **Answered 2026-10-01: yes, in practice** (hub-probe H3, drawing on): 16, 19 and 20 of 20 counted (the user saw every swipe counted; the first run may be a miscount). The fastest events were ~260 ms apart (median 320–400 ms); frames coalesce as designed (1–4 swiped while a tile sends → 4 shown). |
| H4 | ~~Long-press timing; is `HoldToConfirm` progress smooth?~~ | **Answered 2026-10-01** (hub-probe H4, image ring): `hold` arrives ~0.5 s after touch-down (user's estimate); the ring moved in steps (~3 tile sends per 1.5 s hold: "in steps, fine"); release sometimes felt late. Follow-up: H4b. |
| H5 | ~~Phone render time per tile (target < 10 ms)~~ | **Answered 2026-10-01** (hub-probe H5, iPhone, iOS 18.7): every gallery sample renders in ≤ 1 ms and PNG-encodes in ≤ 1 ms (WebKit's timer resolution is 1 ms). Rendering is not a bottleneck. |
| H4b | ~~Does a text hold bar (`TextHold`) feel better than the image ring?~~ | **Answered 2026-10-01: yes, by far.** The user: "a million times better and feels reactive compared to img". No numbers saved for the text run. |
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
| F9 | ~~**HoldToConfirm visual**~~ | Done as text: `TextHold` (driven by `HoldToConfirm`), since text updates are ~4× faster than an image ring (H4). Preferred on glasses (H4b). |
| F10 | **API reference** | Generated reference (e.g. TypeDoc) published with the demo site. |
| F12 | **Text-only components** (first batch done: `TextSpinner`, `TextProgress`, `TextSlider`, `g2.textArea`, `layouts.textBoxes`, `hub-text`; next: toast, ticker, status line, value readout) | Firmware text updates are ~4× faster than an image send (61 vs 259 ms, H1d). Components that only need characters could render to a text container instead of a tile: spinner (rotating `/ - \` characters), progress / loading bar (`[#####-----] 50%`), slider and value readouts, ticker, toast, status line. A `TextComponent` contract (props → string, ≤ 999 bytes) plus `g2.drawText(container, …)` that skips unchanged strings, like `Surface` does for tiles. Trade-offs: firmware font only (no levels, no shapes), and the text container is also the input capture, so layout and scrolling need care. |
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
- Report the oversize-image crash (H2) to Even Realities with the exact layout (one 576×72 image + a blank
  text capture, via `rebuildPageContainer`); record replies in STATUS.md.
- Report the one-lens issue to Even Realities (Discord #dev-chat) with `hub-lens`; record replies in STATUS.md.
