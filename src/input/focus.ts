/**
 * Focus model. With one 1-D gesture axis (swipe up/down) plus tap and hold,
 * every UI is a sequence of focus rings:
 *
 *   swipe      move focus (or adjust a value in edit mode)
 *   tap        activate (or enter/commit edit mode)
 *   hold       secondary action / back (or cancel edit mode)
 *   double-tap app level: exit prompt / menu
 *
 * The OS uses tap-then-hold for its own contextual menu, so a hold right after
 * a tap may open the OS menu instead of reaching the app.
 */
import type { G2Event } from '../bridge/events.js'

export type Action = 'focusNext' | 'focusPrev' | 'activate' | 'back' | 'app' | 'none'

export interface GestureMap {
  next: Action
  prev: Action
  tap: Action
  hold: Action
  doubleTap: Action
}

/** The documented default convention. */
export const DEFAULT_GESTURES: GestureMap = {
  next: 'focusNext',
  prev: 'focusPrev',
  tap: 'activate',
  hold: 'back',
  doubleTap: 'app',
}

export interface EditHandler {
  /** Swipe while editing: +1 for next, -1 for prev. */
  adjust(delta: 1 | -1): void
  /** Called on entering edit mode (snapshot the value for cancel). */
  begin?(): void
  /** Tap while editing. */
  commit?(): void
  /** Hold while editing: restore the snapshot. */
  cancel?(): void
}

export interface Focusable {
  id: string
  disabled?: boolean
  /** Tap on a focused, non-editable item. */
  activate?(): void
  /** Hold on a focused item (else the ring's onBack). */
  secondary?(): void
  /** Makes the item editable: tap enters edit mode; swipes adjust. */
  edit?: EditHandler
}

export interface FocusState {
  index: number
  id: string | null
  editing: boolean
}

export interface FocusRingOptions {
  /** Wrap from last to first (default true). */
  wrap?: boolean
  gestures?: Partial<GestureMap>
  /** Called after any focus/edit change: redraw here. */
  onChange?(state: FocusState): void
  /** 'back' action with nothing else to handle it. */
  onBack?(): void
  /** 'app' action (double-tap by default). */
  onApp?(): void
  initial?: number | string
}

export class FocusRing {
  index = 0
  editing = false
  private items: Focusable[]
  private readonly gestures: GestureMap

  constructor(
    items: readonly Focusable[],
    private readonly opts: FocusRingOptions = {},
  ) {
    this.items = [...items]
    this.gestures = { ...DEFAULT_GESTURES, ...opts.gestures }
    if (opts.initial !== undefined) this.focus(opts.initial, false)
    if (this.items[this.index]?.disabled) this.move(1, false)
  }

  get focused(): Focusable | null {
    return this.items[this.index] ?? null
  }

  get state(): FocusState {
    return { index: this.index, id: this.focused?.id ?? null, editing: this.editing }
  }

  /** Is the item with this id focused? Handy in render code. */
  is(id: string): boolean {
    return this.focused?.id === id
  }

  setItems(items: readonly Focusable[], keep = true): void {
    const id = this.focused?.id
    this.items = [...items]
    this.editing = false
    const at = keep && id ? this.items.findIndex((i) => i.id === id) : -1
    this.index = at >= 0 ? at : Math.min(this.index, Math.max(0, this.items.length - 1))
    if (this.items[this.index]?.disabled) this.move(1, false)
    this.changed()
  }

  focus(target: number | string, notify = true): void {
    const i = typeof target === 'number' ? target : this.items.findIndex((it) => it.id === target)
    if (i < 0 || i >= this.items.length) return
    this.index = i
    this.editing = false
    if (notify) this.changed()
  }

  next(): void {
    this.move(1)
  }

  prev(): void {
    this.move(-1)
  }

  private move(step: 1 | -1, notify = true): void {
    const n = this.items.length
    if (n === 0) return
    let i = this.index
    for (let k = 0; k < n; k++) {
      let j = i + step
      if (j < 0 || j >= n) {
        if (this.opts.wrap === false) break
        j = (j + n) % n
      }
      i = j
      if (!this.items[i].disabled) {
        this.index = i
        break
      }
    }
    if (notify) this.changed()
  }

  /** Enter edit mode on the focused item (if editable). */
  beginEdit(): boolean {
    const f = this.focused
    if (!f?.edit || f.disabled) return false
    f.edit.begin?.()
    this.editing = true
    this.changed()
    return true
  }

  commitEdit(): void {
    if (!this.editing) return
    this.focused?.edit?.commit?.()
    this.editing = false
    this.changed()
  }

  cancelEdit(): void {
    if (!this.editing) return
    this.focused?.edit?.cancel?.()
    this.editing = false
    this.changed()
  }

  /** Route one normalised event. Returns true if the ring consumed it. */
  handle(e: G2Event): boolean {
    const f = this.focused
    if (this.editing && f?.edit) {
      if (e.type === 'next' || e.type === 'prev') {
        f.edit.adjust(e.type === 'next' ? 1 : -1)
        this.changed()
        return true
      }
      if (e.type === 'tap') {
        this.commitEdit()
        return true
      }
      if (e.type === 'hold') {
        this.cancelEdit()
        return true
      }
    }
    const key = e.type === 'next' || e.type === 'prev' || e.type === 'tap' || e.type === 'hold' || e.type === 'doubleTap' ? e.type : null
    if (!key) return false
    return this.run(this.gestures[key])
  }

  private run(action: Action): boolean {
    const f = this.focused
    switch (action) {
      case 'focusNext':
        this.next()
        return true
      case 'focusPrev':
        this.prev()
        return true
      case 'activate':
        if (!f || f.disabled) return false
        if (f.edit) return this.beginEdit()
        if (f.activate) {
          f.activate()
          this.changed()
          return true
        }
        return false
      case 'back':
        if (f?.secondary) {
          f.secondary()
          this.changed()
          return true
        }
        if (this.opts.onBack) {
          this.opts.onBack()
          return true
        }
        return false
      case 'app':
        if (this.opts.onApp) {
          this.opts.onApp()
          return true
        }
        return false
      case 'none':
        return false
    }
  }

  private changed(): void {
    this.opts.onChange?.(this.state)
  }
}

/** Step an index by delta with or without wrapping. */
export function stepIndex(i: number, delta: number, n: number, wrap = true): number {
  if (n <= 0) return 0
  const j = i + delta
  return wrap ? ((j % n) + n) % n : Math.max(0, Math.min(n - 1, j))
}

/** Clamp/step a numeric value within [min, max] by `step`, optionally wrapping. */
export function stepValue(v: number, delta: number, o: { min: number; max: number; step?: number; wrap?: boolean }): number {
  const step = o.step ?? 1
  let next = Math.round((v + delta * step) / step) * step
  if (o.wrap) {
    const span = o.max - o.min + step
    next = o.min + ((((next - o.min) % span) + span) % span)
  }
  return Math.max(o.min, Math.min(o.max, Number(next.toFixed(10))))
}
