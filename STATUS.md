# STATUS (v0.1.0)

What is done and how each part was verified.

- **unit**: covered by `npm test` (214 tests in Node, no device).
- **gallery**: rendered by `npm run gallery` and inspected by eye at 1:1 and 2×.
- **simulator**: exercised in evenhub-simulator 0.9.5 (SDK 0.0.16) through its automation API
  (`npm run sim:check`), with screenshots and console logs checked.
- **glasses**: tested on real G2 hardware. **Nothing in g2-kit is at this level yet.**

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
| Framebuffer, primitives (golden buffers), text layout | ✓ | ✓ | ✓ (via examples) | – |
| PNG / pack round trips | ✓ | | PNG ✓; raw Gray8 / packed Gray4 accepted | PNG reported working by WordLens |
| Host 8-bit → gray4 conversion is linear `round(v/17)` | | | ✓ measured (`hub-ramp`) | – |
| Simulator brightness curve (levels 9–15 identical) | | | ✓ measured (`hub-calibrate`, `hub-ramp`) | open |
| Default theme levels (0/2/4/6/8/15) | ✓ | ✓ | ✓ distinct | **needs retuning on glasses** |
| ImageQueue: serial, coalescing, rebuild drop, retry, typed errors | ✓ | | ✓ (no overlapping sends, correct order) | – |
| PageBuilder validation (all rules) | ✓ | | layouts accepted by the simulator | – |
| All 6 layout presets | ✓ | | twoTilesWithList, twoTilesWithControl, dashboardQuad, fullScreen ✓; heroSidebar, menuPage unit only | – |
| Event normalisation | ✓ every truth-table row | | ✓ list tap, list swipe (no event), text swipes, tap, double-tap, long press, release | WordLens reports |
| Contextual menu events | ✓ | | not driven | – |
| Surface: only changed tiles sent | ✓ | | ✓ 1 send per carousel swipe; 2 per dashboard focus move; 1–2 per keyboard move | – |
| Tile spanning (one view over 4 tiles) | ✓ | | ✓ seamless (dashboard detail, keyboard) | – |
| create → rebuild fallback after a WebView reload | ✓ | | not driven | WordLens reports |
| Double-tap → `shutDownPageContainer(1)` | ✓ | | ✓ | – |
| FocusRing, edit mode | ✓ | | ✓ (time picker: enter, adjust, commit) | – |
| HoldToConfirm | ✓ (fake timers) | | not driven | open: LONG_PRESS timing |
| TapConfirm, PagedList, HybridSkeleton | ✓ | | not driven | – |
| Every chart and widget (92 gallery samples) | ✓ smoke + PNG snapshot | ✓ | components used by the examples ✓ | – |
| Render time | ✓ `npm run bench`: worst sample 0.8 ms warm on a desktop | | | phone WebView not measured; examples display it |

## Needs real glasses

1. Run `examples/hub-calibrate` and decide the default levels (and whether `linearTheme` fits better).
2. Long-press timing: how soon `hold` arrives and whether `HoldToConfirm` progress looks smooth.
3. Swipe throughput while tiles are sending (fast swipes on the carousel).
4. Render time per tile in the phone WebView (shown on every example page).
5. Raw Gray8 / packed Gray4 image data (`format`), which would skip PNG encoding.
6. Readability of the 5×7 font at 1× and of `faint` / `dim` marks.

## Known limits

- Rebuilding a page flickers on hardware (docs); presets keep rebuilds to screen changes.
- A ticker or spinner costs one image send per frame.
- Patterns are anchored to absolute pixels, so the same component drawn at a different offset may shift its
  hatch phase by a pixel.
