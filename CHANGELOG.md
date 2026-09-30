# Changelog

All notable changes to g2-kit. This project follows [semver](https://semver.org/); until 1.0, minor versions
may change APIs.

## Unreleased

- Docs: measured on G2 glasses (STATUS.md): outline bar charts send ~10 % slower than filled with or without
  textures; outline progress is as fast as filled with `surfaceTexture: false`; a firmware text update takes
  ~60 ms vs ~260 ms for an image send (~4× faster), so text-only components (ROADMAP F12) are next.
- `theme.surfaceTexture` (default true): `false` draws outline blocks as plain frames, without the sparse dots
  in bars and the hatch in progress fills (less picture detail, which costs send time on the glasses).
- Examples: `hub-bench` sweeps "surface" (bar chart and progress bar: filled, outline, plain outline; H1c) and
  "text" (an image progress bar vs the same progress as firmware text; H1d).
- Docs: what sets the image send time on G2 glasses (hub-bench sweeps, STATUS.md): ~200 ms fixed per send plus
  time for picture detail; bytes and image format barely matter; all four formats display on hardware (H6);
  the outline bar chart sends ~10 % slower than the filled one. DESIGN.md's frame budget and ink sections
  say how to design for it.
- Examples: `hub-bench` sweeps one factor per run: gap, tile size (288×144 → 72×72), image format (png, png4,
  gray8, gray4) or tile content (blank, simple, dense, bar chart filled vs outline surface), to find what sets
  the ~350 ms send time (ROADMAP H1b, H6). `sim:check` scenarios can take a query string.
- `gapMs` (ImageQueue / G2) now defaults to 25 ms instead of 100 ms: on G2 glasses the send itself takes
  ~350 ms and gaps down to 0 left no frame stuck, simple or dense tiles (hub-bench). About 10 % more frames
  per second; pass `gapMs: 100` for the old pacing.
- Docs: image sends measured on G2 glasses with `hub-bench`: ~300–370 ms per 288×144 tile (~450 ms for a
  dense pattern), not ~100 ms; no failures and no stuck frames down to `gapMs: 0`. STATUS.md has the table;
  DESIGN.md's frame budget, the README limits and code comments are corrected.
- Examples: "Copy results" in `hub-bench` and `hub-lens` works on a sideloaded phone. A sideloaded page is
  plain http on the PC's LAN address, where the clipboard API is missing, so the button did nothing. It now
  saves the results on the PC through the dev server (`examples/output/results/`), copies with a fallback
  that works over http, and shows the text in a box to select by hand; the button says what worked.

## 0.2.0 (2026-09-30)

- Ink metric: `inkRatio(fb, rect?, min?)` (share of lit pixels) and `INK_BUDGET` (0.25) in `g2-kit/core`.
  The gallery (captions, contact sheet), `npm run bench` and a new test report ink per sample; the test fails
  when a sample goes over budget without a listed reason.
- Outline surface: `theme.surface: 'filled' | 'outline'` (optional, default `'filled'`, which draws exactly as
  before) and `outlineTheme`. Under `'outline'`, `BarChart`, `MultiBarChart`, `Histogram`, `Button` /
  `ButtonRow` (so `Modal`), `Toggle`, `SegmentedControl`, `Tabs` (boxed), `ProgressBar` and error `Toast`s
  draw frames and light textures instead of solid blocks: 30 % → 14 % ink over those samples. New core helper
  `drawBlock` (plus `isOutline`) for components of your own. The gallery has a "Filled vs outline" section
  and `surface-sheet.png`.
- `G2.modal(handler)`: a handler that sees every event first and consumes it by returning true; unconsumed
  events fall through (double-tap still exits). Modals stack; `G2.hasModal`.
- New `Keyboard` (`g2-kit/widgets`): a configurable keyboard for one gesture axis. `keyboardLayout(options)`
  compiles letters (`qwerty`, `qwertz`, `azerty`, `abc` or your own rows), digits (row above the letters, in
  the symbols set, or none), extra punctuation on the letter row, a symbols set (a second layer behind a
  `?123` key, a panel beside the letters, or below them), the action row (`shift`, `caps`, `symbols`,
  `space`, `delete`, `submit`, `cancel`; order and labels configurable) and the scan (`rows`, `columns`,
  `keys`), plus `afterType` (back to the rows, or stay on the key). `KeyboardState` is the headless state
  machine (shift once / lock, caps, layers, text, max length; entering a row lands on the key used last in
  it). `typingCost(layout, text)` counts the fewest gestures a text needs: rows ≈ 5.1 per character on short
  messages, columns ≈ 5.5, every key in one line ≈ 9.4. `GridKeyboard` stays as it was.
- New layout preset `layouts.textWithSpan({ span: 'wide' | 'tall' })`: a firmware text container plus two
  tiles spanned as 576×144 or 288×288 (for keyboards with symbols beside or below the letters).
- `promptText(g2, opts)` in `g2-kit/input`: one-call text entry with a `Keyboard` (`keyboard`: options or a
  compiled layout; default QWERTY with a symbols layer) on `layouts.textWithTile`, or `textWithSpan` for
  side / stacked panels. Resolves the text on submit, null on cancel (a cancel key, or hold while choosing a
  row), abort or exit; `onChange` reports every edit.
- Examples: the picker's keyboard screen is now `promptText` (starting from the carousel's text).
- Examples: new `hub-keyboard` (`npm run dev:keyboard`, port 5189): every keyboard option in a form on the
  phone; the glasses type with it, hold (cancel) switches to the next preset, and the page counts gestures
  per message against `typingCost`. Also on the demo site.
- Examples: new `hub-bench` (`npm run dev:bench`, port 5188): sends N frames per `gapMs` value and shows
  `updateImageRawData` round trip, frames/s and failures on the phone page, with a per-run "tile shows N/N"
  check and "Copy results". For measuring image send speed on real glasses (ROADMAP H1).
- Examples: fixed the shared phone page stylesheet not loading in dev servers (it was linked outside the Vite
  root and got the HTML fallback; now imported from `shared/phone.ts`), and the shared `g2.show` wrapper
  dropping its options, so `hub-lens` now really forces rebuilds (`rebuild: 'always'`).
- README: one poster of all components (`docs/img/showcase.png`, `npm run showcase`) and a single component
  table instead of four category images.
- AGENTS.md / CLAUDE.md (guide for coding agents) and ROADMAP.md (next steps).

## 0.1.1 (2026-09-29)

- Fix: `connect({ sdk })` with the real `@evenrealities/even_hub_sdk` module failed to typecheck
  (`SdkBridge.onEvenHubEvent`'s callback type was too narrow). A type test now checks the real SDK against
  `SdkModule`.
- `G2.show()` skips `rebuildPageContainer` when the new page has exactly the same containers as the page on
  screen, and just redraws the tiles; it now returns `'created' | 'rebuilt' | 'reused'`. Pass
  `{ rebuild: 'always' }` to force a rebuild.
- Known issue documented (STATUS.md): on G2 glasses, a rebuild to four full-size images sometimes showed
  images only in the left lens until the glasses restarted.
- New layout preset `layouts.textWithTile()`: a firmware text container (also the input capture) plus one
  drawn tile. One image per page, text updates cost no image send.
- `GridKeyboard` keeps a 2 px margin so the focused-row frame is never clipped.
- Examples: the picker's keyboard is one 288×144 tile under a firmware text line (was four spanned tiles):
  one tile send per key move, typing updates the text only.
- Examples: the dashboard switches views inside one layout (no rebuilds); new `hub-lens` diagnostic
  (`npm run dev:lens`).
- Examples: fixed the dev server sometimes leaving the page on "Connecting…" (Vite discovered the SDK's
  dynamic import at runtime and served a stale copy, HTTP 504). The SDK is now pre-bundled, and example pages
  show connection errors with a 15 s timeout.
- Docs: default theme levels and fonts checked on real G2 glasses with `hub-calibrate`: brightness levels off
  around 8–10 like the simulator, level 1 is visible, all six theme levels are distinct, all fonts readable.
  No code changes.

## 0.1.0 (2026-09-29)

First release.

### Core (`g2-kit/core`)
- `Framebuffer` (1 byte per pixel, levels 0–15) with a clip stack, `blit` (transparent, flip, remap), `crop`,
  `diffBounds`, `hash`, `toAscii`.
- Primitives: lines and polylines with width and dash patterns, rect / round rect / dashed rect, circle, disc,
  arc, annular sector, polygon fill, triangle, pattern fills.
- Encoding library: 9 fill patterns, 5 dash styles, 7 markers, per-series styles, cell marks
  (filled / ring / strike / outline / dashed / focus).
- Fonts: 5×7 (full ASCII), 8×12 body with 2 px stems, 16×24 display (Scale2x of the body font),
  parametric 7-segment digits. Text: align, ellipsis, wrap, text box, auto-fit.
- Named levels and `Theme`; default levels tuned against the brightness curve measured in
  evenhub-simulator 0.9.5 (`SIMULATOR_CURVE`); `linearTheme`.
- Encoders: 8-bit greyscale PNG (default for the SDK), 4-bit PNG, raw Gray8, packed Gray4; green preview PNG
  with optional simulator curve. Quantise from Gray8 / RGBA with optional Bayer dither. `CanvasAdapter`.
- `defineComponent` contract; `TiledCanvas` / `gridTiles` for tile spanning.

### Bridge (`g2-kit/bridge`)
- `ImageQueue`: serial, per-container coalescing, lazy render at send time, page ops drop stale frames,
  one retry for transient failures, typed `ImageSendError`, pacing, stats.
- `PageBuilder` with validation of every documented limit; `PageLayoutError` names each broken rule.
- Layout presets: `twoTilesWithList`, `twoTilesWithControl`, `dashboardQuad`, `heroSidebar`, `fullScreen`,
  `menuPage`.
- Event normaliser (`next` / `prev` / `tap` / `doubleTap` / `hold` / `release` / `select` / `menu` / lifecycle).
- Retained `Surface`: mounts, dirty rects, sends only tiles whose pixels changed; spans components across tiles.
- `G2` app object and `connect()` (dynamic SDK import, enum drift check, create → rebuild fallback after a
  WebView reload, double-tap exit prompt by default).

### Input (`g2-kit/input`)
- `blankTextSkeleton`, `listSkeleton`, `PagedList`, `HybridSkeleton`.
- `FocusRing` with edit mode and configurable gesture map; `stepIndex`, `stepValue`.
- `TapConfirm`, `HoldToConfirm`.

### Components
- Charts P0: bar (vertical, horizontal, negatives, highlight, peak), line (3 series, area, min/max), sparkline,
  KPI, gauge. P1: grouped / stacked bars, pie / donut, progress rings, heatmap, calendar heatmap, funnel, bullet,
  timeline, legend. P2: waffle, scatter with trend, histogram, box plot, candlestick.
- Widgets P0: carousel, button / button row, toggle, progress bar, big text. P1: segmented control, slider,
  roller, time picker, date picker, checklist, status keyboard, ABC / T9 grid keyboard, toast, modal, tabs,
  pagination dots, scroll indicator, status bar, HUD frame, ticker, analog clock, timer ring, compass strip,
  turn arrow, grid board, score HUD. P2: table, card, badge, spinner, weather glyph, rating, dice, health bar,
  sprite sheet.
- Icons: 56 vector icons for 8 / 12 / 16 px.

### Examples and tooling
- `hub-quickstart`, `hub-dashboard`, `hub-picker`, `hub-game`, `hub-calibrate`, `hub-ramp` (level-mapping probe);
  phone-side mirror and keyboard mock host.
- `npm run gallery` (PNG per sample, contact sheet, HTML), `npm run bench`, `npm run sim:check` (drives the
  simulator through its automation API), `npm run sim`.
- Demo site (`npm run build:site`): gallery with each sample's props, plus every example running in the
  browser against a mock host with on-screen gesture buttons. Deployed to GitHub Pages by `pages.yml`.
- `npm run docs:images` regenerates the README images; PNG encoders accept an optional `deflate` so published
  images are compressed (tiles sent to the glasses stay uncompressed; the SDK compresses in transit).
- GitHub Actions: CI (typecheck, tests, build), Pages, and tag-triggered npm release with provenance.

## Roadmap

See [ROADMAP.md](ROADMAP.md).
