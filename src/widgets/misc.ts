/**
 * P2 widgets: table, card, badge, spinner, weather glyph, rating, dice,
 * health bar, and a sprite sheet helper.
 */
import { defineComponent } from '../core/component.js'
import { fillCircle, fillRectPaint, roundRect, strokeRect } from '../core/draw.js'
import { Framebuffer } from '../core/framebuffer.js'
import { cut, inset, splitColumns, type Rect } from '../core/geometry.js'
import { drawText, ellipsize, textWidth, type Align } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { ICONS, WEATHER_ICONS, type IconName, type Weather } from '../icons/index.js'
import { themeFont } from './common.js'

export interface TableProps {
  columns: ReadonlyArray<{ label: string; align?: Align; weight?: number }>
  rows: ReadonlyArray<ReadonlyArray<string | number>>
  /** Highlighted row index. */
  focus?: number
  /** First visible row. */
  offset?: number
  font?: 'small' | 'body'
}

/** 2–4 column table. Zebra striping is a dotted pattern, not a level; cells truncate with an ellipsis. */
export function renderTable(fb: Framebuffer, rect: Rect, p: TableProps, theme: Theme): void {
  const lv = theme.levels
  const f = themeFont(theme, p.font ?? 'small')
  const rowH = f.font.glyphH * f.scale + 6
  const cols = splitColumns(rect, p.columns.map((c) => c.weight ?? 1), 6)
  const [head, body] = cut(rect, 'top', rowH + 2)
  p.columns.forEach((c, i) => {
    const r = cols[i]
    const a = c.align ?? 'left'
    drawText(fb, ellipsize(c.label.toUpperCase(), r.w, f.font, f.scale), a === 'left' ? r.x : a === 'right' ? r.x + r.w : r.x + r.w / 2, head.y + 2, { font: f.font, scale: f.scale, level: lv.mid, align: a })
  })
  fb.fillRect(rect.x, head.y + rowH, rect.w, 1, lv.dim)
  const visible = Math.floor(body.h / rowH)
  const offset = p.offset ?? Math.max(0, Math.min(p.rows.length - visible, (p.focus ?? 0) - Math.floor(visible / 2)))
  for (let k = 0; k < visible; k++) {
    const row = p.rows[offset + k]
    if (!row) break
    const y = body.y + k * rowH
    const focused = offset + k === p.focus
    if (focused) fb.fillRect(rect.x, y, rect.w, rowH, lv.bright)
    else if ((offset + k) % 2 === 1) fillRectPaint(fb, rect.x, y, rect.w, rowH, { pattern: 'sparseDots', level: lv.faint })
    p.columns.forEach((c, i) => {
      const r = cols[i]
      const a = c.align ?? (typeof row[i] === 'number' ? 'right' : 'left')
      const text = ellipsize(String(row[i] ?? ''), r.w, f.font, f.scale)
      drawText(fb, text, a === 'left' ? r.x : a === 'right' ? r.x + r.w : r.x + r.w / 2, y + 3, { font: f.font, scale: f.scale, level: focused ? 0 : lv.bright, align: a })
    })
  }
}

export const Table = defineComponent<TableProps>('Table', { w: 288, h: 144 }, renderTable)

export interface CardProps {
  title: string
  value: string
  icon?: IconName
  footnote?: string
  focused?: boolean
}

/** Title + value + icon + footnote, composed from primitives. */
export function renderCard(fb: Framebuffer, rect: Rect, p: CardProps, theme: Theme): void {
  const lv = theme.levels
  roundRect(fb, rect.x, rect.y, rect.w, rect.h, theme.radius, { stroke: p.focused ? lv.full : lv.dim, width: p.focused ? 2 : 1 })
  const r = inset(rect, 8)
  let tx = r.x
  if (p.icon) {
    ICONS[p.icon](fb, r.x, r.y, 12, lv.bright)
    tx += 16
  }
  drawText(fb, ellipsize(p.title.toUpperCase(), r.x + r.w - tx, theme.fonts.small), tx, r.y + 2, { font: theme.fonts.small, level: lv.mid })
  const foot = p.footnote ? theme.fonts.small.glyphH + 4 : 0
  const vf = [themeFont(theme, 'display', 2), themeFont(theme, 'display'), themeFont(theme, 'body')].find((c) => textWidth(p.value, c.font, c.scale) <= r.w && c.font.glyphH * c.scale <= r.h - 16 - foot) ?? themeFont(theme, 'body')
  drawText(fb, ellipsize(p.value, r.w, vf.font, vf.scale), r.x, Math.round(r.y + 16 + (r.h - 16 - foot - vf.font.glyphH * vf.scale) / 2), { font: vf.font, scale: vf.scale, level: lv.full })
  if (p.footnote) drawText(fb, ellipsize(p.footnote, r.w, theme.fonts.small), r.x, r.y + r.h - theme.fonts.small.glyphH, { font: theme.fonts.small, level: lv.dim })
}

export const Card = defineComponent<CardProps>('Card', { w: 144, h: 96 }, renderCard)

export interface BadgeProps {
  text: string
  /** 'solid' (filled), 'outline', or 'dashed'. */
  variant?: 'solid' | 'outline' | 'dashed'
  icon?: IconName
}

/** Badge / chip / tag, sized to its text (left-aligned in the rect). */
export function renderBadge(fb: Framebuffer, rect: Rect, p: BadgeProps, theme: Theme): void {
  const lv = theme.levels
  const f = theme.fonts.small
  const h = Math.min(rect.h, f.glyphH + 6)
  const w = Math.min(rect.w, textWidth(p.text, f) + 10 + (p.icon ? 11 : 0))
  const y = rect.y + Math.floor((rect.h - h) / 2)
  const solid = p.variant === 'solid'
  if (solid) roundRect(fb, rect.x, y, w, h, Math.floor(h / 2), { fill: lv.bright })
  else if (p.variant === 'dashed') {
    for (let x = rect.x; x < rect.x + w; x += 4) {
      fb.fillRect(x, y, 2, 1, lv.mid)
      fb.fillRect(x, y + h - 1, 2, 1, lv.mid)
    }
    fb.fillRect(rect.x, y, 1, h, lv.mid)
    fb.fillRect(rect.x + w - 1, y, 1, h, lv.mid)
  }
  else roundRect(fb, rect.x, y, w, h, Math.floor(h / 2), { stroke: lv.mid })
  let x = rect.x + 5
  if (p.icon) {
    ICONS[p.icon](fb, x, y + Math.floor((h - 8) / 2), 8, solid ? 0 : lv.bright)
    x += 11
  }
  drawText(fb, ellipsize(p.text, w - (x - rect.x) - 4, f), x, y + 3, { font: f, level: solid ? 0 : lv.bright })
}

export const Badge = defineComponent<BadgeProps>('Badge', { w: 96, h: 16 }, renderBadge)

export interface SpinnerProps {
  /** Frame index; the spinner has `frames` distinct frames (default 4). */
  frame: number
  frames?: number
  label?: string
}

/**
 * Busy indicator with 2–4 frames. Each frame is one image send (~350 ms on glasses):
 * advance it at most every 250–500 ms, and prefer a static "Loading…" state.
 */
export function renderSpinner(fb: Framebuffer, rect: Rect, p: SpinnerProps, theme: Theme): void {
  const lv = theme.levels
  const n = Math.max(2, Math.min(8, p.frames ?? 4))
  const labelW = p.label ? textWidth(p.label, theme.fonts.body) + 8 : 0
  const s = Math.min(rect.h - 4, 28)
  const cx = rect.x + (rect.w - labelW) / 2
  const cy = rect.y + rect.h / 2
  const R = s / 2
  const active = ((p.frame % n) + n) % n
  for (let i = 0; i < n; i++) {
    const a = ((i * 360) / n - 90) * (Math.PI / 180)
    const d = (i - active + n) % n
    fillCircle(fb, cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3), d === 0 ? 3.5 : 2.5, d === 0 ? lv.full : d === n - 1 ? lv.mid : lv.faint)
  }
  if (p.label) drawText(fb, p.label, cx + R + 8, Math.round(cy - theme.fonts.body.ascent / 2), { font: theme.fonts.body, level: lv.bright })
}

export const Spinner = defineComponent<SpinnerProps>('Spinner', { w: 144, h: 32 }, renderSpinner)

export interface WeatherGlyphProps {
  condition: Weather
  temp: string
  label?: string
  hiLo?: string
}

/** Weather glyph (10 conditions) + temperature. */
export function renderWeatherGlyph(fb: Framebuffer, rect: Rect, p: WeatherGlyphProps, theme: Theme): void {
  const lv = theme.levels
  const r = inset(rect, 6)
  const s = Math.min(r.h, Math.round(r.w * 0.4), 64)
  ICONS[WEATHER_ICONS[p.condition]](fb, r.x, Math.round(r.y + (r.h - s) / 2), s, lv.full)
  const tx = r.x + s + 10
  const d = theme.fonts.display
  const font = textWidth(p.temp, d, 2) <= r.x + r.w - tx && r.h >= 60 ? { f: d, sc: 2 } : { f: d, sc: 1 }
  const th = font.f.glyphH * font.sc
  const extra = (p.label ? theme.fonts.body.glyphH + 4 : 0) + (p.hiLo ? theme.fonts.small.glyphH + 4 : 0)
  let y = Math.round(r.y + (r.h - th - extra) / 2)
  if (p.label) {
    drawText(fb, ellipsize(p.label, r.x + r.w - tx, theme.fonts.body), tx, y, { font: theme.fonts.body, level: lv.mid })
    y += theme.fonts.body.glyphH + 4
  }
  drawText(fb, p.temp, tx, y, { font: font.f, scale: font.sc, level: lv.full })
  if (p.hiLo) drawText(fb, p.hiLo, tx, y + th + 4, { font: theme.fonts.small, level: lv.mid })
}

export const WeatherGlyph = defineComponent<WeatherGlyphProps>('WeatherGlyph', { w: 288, h: 96 }, renderWeatherGlyph)

export interface RatingProps {
  value: number
  max?: number
  /** 'stars' (default) or 'dots'. */
  kind?: 'stars' | 'dots'
  focused?: boolean
  editing?: boolean
}

/** Rating: filled vs outline stars (half values round down to an outline with a half fill). */
export function renderRating(fb: Framebuffer, rect: Rect, p: RatingProps, theme: Theme): void {
  const lv = theme.levels
  const max = p.max ?? 5
  const s = Math.min(rect.h - 6, Math.floor((rect.w - 4 * (max - 1)) / max), 24)
  const total = max * s + (max - 1) * 4
  const x0 = Math.round(rect.x + (rect.w - total) / 2)
  const y = Math.round(rect.y + (rect.h - s) / 2)
  for (let i = 0; i < max; i++) {
    const x = x0 + i * (s + 4)
    const full = p.value >= i + 1
    const half = !full && p.value > i
    if (p.kind === 'dots') {
      if (full) fillCircle(fb, x + s / 2, y + s / 2, s / 2 - 1, lv.full)
      else strokeRect(fb, x + 2, y + 2, s - 4, s - 4, lv.dim, 1)
      continue
    }
    if (full) ICONS.star(fb, x, y, s, p.editing ? lv.full : lv.bright)
    else {
      ICONS.starOutline(fb, x, y, s, lv.mid)
      if (half) fb.withClip({ x, y, w: Math.floor(s / 2), h: s }, () => ICONS.star(fb, x, y, s, lv.bright))
    }
  }
  if (p.focused || p.editing) strokeRect(fb, x0 - 4, y - 3, total + 8, s + 6, lv.full, p.editing ? 2 : 1)
}

export const Rating = defineComponent<RatingProps>('Rating', { w: 160, h: 32 }, renderRating)

export interface DiceProps {
  values: readonly number[]
  /** Dice held (kept between rolls): drawn filled with dark pips. */
  held?: readonly boolean[]
  focus?: number
}

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}

export function renderDice(fb: Framebuffer, rect: Rect, p: DiceProps, theme: Theme): void {
  const lv = theme.levels
  const n = p.values.length
  const s = Math.min(rect.h - 8, Math.floor((rect.w - 8 * (n - 1)) / n))
  const total = n * s + (n - 1) * 8
  const x0 = Math.round(rect.x + (rect.w - total) / 2)
  const y = Math.round(rect.y + (rect.h - s) / 2)
  p.values.forEach((v, i) => {
    const x = x0 + i * (s + 8)
    const held = p.held?.[i]
    roundRect(fb, x, y, s, s, Math.max(2, Math.round(s / 6)), held ? { fill: lv.bright } : { stroke: lv.bright, width: 2 })
    const pip = Math.max(2, s / 10)
    for (const [cx, cy] of PIPS[Math.max(1, Math.min(6, Math.round(v)))]) fillCircle(fb, x + s * (0.25 + cx * 0.25), y + s * (0.25 + cy * 0.25), pip, held ? 0 : lv.full)
    if (p.focus === i) strokeRect(fb, x - 3, y - 3, s + 6, s + 6, lv.full, 1)
  })
}

export const Dice = defineComponent<DiceProps>('Dice', { w: 288, h: 64 }, renderDice)

export interface HealthBarProps {
  value: number
  max: number
  label?: string
  /** Segment size in units (e.g. 10 HP per notch; default max/10). */
  notch?: number
  icon?: IconName
}

/** Health / energy bar with notches, so the amount reads without brightness. */
export function renderHealthBar(fb: Framebuffer, rect: Rect, p: HealthBarProps, theme: Theme): void {
  const lv = theme.levels
  let r = rect
  if (p.icon) {
    ICONS[p.icon](fb, r.x, Math.round(r.y + (r.h - 12) / 2), 12, lv.full)
    r = { ...r, x: r.x + 16, w: r.w - 16 }
  }
  const text = p.label ?? `${Math.round(p.value)}/${p.max}`
  const tw = textWidth(text, theme.fonts.small) + 6
  const bar = { x: r.x, y: Math.round(r.y + (r.h - 10) / 2), w: r.w - tw, h: 10 }
  strokeRect(fb, bar.x, bar.y, bar.w, bar.h, lv.mid, 1)
  const frac = Math.max(0, Math.min(1, p.value / p.max))
  fb.fillRect(bar.x + 2, bar.y + 2, Math.round((bar.w - 4) * frac), bar.h - 4, lv.bright)
  const notch = p.notch ?? p.max / 10
  for (let v = notch; v < p.max; v += notch) fb.fillRect(Math.round(bar.x + 2 + (bar.w - 4) * (v / p.max)), bar.y + 2, 1, bar.h - 4, 0)
  drawText(fb, text, r.x + r.w, Math.round(r.y + (r.h - 7) / 2), { font: theme.fonts.small, level: lv.bright, align: 'right' })
}

export const HealthBar = defineComponent<HealthBarProps>('HealthBar', { w: 160, h: 16 }, renderHealthBar)

/**
 * Sprite sheet: frames of equal size from '#'-rows (1-bit) or hex-digit rows
 * (4-bit, '.' = 0). Draw with `drawSprite` (transparent, flippable, scalable).
 */
export class SpriteSheet {
  readonly frames: Framebuffer[]
  constructor(frames: ReadonlyArray<readonly string[]>, level = 15) {
    this.frames = frames.map((rows) => {
      const w = Math.max(...rows.map((r) => r.length))
      const fb = new Framebuffer(w, rows.length)
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x]
          const v = ch === '#' ? level : ch === '.' || ch === ' ' ? 0 : parseInt(ch, 16)
          if (v) fb.set(x, y, v)
        }
      })
      return fb
    })
  }

  frame(i: number): Framebuffer {
    return this.frames[((i % this.frames.length) + this.frames.length) % this.frames.length]
  }
}

export function drawSprite(fb: Framebuffer, sprite: Framebuffer, x: number, y: number, opts: { flipX?: boolean; flipY?: boolean; scale?: number; level?: number } = {}): void {
  const s = Math.max(1, Math.floor(opts.scale ?? 1))
  for (let j = 0; j < sprite.height; j++)
    for (let i = 0; i < sprite.width; i++) {
      const sx = opts.flipX ? sprite.width - 1 - i : i
      const sy = opts.flipY ? sprite.height - 1 - j : j
      const v = sprite.get(sx, sy)
      if (v) fb.fillRect(x + i * s, y + j * s, s, s, opts.level !== undefined ? Math.round((v * opts.level) / 15) : v)
    }
}
