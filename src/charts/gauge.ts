/**
 * Gauge: an arc from min to max with a fill or a needle, a centre label and
 * optional threshold ticks. Wide rects get a semicircle; squarer rects a
 * 270° dial.
 */
import { defineComponent } from '../core/component.js'
import { fillCircle, fillSector, line } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import { inset, polar, type Rect } from '../core/geometry.js'
import { drawText, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { drawSmall, formatNumber, smallH, type NumberFormat } from './common.js'

export interface GaugeProps {
  value: number
  min?: number
  max?: number
  /** 'fill' (default) fills the arc to the value; 'needle' draws a pointer. */
  style?: 'fill' | 'needle'
  label?: string
  /** Centre text (default: the formatted value; '' for none). */
  text?: string
  format?: NumberFormat
  unit?: string
  /** Values that get a tick outside the arc. */
  thresholds?: readonly number[]
  /** Arc thickness in px (default: radius / 5). */
  thickness?: number
  /** Show min/max at the arc ends (default true). */
  endLabels?: boolean
}

export function renderGauge(fb: Framebuffer, rect: Rect, p: GaugeProps, theme: Theme): void {
  const lv = theme.levels
  const r0 = inset(rect, theme.padding)
  const min = p.min ?? 0
  const max = p.max ?? 100
  const t = Math.max(0, Math.min(1, (p.value - min) / (max - min || 1)))
  const sh = smallH(theme)
  const semi = r0.w >= r0.h * 1.6
  const sweep = semi ? 180 : 270
  const a0 = -sweep / 2
  const labelH = p.label ? theme.fonts.body.glyphH + 4 : 0
  let R: number
  let cx: number
  let cy: number
  if (semi) {
    R = Math.min(r0.w / 2, r0.h - labelH - (p.endLabels !== false ? sh + 2 : 0)) - 4
    cx = r0.x + r0.w / 2
    cy = r0.y + labelH + R + 4
  } else {
    R = Math.min(r0.w, r0.h - labelH) / 2 - 4
    cx = r0.x + r0.w / 2
    cy = r0.y + labelH + (r0.h - labelH) / 2 + R * 0.12
  }
  if (R < 8) return
  const th = p.thickness ?? Math.max(4, Math.round(R / 5))
  const rIn = R - th
  if (p.label) drawText(fb, p.label.toUpperCase(), cx, r0.y, { font: theme.fonts.body, level: lv.mid, align: 'center' })

  // Track: faint; value: bright fill (or needle).
  fillSector(fb, cx, cy, rIn, R, a0, a0 + sweep, lv.faint)
  if (p.style === 'needle') {
    const a = a0 + sweep * t
    const tip = polar(cx, cy, R - 1, a)
    line(fb, cx, cy, tip.x, tip.y, lv.full, { width: 3 })
    fillCircle(fb, cx, cy, 5, lv.full)
  } else if (t > 0) fillSector(fb, cx, cy, rIn, R, a0, a0 + sweep * t, lv.full)
  // End caps: short 2 px radial ticks at min/max.
  for (const a of [a0, a0 + sweep]) {
    const p1 = polar(cx, cy, rIn - 3, a)
    const p2 = polar(cx, cy, rIn - 1, a)
    line(fb, p1.x, p1.y, p2.x, p2.y, lv.dim, { width: 2 })
  }
  for (const v of p.thresholds ?? []) {
    const a = a0 + sweep * Math.max(0, Math.min(1, (v - min) / (max - min || 1)))
    const o1 = polar(cx, cy, R + 2, a)
    const o2 = polar(cx, cy, R + 7, a)
    line(fb, o1.x, o1.y, o2.x, o2.y, lv.bright, { width: 2 })
  }
  if (p.endLabels !== false) {
    const e0 = polar(cx, cy, R - th / 2, a0)
    const e1 = polar(cx, cy, R - th / 2, a0 + sweep)
    const ly = semi ? cy + 3 : e0.y + th / 2 + 2
    drawSmall(fb, formatNumber(min, p.format), e0.x, ly, lv.dim, theme, 'center')
    drawSmall(fb, formatNumber(max, p.format), e1.x, ly, lv.dim, theme, 'center')
  }
  const text = p.text ?? `${formatNumber(p.value, p.format)}${p.unit ?? ''}`
  if (text) {
    const space = (rIn - 4) * 2
    const d = theme.fonts.display
    const useDisplay = textWidth(text, d) <= space * (semi ? 0.9 : 0.8) && rIn > d.glyphH
    const font = useDisplay ? d : theme.fonts.body
    const ty = semi ? cy - font.glyphH - 2 - (p.style === 'needle' ? 6 : 0) : cy - font.ascent / 2 + (p.style === 'needle' ? rIn * 0.45 : 0)
    drawText(fb, text, cx, Math.round(ty), { font, level: lv.full, align: 'center' })
  }
}

export const Gauge = defineComponent<GaugeProps>('Gauge', { w: 288, h: 144 }, renderGauge)
