# STATUS (v0.1.0)

What is done and how each part was verified.

- **unit**: covered by `npm test` (255 tests in Node, no device).
- **gallery**: rendered by `npm run gallery` and inspected by eye at 1:1 and 2×.
- **simulator**: exercised in evenhub-simulator 0.9.5 (SDK 0.0.16) through its automation API
  (`npm run sim:check`), with screenshots and console logs checked.
- **glasses**: tested on real G2 hardware. So far: `hub-calibrate` displayed correctly (2026-09-29, sideloaded via QR).

## Steps

| # | Step | State |
|---|---|---|
| 1 | Study WordLens → NOTES.md | done |
| 2 | Scaffold: ESM exports map, strict TS, Vitest | done |
| 3 | Core: Framebuffer, levels, encoders, PNG, primitives, fonts | done |
| 4 | Bridge: ImageQueue, events, PageBuilder, layout presets | done |
| 5 | P0 charts and widgets + gallery | done |
| 6 | Input: skeletons, FocusRing, edit mode; carousel + buttons in hub-picker | done |
| 7 | Surface, dirty tracking, tile spanning; hub-dashboard | done |
| 8 | P1 components; hub-game | done; a first batch of P2 too |
| 9 | Docs, naming pass (`X` / `renderX` / `XProps`), v0.1.0 | done |

## By area

| Area | unit | gallery | simulator | glasses |
|---|---|---|---|---|
| Framebuffer, primitives (golden buffers), text layout | ✓ | ✓ | ✓ (via examples) | ✓ fonts and patterns (hub-calibrate) |
| PNG / pack round trips | ✓ | | PNG ✓; raw Gray8 / packed Gray4 accepted | ✓ all four formats (png, png4, gray8, gray4) display correctly (hub-bench) |
| Host 8-bit → gray4 conversion is linear `round(v/17)` | | | ✓ measured (`hub-ramp`) | – |
| Brightness curve (levels ~9–15 identical) | | | ✓ measured (`hub-calibrate`, `hub-ramp`) | ✓ same shape by eye (levels off ~8–10) |
| Default theme levels (0/2/4/6/8/15) | ✓ | ✓ | ✓ distinct | ✓ distinct by eye; level 1 visible |
| ImageQueue: serial, coalescing, rebuild drop, retry, typed errors | ✓ | | ✓ (no overlapping sends, correct order) | ✓ 360 sends in `hub-bench`, 0 failed, 0 retried |
| Image send time (one 288×144 PNG tile) | | | ~10 ms (no BLE, not meaningful) | ✓ measured: median 300–370 ms (simple tile), 430–500 ms (dense pattern); ~2–3 frames/s |
| PageBuilder validation (all rules) | ✓ | | layouts accepted by the simulator | – |
| All 6 layout presets | ✓ | | twoTilesWithList, twoTilesWithControl, dashboardQuad, fullScreen ✓; heroSidebar, menuPage unit only | fullScreen ✓ |
| Event normalisation | ✓ every truth-table row | | ✓ list tap, list swipe (no event), text swipes, tap, double-tap, long press, release | WordLens reports |
| Contextual menu events | ✓ | | not driven | – |
| Surface: only changed tiles sent | ✓ | | ✓ 1 send per carousel swipe; 2 per dashboard focus move; 1–2 per keyboard move | – |
| Tile spanning (one view over 4 tiles) | ✓ | | ✓ seamless (dashboard detail, keyboard) | ✓ displays (hub-calibrate) |
| create → rebuild fallback after a WebView reload | ✓ | | not driven | WordLens reports |
| Double-tap → `shutDownPageContainer(1)` | ✓ | | ✓ | – |
| FocusRing, edit mode | ✓ | | ✓ (time picker: enter, adjust, commit) | – |
| HoldToConfirm | ✓ (fake timers) | | not driven | open: LONG_PRESS timing |
| TapConfirm, PagedList, HybridSkeleton | ✓ | | not driven | – |
| Every chart and widget (98 gallery samples) | ✓ smoke + PNG snapshot | ✓ | components used by the examples ✓ | – |
| Ink metric (`inkRatio`), budget test (25 %, listed exceptions) | ✓ | ✓ ink in captions, contact sheet, bench | | – |
| Outline surface (13 samples change) | ✓ PNG snapshots; less ink than filled; inside the rect | ✓ `surface-sheet.png` at 1:1 | not driven | – |
| `G2.modal` (consume / fall through / stack) | ✓ | | ✓ via `promptText` in hub-picker | – |
| `promptText` | ✓ type, DEL, max length, OK, cancel, abort, double-tap exits | | ✓ hub-picker: type, back to rows, OK commits, hold cancels | – |
| `Keyboard`, `keyboardLayout`, `KeyboardState`, `typingCost` | ✓ groups by rows / columns / keys, shift, caps, layers, delete, max length, cost model | ✓ 6 samples (layers, symbols, columns, side, stack) | ✓ `hub-keyboard`: typing on QWERTY, all 6 presets incl. two-tile side and stacked; hub-picker types and commits | – |
| `layouts.textWithSpan` (wide, tall) | ✓ | | ✓ via `hub-keyboard` (seamless across the two tiles) | – |
| Text components (`TextSpinner`, `TextProgress`, `TextSlider`) | ✓ output snapshots, ASCII, deterministic | ✓ gallery text section | ✓ `hub-text`: spinner and bar animate inline; sliders in their own boxes with FocusRing edit mode | text updates measured (H1d); these components not yet looked at on glasses |
| `TextArea` / `g2.textArea`, `layouts.textBoxes` | ✓ compose, skip unchanged, coalesce, reset on show; preset validation | | ✓ `hub-text`; non-capture box updates (`hub-bench` "text, own box") | open: own-box timing (H1e) |
| `hub-bench` send benchmark | | | ✓ runs; simulator round trip ~10 ms (no BLE, not meaningful) | open: H1 |
| Render time | ✓ `npm run bench`: worst sample 0.8 ms warm on a desktop | | | phone WebView not measured; examples display it |

## Needs real glasses

1. ~~Brightness levels~~: done; defaults confirmed (see DESIGN.md).
2. Long-press timing: how soon `hold` arrives and whether `HoldToConfirm` progress looks smooth.
3. Swipe throughput while tiles are sending (fast swipes on the carousel).
4. Render time per tile in the phone WebView (shown on every example page).
5. ~~Raw Gray8 / packed Gray4 image data~~: all four formats display correctly; none is faster (below).
6. ~~Font readability~~: all four text rows on the card read comfortably.
7. ~~Image send speed~~: measured 2026-09-30, see "Image send speed on glasses" below.
   What drives the send time was measured too (H1b, below).

## Image send speed on glasses (H1, 2026-09-30)

`hub-bench` on the user's G2 glasses, 30 frames per run, one 288×144 tile (8-bit PNG, 41 684 bytes before the
SDK compresses it), timing each `updateImageRawData` from call to result:

| `gapMs` | frames/s, simple tile | send median / p95, simple | frames/s, dense pattern | send median / p95, dense |
|---|---|---|---|---|
| 150 | 2.1 | 337 / 420 ms | 1.7 | 476 / 618 ms |
| 100 (default) | 2.4 | 300 / 387 ms | 1.8 | 467 / 669 ms |
| 75 | 2.5 | 324 / 410 ms | 1.8 | 496 / 584 ms |
| 50 | 2.6 | 334 / 460 ms | 2.0 | 462 / 580 ms |
| 25 | 2.7 | 344 / 433 ms | 2.2 | 426 / 545 ms |
| 0 | 2.8 | 372 / 401 ms | 2.0 | 487 / 577 ms |

- A send takes **~300–370 ms**, not the ~100 ms the platform docs suggested; the round trip dominates, so the
  gap barely matters (gap 0 is ~15 % faster than the old default 100 ms). The default is now 25 ms.
- No failures or retries in 360 sends. With the simple tile every run ended on the last frame (30/30), down to
  gap 0: no stuck frames. The dense-pattern runs ended on the last frame too (reported by the user).
- Content matters: a dense pattern takes ~40 % longer than a mostly black tile, although the PNG bytes are the
  same size, so the SDK's compression (or the transfer after it) sets the time. See H1b below.
- Encoding on the phone is 1–3 ms per tile; rendering is not the bottleneck.
- Rerun on 2026-09-30 (gap sweep, 30 frames): the same numbers within ±30 ms, every gap ended on 30/30.

## What sets the send time (H1b, 2026-09-30)

`hub-bench` sweeps on the same glasses, 30 frames per run, gap 25 ms; one factor varies, the rest stays at
288×144, 8-bit PNG, simple counter. Every run ended on the last frame and looked right; 0 failures in 420 sends.

| Sweep | Case | bytes sent | send median / p95 | frames/s |
|---|---|---|---|---|
| size | 288×144 | 41 684 | 345 / 430 ms | 2.7 |
| | 288×72 | 20 876 | 260 / 288 ms | 3.5 |
| | 144×144 | 20 948 | 287 / 346 ms | 3.3 |
| | 144×72 | 10 508 | 260 / 318 ms | 3.6 |
| | 72×72 | 5 324 | 203 / 289 ms | 4.4 |
| format | png (8-bit) | 41 684 | 345 / 378 ms | 2.8 |
| | png4 | 20 948 | 317 / 374 ms | 2.9 |
| | gray8 (raw) | 41 472 | 345 / 406 ms | 2.8 |
| | gray4 (raw, packed) | 20 736 | 345 / 433 ms | 2.8 |
| content | blank (a small counter only) | 41 684 | 203 / 260 ms | 4.1 |
| | simple counter | 41 684 | 345 / 431 ms | 2.8 |
| | dense cross-hatch | 41 684 | 543 / 689 ms | 1.8 |
| | bar chart, filled | 41 684 | 518 / 601 ms | 1.9 |
| | bar chart, outline surface | 41 684 | 569 / 718 ms | 1.7 |

- **Every send costs ~200 ms** however small: a blank 288×144 tile and a 72×72 tile both take 203 ms.
  Fewer sends is the biggest lever; `Surface` already sends only changed tiles.
- **On top of that, detail costs time, not bytes.** The byte count we hand over barely matters (raw formats
  and 4-bit PNG are no faster), but what is in the picture does: edges and texture make a tile slower to
  send (the SDK compresses before sending). A dense pattern takes 2.7× a blank tile; a detailed chart ~2.5×.
- **Fewer lit pixels is not faster.** The outline bar chart lights half the pixels of the filled one but
  sends ~10 % slower: frames and sparse dots are more detail than solid bars, which compress well. Ink
  (seeing through) and send time pull in different directions.
- Smaller tiles help modestly: half the pixels saves ~60–85 ms.
- Format: keep the default `png`; all four work on hardware (H6), none is faster, and encoding costs
  1–2 ms either way.

## Outline textures and text updates (H1c, H1d, 2026-09-30)

Same glasses, 30 frames per run, gap 25 ms, 288×144 PNG tiles; every run ended on the last frame, 0 failures.

| Case | send median / p95 | frames/s |
|---|---|---|
| bar chart, filled | 517 / 718 ms | 1.8 |
| bar chart, outline (sparse dots in bars) | 570 / 662 ms | 1.7 |
| bar chart, outline, plain frames (`surfaceTexture: false`) | 570 / 723 ms | 1.6 |
| progress bar, filled | 259 / 321 ms | 3.5 |
| progress bar, outline (hatched fill) | 286 / 344 ms | 3.2 |
| progress bar, outline, plain frames | 260 / 317 ms | 3.4 |
| progress as an image tile (text sweep) | 259 / 316 ms | 3.5 |
| **progress as firmware text** (`textContainerUpgrade`, no image) | **61 / 118 ms** | **10.0** |

- **Outline bars cost ~10 % more to send, with or without textures**: the frames themselves are the extra
  detail. Keeping the dots costs nothing extra, so `surfaceTexture` stays on by default for bars.
- **Outline progress costs ~10 % more because of its hatch**; with plain frames it sends like the filled bar.
- **A text update is ~4× faster than an image send** (61 vs 259 ms) and reached 10 updates/s; the text counted
  up to the last frame. Anything that can be characters is far cheaper as firmware text (ROADMAP F12).

## Known hardware issue: one lens after a rebuild

Seen on G2 glasses on 2026-09-29 with `examples/hub-lens` (details from the tester):

- After `rebuildPageContainer` to a page of **four full-size (288×144) images**, the images showed only in the
  **left** lens. Re-sending the tiles did not recover the right lens; waiting 1.5 s or 3 s before sending did
  not help either.
- In the same runs, a rebuild to **two images plus text** showed in both lenses, and pages created at app
  start always showed in both.
- It depended on the glasses' state: it persisted across app restarts, the glasses then crashed and rebooted,
  and after the reboot every step worked. It has not come back since.
- Our guess: the right side of the glasses runs out of room for four full-size image containers during a
  rebuild after heavy use. Unconfirmed; the app gets a success result either way. Worth reporting to
  Even Realities with `hub-lens`.

Mitigation in g2-kit: `G2.show()` skips the rebuild when the new page has the same containers as the current
one (it only redraws tiles), and the dashboard example switches views inside one layout. `hub-lens` has steps
S9 (clear to a text-only page first) and S10 (three tiles) to try the next time it happens.

Caveat (found 2026-09-30): until then the examples' shared `g2.show` wrapper dropped its options, so the
committed `hub-lens` did not force rebuilds: S3, S5 and S6 (same layout as the step before) reused the page
and the phone log said "page reused". Runs of that version tested re-sending tiles in those steps, not
rebuild-then-send. Fixed; rerun hub-lens if those steps matter.

## Known limits

- Rebuilding a page flickers on hardware (docs); presets keep rebuilds to screen changes.
- A ticker or spinner costs one image send per frame.
- Patterns are anchored to absolute pixels, so the same component drawn at a different offset may shift its
  hatch phase by a pixel.
