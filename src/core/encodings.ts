/**
 * The encoding library: how meaning is carried by shape, not brightness alone.
 *  - Markers: point shapes for scatter/line series.
 *  - Series styles: one dash + marker + fill pattern per series index.
 *  - Marks: cell states (WordLens's rule: filled = yes, ring = partly, strike = no).
 */
import { fillCircle, fillPolygon, line, strokeCircle, strokeRect } from './draw.js'
import type { Framebuffer } from './framebuffer.js'
import type { Rect } from './geometry.js'
import type { DashStyle, FillPattern } from './paint.js'

export type MarkerShape = 'dot' | 'square' | 'triangle' | 'diamond' | 'cross' | 'ring' | 'plus'

export const MARKER_SHAPES: readonly MarkerShape[] = ['dot', 'square', 'triangle', 'diamond', 'cross', 'ring', 'plus']

/** Point marker centred on (cx, cy); `size` is the full width in px (≥ 5 recommended). */
export function drawMarker(fb: Framebuffer, shape: MarkerShape, cx: number, cy: number, size: number, level: number): void {
  cx = Math.round(cx)
  cy = Math.round(cy)
  const h = Math.max(1, Math.floor(size / 2))
  switch (shape) {
    case 'dot':
      fillCircle(fb, cx + 0.5, cy + 0.5, h + 0.5, level)
      return
    case 'square':
      fb.fillRect(cx - h, cy - h, 2 * h + 1, 2 * h + 1, level)
      return
    case 'triangle':
      fillPolygon(fb, [{ x: cx + 0.5, y: cy - h }, { x: cx + h + 1, y: cy + h + 1 }, { x: cx - h, y: cy + h + 1 }], level)
      return
    case 'diamond':
      fillPolygon(fb, [{ x: cx + 0.5, y: cy - h }, { x: cx + h + 1, y: cy + 0.5 }, { x: cx + 0.5, y: cy + h + 1 }, { x: cx - h, y: cy + 0.5 }], level)
      return
    case 'cross':
      line(fb, cx - h, cy - h, cx + h, cy + h, level, { width: 2 })
      line(fb, cx - h, cy + h, cx + h, cy - h, level, { width: 2 })
      return
    case 'plus':
      fb.fillRect(cx - h, cy, 2 * h + 1, 2, level)
      fb.fillRect(cx, cy - h, 2, 2 * h + 1, level)
      return
    case 'ring':
      strokeCircle(fb, cx + 0.5, cy + 0.5, h, level, 2)
      return
  }
}

export interface SeriesStyle {
  dash: DashStyle
  marker: MarkerShape
  fill: FillPattern
}

/** Default per-series encodings. Series 0 is always the plainest (solid / dot / solid). */
export const SERIES_STYLES: readonly SeriesStyle[] = [
  { dash: 'solid', marker: 'dot', fill: 'solid' },
  { dash: 'dashed', marker: 'square', fill: 'hatch' },
  { dash: 'dotted', marker: 'triangle', fill: 'dots' },
  { dash: 'dashDot', marker: 'diamond', fill: 'crossHatch' },
  { dash: 'longDash', marker: 'cross', fill: 'checker' },
  { dash: 'solid', marker: 'ring', fill: 'vStripes' },
]

export function seriesStyle(i: number): SeriesStyle {
  return SERIES_STYLES[i % SERIES_STYLES.length]
}

const warned = new Set<string>()
/** Warn once per component when more series than the display can separate are drawn. */
export function warnSeries(component: string, count: number, max = 3): void {
  if (count <= max || warned.has(component)) return
  warned.add(component)
  console.warn(`[g2-kit] ${component}: ${count} series; more than ${max} are hard to tell apart on the glasses.`)
}

/** Cell/key state marks. */
export type Mark = 'empty' | 'outline' | 'filled' | 'ring' | 'strike' | 'dashed' | 'focus'

export interface MarkLevels {
  /** Main stroke/fill level. */
  fg: number
  /** Secondary (frame) level, e.g. the dim outline behind a ring. */
  dim: number
}

/**
 * Draw the mark for one cell. Glyph drawing is left to the caller because
 * the glyph level depends on the mark (dark text on a filled cell).
 */
export function drawMark(fb: Framebuffer, r: Rect, mark: Mark, lv: MarkLevels): void {
  const { x, y, w, h } = r
  switch (mark) {
    case 'empty':
      return
    case 'outline':
      strokeRect(fb, x, y, w, h, lv.dim, 1)
      return
    case 'focus':
      strokeRect(fb, x, y, w, h, lv.fg, 2)
      return
    case 'filled':
      fb.fillRect(x, y, w, h, lv.fg)
      return
    case 'ring': {
      strokeRect(fb, x, y, w, h, lv.dim, 1)
      const rr = Math.min(w, h) / 2 - 1.5
      strokeCircle(fb, x + w / 2, y + h / 2, rr, lv.fg, 1.5)
      return
    }
    case 'strike': {
      const inset = Math.max(2, Math.round(Math.min(w, h) * 0.15))
      line(fb, x + inset, y + h - 1 - inset, x + w - 1 - inset, y + inset, lv.fg)
      return
    }
    case 'dashed': {
      for (let i = x; i < x + w; i += 4) {
        fb.fillRect(i, y, 2, 1, lv.dim)
        fb.fillRect(i, y + h - 1, 2, 1, lv.dim)
      }
      for (let j = y; j < y + h; j += 4) {
        fb.fillRect(x, j, 1, 2, lv.dim)
        fb.fillRect(x + w - 1, j, 1, 2, lv.dim)
      }
      return
    }
  }
}

/** Glyph level to use on top of a mark so text stays readable (dark text on filled cells). */
export function glyphLevelOn(mark: Mark, fg: number, dimText: number): number {
  if (mark === 'filled') return 0
  if (mark === 'strike') return dimText
  return fg
}
