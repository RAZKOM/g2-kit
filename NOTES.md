# NOTES: what to take from WordLens

Study of [RAZKOM/WordLens](https://github.com/RAZKOM/WordLens) (local copy at `../Wordlens`), the
installed `@evenrealities/even_hub_sdk@0.0.16` type declarations, the simulator 0.9.5 README, and
hub.evenrealities.com/docs (Display & UI, Page Lifecycle, Device APIs). Written before any code.

## Extract (generalise, keep the behaviour)

| WordLens file | What it proves | What g2-kit does with it |
|---|---|---|
| `render/framebuffer.ts` | 1 byte per pixel, level 0–15, drawn in plain TS | `core/Framebuffer` + clip stack, blit, diff, pack; primitives move to free functions (tree-shaking) |
| `render/font.ts` | 5×7 glyph strings, integer scaling | `core/fonts`: 5×7 (now with lowercase), 8×12 body, 16×24 display (Scale2x of body), parametric 7-segment |
| `render/png.ts` | Stored-deflate greyscale PNG is accepted by `updateImageRawData` | `core/png`: same encoder, plus the green-on-black preview encoder for mirrors/gallery |
| `imageQueue.ts` | Serial queue; per-container coalescing; lazy render at send time; page ops drop stale frames; one retry | `bridge/ImageQueue`: same semantics + typed errors from the SDK result string + send stats + `onSent` hook |
| `input.ts` | `CLICK_EVENT` is 0 and protobuf omits it, so tap arrives with `eventType` undefined; resolve per envelope; explicit types first | `bridge/events.normalize` with the same rules, emitting `next/prev/tap/doubleTap/hold/release/select` |
| `pages.ts` | Layout objects as plain SDK-shaped data; blank `' '` text container as the capture skeleton under an image | `bridge/PageBuilder` (validated) + `bridge/layouts` presets + `input/skeletons` |
| `render/strip.ts` | Carousel: centred boxed item, neighbours dimmer, only whole glyphs drawn, wraps | `widgets/Carousel` over any item list, with a level ramp by distance |
| `render/cells.ts` | Meaning by shape: fill = correct, ring = present, strike = absent | `core/encodings` "mark" set, reused by keyboard, grid board, legend |
| `render/chart.ts` | Bar chart in 288×144, outline bar for a different category, highlight by level | `charts/BarChart` generalised |
| `config.ts` list pages | 20-item native list limit handled by `MORE >>` / `<< BACK` paging; a rebuilt list highlights index 0 | `input/PagedList` |
| `main.ts` | Enum drift check between mirrored constants and the SDK enum; mirror of sent frames on the phone page | `bridge/connect` runs the same drift check; examples keep the mirror |
| controller `start()` | `createStartUpPageContainer` fails after a WebView reload; fall back to `rebuildPageContainer` | `G2.show()` does the same fallback |

## Change

- Primitives were methods on the framebuffer. Make them free functions over a `Framebuffer` so unused
  ones tree-shake, and add clipping (components must never draw outside their rect).
- WordLens hard-codes levels per element (`LEVELS`). g2-kit routes every level through a `Theme` of six
  named levels so they can be retuned per device.
- The queue's retry/gap timings were app constants. Make them options with the same defaults (100 ms gap,
  300 ms retry).
- WordLens's event parser returned app-specific kinds (`scrollTop`). The kit exposes gesture-level names
  (`next`/`prev`) with a configurable swipe direction.
- Font is uppercase only; a UI kit needs lowercase and more punctuation.

## Platform facts collected (with source)

| Fact | Source |
|---|---|
| Canvas 576×288, origin top-left, 16 grey levels shown green | docs: Display & UI |
| ≤ 4 image + ≤ 8 other containers per page; `containerTotalNum` 1–12 | docs + SDK d.ts |
| Image container width 20–288, height 20–144 | SDK d.ts (`ImageContainerProperty`) — docs only give the max |
| Exactly one `isEventCapture: 1` | docs + SDK README |
| `zOrderIndex`: all-or-none per page, unique, larger = front | docs + SDK README + simulator 0.8.0 |
| List ≤ 20 items, item ≤ 64 chars (simulator enforces 63 bytes) | docs; simulator 0.7.3 changelog |
| Text content ≤ 1000 chars on create/rebuild, 2000 on `textContainerUpgrade` (simulator: 999 bytes) | docs; simulator 0.7.1 |
| Border width 0–5, border colour 0–15, radius 0–10, padding 0–32; `textColor` 0–4 | docs + SDK d.ts |
| Menu ≤ 10 items, non-zero unique uint32 IDs, name ≤ 32 UTF-8 bytes; omitting `menuObject` on rebuild clears it | SDK d.ts + README |
| No concurrent image sends; each send holds the image path ~100 ms | docs: Display & UI |
| `updateImageRawData` result strings: success, imageException, imageSizeInvalid, imageToGray4Failed, sendFailed | SDK d.ts + docs |
| Images are encoded (PNG works); simulator ≥ 0.9.2 also accepts raw Gray8 / packed Gray4 | WordLens (PNG, simulator + glasses); simulator changelog (raw) — raw is **unverified on hardware** |
| Long press = `LONG_PRESS_EVENT` (9) then `LONG_PRESS_RELEASE_EVENT` (10), SDK ≥ 0.0.14 / app ≥ 2.2.9; a rebuild mid-press still delivers the release | docs: Device APIs |
| OS uses tap-then-hold for its own contextual menu | docs + WordLens |
| Root page must exit with `shutDownPageContainer(1)` | docs: Page Lifecycle |
| Simulator exposes `--automation-port` HTTP API: `/api/input`, `/api/screenshot/glasses`, `/api/console` | simulator README |

## WordLens "verified on glasses" claims (theirs, not ours)

- Every swipe on a blank text container reached the app and the redraw kept up.
- A fast double-tap is a double-tap, not two single taps.
- Native list edges emit no scroll events.
- Dim marks (levels ~5–7) stay visible.

g2-kit repeats these only as "reported by WordLens"; nothing is marked verified on hardware here.
