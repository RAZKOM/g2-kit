/**
 * Keyboards.
 *  - StatusKeyboard: QWERTY display with a mark per key (WordLens's letter
 *    status board, generalised). Display-only or with a focused key.
 *  - GridKeyboard: ABC/T9-style grid for text entry with two-level focus:
 *    swipes move through rows; tap enters the row; swipes move through keys;
 *    tap types; hold goes back up to rows.
 */
import { defineComponent } from '../core/component.js'
import { strokeRect } from '../core/draw.js'
import { drawMark, glyphLevelOn, type Mark } from '../core/encodings.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Rect } from '../core/geometry.js'
import { drawText, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { themeFont } from './common.js'

export const QWERTY = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const

export interface StatusKeyboardProps {
  /** Mark per key (uppercase letter → mark). Unlisted keys are 'outline'. */
  marks?: Readonly<Record<string, Mark>>
  rows?: readonly string[]
  /** Focused key (letter). */
  focus?: string
  gap?: number
}

export function renderStatusKeyboard(fb: Framebuffer, rect: Rect, p: StatusKeyboardProps, theme: Theme): void {
  const lv = theme.levels
  const rows = p.rows ?? QWERTY
  const gap = p.gap ?? 2
  const maxCols = Math.max(...rows.map((r) => r.length))
  const kw = Math.floor((rect.w - gap * (maxCols - 1)) / maxCols)
  const kh = Math.floor((rect.h - gap * (rows.length - 1)) / rows.length)
  const f = themeFont(theme, kh >= 30 && kw >= 18 ? 'body' : 'small', kh >= 30 && kw >= 18 ? 1 : kh >= 20 ? 2 : 1)
  rows.forEach((row, ri) => {
    const rowW = row.length * kw + (row.length - 1) * gap
    const x0 = Math.round(rect.x + (rect.w - rowW) / 2)
    const y = rect.y + ri * (kh + gap)
    ;[...row].forEach((ch, ci) => {
      const x = x0 + ci * (kw + gap)
      const mark = p.marks?.[ch.toUpperCase()] ?? 'outline'
      drawMark(fb, { x, y, w: kw, h: kh }, mark, { fg: lv.full, dim: lv.dim })
      const gl = glyphLevelOn(mark, mark === 'outline' ? lv.bright : lv.full, lv.dim)
      const tw = textWidth(ch, f.font, f.scale)
      drawText(fb, ch, Math.round(x + (kw - tw) / 2), Math.round(y + (kh - f.font.ascent * f.scale) / 2), { font: f.font, scale: f.scale, level: gl })
      if (p.focus && p.focus.toUpperCase() === ch.toUpperCase()) strokeRect(fb, x - 1, y - 1, kw + 2, kh + 2, lv.full, 2)
    })
  })
}

export const StatusKeyboard = defineComponent<StatusKeyboardProps>('StatusKeyboard', { w: 288, h: 120 }, renderStatusKeyboard)

/** Default ABC grid: letters in alphabetical rows plus editing keys. */
export const ABC_ROWS: readonly (readonly string[])[] = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
  ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z', '.', ','],
  ['SPACE', 'DEL', 'OK'],
]

/** Phone-keypad (T9-style) groups; each key cycles through its letters. */
export const T9_ROWS: readonly (readonly string[])[] = [
  ['.,?', 'ABC', 'DEF'],
  ['GHI', 'JKL', 'MNO'],
  ['PQRS', 'TUV', 'WXYZ'],
  ['SPACE', 'DEL', 'OK'],
]

export interface GridKeyboardProps {
  rows?: readonly (readonly string[])[]
  /** Focused row. */
  row: number
  /** Focused key within the row, or -1 while choosing a row. */
  col: number
  /** Text typed so far (shown above the grid when set). */
  text?: string
  /** Cursor blink state is not animated (each frame costs a send): always shown. */
  placeholder?: string
}

export function renderGridKeyboard(fb: Framebuffer, rect: Rect, p: GridKeyboardProps, theme: Theme): void {
  const lv = theme.levels
  const rows = p.rows ?? ABC_ROWS
  // 2 px margin so the focused-row frame (drawn 2 px outside the row) is never clipped.
  let r = { x: rect.x + 2, y: rect.y + 2, w: rect.w - 4, h: rect.h - 4 }
  const body = theme.fonts.body
  if (p.text !== undefined) {
    const h = body.glyphH + 8
    const shown = p.text.length ? p.text : (p.placeholder ?? '')
    strokeRect(fb, r.x, r.y, r.w, h, lv.dim, 1)
    const maxChars = Math.floor((r.w - 16) / body.advance)
    const visible = shown.length > maxChars ? shown.slice(shown.length - maxChars) : shown
    const tw = drawText(fb, visible, r.x + 5, r.y + 4, { font: body, level: p.text.length ? lv.full : lv.dim })
    if (p.text.length || !p.placeholder) fb.fillRect(r.x + 6 + tw + (p.text.length ? 1 : -tw), r.y + 3, 2, body.ascent + 2, lv.full)
    r = { x: r.x, y: r.y + h + 4, w: r.w, h: r.h - h - 4 }
  }
  const gap = 2
  const kh = Math.floor((r.h - gap * (rows.length - 1)) / rows.length)
  rows.forEach((row, ri) => {
    const y = r.y + ri * (kh + gap)
    const rowFocused = ri === p.row
    const choosingRow = p.col < 0
    const weights = row.map((k) => (k.length >= 5 ? 2 : 1))
    const total = weights.reduce((a, b) => a + b, 0)
    const unit = (r.w - gap * (row.length - 1)) / total
    let x = r.x
    row.forEach((k, ci) => {
      const w = Math.round(unit * weights[ci])
      const keyFocused = rowFocused && ci === p.col
      const f = themeFont(theme, textWidth(k, body) + 4 <= w && kh >= body.glyphH + 2 ? 'body' : 'small')
      if (keyFocused) {
        fb.fillRect(x, y, w, kh, lv.full)
      } else {
        const rowLit = rowFocused && choosingRow
        strokeRect(fb, x, y, w, kh, rowLit ? lv.bright : lv.faint, 1)
      }
      const level = keyFocused ? 0 : rowFocused ? lv.full : choosingRow ? lv.mid : lv.dim
      drawText(fb, k, x + w / 2, Math.round(y + (kh - f.font.ascent * f.scale) / 2), { font: f.font, scale: f.scale, level, align: 'center' })
      x += w + gap
    })
    if (rowFocused && choosingRow) strokeRect(fb, r.x - 2, y - 2, r.w + 4, kh + 4, lv.full, 2)
  })
}

export const GridKeyboard = defineComponent<GridKeyboardProps>('GridKeyboard', { w: 288, h: 144 }, renderGridKeyboard)

/**
 * Two-level focus state machine for GridKeyboard. Feed it gestures; it
 * returns the key typed on a tap at key level.
 */
export class GridKeyboardState {
  row = 0
  col = -1
  constructor(readonly rows: readonly (readonly string[])[] = ABC_ROWS) {}

  /** Swipe: move row (row level) or key (key level), wrapping. */
  move(delta: 1 | -1): void {
    if (this.col < 0) this.row = (this.row + delta + this.rows.length) % this.rows.length
    else {
      const n = this.rows[this.row].length
      this.col = (this.col + delta + n) % n
    }
  }

  /** Tap: enter the row, or return the focused key. */
  tap(): string | null {
    if (this.col < 0) {
      this.col = 0
      return null
    }
    return this.rows[this.row][this.col]
  }

  /** Hold: back to row level. Returns false if already there. */
  back(): boolean {
    if (this.col < 0) return false
    this.col = -1
    return true
  }
}
