/**
 * Legends for any encoding set: fill paints, dash styles, markers, or cell
 * marks (filled / ring / strike). Use it inline, or render a key page.
 */
import { defineComponent } from '../core/component.js'
import { fillRectPaint, line, strokeRect } from '../core/draw.js'
import { drawMark, drawMarker, type Mark, type MarkerShape } from '../core/encodings.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Rect } from '../core/geometry.js'
import type { Dash, Paint } from '../core/paint.js'
import { drawText, ellipsize, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { smallH } from './common.js'

export interface LegendItem {
  label: string
  /** Swatch filled with this paint. */
  paint?: Paint
  /** Line sample with this dash. */
  dash?: Dash
  marker?: MarkerShape
  /** Cell-mark sample (with an optional letter). */
  mark?: Mark
  glyph?: string
  level?: number
}

export interface LegendProps {
  items: readonly LegendItem[]
  direction?: 'horizontal' | 'vertical'
  valign?: 'top' | 'middle'
  /** Use the body font (key pages) instead of the small label font. */
  large?: boolean
}

export function renderLegend(fb: Framebuffer, rect: Rect, p: LegendProps, theme: Theme): void {
  const lv = theme.levels
  const font = p.large ? theme.fonts.body : theme.fonts.small
  const scale = p.large ? 1 : theme.smallScale
  const th = p.large ? font.glyphH : smallH(theme)
  const sw = p.large ? 22 : 14
  const rowH = Math.max(th, p.large ? 22 : 10) + (p.large ? 8 : 5)
  const vertical = p.direction !== 'horizontal'
  const totalH = vertical ? p.items.length * rowH - (rowH - Math.max(th, sw * 0.6)) : rowH
  let x = rect.x
  let y = p.valign === 'middle' ? Math.round(rect.y + (rect.h - totalH) / 2) : rect.y
  for (const it of p.items) {
    const level = it.level ?? lv.full
    const boxH = p.large ? 20 : 8
    const cy = y + Math.round(Math.max(th, boxH) / 2)
    const sy = cy - Math.round(boxH / 2)
    if (it.mark) {
      const s = p.large ? 20 : 10
      drawMark(fb, { x, y: cy - s / 2, w: s, h: s }, it.mark, { fg: level, dim: lv.dim })
      if (it.glyph) drawText(fb, it.glyph, x + s / 2, Math.round(cy - font.ascent / 2), { font: theme.fonts.small, level: it.mark === 'filled' ? 0 : level, align: 'center' })
    } else if (it.dash !== undefined || it.marker) {
      if (it.dash !== undefined) line(fb, x, cy, x + sw - 1, cy, level, { width: 2, dash: it.dash })
      if (it.marker) drawMarker(fb, it.marker, x + Math.floor(sw / 2), cy, p.large ? 9 : 7, level)
    } else {
      fillRectPaint(fb, x, sy, sw, boxH, it.paint ?? level)
      strokeRect(fb, x, sy, sw, boxH, level, 1)
    }
    const tx = x + sw + (p.large ? 8 : 5)
    const avail = vertical ? rect.x + rect.w - tx : rect.x + rect.w - tx
    const text = ellipsize(it.label, avail, font, scale)
    drawText(fb, text, tx, Math.round(cy - (p.large ? font.ascent : th) / 2), { font, scale, level: lv.bright })
    if (vertical) y += rowH
    else x = tx + textWidth(text, font, scale) + 12
  }
}

export const Legend = defineComponent<LegendProps>('Legend', { w: 288, h: 144 }, renderLegend)
