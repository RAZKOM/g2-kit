# Changelog

All notable changes to g2-kit. This project follows [semver](https://semver.org/); until 1.0, minor versions
may change APIs.

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

## Roadmap (not in 0.1.0)

P2 items from the original catalogue still open:

- Charts: Gantt strip, polar / radar, two-column sankey / flow bars.
- Controls: radial / pie menu, grid picker with snake-order focus, stepper with confirm.
- Data faces: mini-map (route polyline + position), stopwatch / lap list, teleprompter page,
  heart-rate zone bands.
- Game kit: playing cards, clicker "big button" with press feedback.
- Real-glasses pass: retune default levels, measure long-press timing and swipe throughput, verify
  raw Gray8 / Gray4 image formats.
