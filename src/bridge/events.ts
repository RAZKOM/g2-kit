/**
 * Raw `onEvenHubEvent` envelopes → gesture-level events. Pure: no SDK import,
 * so every row of the observed truth table is unit-tested with plain objects.
 *
 * Rules (SDK d.ts, hub docs, WordLens field notes):
 *  - CLICK_EVENT is 0 and protobuf omits zero values, so a tap arrives with
 *    `eventType` undefined. Resolve that default per envelope, never across
 *    envelopes, or scroll/lifecycle events would also fire a tap.
 *  - Match explicit types first, CLICK last.
 *  - `currentSelectItemIndex` 0 can also arrive missing.
 *  - Long press = LONG_PRESS_EVENT (9) then LONG_PRESS_RELEASE_EVENT (10), SDK ≥ 0.0.14.
 */

/** Mirrors `OsEventTypeList` (checked against the SDK enum by `connect()`). */
export const EV = {
  CLICK: 0,
  SCROLL_TOP: 1,
  SCROLL_BOTTOM: 2,
  DOUBLE_CLICK: 3,
  FOREGROUND_ENTER: 4,
  FOREGROUND_EXIT: 5,
  ABNORMAL_EXIT: 6,
  SYSTEM_EXIT: 7,
  IMU: 8,
  LONG_PRESS: 9,
  LONG_PRESS_RELEASE: 10,
} as const

/** Mirrors `EventSourceType`. */
export const SOURCE = { NONE: 0, GLASSES_R: 1, RING: 2, GLASSES_L: 3 } as const

export type InputSource = 'right' | 'left' | 'ring'

export interface RawEnvelope {
  eventType?: number | null
  containerID?: number
  containerName?: string
  currentSelectItemIndex?: number
  currentSelectItemName?: string
  eventSource?: number
  imuData?: { x?: number; y?: number; z?: number }
}

/** Shape of the SDK's `EvenHubEvent` (only the fields we read). */
export interface RawEvent {
  listEvent?: RawEnvelope
  textEvent?: RawEnvelope
  sysEvent?: RawEnvelope
  menuItemClickEvent?: { itemID?: number }
  audioEvent?: unknown
}

export type GestureType = 'next' | 'prev' | 'tap' | 'doubleTap' | 'hold' | 'release' | 'select'

export type G2Event =
  | { type: 'next' | 'prev'; from: 'text' | 'list' | 'sys'; source?: InputSource }
  | { type: 'tap'; source?: InputSource }
  | { type: 'doubleTap'; source?: InputSource }
  | { type: 'hold'; source?: InputSource }
  | { type: 'release'; source?: InputSource }
  | { type: 'select'; index: number; name: string | null; containerID?: number; containerName?: string }
  | { type: 'menu'; itemID: number }
  | { type: 'foreground' }
  | { type: 'background' }
  | { type: 'exit'; abnormal: boolean }
  | { type: 'imu'; x: number; y: number; z: number }
  | { type: 'ignore' }

export type G2EventType = G2Event['type']

export interface NormalizeOptions {
  /**
   * Which swipe means "next". On a text container, swipe down arrives as
   * SCROLL_BOTTOM. Default 'down' (WordLens: down moves the carousel forward).
   */
  nextIs?: 'down' | 'up'
}

function typeOf(env?: RawEnvelope): number | null {
  if (!env) return null
  return env.eventType ?? EV.CLICK
}

function sourceOf(e: RawEvent): InputSource | undefined {
  const s = e.sysEvent?.eventSource ?? e.textEvent?.eventSource ?? e.listEvent?.eventSource
  return s === SOURCE.GLASSES_R ? 'right' : s === SOURCE.GLASSES_L ? 'left' : s === SOURCE.RING ? 'ring' : undefined
}

export function normalizeEvent(e: RawEvent, opts: NormalizeOptions = {}): G2Event {
  if (e.menuItemClickEvent) {
    const id = e.menuItemClickEvent.itemID
    return typeof id === 'number' && id > 0 ? { type: 'menu', itemID: id } : { type: 'ignore' }
  }

  const list = typeOf(e.listEvent)
  const text = typeOf(e.textEvent)
  const sys = typeOf(e.sysEvent)
  const any = (t: number) => list === t || text === t || sys === t
  const source = sourceOf(e)
  const withSource = <T extends object>(ev: T): T => (source ? { ...ev, source } : ev)

  if (any(EV.LONG_PRESS)) return withSource({ type: 'hold' as const })
  if (any(EV.LONG_PRESS_RELEASE)) return withSource({ type: 'release' as const })
  if (any(EV.DOUBLE_CLICK)) return withSource({ type: 'doubleTap' as const })
  if (sys === EV.SYSTEM_EXIT || sys === EV.ABNORMAL_EXIT) return { type: 'exit', abnormal: sys === EV.ABNORMAL_EXIT }
  if (sys === EV.FOREGROUND_ENTER) return { type: 'foreground' }
  if (sys === EV.FOREGROUND_EXIT) return { type: 'background' }
  if (sys === EV.IMU) {
    const d = e.sysEvent?.imuData
    return d ? { type: 'imu', x: d.x ?? 0, y: d.y ?? 0, z: d.z ?? 0 } : { type: 'ignore' }
  }
  const down = opts.nextIs === 'up' ? 'prev' : 'next'
  const up = down === 'next' ? 'prev' : 'next'
  const from = list !== null && (list === EV.SCROLL_BOTTOM || list === EV.SCROLL_TOP) ? 'list' : text !== null ? 'text' : 'sys'
  if (any(EV.SCROLL_BOTTOM)) return withSource({ type: down, from })
  if (any(EV.SCROLL_TOP)) return withSource({ type: up, from })

  if (e.listEvent && list === EV.CLICK) {
    const name = e.listEvent.currentSelectItemName
    return {
      type: 'select',
      index: e.listEvent.currentSelectItemIndex ?? 0,
      name: typeof name === 'string' && name.length > 0 ? name : null,
      ...(e.listEvent.containerID !== undefined ? { containerID: e.listEvent.containerID } : {}),
      ...(e.listEvent.containerName ? { containerName: e.listEvent.containerName } : {}),
    }
  }
  if (text === EV.CLICK || sys === EV.CLICK) return withSource({ type: 'tap' as const })
  return { type: 'ignore' }
}

/** Resolve a list selection to its label, preferring the reported name. */
export function resolveListItem(items: readonly string[], index: number, name: string | null): string | null {
  if (name !== null) {
    const trimmed = name.trim()
    if (items.includes(trimmed)) return trimmed
  }
  return index >= 0 && index < items.length ? items[index] : null
}

/** Is this a user gesture (as opposed to lifecycle/menu/imu)? */
export function isGesture(e: G2Event): e is Extract<G2Event, { type: GestureType }> {
  return e.type === 'next' || e.type === 'prev' || e.type === 'tap' || e.type === 'doubleTap' || e.type === 'hold' || e.type === 'release' || e.type === 'select'
}
