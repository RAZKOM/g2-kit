/**
 * Keyboard: a configurable text-entry keyboard for one gesture axis.
 *
 * `keyboardLayout(options)` compiles letters (QWERTY, QWERTZ, AZERTY, ABC or
 * your own rows), an optional symbols/numbers set and an action row (shift,
 * caps lock, symbols switch, space, delete, submit, cancel) into views of
 * placed keys and **groups**: what a swipe walks through. Scanning by rows,
 * a swipe moves between rows, tap opens one, swipes move between its keys,
 * tap types; by columns the same goes left to right; 'keys' walks every key.
 *
 * The symbols set is a second layer behind a switch key (`panels: 'layers'`),
 * a panel beside the letters (`'side'`) or below them (`'stack'`). Either way
 * the scan runs through the letters first, then the symbols, then the action
 * row; with `scan: 'columns'` and side panels it runs left to right across both.
 *
 * `KeyboardState` is the headless state machine (focus, shift, layer, text);
 * `Keyboard` draws it; `typingCost` counts the gestures a text needs, to
 * compare configurations.
 */
import { drawBlock } from '../core/block.js'
import { defineComponent } from '../core/component.js'
import { polyline, strokeRect } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Rect, Size } from '../core/geometry.js'
import { drawText, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { themeFont } from './common.js'

export type KeyAction = 'char' | 'shift' | 'caps' | 'symbols' | 'space' | 'delete' | 'submit' | 'cancel'
export type ActionName = Exclude<KeyAction, 'char'>
export type ShiftState = 'off' | 'once' | 'lock'

/** Letter arrangements. Lowercase; shift and caps type uppercase. */
export const LETTER_ROWS = {
  qwerty: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  qwertz: ['qwertzuiop', 'asdfghjkl', 'yxcvbnm'],
  azerty: ['azertyuiop', 'qsdfghjklm', 'wxcvbn'],
  abc: ['abcdefg', 'hijklmn', 'opqrstu', 'vwxyz'],
} as const satisfies Record<string, readonly string[]>

export const DIGIT_ROW = '1234567890'

/** Default symbol rows: wide ones for 'layers' / 'stack', a narrow block for 'side'. */
export const SYMBOL_ROWS = {
  wide: ['.,?!\'":;-/', '@#&*()+=%_', '$<>[]{}~^|'],
  wideWithDigits: [DIGIT_ROW, '.,?!\'":;-/', '@#&*()+=%_'],
  block: ['.,?!\'', '-:;"/', '@#&*%', '()+=_'],
  blockWithDigits: ['12345', '67890', '.,?!\'', '-@#&/'],
} as const

export interface KeyboardOptions {
  /** Letter rows: a preset (default 'qwerty') or your own rows of characters. */
  letters?: keyof typeof LETTER_ROWS | readonly string[]
  /** Digits as a row above the letters, in the symbols set (default), or none. */
  digits?: 'row' | 'symbols' | false
  /** Characters added to the end of the last letter row, e.g. ',.' (default none: they are in the symbols set). */
  punctuation?: string
  /** Symbol rows (default: `SYMBOL_ROWS`, matching `panels` and `digits`), or false for letters only. */
  symbols?: readonly string[] | false
  /** Action keys on the bottom row, in order. Default: shift, symbols (with 'layers'), space, delete, submit. */
  actions?: readonly ActionName[]
  /** Labels for action keys, e.g. { submit: 'Send' }. Shift, caps, space, delete and cancel draw icons unless labelled. */
  labels?: Partial<Record<ActionName, string>> & { letters?: string }
  /** Symbols as a second layer behind a switch key (default), a panel beside the letters, or below them. */
  panels?: 'layers' | 'side' | 'stack'
  /**
   * What a swipe walks first: rows (default), columns (left to right, then the action row), or every key in
   * one line. `typingCost` on short messages: rows ≈ 5.1 gestures/char, columns ≈ 5.5 (6.1 with side
   * panels, which have more columns than rows), keys ≈ 9.4.
   */
  scan?: 'rows' | 'columns' | 'keys'
  /** After typing: back to choosing a row/column (default), or stay on the key. Delete always stays. */
  afterType?: 'group' | 'stay'
}

export interface PlacedKey {
  action: KeyAction
  /** Typed character ('char' keys). */
  char?: string
  label?: string
  /** Position and size in key units. */
  x: number
  y: number
  w: number
  h: number
  /** 0 = letters, 1 = symbols, 2 = action row. */
  panel: 0 | 1 | 2
  row: number
  col: number
}

export interface KeyboardView {
  id: 'letters' | 'symbols' | 'both'
  /** Size in key units. */
  cols: number
  rows: number
  keys: PlacedKey[]
  /** Scan order: groups of indices into `keys`. */
  groups: number[][]
}

export interface KeyboardLayout {
  views: KeyboardView[]
  panels: 'layers' | 'side' | 'stack'
  scan: 'rows' | 'columns' | 'keys'
  afterType: 'group' | 'stay'
  /** Recommended pixel size: 288×144 (layers), 576×144 (side), 288×288 (stack). */
  size: Size
  labels: Partial<Record<ActionName | 'letters', string>>
  /** The options it was compiled from. */
  options: KeyboardOptions
}

const ACTION_WEIGHT: Record<ActionName, number> = { shift: 1.5, caps: 1.5, symbols: 1.5, space: 4, delete: 1.5, submit: 1.5, cancel: 1.5 }

function gridKeys(rows: readonly string[], panel: 0 | 1, x0: number, y0: number, width: number, aligned: boolean): PlacedKey[] {
  const keys: PlacedKey[] = []
  rows.forEach((row, r) => {
    const chars = [...row]
    // Short rows are centred (half-key stagger); whole-key offsets when scanning columns keep them aligned.
    const off = (width - chars.length) / 2
    const col = Math.floor(off)
    chars.forEach((ch, i) => keys.push({ action: 'char', char: ch, x: x0 + (aligned ? col : off) + i, y: y0 + r, w: 1, h: 1, panel, row: r, col: col + i }))
  })
  return keys
}

function actionKeys(actions: readonly ActionName[], y: number, width: number): PlacedKey[] {
  const total = actions.reduce((a, n) => a + ACTION_WEIGHT[n], 0)
  let x = 0
  return actions.map((a, i) => {
    const w = (ACTION_WEIGHT[a] / total) * width
    const k: PlacedKey = { action: a, x, y, w, h: 1, panel: 2, row: 0, col: i }
    x += w
    return k
  })
}

function scanGroups(keys: PlacedKey[], scan: KeyboardLayout['scan']): number[][] {
  const idx = keys.map((_, i) => i)
  const inPanel = (p: number) => idx.filter((i) => keys[i].panel === p)
  if (scan === 'keys') {
    const order = [0, 1, 2].flatMap((p) => inPanel(p).sort((a, b) => keys[a].row - keys[b].row || keys[a].col - keys[b].col))
    return [order]
  }
  const groups: number[][] = []
  for (const p of [0, 1]) {
    const ks = inPanel(p)
    if (!ks.length) continue
    const by = (k: PlacedKey) => (scan === 'rows' ? k.row : k.col)
    const within = (k: PlacedKey) => (scan === 'rows' ? k.col : k.row)
    const n = Math.max(...ks.map((i) => by(keys[i]))) + 1
    for (let g = 0; g < n; g++) {
      const members = ks.filter((i) => by(keys[i]) === g).sort((a, b) => within(keys[a]) - within(keys[b]))
      if (members.length) groups.push(members)
    }
  }
  const actions = inPanel(2)
  if (actions.length) groups.push(actions)
  return groups
}

/** Compile keyboard options into views, key positions and scan groups. */
export function keyboardLayout(o: KeyboardOptions = {}): KeyboardLayout {
  const digits = o.digits ?? 'symbols'
  let panels = o.panels ?? 'layers'
  const letterRows = [...(typeof o.letters === 'object' ? o.letters : LETTER_ROWS[o.letters ?? 'qwerty'])]
  if (o.punctuation) letterRows[letterRows.length - 1] += o.punctuation
  if (digits === 'row') letterRows.unshift(DIGIT_ROW)
  const withDigits = digits === 'symbols'
  const symbolRows: readonly string[] =
    o.symbols === false ? [] : (o.symbols ?? (panels === 'side' ? (withDigits ? SYMBOL_ROWS.blockWithDigits : SYMBOL_ROWS.block) : withDigits ? SYMBOL_ROWS.wideWithDigits : SYMBOL_ROWS.wide))
  if (!symbolRows.length) panels = 'layers'
  const scan = o.scan ?? 'rows'
  const cols = scan === 'columns'
  const layered = panels === 'layers' && symbolRows.length > 0
  const actions = (o.actions ?? ['shift', 'symbols', 'space', 'delete', 'submit']).filter((a) => a !== 'symbols' || layered)

  const lw = Math.max(...letterRows.map((r) => [...r].length))
  const lh = letterRows.length
  const sw = symbolRows.length ? Math.max(...symbolRows.map((r) => [...r].length)) : 0
  const sh = symbolRows.length
  const views: KeyboardView[] = []
  const view = (id: KeyboardView['id'], cols: number, rows: number, keys: PlacedKey[]): KeyboardView => {
    const all = [...keys, ...actionKeys(actions, rows - 1, cols)]
    return { id, cols, rows, keys: all, groups: scanGroups(all, scan) }
  }
  if (panels === 'side') {
    const h = Math.max(lh, sh)
    views.push(view('both', lw + 0.5 + sw, h + 1, [...gridKeys(letterRows, 0, 0, (h - lh) / 2, lw, cols), ...gridKeys(symbolRows, 1, lw + 0.5, (h - sh) / 2, sw, cols)]))
  } else if (panels === 'stack') {
    const w = Math.max(lw, sw)
    views.push(view('both', w, lh + 0.25 + sh + 1, [...gridKeys(letterRows, 0, (w - lw) / 2, 0, lw, cols), ...gridKeys(symbolRows, 1, (w - sw) / 2, lh + 0.25, sw, cols)]))
  } else {
    // Both layers share one size, so keys don't jump when switching.
    const w = Math.max(lw, sw)
    const h = Math.max(lh, sh)
    views.push(view('letters', w, h + 1, gridKeys(letterRows, 0, 0, (h - lh) / 2, w, cols)))
    if (layered) views.push(view('symbols', w, h + 1, gridKeys(symbolRows, 1, 0, (h - sh) / 2, w, cols)))
  }
  const size = panels === 'side' ? { w: 576, h: 144 } : panels === 'stack' ? { w: 288, h: 288 } : { w: 288, h: 144 }
  return { views, panels, scan, afterType: o.afterType ?? 'group', size, labels: o.labels ?? {}, options: o }
}

/** What a tap did. */
export type KeyboardEffect = 'opened' | 'typed' | 'deleted' | 'mode' | 'submit' | 'cancel' | 'none'

const isLetter = (c: string) => c.toLowerCase() !== c.toUpperCase()

/**
 * Focus, shift, layer and text for a `KeyboardLayout`. Feed it gestures:
 * `move(±1)` for swipes, `tap()`, `back()` for hold (false at the top level).
 * Entering a group lands on the key used last in it; a group with one key
 * types on the first tap.
 */
export class KeyboardState {
  view = 0
  group = 0
  /** Focused key within the group, or -1 while choosing a group. */
  key = -1
  shift: ShiftState = 'off'
  text: string
  readonly maxLength: number
  private last = new Map<string, number>()

  constructor(
    readonly layout: KeyboardLayout,
    opts: { text?: string; maxLength?: number } = {},
  ) {
    this.maxLength = opts.maxLength ?? Infinity
    this.text = (opts.text ?? '').slice(0, this.maxLength)
    if (layout.scan === 'keys') this.key = 0
  }

  get current(): KeyboardView {
    return this.layout.views[this.view]
  }

  /** The focused key, when a group is open. */
  get focusedKey(): PlacedKey | null {
    return this.key < 0 ? null : this.current.keys[this.current.groups[this.group][this.key]]
  }

  /** Props for `Keyboard`. */
  get props(): KeyboardProps {
    return { layout: this.layout, view: this.view, group: this.group, key: this.key, shift: this.shift }
  }

  move(delta: 1 | -1): void {
    const wrap = (i: number, n: number) => (i + delta + n) % n
    if (this.key < 0) this.group = wrap(this.group, this.current.groups.length)
    else this.key = wrap(this.key, this.current.groups[this.group].length)
  }

  back(): boolean {
    if (this.key < 0 || this.layout.scan === 'keys') return false
    this.remember()
    this.key = -1
    return true
  }

  tap(): KeyboardEffect {
    const members = this.current.groups[this.group]
    if (this.key < 0) {
      this.key = Math.min(this.last.get(`${this.view}:${this.group}`) ?? 0, members.length - 1)
      if (members.length > 1) return 'opened'
    }
    return this.press(this.current.keys[members[this.key]])
  }

  /** Copy (for planning, e.g. `typingCost`). */
  clone(): KeyboardState {
    const s = new KeyboardState(this.layout, { text: this.text, maxLength: this.maxLength })
    s.view = this.view
    s.group = this.group
    s.key = this.key
    s.shift = this.shift
    s.last = new Map(this.last)
    return s
  }

  private remember(): void {
    if (this.key >= 0) this.last.set(`${this.view}:${this.group}`, this.key)
  }

  private leave(): void {
    if (this.layout.afterType === 'stay' || this.layout.scan === 'keys') return
    this.remember()
    this.key = -1
  }

  private press(k: PlacedKey): KeyboardEffect {
    switch (k.action) {
      case 'char':
      case 'space': {
        if (this.text.length >= this.maxLength) return 'none'
        const c = k.action === 'space' ? ' ' : this.shift !== 'off' ? k.char!.toUpperCase() : k.char!
        this.text += c
        if (this.shift === 'once' && isLetter(c)) this.shift = 'off'
        this.leave()
        return 'typed'
      }
      case 'delete':
        // Stays on the key, so repeated taps keep deleting.
        if (!this.text) return 'none'
        this.text = this.text.slice(0, -1)
        return 'deleted'
      case 'shift': {
        const hasCaps = this.current.keys.some((x) => x.action === 'caps')
        this.shift = this.shift === 'off' ? 'once' : this.shift === 'once' && !hasCaps ? 'lock' : 'off'
        this.leave()
        return 'mode'
      }
      case 'caps':
        this.shift = this.shift === 'lock' ? 'off' : 'lock'
        this.leave()
        return 'mode'
      case 'symbols': {
        // Land on the same switch key in the other layer.
        this.remember()
        this.view = (this.view + 1) % this.layout.views.length
        const v = this.current
        const target = v.keys.findIndex((x) => x.action === 'symbols')
        this.group = Math.max(0, v.groups.findIndex((g) => g.includes(target)))
        this.key = Math.max(0, v.groups[this.group].indexOf(target))
        this.leave()
        return 'mode'
      }
      case 'submit':
        return 'submit'
      case 'cancel':
        return 'cancel'
    }
  }
}

export interface KeyboardProps {
  layout: KeyboardLayout
  view?: number
  /** Focused group (-1 for none). */
  group?: number
  /** Focused key within the group, -1 while choosing a group. */
  key?: number
  shift?: ShiftState
  /** Optional text line above the keys. */
  text?: string
}

function groupBounds(v: KeyboardView, g: number): { x0: number; y0: number; x1: number; y1: number } {
  const ks = v.groups[g].map((i) => v.keys[i])
  return { x0: Math.min(...ks.map((k) => k.x)), y0: Math.min(...ks.map((k) => k.y)), x1: Math.max(...ks.map((k) => k.x + k.w)), y1: Math.max(...ks.map((k) => k.y + k.h)) }
}

/** Action icons on the 16-unit icon grid (outlined, so a key reads as a key). */
function drawActionIcon(fb: Framebuffer, action: ActionName, cx: number, cy: number, s: number, level: number, shift: ShiftState): void {
  const k = s / 16
  const x = cx - s / 2
  const y = cy - s / 2
  const P = (px: number, py: number) => ({ x: x + px * k, y: y + py * k })
  const w = s < 12 ? 1 : 2
  const path = (pts: Array<[number, number]>) => polyline(fb, pts.map(([a, b]) => P(a, b)), level, { width: w })
  if (action === 'shift' || action === 'caps') {
    path([[8, 1], [15, 8], [11, 8], [11, 12], [5, 12], [5, 8], [1, 8], [8, 1]])
    if (action === 'caps' || shift !== 'off') path([[4, 15], [12, 15]])
  } else if (action === 'delete') {
    path([[5, 3], [15, 3], [15, 13], [5, 13], [1, 8], [5, 3]])
    path([[8, 6], [12, 10]])
    path([[12, 6], [8, 10]])
  } else if (action === 'space') path([[1, 8], [1, 12], [15, 12], [15, 8]])
  else if (action === 'cancel') {
    path([[3, 3], [13, 13]])
    path([[13, 3], [3, 13]])
  }
}

export function renderKeyboard(fb: Framebuffer, rect: Rect, p: KeyboardProps, theme: Theme): void {
  const lv = theme.levels
  const v = p.layout.views[p.view ?? 0] ?? p.layout.views[0]
  const group = p.group ?? -1
  const key = p.key ?? -1
  const shift = p.shift ?? 'off'
  const body = theme.fonts.body
  // 2 px margin for the group frame, drawn 2 px outside the keys.
  let r = { x: rect.x + 2, y: rect.y + 2, w: rect.w - 4, h: rect.h - 4 }
  if (p.text !== undefined) {
    const h = body.glyphH + 8
    strokeRect(fb, r.x, r.y, r.w, h, lv.dim, 1)
    const max = Math.floor((r.w - 16) / body.advance)
    const shown = p.text.length > max ? p.text.slice(p.text.length - max) : p.text
    const tw = drawText(fb, shown, r.x + 5, r.y + 4, { font: body, level: lv.full })
    fb.fillRect(r.x + 6 + tw + 1, r.y + 3, 2, body.ascent + 2, lv.full)
    r = { x: r.x, y: r.y + h + 4, w: r.w, h: r.h - h - 4 }
  }
  const gap = 2
  const uw = (r.w + gap) / v.cols
  const uh = (r.h + gap) / v.rows
  const px = (k: { x: number; y: number; w: number; h: number }): Rect => {
    const x0 = Math.round(r.x + k.x * uw)
    const y0 = Math.round(r.y + k.y * uh)
    return { x: x0, y: y0, w: Math.round(r.x + (k.x + k.w) * uw) - gap - x0, h: Math.round(r.y + (k.y + k.h) * uh) - gap - y0 }
  }
  const inGroup = new Set(group >= 0 && v.groups[group] ? v.groups[group] : [])
  const focusIndex = key >= 0 && v.groups[group] ? v.groups[group][key] : -1
  const choosing = key < 0
  const labels = p.layout.labels
  v.keys.forEach((k, i) => {
    const b = px(k)
    const focused = i === focusIndex
    const member = inGroup.has(i)
    const locked = (k.action === 'shift' || k.action === 'caps') && shift === 'lock'
    let solid = false
    if (focused) solid = drawBlock(fb, b.x, b.y, b.w, b.h, lv.full, theme, { width: 2, double: true })
    else if (locked) solid = drawBlock(fb, b.x, b.y, b.w, b.h, lv.bright, theme, { width: 1, double: true })
    else strokeRect(fb, b.x, b.y, b.w, b.h, member ? lv.bright : lv.faint, 1)
    const level = solid ? 0 : focused || (member && choosing) ? lv.full : member ? lv.bright : choosing && group >= 0 ? lv.mid : lv.dim
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    let label = k.char ?? labels[k.action as ActionName]
    if (k.action === 'char' && shift !== 'off') label = label!.toUpperCase()
    if (k.action === 'symbols' && !labels.symbols) label = v.id === 'symbols' ? (labels.letters ?? 'abc') : '?123'
    if (k.action === 'submit' && !label) label = 'OK'
    if (label === undefined) {
      const room = Math.min(b.h, b.w) - 6
      const s = room >= 16 ? 16 : room >= 12 ? 12 : 8
      drawActionIcon(fb, k.action as ActionName, Math.round(cx), Math.round(cy), s, level, shift)
      return
    }
    const f = themeFont(theme, textWidth(label, body) + 4 <= b.w && b.h >= body.glyphH + 2 ? 'body' : 'small')
    drawText(fb, label, Math.round(cx), Math.round(cy - (f.font.ascent * f.scale) / 2), { font: f.font, scale: f.scale, level, align: 'center' })
  })
  if (group >= 0 && choosing && v.groups[group]) {
    const g = groupBounds(v, group)
    const a = px({ x: g.x0, y: g.y0, w: g.x1 - g.x0, h: g.y1 - g.y0 })
    strokeRect(fb, a.x - 2, a.y - 2, a.w + 4, a.h + 4, lv.full, 2)
  }
}

export const Keyboard = defineComponent<KeyboardProps>('Keyboard', { w: 288, h: 144 }, renderKeyboard)

export interface TypingCost {
  /** Swipes + taps + holds. */
  gestures: number
  swipes: number
  taps: number
  holds: number
  /** Gestures per typed character. */
  perChar: number
  /** Characters the layout cannot type. */
  missing: string
}

/**
 * Fewest gestures to type `text` on `layout`, one character at a time
 * (breadth-first over swipes, taps and holds; swipes wrap). For comparing
 * configurations: letters, scan, panels, afterType, punctuation placement.
 */
export function typingCost(layout: KeyboardLayout, text: string): TypingCost {
  let s = new KeyboardState(layout)
  const cost = { swipes: 0, taps: 0, holds: 0 }
  let missing = ''
  let typed = 0
  for (const ch of text) {
    type Node = { st: KeyboardState; swipes: number; taps: number; holds: number }
    const seen = new Set<string>()
    const id = (st: KeyboardState) => `${st.view},${st.group},${st.key},${st.shift}`
    let frontier: Node[] = [{ st: s, swipes: 0, taps: 0, holds: 0 }]
    seen.add(id(s))
    let found: Node | null = null
    while (frontier.length && !found) {
      const next: Node[] = []
      for (const n of frontier) {
        const tries: Array<[KeyboardState, 'swipes' | 'taps' | 'holds']> = []
        for (const d of [1, -1] as const) {
          const m = n.st.clone()
          m.move(d)
          tries.push([m, 'swipes'])
        }
        const b = n.st.clone()
        if (b.back()) tries.push([b, 'holds'])
        const t = n.st.clone()
        const before = t.text
        const eff = t.tap()
        if (eff === 'typed' && t.text === before + ch) {
          found = { st: t, swipes: n.swipes, taps: n.taps + 1, holds: n.holds }
          break
        }
        if (eff === 'opened' || eff === 'mode') tries.push([t, 'taps'])
        for (const [st, kind] of tries) {
          if (seen.has(id(st))) continue
          seen.add(id(st))
          next.push({ ...n, st, [kind]: n[kind] + 1 })
        }
      }
      frontier = next
    }
    if (!found) {
      missing += ch
      continue
    }
    const f: Node = found
    cost.swipes += f.swipes
    cost.taps += f.taps
    cost.holds += f.holds
    s = f.st
    typed++
  }
  const gestures = cost.swipes + cost.taps + cost.holds
  return { gestures, ...cost, perChar: typed ? gestures / typed : 0, missing }
}
