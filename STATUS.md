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
| PNG / pack round trips | ✓ | | PNG ✓; raw Gray8 / packed Gray4 accepted | PNG ✓ (hub-calibrate) |
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
| `hub-bench` send benchmark | | | ✓ runs; simulator round trip ~10 ms (no BLE, not meaningful) | open: H1 |
| Render time | ✓ `npm run bench`: worst sample 0.8 ms warm on a desktop | | | phone WebView not measured; examples display it |

## Needs real glasses

1. ~~Brightness levels~~: done; defaults confirmed (see DESIGN.md).
2. Long-press timing: how soon `hold` arrives and whether `HoldToConfirm` progress looks smooth.
3. Swipe throughput while tiles are sending (fast swipes on the carousel).
4. Render time per tile in the phone WebView (shown on every example page).
5. Raw Gray8 / packed Gray4 image data (`format`), which would skip PNG encoding.
6. ~~Font readability~~: all four text rows on the card read comfortably.
7. ~~Image send speed~~: measured 2026-09-30, see "Image send speed on glasses" below.
   Still open: whether the busy-pattern runs ended on N/N (not recorded), and what drives the send time
   (bytes after the SDK's compression? tile size? format?).

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
  gap barely matters (gap 0 is ~15 % faster than the default 100 ms).
- No failures or retries in 360 sends. With the simple tile every run ended on the last frame (30/30), down to
  gap 0: no stuck frames. The dense-pattern runs did not record N/N.
- Content matters: a dense pattern takes ~40 % longer than a mostly black tile, although the PNG bytes are the
  same size, so the SDK's compression (or the transfer after it) sets the time. Fewer lit pixels, e.g. the
  outline surface, should also mean faster sends (not measured).
- Encoding on the phone is 1–3 ms per tile; rendering is not the bottleneck.

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
