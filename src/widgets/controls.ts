/**
 * Edit-mode controls: segmented control, slider, number roller, time and date
 * pickers, checklist. Pair them with FocusRing: tap enters edit mode, swipes
 * adjust, tap commits, hold cancels.
 */
import { defineComponent } from '../core/component.js'
import { fillTriangle, line, roundRect, strokeRect } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import { cut, inset, splitColumns, type Rect } from '../core/geometry.js'
import { drawText, ellipsize, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { themeFont } from './common.js'

export interface SegmentedControlProps {
  options: readonly string[]
  selected: number
  /** Focus ring around the whole control. */
  focused?: boolean
  /** In edit mode the selection follows swipes; a caret marks it. */
  editing?: boolean
}

/** 2–4 options in one pill; the selected segment is filled. */
export function renderSegmentedControl(fb: Framebuffer, rect: Rect, p: SegmentedControlProps, theme: Theme): void {
  const lv = theme.levels
  const r = inset(rect, 3)
  const n = p.options.length
  if (!n) return
  roundRect(fb, r.x, r.y, r.w, r.h, Math.min(theme.radius, r.h / 3), { stroke: p.focused || p.editing ? lv.full : lv.mid, width: p.focused || p.editing ? 2 : 1 })
  const cells = splitColumns(inset(r, 3), p.options.map(() => 1), 2)
  const f = theme.fonts.body
  cells.forEach((c, i) => {
    const sel = i === p.selected
    if (sel) fb.fillRect(c.x, c.y, c.w, c.h, p.editing ? lv.full : lv.bright)
    else if (i > 0 && p.selected !== i - 1) fb.fillRect(c.x - 2, c.y + 3, 1, c.h - 6, lv.dim)
    const text = ellipsize(p.options[i], c.w - 6, f)
    drawText(fb, text, c.x + c.w / 2, Math.round(c.y + (c.h - f.ascent) / 2), { font: f, level: sel ? 0 : lv.bright, align: 'center' })
  })
  if (p.editing) {
    const c = cells[p.selected]
    if (c) {
      const cx = c.x + c.w / 2
      fillTriangle(fb, { x: cx - 4, y: rect.y }, { x: cx + 4, y: rect.y }, { x: cx, y: rect.y + 3 }, lv.full)
    }
  }
}

export const SegmentedControl = defineComponent<SegmentedControlProps>('SegmentedControl', { w: 288, h: 36 }, renderSegmentedControl)

export interface SliderProps {
  value: number
  min?: number
  max?: number
  step?: number
  label?: string
  focused?: boolean
  /** Edit mode: thumb enlarged, value bubble shown, arrows hint the swipe axis. */
  editing?: boolean
  orientation?: 'horizontal' | 'vertical'
  /** Value text (default: the number). */
  format?: (v: number) => string
  /** Tick marks at each step when there are ≤ 20 steps (default true). */
  ticks?: boolean
}

export function renderSlider(fb: Framebuffer, rect: Rect, p: SliderProps, theme: Theme): void {
  const lv = theme.levels
  const min = p.min ?? 0
  const max = p.max ?? 100
  const t = Math.max(0, Math.min(1, (p.value - min) / (max - min || 1)))
  const fmt = p.format ?? ((v: number) => String(Math.round(v * 100) / 100))
  const f = theme.fonts.body
  let r = inset(rect, 4)
  const vertical = p.orientation === 'vertical'
  if (p.label && !vertical) {
    const [strip, rest] = cut(r, 'top', f.glyphH + 4)
    drawText(fb, ellipsize(p.label, strip.w - 40, f), strip.x, strip.y, { font: f, level: p.focused || p.editing ? lv.full : lv.bright })
    if (!p.editing) drawText(fb, fmt(p.value), strip.x + strip.w, strip.y, { font: f, level: lv.bright, align: 'right' })
    r = rest
  }
  const thumb = p.editing ? 9 : 6
  if (!vertical) {
    const bubbleH = p.editing ? f.glyphH + 8 : 0
    const cy = Math.round(r.y + bubbleH + (r.h - bubbleH) / 2)
    const x0 = r.x + thumb + 2
    const x1 = r.x + r.w - thumb - 3
    const tx = Math.round(x0 + (x1 - x0) * t)
    fb.fillRect(x0, cy - 1, x1 - x0, 3, lv.dim)
    fb.fillRect(x0, cy - 2, tx - x0, 5, lv.bright)
    const steps = p.step ? Math.round((max - min) / p.step) : 0
    if (p.ticks !== false && steps > 0 && steps <= 20) for (let i = 0; i <= steps; i++) fb.fillRect(Math.round(x0 + ((x1 - x0) * i) / steps), cy + 5, 1, 3, lv.dim)
    if (p.editing) {
      roundRect(fb, tx - thumb, cy - thumb, thumb * 2 + 1, thumb * 2 + 1, thumb, { fill: lv.full })
      const text = fmt(p.value)
      const bw = textWidth(text, f) + 10
      const bx = Math.max(rect.x, Math.min(rect.x + rect.w - bw, tx - bw / 2))
      roundRect(fb, bx, r.y, bw, f.glyphH + 4, 3, { fill: lv.full })
      drawText(fb, text, bx + bw / 2, r.y + 2, { font: f, level: 0, align: 'center' })
      // Swipe hint arrows at the ends.
      fillTriangle(fb, { x: r.x, y: cy }, { x: r.x + 5, y: cy - 5 }, { x: r.x + 5, y: cy + 5 }, lv.mid)
      fillTriangle(fb, { x: r.x + r.w - 1, y: cy }, { x: r.x + r.w - 6, y: cy - 5 }, { x: r.x + r.w - 6, y: cy + 5 }, lv.mid)
    } else {
      roundRect(fb, tx - thumb, cy - thumb, thumb * 2 + 1, thumb * 2 + 1, thumb, { fill: 0, stroke: p.focused ? lv.full : lv.bright, width: 2 })
    }
    if (p.focused && !p.editing) strokeRect(fb, rect.x, rect.y, rect.w, rect.h, lv.full, 1)
    return
  }
  // Vertical: bottom = min.
  const cx = Math.round(r.x + r.w / 2)
  const y0 = r.y + thumb + 2
  const y1 = r.y + r.h - thumb - 3 - (p.label ? f.glyphH + 4 : 0)
  const ty = Math.round(y1 - (y1 - y0) * t)
  fb.fillRect(cx - 1, y0, 3, y1 - y0, lv.dim)
  fb.fillRect(cx - 2, ty, 5, y1 - ty, lv.bright)
  if (p.editing) roundRect(fb, cx - thumb, ty - thumb, thumb * 2 + 1, thumb * 2 + 1, thumb, { fill: lv.full })
  else roundRect(fb, cx - thumb, ty - thumb, thumb * 2 + 1, thumb * 2 + 1, thumb, { fill: 0, stroke: p.focused ? lv.full : lv.bright, width: 2 })
  const text = fmt(p.value)
  drawText(fb, text, Math.min(rect.x + rect.w - textWidth(text, f) - 2, cx + thumb + 4), ty - Math.round(f.ascent / 2), { font: f, level: p.editing ? lv.full : lv.bright })
  if (p.label) drawText(fb, ellipsize(p.label, r.w, f), cx, r.y + r.h - f.glyphH, { font: f, level: lv.bright, align: 'center' })
  if (p.focused && !p.editing) strokeRect(fb, rect.x, rect.y, rect.w, rect.h, lv.full, 1)
}

export const Slider = defineComponent<SliderProps>('Slider', { w: 288, h: 56 }, renderSlider)

export interface RollerColumn {
  /** Values this column cycles through. */
  values: readonly string[]
  index: number
  /** Separator drawn after this column (e.g. ':'). */
  after?: string
}

export interface RollerProps {
  columns: readonly RollerColumn[]
  /** Focused column (-1 none). */
  focus?: number
  /** Focused column is being edited (swipes roll it). */
  editing?: boolean
  label?: string
  /** Show the previous/next values above/below (default true when there is room). */
  neighbours?: boolean
}

/**
 * Slot-machine roller: one column per digit/field. The current value is big
 * and boxed when focused; neighbours show dim above and below, so the swipe
 * direction is obvious. Used for PINs, timers, amounts, time and date.
 */
export function renderRoller(fb: Framebuffer, rect: Rect, p: RollerProps, theme: Theme): void {
  const lv = theme.levels
  let r = rect
  const body = theme.fonts.body
  if (p.label) {
    const [strip, rest] = cut(r, 'top', body.glyphH + 4)
    drawText(fb, ellipsize(p.label, strip.w, body), strip.x + strip.w / 2, strip.y, { font: body, level: lv.mid, align: 'center' })
    r = rest
  }
  const big = themeFont(theme, 'display')
  const small = themeFont(theme, 'body')
  const showN = p.neighbours ?? r.h >= big.font.glyphH + 2 * small.font.glyphH + 24
  const colW = (c: RollerColumn) => Math.max(...c.values.map((v) => textWidth(v, big.font))) + 14
  const sepW = (c: RollerColumn) => (c.after ? textWidth(c.after, big.font) + 6 : 0)
  const total = p.columns.reduce((a, c) => a + colW(c) + sepW(c), 0) + (p.columns.length - 1) * 4
  let x = Math.round(r.x + (r.w - total) / 2)
  const cy = Math.round(r.y + r.h / 2)
  const boxH = big.font.glyphH + 10
  p.columns.forEach((c, i) => {
    const w = colW(c)
    const n = c.values.length
    const idx = ((c.index % n) + n) % n
    const focused = p.focus === i
    const editing = focused && p.editing
    const by = cy - Math.round(boxH / 2)
    if (editing) roundRect(fb, x, by, w, boxH, 3, { fill: lv.full })
    else if (focused) strokeRect(fb, x, by, w, boxH, lv.full, 2)
    else strokeRect(fb, x, by, w, boxH, lv.faint, 1)
    drawText(fb, c.values[idx], x + w / 2, by + 5, { font: big.font, level: editing ? 0 : focused ? lv.full : lv.bright, align: 'center' })
    if (showN) {
      const prev = c.values[(idx - 1 + n) % n]
      const next = c.values[(idx + 1) % n]
      const lvl = focused ? lv.mid : lv.dim
      // Leave room for the edit arrows between the box and the neighbours.
      drawText(fb, prev, x + w / 2, by - small.font.glyphH - 8, { font: small.font, level: lvl, align: 'center' })
      drawText(fb, next, x + w / 2, by + boxH + 8, { font: small.font, level: lvl, align: 'center' })
    }
    if (editing) {
      fillTriangle(fb, { x: x + w / 2 - 4, y: by - 2 }, { x: x + w / 2 + 4, y: by - 2 }, { x: x + w / 2, y: by - 6 }, lv.full)
      fillTriangle(fb, { x: x + w / 2 - 4, y: by + boxH + 1 }, { x: x + w / 2 + 4, y: by + boxH + 1 }, { x: x + w / 2, y: by + boxH + 5 }, lv.full)
    }
    x += w
    if (c.after) {
      drawText(fb, c.after, x + 3, by + 5, { font: big.font, level: lv.bright })
      x += sepW(c)
    }
    x += 4
  })
}

export const Roller = defineComponent<RollerProps>('Roller', { w: 288, h: 96 }, renderRoller)

const pad2 = (n: number) => String(n).padStart(2, '0')
const range = (a: number, b: number, f: (n: number) => string = pad2) => Array.from({ length: b - a + 1 }, (_, i) => f(a + i))

/** Digit columns for multi-digit entry (PIN, amount). */
export function digitColumns(value: string, opts: { after?: Record<number, string> } = {}): RollerColumn[] {
  const digits = range(0, 9, String)
  return [...value].map((ch, i) => ({ values: digits, index: Math.max(0, digits.indexOf(ch)), after: opts.after?.[i] }))
}

export interface TimePickerProps {
  hours: number
  minutes: number
  seconds?: number
  /** 12-hour display with an AM/PM column (default false). */
  twelveHour?: boolean
  /** Focused field: 0 = hours, 1 = minutes, 2 = seconds (or AM/PM). */
  focus?: number
  editing?: boolean
  label?: string
  minuteStep?: number
}

export function timeColumns(p: TimePickerProps): RollerColumn[] {
  const step = p.minuteStep ?? 1
  const mins = range(0, Math.floor(59 / step)).map((_, i) => pad2(i * step))
  const cols: RollerColumn[] = []
  if (p.twelveHour) cols.push({ values: range(1, 12), index: ((p.hours + 11) % 12), after: ':' })
  else cols.push({ values: range(0, 23), index: p.hours, after: ':' })
  cols.push({ values: mins, index: Math.round(p.minutes / step) % mins.length, after: p.seconds !== undefined ? ':' : undefined })
  if (p.seconds !== undefined) cols.push({ values: range(0, 59), index: p.seconds })
  if (p.twelveHour) cols.push({ values: ['AM', 'PM'], index: p.hours >= 12 ? 1 : 0 })
  return cols
}

export function renderTimePicker(fb: Framebuffer, rect: Rect, p: TimePickerProps, theme: Theme): void {
  renderRoller(fb, rect, { columns: timeColumns(p), focus: p.focus, editing: p.editing, label: p.label }, theme)
}

export const TimePicker = defineComponent<TimePickerProps>('TimePicker', { w: 288, h: 120 }, renderTimePicker)

export interface DatePickerProps {
  year: number
  /** 1–12 */
  month: number
  day: number
  focus?: number
  editing?: boolean
  label?: string
  /** Column order (default 'dmy'). */
  order?: 'dmy' | 'mdy' | 'ymd'
  minYear?: number
  maxYear?: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function dateColumns(p: DatePickerProps): RollerColumn[] {
  const y0 = p.minYear ?? p.year - 50
  const y1 = p.maxYear ?? p.year + 50
  const cols: Record<'d' | 'm' | 'y', RollerColumn> = {
    d: { values: range(1, daysInMonth(p.year, p.month)), index: p.day - 1 },
    m: { values: MONTHS, index: p.month - 1 },
    y: { values: range(y0, y1, String), index: p.year - y0 },
  }
  return [...(p.order ?? 'dmy')].map((k) => cols[k as 'd' | 'm' | 'y'])
}

export function renderDatePicker(fb: Framebuffer, rect: Rect, p: DatePickerProps, theme: Theme): void {
  renderRoller(fb, rect, { columns: dateColumns(p), focus: p.focus, editing: p.editing, label: p.label }, theme)
}

export const DatePicker = defineComponent<DatePickerProps>('DatePicker', { w: 288, h: 120 }, renderDatePicker)

export interface ChecklistProps {
  items: ReadonlyArray<{ label: string; done?: boolean }>
  focus?: number
  /** First visible row (default: scrolled so focus is visible). */
  offset?: number
  font?: 'small' | 'body'
}

/** Checkbox rows; done items are ticked, struck through and dimmed. */
export function renderChecklist(fb: Framebuffer, rect: Rect, p: ChecklistProps, theme: Theme): void {
  const lv = theme.levels
  const f = themeFont(theme, p.font ?? 'body')
  const rowH = f.font.glyphH * f.scale + 8
  const rows = Math.max(1, Math.floor(rect.h / rowH))
  const focus = p.focus ?? -1
  const offset = p.offset ?? Math.max(0, Math.min(p.items.length - rows, focus - Math.floor(rows / 2)))
  const box = Math.round(f.font.ascent * f.scale) + 2
  for (let k = 0; k < rows; k++) {
    const i = offset + k
    const it = p.items[i]
    if (!it) break
    const y = rect.y + k * rowH + 4
    const x = rect.x + 6
    const focused = i === focus
    const by = y + Math.round((f.font.ascent * f.scale - box) / 2)
    strokeRect(fb, x, by, box, box, it.done ? lv.mid : lv.bright, focused ? 2 : 1)
    if (it.done) {
      // Tick overshoots the box corner: reads as "checked" even at small sizes.
      line(fb, x + 2, by + box / 2, x + box / 2 - 1, by + box - 3, lv.full, { width: 2 })
      line(fb, x + box / 2 - 1, by + box - 3, x + box + 1, by - 2, lv.full, { width: 2 })
    }
    const tx = x + box + 8
    const text = ellipsize(it.label, rect.x + rect.w - tx - 8, f.font, f.scale)
    drawText(fb, text, tx, y, { font: f.font, scale: f.scale, level: it.done ? lv.dim : focused ? lv.full : lv.bright })
    if (it.done) fb.fillRect(tx - 2, y + Math.round((f.font.ascent * f.scale) / 2), textWidth(text, f.font, f.scale) + 4, 1, lv.mid)
    if (focused) {
      fillTriangle(fb, { x: rect.x, y: by }, { x: rect.x + 3, y: by + box / 2 }, { x: rect.x, y: by + box }, lv.full)
    }
  }
  // Scroll hint when more rows exist.
  if (offset > 0) fillTriangle(fb, { x: rect.x + rect.w - 9, y: rect.y + 6 }, { x: rect.x + rect.w - 1, y: rect.y + 6 }, { x: rect.x + rect.w - 5, y: rect.y + 1 }, lv.dim)
  if (offset + rows < p.items.length) fillTriangle(fb, { x: rect.x + rect.w - 9, y: rect.y + rect.h - 6 }, { x: rect.x + rect.w - 1, y: rect.y + rect.h - 6 }, { x: rect.x + rect.w - 5, y: rect.y + rect.h - 1 }, lv.dim)
}

export const Checklist = defineComponent<ChecklistProps>('Checklist', { w: 288, h: 144 }, renderChecklist)
