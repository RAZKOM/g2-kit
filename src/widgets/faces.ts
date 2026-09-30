/** Glanceable data faces: analog clock, timer ring, compass strip, turn arrow. */
import { defineComponent } from '../core/component.js'
import { fillCircle, fillPolygon, fillSector, fillTriangle, line, polyline, strokeArc } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import { cut, inset, polar, type Point, type Rect } from '../core/geometry.js'
import { drawText, ellipsize, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'

export interface AnalogClockProps {
  hours: number
  minutes: number
  seconds?: number
  /** Tick style: 12 ticks (default), 4 (quarters), or 'numbers'. */
  ticks?: 12 | 4 | 'numbers'
  label?: string
}

export function renderAnalogClock(fb: Framebuffer, rect: Rect, p: AnalogClockProps, theme: Theme): void {
  const lv = theme.levels
  let r = inset(rect, 4)
  if (p.label) {
    const f = theme.fonts.body
    const [strip, rest] = cut(r, 'bottom', f.glyphH + 4)
    drawText(fb, ellipsize(p.label, strip.w, f), strip.x + strip.w / 2, strip.y + 4, { font: f, level: lv.mid, align: 'center' })
    r = rest
  }
  const R = Math.min(r.w, r.h) / 2 - 1
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  strokeArc(fb, cx, cy, R - 1, 0, 360, lv.mid, 2)
  const ticks = p.ticks ?? 12
  if (ticks === 'numbers') {
    const f = R > 50 ? theme.fonts.body : theme.fonts.small
    for (let h = 1; h <= 12; h++) {
      const pt = polar(cx, cy, R - f.glyphH, h * 30)
      drawText(fb, String(h), pt.x, Math.round(pt.y - f.ascent / 2), { font: f, level: h % 3 === 0 ? lv.full : lv.mid, align: 'center' })
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const major = i % 3 === 0
      if (ticks === 4 && !major) continue
      const a = polar(cx, cy, R - (major ? 9 : 5), i * 30)
      const b = polar(cx, cy, R - 2, i * 30)
      line(fb, a.x, a.y, b.x, b.y, major ? lv.full : lv.dim, { width: 2 })
    }
  }
  const min = p.minutes + (p.seconds ?? 0) / 60
  const hr = (p.hours % 12) + min / 60
  const hand = (deg: number, len: number, width: number, level: number) => {
    const tip = polar(cx, cy, len, deg)
    line(fb, cx, cy, tip.x, tip.y, level, { width })
  }
  hand(hr * 30, R * 0.5, 4, lv.full)
  hand(min * 6, R * 0.78, 2, lv.full)
  if (p.seconds !== undefined) hand(p.seconds * 6, R * 0.85, 1, lv.mid)
  fillCircle(fb, cx, cy, 3, lv.full)
}

export const AnalogClock = defineComponent<AnalogClockProps>('AnalogClock', { w: 144, h: 144 }, renderAnalogClock)

export interface TimerRingProps {
  /** Seconds remaining. */
  remaining: number
  /** Total seconds. */
  total: number
  label?: string
  /** Show tick marks for each minute (≤ 60 min) (default true). */
  ticks?: boolean
}

/** Countdown ring (pomodoro): remaining arc shrinks clockwise; mm:ss in the centre. */
export function renderTimerRing(fb: Framebuffer, rect: Rect, p: TimerRingProps, theme: Theme): void {
  const lv = theme.levels
  const r = inset(rect, 4)
  const R = Math.min(r.w, r.h) / 2 - 1
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  const th = Math.max(5, Math.round(R / 7))
  const frac = p.total > 0 ? Math.max(0, Math.min(1, p.remaining / p.total)) : 0
  fillSector(fb, cx, cy, R - th, R, 0, 360, lv.faint)
  if (frac > 0) fillSector(fb, cx, cy, R - th, R, 360 * (1 - frac), 360, lv.full)
  const mins = Math.ceil(p.total / 60)
  if (p.ticks !== false && mins > 1 && mins <= 60) {
    for (let i = 0; i < mins; i++) {
      const a = polar(cx, cy, R - th - 5, (i * 360) / mins)
      const b = polar(cx, cy, R - th - 2, (i * 360) / mins)
      line(fb, a.x, a.y, b.x, b.y, i % 5 === 0 ? lv.mid : lv.dim)
    }
  }
  const s = Math.max(0, Math.ceil(p.remaining))
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const d = theme.fonts.display
  const font = textWidth(text, d) < (R - th - 8) * 1.8 ? d : theme.fonts.body
  const labelH = p.label ? theme.fonts.small.glyphH + 4 : 0
  const ty = Math.round(cy - (font.ascent + labelH) / 2)
  drawText(fb, text, cx, ty, { font, level: lv.full, align: 'center' })
  if (p.label) drawText(fb, ellipsize(p.label.toUpperCase(), (R - th) * 1.6, theme.fonts.small), cx, ty + font.ascent + 4, { font: theme.fonts.small, level: lv.mid, align: 'center' })
}

export const TimerRing = defineComponent<TimerRingProps>('TimerRing', { w: 144, h: 144 }, renderTimerRing)

export interface CompassStripProps {
  /** Heading in degrees (0 = north, clockwise). */
  heading: number
  /** Degrees visible across the strip (default 120). */
  fov?: number
  /** Extra bearings to mark, e.g. a destination. */
  markers?: ReadonlyArray<{ bearing: number; label?: string }>
  /** Show the numeric heading under the caret (default true). */
  showHeading?: boolean
}

const CARDINALS: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }

/** Horizontal heading tape: ticks every 15°, cardinal letters, centre caret. */
export function renderCompassStrip(fb: Framebuffer, rect: Rect, p: CompassStripProps, theme: Theme): void {
  const lv = theme.levels
  const fov = p.fov ?? 120
  const cx = rect.x + rect.w / 2
  const pxPerDeg = rect.w / fov
  const f = theme.fonts.body
  const showH = p.showHeading !== false
  const tapeY = rect.y + (showH ? f.glyphH + 8 : 4)
  const baseY = tapeY + 14
  const rel = (b: number) => ((((b - p.heading) % 360) + 540) % 360) - 180
  for (let b = 0; b < 360; b += 15) {
    const d = rel(b)
    if (Math.abs(d) > fov / 2) continue
    const x = Math.round(cx + d * pxPerDeg)
    const card = CARDINALS[b]
    const major = b % 90 === 0
    fb.fillRect(x - (major ? 1 : 0), baseY - (card ? 8 : 4), major ? 3 : 1, card ? 8 : 4, card ? lv.bright : lv.dim)
    if (card) drawText(fb, card, x, baseY + 3, { font: major ? f : theme.fonts.small, level: major ? lv.full : lv.mid, align: 'center' })
  }
  fb.fillRect(rect.x, baseY, rect.w, 1, lv.dim)
  for (const m of p.markers ?? []) {
    const d = rel(m.bearing)
    const clamped = Math.max(-fov / 2, Math.min(fov / 2, d))
    const x = Math.round(cx + clamped * pxPerDeg)
    const off = Math.abs(d) > fov / 2
    // Diamond marker; a hollow arrow at the edge when off-tape.
    if (off) fillTriangle(fb, { x: x - (d < 0 ? -1 : 1) * 0, y: baseY - 12 }, { x: x + (d < 0 ? 8 : -8), y: baseY - 16 }, { x: x + (d < 0 ? 8 : -8), y: baseY - 8 }, lv.full)
    else fillPolygon(fb, [{ x, y: baseY - 16 }, { x: x + 5, y: baseY - 11 }, { x, y: baseY - 6 }, { x: x - 5, y: baseY - 11 }], lv.full)
  }
  // Caret at the centre.
  fillTriangle(fb, { x: cx - 6, y: tapeY - 4 }, { x: cx + 6, y: tapeY - 4 }, { x: cx, y: tapeY + 3 }, lv.full)
  if (showH) {
    const h = `${Math.round(((p.heading % 360) + 360) % 360)}°`
    drawText(fb, h, cx, rect.y + 2, { font: f, level: lv.full, align: 'center' })
  }
}

export const CompassStrip = defineComponent<CompassStripProps>('CompassStrip', { w: 288, h: 48 }, renderCompassStrip)

export type TurnDirection = 'straight' | 'slightLeft' | 'left' | 'sharpLeft' | 'uturn' | 'slightRight' | 'right' | 'sharpRight' | 'arrive'

export interface TurnArrowProps {
  direction: TurnDirection
  /** e.g. '200 m' */
  distance?: string
  street?: string
}

const TURN_ANGLE: Record<Exclude<TurnDirection, 'uturn' | 'arrive'>, number> = {
  straight: 0,
  slightLeft: -40,
  left: -90,
  sharpLeft: -135,
  slightRight: 40,
  right: 90,
  sharpRight: 135,
}

/** Big turn-by-turn arrow with distance and street. */
export function renderTurnArrow(fb: Framebuffer, rect: Rect, p: TurnArrowProps, theme: Theme): void {
  const lv = theme.levels
  const r = inset(rect, 6)
  const size = Math.min(r.h, Math.round(r.w * 0.5))
  const ax = r.x
  const ay = r.y + Math.round((r.h - size) / 2)
  const u = size / 16
  const W = Math.max(4, Math.round(size / 7))
  const base: Point = { x: ax + 8 * u, y: ay + 15.5 * u }
  const joint: Point = { x: ax + 8 * u, y: ay + 9 * u }
  const head = (tip: Point, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180
    const back = { x: tip.x - Math.cos(a) * 4.5 * u, y: tip.y - Math.sin(a) * 4.5 * u }
    const nx = -Math.sin(a) * 4 * u
    const ny = Math.cos(a) * 4 * u
    fillTriangle(fb, tip, { x: back.x + nx, y: back.y + ny }, { x: back.x - nx, y: back.y - ny }, lv.full)
    return back
  }
  if (p.direction === 'arrive') {
    polyline(fb, [base, { x: ax + 8 * u, y: ay + 4 * u }], lv.full, { width: W })
    fillCircle(fb, ax + 8 * u, ay + 4 * u, 3.5 * u, lv.full)
    fillCircle(fb, ax + 8 * u, ay + 4 * u, 1.5 * u, 0)
  } else if (p.direction === 'uturn') {
    const top = ay + 4 * u
    polyline(fb, [{ x: ax + 11 * u, y: ay + 15.5 * u }, { x: ax + 11 * u, y: top + 3 * u }], lv.full, { width: W })
    strokeArc(fb, ax + 8 * u, top + 3 * u, 3 * u, 270, 450, lv.full, W)
    const back = head({ x: ax + 5 * u, y: ay + 13.5 * u }, 180)
    polyline(fb, [{ x: ax + 5 * u, y: top + 3 * u }, back], lv.full, { width: W })
  } else {
    const deg = TURN_ANGLE[p.direction]
    const a = ((deg - 90) * Math.PI) / 180
    const tip = { x: joint.x + Math.cos(a) * 7 * u, y: joint.y + Math.sin(a) * 7 * u }
    const back = head(tip, deg)
    polyline(fb, deg === 0 ? [base, back] : [base, joint, back], lv.full, { width: W })
  }
  const tx = ax + size + 12
  const tw = r.x + r.w - tx
  if (p.distance) {
    const d = theme.fonts.display
    const font = textWidth(p.distance, d) <= tw ? d : theme.fonts.body
    drawText(fb, p.distance, tx, Math.round(r.y + r.h / 2 - font.glyphH + (p.street ? 0 : font.glyphH / 2)), { font, level: lv.full })
  }
  if (p.street) drawText(fb, ellipsize(p.street, tw, theme.fonts.body), tx, Math.round(r.y + r.h / 2 + 6), { font: theme.fonts.body, level: lv.bright })
}

export const TurnArrow = defineComponent<TurnArrowProps>('TurnArrow', { w: 288, h: 96 }, renderTurnArrow)
