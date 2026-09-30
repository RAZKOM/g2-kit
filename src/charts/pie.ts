/**
 * Pie / donut (≤ ~5 slices, patterned fills, 2 px dark separators, labels
 * outside or a legend) and concentric progress rings (Activity-style).
 */
import { defineComponent } from '../core/component.js'
import { fillRectPaint, fillSector, line, strokeArc, strokeRect } from '../core/draw.js'
import { seriesStyle } from '../core/encodings.js'
import type { Framebuffer } from '../core/framebuffer.js'
import { inset, polar, type Rect } from '../core/geometry.js'
import type { FillPattern, Paint } from '../core/paint.js'
import { drawText, ellipsize, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { chartFrame, drawSmall, drawState, formatNumber, smallH, smallW, type ChartCommon, type NumberFormat } from './common.js'
import { renderLegend, type LegendItem } from './legend.js'

export interface PieSlice {
  label?: string
  value: number
  fill?: FillPattern
}

export interface PieChartProps extends ChartCommon {
  slices: readonly PieSlice[]
  /** Inner radius as a fraction of the outer (0 = pie, default 0.55 = donut). */
  donut?: number
  /** Text in the donut hole (default: largest slice %; '' for none). */
  center?: string
  centerLabel?: string
  /** 'outside' labels, a 'legend' beside, or 'none' (default: legend when it fits). */
  labelMode?: 'outside' | 'legend' | 'none'
  /** Label values as percentages (default) or raw values. */
  percent?: boolean
  valueFormat?: NumberFormat
}

const SLICE_FILLS: FillPattern[] = ['solid', 'hatch', 'dots', 'crossHatch', 'checker', 'vStripes']

function slicePaint(i: number, s: PieSlice, theme: Theme): Paint {
  const f = s.fill ?? SLICE_FILLS[i % SLICE_FILLS.length]
  return f === 'solid' ? theme.levels.bright : { pattern: f, level: theme.levels.full }
}

export function renderPieChart(fb: Framebuffer, rect: Rect, p: PieChartProps, theme: Theme): void {
  const plot = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot, p, theme)) return
  const slices = p.slices.filter((s) => s.value > 0)
  const total = slices.reduce((a, s) => a + s.value, 0)
  if (!slices.length || total <= 0) return void drawState(fb, plot, { ...p, state: 'empty' }, theme)
  if (slices.length > 5) console.warn('[g2-kit] Pie: more than 5 slices are hard to read on the glasses; consider a bar chart or waffle.')
  const lv = theme.levels
  const pct = (v: number) => (p.percent === false ? formatNumber(v, p.valueFormat) : `${Math.round((v / total) * 100)}%`)
  const mode = p.labelMode ?? (plot.w > plot.h * 1.3 ? 'legend' : 'outside')

  let pie = plot
  if (mode === 'legend') {
    const items: LegendItem[] = slices.map((s, i) => ({ label: `${s.label ?? ''} ${pct(s.value)}`.trim(), paint: slicePaint(i, s, theme) }))
    const lw = Math.min(Math.round(plot.w * 0.5), Math.max(...items.map((it) => smallW(it.label, theme))) + 22)
    renderLegend(fb, { x: plot.x + plot.w - lw, y: plot.y, w: lw, h: plot.h }, { items, direction: 'vertical', valign: 'middle' }, theme)
    pie = { x: plot.x, y: plot.y, w: plot.w - lw - 6, h: plot.h }
  }
  // Outside labels need room on both sides and above/below.
  const labelText = (s: PieSlice) => `${s.label ? `${s.label} ` : ''}${pct(s.value)}`
  const maxLabelW = mode === 'outside' ? Math.max(...slices.map((s) => smallW(labelText(s), theme))) : 0
  const padX = mode === 'outside' ? maxLabelW + 6 : 2
  const padY = mode === 'outside' ? smallH(theme) + 6 : 2
  const R = Math.max(6, Math.min(pie.w / 2 - padX, pie.h / 2 - padY))
  const cx = pie.x + pie.w / 2
  const cy = pie.y + pie.h / 2
  const rIn = R * (p.donut ?? 0.55)

  let a = 0
  slices.forEach((s, i) => {
    const sweep = (s.value / total) * 360
    fillSector(fb, cx, cy, rIn, R, a, a + sweep, slicePaint(i, s, theme))
    a += sweep
  })
  // Outer outline so patterned slices have an edge, then dark separators.
  strokeArc(fb, cx, cy, R - 0.5, 0, 360, lv.full, 1)
  if (rIn > 2) strokeArc(fb, cx, cy, rIn + 0.5, 0, 360, lv.full, 1)
  a = 0
  if (slices.length > 1)
    for (const s of slices) {
      const p0 = polar(cx, cy, Math.max(0, rIn - 1), a)
      const p1 = polar(cx, cy, R + 1, a)
      line(fb, p0.x, p0.y, p1.x, p1.y, 0, { width: 2 })
      a += (s.value / total) * 360
    }

  if (mode === 'outside') {
    a = 0
    slices.forEach((s) => {
      const mid = a + ((s.value / total) * 360) / 2
      a += (s.value / total) * 360
      const pt = polar(cx, cy, R + 4, mid)
      const text = labelText(s)
      const right = mid < 180
      // Vertical anchor: above the point near 12 o'clock, below near 6, centred at the sides.
      const up = Math.cos((mid * Math.PI) / 180)
      const ty = Math.round(pt.y - smallH(theme) / 2 - up * (smallH(theme) / 2 + 1))
      const tw = smallW(text, theme)
      const tx = right ? Math.min(rect.x + rect.w - tw, pt.x + 2) : Math.max(rect.x, pt.x - tw - 2)
      drawSmall(fb, text, tx, ty, lv.bright, theme)
    })
  }

  if (rIn > 12) {
    const big = slices.reduce((m, s) => (s.value > m.value ? s : m))
    const text = p.center ?? pct(big.value)
    if (text) {
      const d = theme.fonts.display
      const font = textWidth(text, d) <= rIn * 1.7 ? d : theme.fonts.body
      const sub = p.centerLabel ?? (p.center === undefined ? big.label : undefined)
      const subH = sub ? smallH(theme) + 2 : 0
      const ty = Math.round(cy - (font.ascent + subH) / 2)
      drawText(fb, text, cx, ty, { font, level: lv.full, align: 'center' })
      if (sub) drawSmall(fb, ellipsize(sub, rIn * 1.7, theme.fonts.small, theme.smallScale), cx, ty + font.ascent + 3, lv.mid, theme, 'center')
    }
  }
}

export const PieChart = defineComponent<PieChartProps>('PieChart', { w: 288, h: 144 }, renderPieChart)

export interface ProgressRingsProps {
  /** Outer → inner; 1–3 rings. `value` is 0–1 (or value/max); > 1 laps. */
  rings: ReadonlyArray<{ label?: string; value: number; max?: number }>
  /** Centre text. */
  center?: string
  thickness?: number
  /** Show ring labels to the right (default when there is room). */
  labels?: boolean
}

/** Concentric progress rings. Each ring: faint track, bright progress, a notch at the progress end. */
export function renderProgressRings(fb: Framebuffer, rect: Rect, p: ProgressRingsProps, theme: Theme): void {
  const lv = theme.levels
  const r = inset(rect, theme.padding)
  const showLabels = p.labels ?? r.w > r.h * 1.4
  const size = showLabels ? Math.min(r.h, r.w * 0.55) : Math.min(r.w, r.h)
  const cx = r.x + (showLabels ? size / 2 : r.w / 2)
  const cy = r.y + r.h / 2
  const n = Math.min(3, p.rings.length)
  const th = p.thickness ?? Math.max(5, Math.round(size / 2 / (n * 2.4)))
  const gap = 3
  p.rings.slice(0, 3).forEach((ring, i) => {
    const R = size / 2 - i * (th + gap)
    const frac = ring.max ? ring.value / ring.max : ring.value
    fillSector(fb, cx, cy, R - th, R, 0, 360, lv.faint)
    const sweep = Math.min(1, Math.max(0, frac)) * 360
    const level = i === 0 ? lv.full : i === 1 ? lv.bright : lv.mid
    const paint: Paint = i === 0 ? level : { pattern: seriesStyle(i).fill, level: lv.full }
    if (sweep > 0) fillSector(fb, cx, cy, R - th, R, 0, sweep, paint)
    if (frac > 1) fillSector(fb, cx, cy, R - th, R, 0, Math.min(1, frac - 1) * 360, lv.full)
    // Dark notch where progress ends (reads as a direction marker).
    if (sweep > 0 && sweep < 360) {
      const a = polar(cx, cy, R - th - 1, sweep)
      const b = polar(cx, cy, R + 1, sweep)
      line(fb, a.x, a.y, b.x, b.y, 0, { width: 2 })
    }
    if (showLabels && ring.label) {
      const ly = r.y + 4 + i * (smallH(theme) + 10)
      const lx = r.x + size + 12
      fillRectPaint(fb, lx, ly, 10, 7, paint)
      strokeRect(fb, lx, ly, 10, 7, level, 1)
      drawSmall(fb, `${ring.label} ${Math.round(frac * 100)}%`, lx + 14, ly, lv.bright, theme)
    }
  })
  if (p.center) drawText(fb, p.center, cx, Math.round(cy - theme.fonts.body.ascent / 2), { font: theme.fonts.body, level: lv.full, align: 'center' })
}

export const ProgressRings = defineComponent<ProgressRingsProps>('ProgressRings', { w: 288, h: 144 }, renderProgressRings)
