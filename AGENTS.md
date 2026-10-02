# AGENTS.md

Guide for coding agents working on g2-kit. Read this, then STATUS.md (what is verified) and ROADMAP.md
(what to do next). Background: NOTES.md (origins), DESIGN.md (visual rules), INPUT.md (events and input).

## What this is

`g2-kit` (npm, MIT, unofficial): drawn UI for Even Realities G2 Hub plugins. Components draw on the phone into a
4-bit `Framebuffer`; tiles (≤ 288×144, ≤ 4 per page) are sent with `updateImageRawData`; one invisible
capturing container (the "skeleton": a blank text container or a native list) receives gestures.
Repo: github.com/RAZKOM/g2-kit · demo site: razkom.github.io/g2-kit · owner: RAZKOM.

## Layout

| Path | What |
|---|---|
| `src/core` | Framebuffer, primitives, paints/patterns, encodings, fonts (5×7, 8×12, 16×24, 7-seg), text, text grid (`TEXT_GRID`, `toFullwidth`), theme (incl. `surface`), `drawBlock`, `inkRatio`, PNG/Gray4 encoders, tiles, `defineComponent`. No DOM, no deps. |
| `src/bridge` | `G2` (app object), `connect()`, `ImageQueue`, `PageBuilder` (validation), `layouts` (9 presets), events normaliser, `Surface`, `TextArea` (`g2.textArea`). **Only `bridge/sdk.ts` touches the SDK**, via dynamic `import()`. |
| `src/input` | Skeletons, `PagedList`, `HybridSkeleton`, `FocusRing` (edit mode), `TapConfirm`, `HoldToConfirm`, `promptText` (uses `G2.modal` and `Keyboard`). |
| `src/charts`, `src/widgets` | Components (`widgets/text.ts`: text components, strings for firmware text). `src/icons`: vector icons. |
| `test/` | Vitest. `components.test.ts` smoke-tests + PNG-hash-snapshots every gallery sample (filled and outline surface) and enforces the ink budget (`INK_EXCEPTIONS`). `sdk-types.test.ts` checks the real SDK against `SdkModule` (compile time). |
| `examples/gallery/samples.ts` | Every component with sample props: drives the gallery, the site, the showcase and the tests. |
| `examples/hub-*` | Plugin examples (Vite). `shared/phone.ts`: phone mirror, keyboard/button mock host, error display. |
| `scripts/` | `simcheck.ts` (drive the simulator), `bench.ts`, `build-site.ts`, `docs-images.ts`, `showcase.ts`. |

## Commands

```
npm test                 # 302 tests
npm run typecheck
npm run gallery          # examples/output/ (PNGs, index.html, contact-sheet.png, surface-sheet.png; prints ink over budget)
npm run docs:images      # regenerate docs/img/ incl. showcase.png (run sim:check first for sim-*.png)
npm run build:site       # site/ (gallery + in-browser demos), then npm run preview:site
npm run dev:<name>       # quickstart | dashboard | picker | game | calibrate | lens | bench | keyboard | text | probe
npm run sim -- <url>     # launch evenhub-simulator (npx evenhub-simulator does not resolve here)
npm run sim:check -- hub-dashboard   # headless: replay gestures via the simulator's automation API
npm run bench
```

## Conventions (keep these)

- Component contract: `export const X = defineComponent<XProps>('X', recommendedSize, renderX)`; export
  `X`, `renderX`, `XProps` from the package index. Pure function of props; drawing clipped to `rect`.
- Levels only through `theme.levels` (`off/faint/dim/mid/bright/full` = 0/2/4/6/8/15). On G2 glasses and the
  simulator, brightness levels off around 8–10, so never rely on 9 vs 15.
- Solid blocks go through `drawBlock` (honours `theme.surface: 'outline'`; content on a block is level 0 only
  when it returns true). Keep samples under `INK_BUDGET` (25 %) or list the reason in `INK_EXCEPTIONS`.
- Encode meaning by shape as well as brightness (filled/ring/strike, outline vs fill, focus = 2 px frame).
- Every new component gets a gallery sample in `examples/gallery/samples.ts` (tests pick it up) and a line in
  the README table and CHANGELOG. Look at it: `npm run gallery`, then the contact sheet.
- Respect platform limits (PageBuilder enforces them): images 20–288 × 20–144, ≤ 4 images + ≤ 8 others,
  exactly one capture, zOrder all-or-none unique, list ≤ 20 items, text ≤ 999 bytes, menu ≤ 10.
- Prefer switching views inside one layout: `G2.show()` skips identical-layout rebuilds. A rebuild to four
  full-size images once left the right lens empty on real glasses (STATUS.md).
- One gesture should cost one tile send (~350 ms each on glasses, measured; STATUS.md). Put swipe-reactive UI on its own tile.
- Feedback that must track a gesture live (hold progress, value readouts) goes in firmware text, not a tile: a
  text update takes ~60 ms. On glasses, `TextHold` felt far more reactive than an image ring (STATUS.md, H4b).
- Honesty rule: never mark anything "verified on glasses" unless the user tested it on hardware. Levels:
  unit / gallery / simulator / glasses (STATUS.md).
- Published PNGs (docs, site) use `deflate`; tiles sent to the glasses stay uncompressed (SDK compresses).

## Gotchas learned the hard way

- Vite dev servers must pre-bundle the SDK (`optimizeDeps.include` in `examples/vite.shared.ts`), or the
  dynamic import can 504 and the page hangs on "Connecting…".
- `hub-lens` must force rebuilds (`g2.show(page, { rebuild: 'always' })`), since `show()` now skips them.
- Images over 288×144 crash the app and the G2 glasses (a rebuild to one 576×72 image, 2026-10-01). Never get
  around PageBuilder's limit. Simulator 0.9.5 refuses such a rebuild instead, so it won't warn you.
- Simulator screenshots are RGBA with level 0 transparent; `docs-images.ts` flattens them onto black.
- awesome-lint on Windows: run `npx awesome-lint README.md` (no-arg form misreads the path).
- Example dev servers use the example folder as Vite root: anything shared (CSS, TS) must be imported from a
  module, not linked by a relative URL from index.html (`../shared/x` gets the HTML fallback in dev).
- `examples/shared/phone.ts` wraps `g2.show`; keep passing its options through (`rebuild: 'always'`).
- Firmware text containers must fit their text (~27 px per line plus 2 × padding). One that overflows scrolls,
  shows a scroll bar, and if it is the capture container the firmware spends swipes on scrolling: gestures get
  lost (seen in the simulator with `textBoxes`). On G2 glasses a capture box full of text (9 lines in 288 px)
  also scrolled a little and bounced back on every swipe: keep swipe-heavy screens on a blank skeleton and put
  text in non-capture boxes.
- Fullwidth characters (`Ｑ` … `Ｚ`, `［ ］`, ideographic space `　`) are monospaced in the firmware font: 20 px
  per character from x = 0 (padding 0), lines 27 px apart (simulator, and lined up on G2 glasses: ROADMAP H7). Text containers
  can't move: an update changes content (and whole-box brightness) only.
- The firmware font is proportional: anything whose width changes (spinner frames, ◀ ▶ markers) shifts what
  follows it. Put changing glyphs last on a line, or swap same-width pairs (▶/▷, ●/◆).
- The firmware font draws ASCII/Latin-1, arrows, box drawing, blocks and some shapes, but no emoji and not `…`
  or `•`: check strings with `unsupportedTextChars` (core). Text updates take up to 2000 characters, create /
  rebuild 1000.

## Working with the user

- Windows + PowerShell (pwsh). Give commands that work in pwsh; one command per code block.
- Commit, push and release only when asked; otherwise give the commands.
- Release: update CHANGELOG (`## x.y.z (date)`), commit, `npm version patch|minor`,
  `git push --follow-tags` → `.github/workflows/release.yml` publishes via npm trusted publishing (OIDC,
  provenance). The trusted-publisher owner on npmjs.com is case-sensitive: `RAZKOM`.
- Pushing `main` redeploys the demo site (`pages.yml`); README images are committed files
  (`npm run docs:images`).
- The user tests on real G2 glasses by sideloading dev servers: `npx evenhub qr --port <port>`.
