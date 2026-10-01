# Changelog

All notable changes to g2-kit. This project follows [semver](https://semver.org/); until 1.0, minor versions
may change APIs.

## Unreleased

### New
- **`TextHold`** (`g2-kit/widgets`): hold-to-confirm feedback as firmware text, `○ Hold to delete  ────────────`
  filling to `● Confirmed`. Drive it from `HoldToConfirm`. On G2 glasses an image ring managed ~2 frames a second
  while held; text updates take ~60 ms.
- **`TextToast`** (`▲ Battery low`; kinds by shape: ▶ info, ● success, ▲ warning, ■ error; optional detail line),
  **`TextStatusLine`** (`12:45 │ Steps 8 214 │ Bat 82%`), **`TextReadout`** (`Heart rate  128 bpm  ↑ +4`) and
  **`TextTicker`** (a scrolling window over long text) in `g2-kit/widgets`.
- `TextSlider`: `step` sets the default track width to one cell per step (up to 16), so every swipe moves the
  knob; `editStyle: 'knob'` shows edit mode as a ◆ knob instead of ◀ … ▶, so the line doesn't move.
- `hub-text` has a third screen: those four in text boxes, updating several times a second, over a chart tile
  that is re-sent only every 5 s.
- New `hub-probe` example (`npm run dev:probe`, port 5192): hardware questions in one page. It measures render
  time on the phone, swipe throughput, long-press timing (image ring or `TextHold`) and a text box over an image
  tile (H6). Results are saved to the PC.
- `sim:check` takes an optional query (`npm run sim:check -- hub-probe ?probe=hold`).

### Changed
- `TextSpinner` puts the spinner after its label by default (`Syncing ↗`): the font is proportional, so frames
  of different widths before the label shifted it on every frame (seen on G2). `position: 'before'` for the old
  order.

### Measured on G2 glasses (STATUS.md has details)
- **Images larger than 288×144 crash the app and the glasses** (a rebuild to one 576×72 image). Keep to the
  limit; PageBuilder enforces it.
- Fast swipes all arrive (fastest ~260 ms apart); tiles coalesce to the latest state.
- `hold` arrives ~0.5 s after touch-down; an image progress ring updates ~2 times a second while held.
  `TextHold` felt far more reactive than the ring; use it for hold-to-confirm.
- Rendering plus PNG encoding takes ≤ 1 ms per gallery sample in an iPhone WebView.
- A firmware text box over an image tile shows cleanly and stays on top when the image is re-sent (H6), so a
  picture drawn once can carry live numbers as text.
- The new text components and their glyphs (`■ ▲ │ ◆`) read well on the glasses.

## 0.3.0 (2026-09-30)

### New
- **Text components**: the firmware-text counterpart of drawn components, for readouts that change often. A text
  update took ~60 ms on G2 glasses vs ~260 ms for an image send (4× faster). `defineTextComponent` (core);
  `TextSpinner`, `TextProgress`, `TextSlider`, `TextMenu` (a `▶` cursor over items, optional `● / ○` checks, a
  scrolling window with `▲ ▼`) and `TextToggle` (`● On` / `○ Off`) in `g2-kit/widgets`. They use the glyphs the G2
  font draws (`━ ─ █ ● ▶ ▷ ◀ ↗`; progress can fill by eighths with `blocks: true`); `glyphs: 'ascii'` gives plain
  versions. Checked on G2 glasses: both styles read well.
- **`G2.textArea(container)`** (`TextArea` in `g2-kit/bridge`): retained content for a text container. Composes
  plain-text and component slots (one line each, or your own `layout`), sends only changed text and coalesces
  bursts. Works inline in a page's existing text container or in a container of its own. `G2.settle()` also
  waits for pending text updates.
- **`layouts.textBoxes()`**: text containers stacked from the top (one text component per box), optionally above
  one tile. Defaults to 4 px padding so a one-line box fits its line (an overflowing capture box would scroll
  and eat swipes).
- **`unsupportedTextChars(text)`** (core) lists characters the G2 font cannot draw (emoji, `…`, `•`);
  `g2.textArea` warns about them and about updates over 2000 characters (`MAX_TEXT_UPDATE_CHARS`).
- **`theme.surfaceTexture`** (default true): `false` draws outline blocks as plain frames, without the dots in
  bars and the hatch in progress fills. Outline progress bars then send as fast as filled ones.

### Changed
- **`gapMs` now defaults to 25 ms** (was 100 ms) in `ImageQueue` / `G2`: on G2 glasses a send itself takes
  ~350 ms, and gaps down to 0 left no frame stuck. About 10 % more frames per second; pass `gapMs: 100` for the
  old pacing.

### Measured on G2 glasses (STATUS.md has the tables)
- An image send takes ~200 ms fixed plus time for picture detail: ~350 ms for a simple 288×144 tile, ~520 ms
  for a detailed chart, ~540 ms for a dense pattern; not the ~100 ms the platform docs suggested. Bytes and
  image format barely matter (png, png4, gray8 and gray4 all display correctly; none is faster); smaller tiles
  help a little. No failures in 900+ sends.
- Outline bar charts send ~10 % slower than filled ones, with or without textures (the frames are the detail).
- A text update takes ~60 ms in the capture container and in a container of its own.
- DESIGN.md's frame budget and ink sections, the README limits and code comments now use these numbers.

### Examples and tooling
- New `hub-text` (`npm run dev:text`, port 5191; also on the demo site): a spinner and progress bar inline in the
  page's text, then a settings page with a `TextSlider` per text box.
- `hub-bench` sweeps one factor per run: gap, tile size, image format, tile content, outline surface, or text vs
  image (incl. a text container of its own).
- "Copy results" in `hub-bench` and `hub-lens` works on a sideloaded phone (plain http, where the clipboard API
  is missing): it saves the results on the PC through the dev server (`examples/output/results/`), copies with
  a fallback, and shows the text to select by hand.
- `sim:check` scenarios can take a query string.

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
