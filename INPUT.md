# INPUT

The G2 touchpad (temple, or the R1 ring) gives you swipe up, swipe down, tap, double-tap, and long press
with release. Exactly one container per page receives them. g2-kit turns that into skeletons, normalised
events, and focus rings.

## Skeletons

A skeleton is a real container that captures input and shows nothing. Put it **on the canvas, under the
images** (lowest `zOrderIndex`; the layout presets do this).

| Preset | Container | You get | Use when |
|---|---|---|---|
| `blankTextSkeleton(box)` | text, content `' '`, no border | `next` / `prev` per swipe, `tap`, `doubleTap`, `hold` / `release` | drawn controls: carousels, sliders, boards, anything that reacts per swipe |
| `listSkeleton(box, items)` | native list, firmware highlight | `select` with the index on tap; swipes move the firmware highlight and emit **no event** | menus where the firmware highlight is enough |
| `PagedList` | native list pages | > 20 items via `MORE >>` / `<< BACK` entries; `select()` maps a tap to an item (with its global index) or a page change | long lists; a page change needs a rebuild, and a rebuilt list highlights item 0 |
| `HybridSkeleton` | either | list mode for one screen, blank text + drawn control for another; `setMode()` tells you when to rebuild | apps that switch between the two |

Level 0 pixels are "off" (see-through). Anything drawn over a skeleton must either be opaque where it matters,
or the skeleton must show nothing, which is why the text skeleton's content is a single space and its border
is 0.

## Normalised events

`normalizeEvent(raw)` (used by `G2.on`) maps SDK envelopes to:

```ts
type G2Event =
  | { type: 'next' | 'prev'; from: 'text' | 'list' | 'sys'; source? }
  | { type: 'tap' | 'doubleTap' | 'hold' | 'release'; source? }   // source: 'right' | 'left' | 'ring'
  | { type: 'select'; index: number; name: string | null; containerID?; containerName? }
  | { type: 'menu'; itemID: number }                              // contextual menu (tap, then hold)
  | { type: 'foreground' | 'background' }
  | { type: 'exit'; abnormal: boolean }
  | { type: 'imu'; x; y; z }
```

Rules: `CLICK_EVENT` is 0 and protobuf omits zero values, so a tap arrives with `eventType` missing. The
default is resolved per envelope (a scroll plus an empty `sysEvent` is a scroll, not a tap), explicit types
win over the click default, and a missing `currentSelectItemIndex` means 0. Swipe down is `next` by
default (`nextIs: 'up'` flips it). `connect()` checks the mirrored constants against the SDK's
`OsEventTypeList` and throws on drift.

## Truth table

Observed by driving the examples through the **evenhub-simulator 0.9.5** automation API, with SDK 0.0.16
(`npm run sim:check`). The glasses column only repeats what WordLens reported; g2-kit's own glasses testing
so far covers display (see DESIGN.md), not input.

| Source | Gesture | Arrives as (simulator 0.9.5) | g2-kit event | Glasses |
|---|---|---|---|---|
| Native list | tap | `listEvent { containerID, containerName, currentSelectItemIndex }`; index omitted for item 0; no item name | `select` | WordLens: `listEvent` with only the index |
| Native list | swipe | no event, including past either end | none | WordLens: no event, list edges emit nothing |
| Text container | swipe down | `textEvent { containerID, containerName, eventType: 2 }` | `next` | WordLens: same, every swipe arrived |
| Text container | swipe up | `textEvent { …, eventType: 1 }` | `prev` | WordLens: same |
| Text container | tap | `sysEvent { eventSource: 1 }` (no `eventType`) | `tap` | WordLens: `sysEvent` |
| Any | double-tap | `sysEvent { eventType: 3, eventSource: 1 }`, no single tap before it | `doubleTap` | WordLens: a fast double-tap is not two taps |
| Any | long press | `sysEvent { eventType: 9 }` (no `eventSource`) | `hold` | needs SDK ≥ 0.0.15; older SDKs report two taps |
| Any | release | `sysEvent { eventType: 10 }` | `release` | docs: a rebuild mid-press still delivers it |
| Contextual menu | select | `menuItemClickEvent { itemID }` (unit-tested; not driven in the simulator) | `menu` | OS opens it on tap, then hold |

Every row is also a unit test (`test/bridge.test.ts`).

### Still open

- How long after touch-down `LONG_PRESS_EVENT` fires, and whether `HoldToConfirm` progress (one send per
  ~100 ms) is smooth enough.
- Whether every fast swipe reaches the app when the image path is busy (WordLens says yes for one tile).
- `foreground` / `background` events: the simulator does not emit status events.
- Whether hardware accepts raw Gray8 / packed Gray4 image data (`format: 'gray8' | 'gray4'`); the simulator
  does (≥ 0.9.2). PNG is the default and the only format known to work on glasses.

## Focus rings

With one gesture axis, every screen is a sequence of focusable things:

```ts
import { FocusRing, stepValue } from 'g2-kit/input'

const ring = new FocusRing(
  [
    { id: 'play', activate: () => player.toggle() },
    { id: 'volume', edit: {
        begin: () => (saved = volume),
        adjust: (d) => (volume = stepValue(volume, d, { min: 0, max: 100, step: 5 })),
        cancel: () => (volume = saved),
    } },
    { id: 'delete', activate: () => confirm.tap(), disabled: !canDelete },
  ],
  { onChange: () => redraw(), onBack: () => goHome() },
)
g2.on('*', (e) => ring.handle(e))
```

- Swipes move focus, skipping disabled items; `wrap: false` stops at the ends.
- Tap activates. On an editable item, tap enters **edit mode**: swipes now call `adjust(±1)`, tap commits,
  hold cancels (restore the snapshot you took in `begin`).
- Hold runs the item's `secondary`, else `onBack`. Double-tap runs `onApp`; if nothing handles double-tap,
  `G2` shows the system exit prompt (the platform requires double-tap to reach it from the root page).
- `gestures` remaps any gesture to `focusNext | focusPrev | activate | back | app | none`.
- Render from `ring.state` (`index`, `id`, `editing`): e.g. `Slider { focused, editing }`,
  `Roller { focus, editing }`, `ButtonRow { focus }`.

`GridKeyboardState` is a two-level ring for keyboards: swipes pick a row, tap enters it, swipes pick a key,
tap types, hold goes back up.

## Confirming destructive actions

- `TapConfirm`: the first tap arms ("tap again to delete"), a second tap within `timeoutMs` confirms.
  Works everywhere; use this by default.
- `HoldToConfirm`: a ring fills while the user holds; confirms after `durationMs`, cancels on an early
  release. Built on `hold` / `release` events; timing on hardware is unverified (see above).

## Gesture convention

| Gesture | Meaning |
|---|---|
| Swipe down / up | next / previous |
| Tap | activate, enter / commit edit mode |
| Hold | back, secondary, cancel edit mode |
| Double-tap | exit prompt (app level) |
| Tap, then hold | the OS contextual menu (`menuObject`): don't rely on a hold right after a tap reaching the app |
