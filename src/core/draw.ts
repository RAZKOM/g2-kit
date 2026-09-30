/**
 * Drawing primitives. Free functions over a Framebuffer so unused ones
 * tree-shake. Coordinates are pixels; fractional centres are allowed for
 * round shapes. Angles are degrees, 0° = 12 o'clock, increasing clockwise.
 */
import type { Framebuffer } from './framebuffer.js'
import type { Point } from './geometry.js'
import { DashCursor, dashArray, paintAt, type Dash, type Paint } from './paint.js'

export interface StrokeOptions {
  /** Stroke width in px (default 1). */
  width?: number
  /** Dash style or on/off runs. */
  dash?: Dash
}

/** Stamp a width×width brush centred on (x, y). Width ≥ 3 uses a round brush. */
function stamp(fb: Framebuffer, x: number, y: number, width: number, level: number): void {
  if (width <= 1) return fb.set(x, y, level)
  const off = Math.floor((width - 1) / 2)
  if (width <= 2) return fb.fillRect(x - off, y - off, width, width, level)
  const r = width / 2
  for (let j = 0; j < width; j++)
    for (let i = 0; i < width; i++) {
      const dx = i - off - (width % 2 === 0 ? 0.5 : 0)
      const dy = j - off - (width % 2 === 0 ? 0.5 : 0)
      if (dx * dx + dy * dy <= r * r) fb.set(x - off + i, y - off + j, level)
    }
}

function walkLine(x0: number, y0: number, x1: number, y1: number, visit: (x: number, y: number) => void, skipFirst = false): void {
  x0 = Math.round(x0)
  y0 = Math.round(y0)
  x1 = Math.round(x1)
  y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let first = true
  for (;;) {
    if (!(first && skipFirst)) visit(x0, y0)
    first = false
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
}

/** Straight line (Bresenham) with optional width and dash. */
export function line(fb: Framebuffer, x0: number, y0: number, x1: number, y1: number, level: number, opts: StrokeOptions = {}): void {
  polyline(fb, [{ x: x0, y: y0 }, { x: x1, y: y1 }], level, opts)
}

/** Connected segments; the dash pattern continues across joints. */
export function polyline(fb: Framebuffer, pts: readonly Point[], level: number, opts: StrokeOptions = {}): void {
  const width = opts.width ?? 1
  const dash = new DashCursor(dashArray(opts.dash))
  if (pts.length === 1) return stamp(fb, Math.round(pts[0].x), Math.round(pts[0].y), width, level)
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    walkLine(a.x, a.y, b.x, b.y, (x, y) => {
      if (dash.step()) stamp(fb, x, y, width, level)
    }, i > 1)
  }
}

/** Outline of `width` px drawn inside the w×h box. */
export function strokeRect(fb: Framebuffer, x: number, y: number, w: number, h: number, level: number, width = 1): void {
  const t = Math.min(width, Math.floor(w / 2), Math.floor(h / 2)) || 1
  fb.fillRect(x, y, w, t, level)
  fb.fillRect(x, y + h - t, w, t, level)
  fb.fillRect(x, y + t, t, h - 2 * t, level)
  fb.fillRect(x + w - t, y + t, t, h - 2 * t, level)
}

/** Dashed rectangle outline (1 px or `width`). */
export function dashedRect(fb: Framebuffer, x: number, y: number, w: number, h: number, level: number, opts: StrokeOptions = {}): void {
  const x1 = x + w - 1
  const y1 = y + h - 1
  polyline(fb, [{ x, y }, { x: x1, y }, { x: x1, y: y1 }, { x, y: y1 }, { x, y }], level, opts)
}

/** Fill a rectangle with a paint (level or pattern). */
export function fillRectPaint(fb: Framebuffer, x: number, y: number, w: number, h: number, paint: Paint): void {
  if (typeof paint === 'number') return fb.fillRect(x, y, w, h, paint)
  const c = fb.clip
  const x0 = Math.max(c.x, Math.floor(x))
  const y0 = Math.max(c.y, Math.floor(y))
  const x1 = Math.min(c.x + c.w, Math.floor(x + w))
  const y1 = Math.min(c.y + c.h, Math.floor(y + h))
  for (let j = y0; j < y1; j++)
    for (let i = x0; i < x1; i++) {
      const l = paintAt(paint, i, j)
      if (l >= 0) fb.set(i, j, l)
    }
}

/** Signed "inside" test for a rounded rect, sampled at pixel centres. */
function inRoundRect(px: number, py: number, x: number, y: number, w: number, h: number, r: number): boolean {
  if (px < x || py < y || px > x + w || py > y + h) return false
  const rx = Math.min(r, w / 2)
  const ry = Math.min(r, h / 2)
  const cx = px < x + rx ? x + rx : px > x + w - rx ? x + w - rx : px
  const cy = py < y + ry ? y + ry : py > y + h - ry ? y + h - ry : py
  const dx = (px - cx) / (rx || 1)
  const dy = (py - cy) / (ry || 1)
  return dx * dx + dy * dy <= 1.0001
}

export interface RoundRectOptions {
  /** Fill paint; omit for outline only. */
  fill?: Paint
  /** Outline level; omit for fill only. */
  stroke?: number
  /** Outline width (default 1). */
  width?: number
}

/** Rounded rectangle, filled and/or outlined. */
export function roundRect(fb: Framebuffer, x: number, y: number, w: number, h: number, radius: number, opts: RoundRectOptions): void {
  const bw = opts.width ?? 1
  const stroke = opts.stroke ?? (opts.fill === undefined ? 15 : undefined)
  const c = fb.clip
  const x0 = Math.max(c.x, Math.floor(x))
  const y0 = Math.max(c.y, Math.floor(y))
  const x1 = Math.min(c.x + c.w, Math.ceil(x + w))
  const y1 = Math.min(c.y + c.h, Math.ceil(y + h))
  for (let j = y0; j < y1; j++)
    for (let i = x0; i < x1; i++) {
      const px = i + 0.5
      const py = j + 0.5
      if (!inRoundRect(px, py, x, y, w, h, radius)) continue
      const inner = inRoundRect(px, py, x + bw, y + bw, w - 2 * bw, h - 2 * bw, Math.max(0, radius - bw))
      if (!inner && stroke !== undefined) fb.set(i, j, stroke)
      else if (opts.fill !== undefined) {
        const l = paintAt(opts.fill, i, j)
        if (l >= 0) fb.set(i, j, l)
      }
    }
}

/** Circle outline: pixels whose centres lie within width/2 of radius r. */
export function strokeCircle(fb: Framebuffer, cx: number, cy: number, r: number, level: number, width = 1.5): void {
  strokeArc(fb, cx, cy, r, 0, 360, level, width)
}

/** Filled disc. */
export function fillCircle(fb: Framebuffer, cx: number, cy: number, r: number, paint: Paint): void {
  fillSector(fb, cx, cy, 0, r, 0, 360, paint)
}

/** Angle of (dx, dy) in degrees, 0 = up, clockwise, 0 ≤ a < 360. */
export function angleOf(dx: number, dy: number): number {
  const a = (Math.atan2(dx, -dy) * 180) / Math.PI
  return a < 0 ? a + 360 : a
}

function inSweep(a: number, start: number, end: number): boolean {
  const span = end - start
  if (span >= 360 || span <= -360) return true
  let s = start % 360
  if (s < 0) s += 360
  let rel = a - s
  if (rel < 0) rel += 360
  return span >= 0 ? rel <= span : rel >= 360 + span
}

/**
 * Annular sector: pixels with rIn ≤ d ≤ rOut and angle in [start, end]
 * (clockwise from 12 o'clock). Covers pies, donuts, gauges and rings.
 */
export function fillSector(fb: Framebuffer, cx: number, cy: number, rIn: number, rOut: number, start: number, end: number, paint: Paint): void {
  const c = fb.clip
  const x0 = Math.max(c.x, Math.floor(cx - rOut - 1))
  const x1 = Math.min(c.x + c.w, Math.ceil(cx + rOut + 1))
  const y0 = Math.max(c.y, Math.floor(cy - rOut - 1))
  const y1 = Math.min(c.y + c.h, Math.ceil(cy + rOut + 1))
  const ri2 = rIn * rIn
  // Discs get a quarter-pixel of slack so small ones round off instead of growing single-pixel tips.
  const ro2 = rIn > 0 ? rOut * rOut : (rOut + 0.25) * (rOut + 0.25)
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const d2 = dx * dx + dy * dy
      // Outer edge inclusive for discs, half-open for rings (no doubled pixels on the axes).
      if (d2 < ri2 || (rIn > 0 ? d2 >= ro2 : d2 > ro2)) continue
      if (!inSweep(angleOf(dx, dy), start, end)) continue
      const l = paintAt(paint, x, y)
      if (l >= 0) fb.set(x, y, l)
    }
}

/** Arc outline of `width` px centred on radius r. */
export function strokeArc(fb: Framebuffer, cx: number, cy: number, r: number, start: number, end: number, level: number, width = 2): void {
  fillSector(fb, cx, cy, Math.max(0, r - width / 2), r + width / 2, start, end, level)
}

/** Even-odd scanline polygon fill sampled at pixel centres. */
export function fillPolygon(fb: Framebuffer, pts: readonly Point[], paint: Paint): void {
  if (pts.length < 3) return
  const c = fb.clip
  let minY = Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const y0 = Math.max(c.y, Math.floor(minY))
  const y1 = Math.min(c.y + c.h - 1, Math.ceil(maxY))
  const xs: number[] = []
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5
    xs.length = 0
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      if ((a.y <= sy && b.y > sy) || (b.y <= sy && a.y > sy)) xs.push(a.x + ((sy - a.y) / (b.y - a.y)) * (b.x - a.x))
    }
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.ceil(xs[k] - 0.5)
      const xb = Math.ceil(xs[k + 1] - 0.5) - 1
      if (typeof paint === 'number') fb.hspan(xa, xb, y, paint)
      else
        for (let x = xa; x <= xb; x++) {
          const l = paintAt(paint, x, y)
          if (l >= 0) fb.set(x, y, l)
        }
    }
  }
}

/** Closed polygon outline. */
export function strokePolygon(fb: Framebuffer, pts: readonly Point[], level: number, opts: StrokeOptions = {}): void {
  if (pts.length < 2) return
  polyline(fb, [...pts, pts[0]], level, opts)
}

/** Filled triangle. */
export function fillTriangle(fb: Framebuffer, a: Point, b: Point, c: Point, paint: Paint): void {
  fillPolygon(fb, [a, b, c], paint)
}
