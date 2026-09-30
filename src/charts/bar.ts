/**
 * Bar chart: vertical or horizontal, value labels, one highlighted bar, peak
 * marker, negative values around a zero baseline. Negative bars are drawn as
 * outlines so the sign survives without brightness.
 */
import { defineComponent } from '../core/component.js'
import { fillRectPaint, fillTriangle, strokeRect } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Rect } from '../core/geometry.js'
import type { FillPattern } from '../core/paint.js'
import type { Theme } from '../core/theme.js'
import { chartFrame, drawSmall, drawState, formatNumber, linear, showLabel, smallH, smallW, type ChartCommon } from './common.js'

export type BarDatum = number | { label?: string; value: number }

export interface BarChartProps extends ChartCommon {
  data: readonly BarDatum[]
  /** Category labels (override datum labels). */
  categories?: readonly string[]
  orientation?: 'vertical' | 'horizontal'
  /** Index drawn at full brightness with its label always shown. */
  highlight?: number
  /** Value labels on bars (default: when ≤ 12 bars). */
  valueLabels?: boolean
  /** Small ▼ marker over the maximum bar. */
  peak?: boolean
  /** Fill for positive bars (default solid). */
  fill?: FillPattern
  /** Force the value domain. */
  min?: number
  max?: number
  /** Gap between bars as a fraction of the slot (default 0.25). */
  gap?: number
}

function value(d: BarDatum): number {
  return typeof d === 'number' ? d : d.value
}

export function renderBarChart(fb: Framebuffer, rect: Rect, p: BarChartProps, theme: Theme): void {
  const plot0 = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot0, p, theme)) return
  if (p.data.length === 0) return void drawState(fb, plot0, { ...p, state: 'empty' }, theme)
  if (p.orientation === 'horizontal') return renderHorizontal(fb, plot0, p, theme)

  const lv = theme.levels
  const n = p.data.length
  const vals = p.data.map(value)
  const labels = p.categories ?? p.data.map((d) => (typeof d === 'number' ? '' : (d.label ?? '')))
  const hasLabels = labels.some((l) => l)
  // Category labels: all when ≤ 8 bars, else sparse (first, last, highlight), unless overridden.
  const catDensity = !hasLabels ? 'none' : (p.labels ?? (n <= 8 ? 'normal' : 'sparse'))
  const sh = smallH(theme)
  const showValues = p.valueLabels ?? n <= 12
  const lo = Math.min(0, p.min ?? Math.min(...vals))
  const hi = Math.max(0, p.max ?? Math.max(...vals))
  const top = plot0.y + (showValues || p.peak ? sh + 3 : 0)
  const bottom = plot0.y + plot0.h - (catDensity !== 'none' ? sh + 3 : 0) - (lo < 0 && showValues ? sh + 3 : 0)
  const y = linear(lo, hi === lo ? lo + 1 : hi, bottom, top)
  const zero = Math.round(y(0))
  const slot = plot0.w / n
  const barW = Math.max(2, Math.round(slot * (1 - (p.gap ?? 0.25))))
  const maxI = vals.indexOf(Math.max(...vals))

  // Baseline (2 px) instead of gridlines.
  if (p.axis !== false) fb.fillRect(plot0.x, zero, plot0.w, 2, lv.dim)

  vals.forEach((v, i) => {
    const cx = plot0.x + slot * i + slot / 2
    const x = Math.round(cx - barW / 2)
    const hl = p.highlight === i
    const level = p.highlight === undefined || hl ? lv.bright : lv.mid
    const yv = Math.round(y(v))
    if (v >= 0) {
      const h = Math.max(v > 0 ? 2 : 0, zero - yv)
      if (h > 0) fillRectPaint(fb, x, zero - h, barW, h, p.fill && !hl ? { pattern: p.fill, level } : hl ? lv.full : level)
    } else {
      const h = Math.max(2, yv - zero - 1)
      strokeRect(fb, x, zero + 2, barW, h, hl ? lv.full : level, 2)
    }
    const text = formatNumber(v, p.format)
    if (showValues && smallW(text, theme) <= slot + 2) {
      const ty = v >= 0 ? Math.round(y(Math.max(v, 0))) - sh - 3 : Math.round(y(v)) + 4
      drawSmall(fb, text, cx, ty, hl ? lv.full : lv.bright, theme, 'center')
    }
    if (p.peak && i === maxI && v > 0) {
      const ty = Math.round(y(v)) - (showValues ? sh + 6 : 3)
      fillTriangle(fb, { x: cx - 4, y: ty - 5 }, { x: cx + 4, y: ty - 5 }, { x: cx, y: ty }, lv.full)
    }
    if (showLabel(i, n, catDensity, p.highlight) && labels[i]) {
      drawSmall(fb, labels[i], cx, plot0.y + plot0.h - sh, hl ? lv.full : lv.bright, theme, 'center')
    }
  })
}

function renderHorizontal(fb: Framebuffer, plot: Rect, p: BarChartProps, theme: Theme): void {
  const lv = theme.levels
  const n = p.data.length
  const vals = p.data.map(value)
  const labels = p.categories ?? p.data.map((d) => (typeof d === 'number' ? '' : (d.label ?? '')))
  const sh = smallH(theme)
  const labelW = Math.min(Math.round(plot.w * 0.35), Math.max(0, ...labels.map((l) => smallW(l, theme))))
  const showValues = p.valueLabels ?? n <= 12
  const valueW = showValues ? Math.max(...vals.map((v) => smallW(formatNumber(v, p.format), theme))) + 4 : 0
  const x0 = plot.x + (labelW ? labelW + 6 : 0)
  const lo = Math.min(0, p.min ?? Math.min(...vals))
  const hi = Math.max(0, p.max ?? Math.max(...vals))
  const x = linear(lo, hi === lo ? lo + 1 : hi, x0 + (lo < 0 ? valueW : 0), plot.x + plot.w - valueW)
  const zero = Math.round(x(0))
  const slot = plot.h / n
  const barH = Math.max(2, Math.round(slot * (1 - (p.gap ?? 0.3))))
  const maxI = vals.indexOf(Math.max(...vals))
  if (p.axis !== false) fb.fillRect(zero - 1, plot.y, 2, plot.h, lv.dim)
  vals.forEach((v, i) => {
    const cy = plot.y + slot * i + slot / 2
    const y = Math.round(cy - barH / 2)
    const hl = p.highlight === i
    const level = p.highlight === undefined || hl ? lv.bright : lv.mid
    const xv = Math.round(x(v))
    if (v >= 0) {
      const w = Math.max(v > 0 ? 2 : 0, xv - zero - 1)
      if (w > 0) fillRectPaint(fb, zero + 1, y, w, barH, p.fill && !hl ? { pattern: p.fill, level } : hl ? lv.full : level)
    } else strokeRect(fb, xv, y, Math.max(2, zero - 1 - xv), barH, hl ? lv.full : level, 2)
    const ty = Math.round(cy - sh / 2)
    if (labels[i]) drawSmall(fb, labels[i], x0 - 6, ty, hl ? lv.full : lv.bright, theme, 'right')
    if (showValues) {
      const text = formatNumber(v, p.format)
      if (v >= 0) drawSmall(fb, text, xv + 3, ty, hl ? lv.full : lv.bright, theme)
      else drawSmall(fb, text, xv - 3, ty, hl ? lv.full : lv.bright, theme, 'right')
    }
    if (p.peak && i === maxI && v > 0 && !showValues) fillTriangle(fb, { x: xv + 3, y: cy - 4 }, { x: xv + 3, y: cy + 4 }, { x: xv + 8, y: cy }, lv.full)
  })
}

export const BarChart = defineComponent<BarChartProps>('BarChart', { w: 288, h: 144 }, renderBarChart)
