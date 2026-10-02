/**
 * Text keyboard: a `KeyboardLayout` drawn as firmware text on the G2 text grid (core/textGrid), with key
 * frames drawn once as an image underneath. A swipe moves the focus by swapping the spacer cells around a
 * key for ［ ］: one text update (~60 ms on G2) instead of an image send (~350 ms). The frames change only
 * when the view (letters / symbols) or the shift lock changes.
 *
 * Each line is spacer, key, spacer, key, …; keys share their spacers, so ［ ］ around a key sit where the
 * spacers were and nothing moves. Choosing a group (a row, a column, the action row) brackets the group's
 * run of keys on each of its lines. Letter keys keep the layout's geometry: two cells per key unit, so a
 * half-key stagger is one cell and column scans stay in columns. The action row is packed and centred.
 *
 * Labels must be grid characters: letters, digits and punctuation become fullwidth; action keys use
 * △ ▲ ■ (shift off / once / locked), □ ■ (caps), ◀ (delete), ＿＿＿ (space), ＯＫ, ＥＳＣ, ？１２３ / ａｂｃ.
 * Custom `labels` are converted with `toFullwidth`.
 */
import { defineComponent } from '../core/component.js'
import { strokeRect } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Rect } from '../core/geometry.js'
import { defineTextComponent } from '../core/textComponent.js'
import { GRID_SPACE, TEXT_GRID, toFullwidth } from '../core/textGrid.js'
import type { Theme } from '../core/theme.js'
import type { ActionName, KeyboardLayout, PlacedKey, ShiftState } from './keyboard.js'

/** Cells across a 560 px text box (the canvas less 8 px each side). */
export const TEXT_KEYBOARD_COLS = 28

export interface GridKey {
  /** Index into the view's `keys`. */
  key: number
  line: number
  /** First cell and width in cells. */
  start: number
  len: number
}

export interface TextKeyboardGrid {
  layout: KeyboardLayout
  /** Cells per line. */
  cols: number
  /** Lines in the tallest view. */
  lines: number
  /** Per view: where each key sits (same order as the view's keys). */
  views: GridKey[][]
}

const DEFAULT_LABELS: Record<Exclude<ActionName, 'shift' | 'caps' | 'symbols'>, string> = {
  space: '＿＿＿',
  delete: '◀',
  submit: 'ＯＫ',
  cancel: 'ＥＳＣ',
}

/**
 * Label of a key in a view and shift state. Every state of a key has the same width, so the line doesn't
 * move when shift changes.
 */
export function textKeyLabel(layout: KeyboardLayout, view: number, k: PlacedKey, shift: ShiftState = 'off'): string {
  const labels = layout.labels
  switch (k.action) {
    case 'char':
      return toFullwidth(shift !== 'off' ? k.char!.toUpperCase() : k.char!)
    case 'shift':
      return labels.shift ? toFullwidth(labels.shift) : shift === 'lock' ? '■' : shift === 'once' ? '▲' : '△'
    case 'caps':
      return labels.caps ? toFullwidth(labels.caps) : shift === 'lock' ? '■' : '□'
    case 'symbols': {
      const id = layout.views[view]?.id
      if (labels.symbols) return toFullwidth(labels.symbols)
      return id === 'symbols' ? toFullwidth(labels.letters ?? 'abc') : '？１２３'
    }
    default:
      return labels[k.action] ? toFullwidth(labels[k.action]!) : DEFAULT_LABELS[k.action]
  }
}

/** Width in cells of a line holding these keys: a spacer before each key and one after the last. */
const lineWidth = (keys: GridKey[]) => (keys.length ? Math.max(...keys.map((k) => k.start + k.len)) + 1 : 0)

/**
 * Place a layout's keys on the text grid. Throws a RangeError when a view is wider than `cols` cells (e.g.
 * symbols beside the letters: use `panels: 'layers'`) or taller than `maxLines`.
 */
export function textKeyboardGrid(layout: KeyboardLayout, opts: { cols?: number; maxLines?: number } = {}): TextKeyboardGrid {
  const cols = opts.cols ?? TEXT_KEYBOARD_COLS
  const views = layout.views.map((v, vi) => {
    // One line per distinct key row (by y), top to bottom.
    const ys = [...new Set(v.keys.map((k) => k.y))].sort((a, b) => a - b)
    const placed: GridKey[] = new Array(v.keys.length)
    const charKeys = v.keys.map((k, i) => ({ k, i })).filter(({ k }) => k.action === 'char')
    const minX = Math.min(...charKeys.map(({ k }) => k.x))
    for (const { k, i } of charKeys) {
      placed[i] = { key: i, line: ys.indexOf(k.y), start: 1 + Math.round(2 * (k.x - minX)), len: 1 }
    }
    const charWidth = lineWidth(placed.filter(Boolean))
    // Action keys: packed in order on their own line, centred under the letters.
    const actions = v.keys.map((k, i) => ({ k, i })).filter(({ k }) => k.action !== 'char')
    const byLine = new Map<number, typeof actions>()
    for (const a of actions) byLine.set(ys.indexOf(a.k.y), [...(byLine.get(ys.indexOf(a.k.y)) ?? []), a])
    for (const [line, row] of byLine) {
      const lens = row.map(({ k }) => [...textKeyLabel(layout, vi, k)].length)
      const width = 1 + lens.reduce((a, n) => a + n + 1, 0)
      let cell = Math.floor((charWidth - width) / 2) + 1
      row.forEach(({ i }, j) => {
        placed[i] = { key: i, line, start: cell, len: lens[j] }
        cell += lens[j] + 1
      })
    }
    // Centre the view: shift every key so the widest line sits in the middle (and nothing starts before 1).
    const minStart = Math.min(...placed.map((p) => p.start))
    const width = lineWidth(placed) - minStart + 1
    const shift = Math.floor((cols - width) / 2) + 1 - minStart
    for (const p of placed) p.start += shift
    if (lineWidth(placed) > cols || Math.min(...placed.map((p) => p.start)) < 1)
      throw new RangeError(`keyboard view '${v.id}' needs ${width} cells; ${cols} fit (use panels: 'layers', fewer keys per row, or the drawn Keyboard)`)
    return placed
  })
  const lines = Math.max(...views.map((v) => Math.max(...v.map((k) => k.line)) + 1))
  if (opts.maxLines !== undefined && lines > opts.maxLines) throw new RangeError(`keyboard needs ${lines} lines; ${opts.maxLines} fit`)
  return { layout, cols, lines, views }
}

export interface TextKeyboardProps {
  grid: TextKeyboardGrid
  view?: number
  /** Focused group (-1 for none). */
  group?: number
  /** Focused key within the group, -1 while choosing a group. */
  key?: number
  shift?: ShiftState
}

/** The keyboard as grid text, one line per key row; ［ ］ mark the focused key or group. */
export function renderTextKeyboard(p: TextKeyboardProps): string {
  const vi = p.view ?? 0
  const view = p.grid.layout.views[vi]
  const placed = p.grid.views[vi]
  if (!view || !placed) return ''
  const lines = Array.from({ length: p.grid.lines }, () => [] as string[])
  const put = (line: number, cell: number, ch: string) => {
    const l = lines[line]
    while (l.length <= cell) l.push(GRID_SPACE)
    l[cell] = ch
  }
  for (const g of placed) {
    const label = [...textKeyLabel(p.grid.layout, vi, view.keys[g.key], p.shift)]
    label.forEach((ch, i) => put(g.line, g.start + i, ch))
    put(g.line, g.start + g.len, lines[g.line][g.start + g.len] ?? GRID_SPACE) // trailing spacer
  }
  const group = p.group ?? -1
  const key = p.key ?? -1
  const members = group >= 0 ? (view.groups[group] ?? []) : []
  const marked = key >= 0 ? (members[key] !== undefined ? [members[key]] : []) : members
  // Per line: ［ before the first marked key, ］ after the last.
  const runs = new Map<number, { from: number; to: number }>()
  for (const i of marked) {
    const g = placed[i]
    const r = runs.get(g.line)
    runs.set(g.line, { from: Math.min(r?.from ?? Infinity, g.start), to: Math.max(r?.to ?? -Infinity, g.start + g.len) })
  }
  for (const [line, r] of runs) {
    put(line, r.from - 1, '［')
    put(line, r.to, '］')
  }
  // Pad every line of the view to the same length so a box's content width never changes.
  const width = lineWidth(placed)
  for (const l of lines) while (l.length < width) l.push(GRID_SPACE)
  return lines.map((l) => l.join('')).join('\n')
}

/** Keyboard as firmware text: `［ｑ］ｗ　ｅ…`. Pair with `TextKeyboardFrames` and `layouts.textKeyboard`. */
export const TextKeyboard = defineTextComponent<TextKeyboardProps>('TextKeyboard', renderTextKeyboard)

export interface TextKeyboardFramesProps {
  grid: TextKeyboardGrid
  view?: number
  shift?: ShiftState
  /** Where the keyboard text box's top-left corner is, relative to the rect. */
  origin: { x: number; y: number }
}

/** Key frames on the grid, dim; a locked shift / caps key gets a double frame. */
export function renderTextKeyboardFrames(fb: Framebuffer, rect: Rect, p: TextKeyboardFramesProps, theme: Theme): void {
  const vi = p.view ?? 0
  const view = p.grid.layout.views[vi]
  const placed = p.grid.views[vi]
  if (!view || !placed) return
  const { cell, line, mid } = TEXT_GRID
  for (const g of placed) {
    const k = view.keys[g.key]
    const x = Math.round(rect.x + p.origin.x + g.start * cell - 7)
    const y = rect.y + p.origin.y + g.line * line + mid - 12
    const w = g.len * cell + 14
    const locked = (k.action === 'shift' || k.action === 'caps') && p.shift === 'lock'
    strokeRect(fb, x, y, w, 24, locked ? theme.levels.bright : theme.levels.dim, 1)
    if (locked) strokeRect(fb, x - 2, y - 2, w + 4, 28, theme.levels.bright, 1)
  }
}

export const TextKeyboardFrames = defineComponent<TextKeyboardFramesProps>('TextKeyboardFrames', { w: 576, h: 144 }, renderTextKeyboardFrames)
