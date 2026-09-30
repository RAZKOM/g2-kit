/**
 * Big number / KPI tile: label, value + unit (auto-fit: display font, 7-seg,
 * or body), delta arrow with sign, footnote, optional sparkline beneath.
 * The delta arrow is filled when the change is good and outlined when bad,
 * so direction and sentiment survive without colour.
 */
import { defineComponent } from '../core/component.js'
import { fillTriangle, strokePolygon } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import { cut, inset, type Rect } from '../core/geometry.js'
import { drawSevenSeg, measureSevenSeg } from '../core/fonts/sevenSeg.js'
import { drawText, ellipsize, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { drawSmall, formatNumber, smallH, type NumberFormat } from './common.js'
import { renderSparkline } from './line.js'

export interface KpiProps {
  value: number | string
  label?: string
  unit?: string
  format?: NumberFormat
  /** Change since the previous period. */
  delta?: number
  deltaFormat?: NumberFormat
  /** Which direction is good (default 'up'); 'none' draws both arrows filled. */
  good?: 'up' | 'down' | 'none'
  footnote?: string
  spark?: ReadonlyArray<number | null>
  /** Value style: 'auto' (display font), 'segment' (7-segment), 'body'. */
  style?: 'auto' | 'segment' | 'body'
  align?: 'left' | 'center'
}

export function renderKpi(fb: Framebuffer, rect: Rect, p: KpiProps, theme: Theme): void {
  const lv = theme.levels
  let r = inset(rect, theme.padding)
  const sh = smallH(theme)
  const center = p.align === 'center'
  if (p.label) {
    const font = theme.fonts.body
    const [strip, rest] = cut(r, 'top', font.glyphH + 4)
    drawText(fb, ellipsize(p.label.toUpperCase(), strip.w, font), center ? strip.x + strip.w / 2 : strip.x, strip.y, { font, level: lv.mid, align: center ? 'center' : 'left' })
    r = rest
  }
  if (p.footnote) {
    const [strip, rest] = cut(r, 'bottom', sh + 2)
    drawSmall(fb, ellipsize(p.footnote, strip.w, theme.fonts.small, theme.smallScale), center ? strip.x + strip.w / 2 : strip.x, strip.y + 2, lv.dim, theme, center ? 'center' : 'left')
    r = rest
  }
  if (p.spark && p.spark.length > 1) {
    const h = Math.min(28, Math.max(14, Math.round(r.h * 0.3)))
    const [strip, rest] = cut(r, 'bottom', h + 3)
    renderSparkline(fb, { x: strip.x, y: strip.y + 3, w: strip.w, h }, { values: p.spark }, theme)
    r = rest
  }

  const text = typeof p.value === 'number' ? formatNumber(p.value, p.format) : p.value
  const unit = p.unit ?? ''
  // Delta block on the right of the value line.
  let deltaText = ''
  if (p.delta !== undefined && Number.isFinite(p.delta)) {
    const d = formatNumber(Math.abs(p.delta), p.deltaFormat ?? p.format)
    deltaText = `${p.delta > 0 ? '+' : p.delta < 0 ? '-' : '±'}${d}`
  }
  const deltaW = deltaText ? textWidth(deltaText, theme.fonts.body) + 14 : 0

  // Pick the biggest value rendering that fits, with the delta beside the value
  // or, when that squeezes the value, on its own row underneath.
  const unitFont = theme.fonts.body
  const unitW = unit ? textWidth(unit, unitFont) + 4 : 0
  type Choice = { kind: 'font'; font: typeof theme.fonts.display; scale: number; w: number; h: number } | { kind: 'seg'; h: number; w: number }
  const choices: Choice[] = []
  if (p.style === 'segment') {
    for (const h of [64, 56, 48, 40, 32, 24, 18]) choices.push({ kind: 'seg', h, w: measureSevenSeg(text, { height: h }) })
  } else if (p.style !== 'body') {
    const d = theme.fonts.display
    for (const scale of [3, 2, 1]) choices.push({ kind: 'font', font: d, scale, w: textWidth(text, d, scale), h: d.glyphH * scale })
  }
  choices.push({ kind: 'font', font: theme.fonts.body, scale: 2, w: textWidth(text, theme.fonts.body, 2), h: theme.fonts.body.glyphH * 2 })
  choices.push({ kind: 'font', font: theme.fonts.body, scale: 1, w: textWidth(text, theme.fonts.body), h: theme.fonts.body.glyphH })
  const fits = (a: { w: number; h: number }) => choices.find((c) => c.w + unitW <= a.w && c.h <= a.h) ?? choices[choices.length - 1]
  const deltaRowH = theme.fonts.body.glyphH + 6
  const side = fits({ w: r.w - deltaW - (deltaW ? 6 : 0), h: r.h })
  const stacked = deltaText ? fits({ w: r.w, h: r.h - deltaRowH }) : side
  const stack = deltaText !== '' && stacked.h > side.h * 1.25
  const pick = stack ? stacked : side
  const availW = stack ? r.w : r.w - deltaW - (deltaW ? 6 : 0)
  const blockW = pick.w + unitW
  const blockH = pick.h + (stack ? deltaRowH : 0)
  const x0 = center ? Math.round(r.x + (r.w - blockW - (deltaW && !stack ? deltaW + 6 : 0)) / 2) : r.x
  const y0 = r.y + Math.round((r.h - blockH) / 2)
  if (pick.kind === 'seg') drawSevenSeg(fb, text, x0, y0, { height: pick.h, level: lv.full })
  else drawText(fb, ellipsize(text, availW - unitW, pick.font, pick.scale), x0, y0, { font: pick.font, scale: pick.scale, level: lv.full })
  if (unit) drawText(fb, unit, x0 + pick.w + 4, y0 + pick.h - unitFont.glyphH + (pick.kind === 'font' ? -Math.round((pick.font.glyphH - pick.font.ascent) * pick.scale) + 2 : 0), { font: unitFont, level: lv.bright })

  if (deltaText) {
    const up = (p.delta ?? 0) > 0
    const good = p.good === 'none' || (p.good === 'down' ? !up : up) || p.delta === 0
    const dx = stack ? (center ? Math.round(r.x + (r.w - deltaW) / 2) : x0) : x0 + blockW + 8
    const cy = stack ? y0 + pick.h + 6 + Math.round(theme.fonts.body.ascent / 2) : y0 + Math.round(pick.h / 2)
    const tri = up
      ? [{ x: dx, y: cy + 4 }, { x: dx + 10, y: cy + 4 }, { x: dx + 5, y: cy - 5 }]
      : [{ x: dx, y: cy - 5 }, { x: dx + 10, y: cy - 5 }, { x: dx + 5, y: cy + 4 }]
    if (p.delta !== 0) {
      if (good) fillTriangle(fb, tri[0], tri[1], tri[2], lv.full)
      else strokePolygon(fb, tri, lv.full, { width: 1 })
    }
    drawText(fb, deltaText, dx + 14, cy - Math.round(theme.fonts.body.ascent / 2), { font: theme.fonts.body, level: lv.bright })
  }
}

export const Kpi = defineComponent<KpiProps>('Kpi', { w: 288, h: 144 }, renderKpi)
