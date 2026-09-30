/** P2 charts: waffle, scatter (+ trend), histogram, box plot, candlestick. */
import { defineComponent } from '../core/component.js'
import { fillRectPaint, line, strokeRect } from '../core/draw.js'
import { drawMarker, seriesStyle, warnSeries, type MarkerShape } from '../core/encodings.js'
import type { Framebuffer } from '../core/framebuffer.js'
import { cut, type Rect } from '../core/geometry.js'
import type { Theme } from '../core/theme.js'
import { chartFrame, drawSmall, drawState, formatNumber, linear, niceScale, smallH, smallW, type ChartCommon } from './common.js'
import { seriesPaint } from './grouped.js'
import { renderLegend } from './legend.js'

export interface WaffleChartProps extends ChartCommon {
  /** Parts; values are normalised to 100 cells. */
  parts: ReadonlyArray<{ label?: string; value: number }>
  /** Grid size (default 10×10). */
  rows?: number
  cols?: number
  /** Legend beside the grid (default when it fits). */
  legend?: boolean
}

/** 10×10 grid of cells: reads better than a pie at this resolution. Parts differ by pattern. */
export function renderWaffleChart(fb: Framebuffer, rect: Rect, p: WaffleChartProps, theme: Theme): void {
  const plot = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot, p, theme)) return
  const total = p.parts.reduce((a, s) => a + Math.max(0, s.value), 0)
  if (!total) return void drawState(fb, plot, { ...p, state: 'empty' }, theme)
  const rows = p.rows ?? 10
  const cols = p.cols ?? 10
  const n = rows * cols
  // Largest-remainder rounding so the cells add up to exactly n.
  const exact = p.parts.map((s) => (Math.max(0, s.value) / total) * n)
  const counts = exact.map(Math.floor)
  let left = n - counts.reduce((a, b) => a + b, 0)
  exact.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => left-- > 0 && counts[i]++)
  const gap = 2
  const cell = Math.max(3, Math.min(Math.floor((plot.h + gap) / rows) - gap, Math.floor((plot.w + gap) / cols) - gap))
  const gw = cols * (cell + gap) - gap
  const showLegend = p.legend ?? plot.w - gw > 80
  const x0 = plot.x + (showLegend ? 0 : Math.floor((plot.w - gw) / 2))
  const y0 = plot.y + Math.floor((plot.h - (rows * (cell + gap) - gap)) / 2)
  let k = 0
  counts.forEach((c, pi) => {
    const paint = seriesPaint(pi, theme)
    for (let j = 0; j < c; j++, k++) {
      // Fill column by column from the top-left, like reading a stacked bar.
      const col = Math.floor(k / rows)
      const row = k % rows
      const x = x0 + col * (cell + gap)
      const y = y0 + row * (cell + gap)
      fillRectPaint(fb, x, y, cell, cell, paint)
      if (pi > 0) strokeRect(fb, x, y, cell, cell, theme.levels.full, 1)
    }
  })
  for (; k < n; k++) strokeRect(fb, x0 + Math.floor(k / rows) * (cell + gap), y0 + (k % rows) * (cell + gap), cell, cell, theme.levels.faint, 1)
  if (showLegend) {
    const items = p.parts.map((s, i) => ({ label: `${s.label ?? ''} ${Math.round((s.value / total) * 100)}%`.trim(), paint: seriesPaint(i, theme) }))
    renderLegend(fb, { x: x0 + gw + 12, y: plot.y, w: plot.x + plot.w - (x0 + gw + 12), h: plot.h }, { items, valign: 'middle' }, theme)
  }
}

export const WaffleChart = defineComponent<WaffleChartProps>('WaffleChart', { w: 288, h: 144 }, renderWaffleChart)

export interface ScatterSeries {
  name?: string
  points: ReadonlyArray<readonly [number, number]>
  marker?: MarkerShape
}

export interface ScatterChartProps extends ChartCommon {
  series: readonly ScatterSeries[]
  /** Least-squares trend line per series (dashed like the series). */
  trend?: boolean
  xLabel?: string
  yLabel?: string
  xFormat?: ChartCommon['format']
}

export function linearFit(pts: ReadonlyArray<readonly [number, number]>): { slope: number; intercept: number } | null {
  const n = pts.length
  if (n < 2) return null
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (const [x, y] of pts) {
    sx += x
    sy += y
    sxx += x * x
    sxy += x * y
  }
  const d = n * sxx - sx * sx
  if (d === 0) return null
  const slope = (n * sxy - sx * sy) / d
  return { slope, intercept: (sy - slope * sx) / n }
}

export function renderScatterChart(fb: Framebuffer, rect: Rect, p: ScatterChartProps, theme: Theme): void {
  const plot0 = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot0, p, theme)) return
  const all = p.series.flatMap((s) => s.points)
  if (!all.length) return void drawState(fb, plot0, { ...p, state: 'empty' }, theme)
  warnSeries('Scatter', p.series.length)
  const lv = theme.levels
  const sh = smallH(theme)
  const xs = niceScale(Math.min(...all.map((q) => q[0])), Math.max(...all.map((q) => q[0])), 4)
  const ys = niceScale(Math.min(...all.map((q) => q[1])), Math.max(...all.map((q) => q[1])), 4)
  const ylw = Math.max(smallW(formatNumber(ys.min, p.format), theme), smallW(formatNumber(ys.max, p.format), theme)) + 5
  const plot: Rect = { x: plot0.x + ylw, y: plot0.y + Math.ceil(sh / 2), w: plot0.w - ylw - 4, h: plot0.h - sh - 6 - Math.ceil(sh / 2) }
  const px = linear(xs.min, xs.max, plot.x + 4, plot.x + plot.w - 4)
  const py = linear(ys.min, ys.max, plot.y + plot.h - 4, plot.y + 4)
  if (p.axis !== false) {
    fb.fillRect(plot.x, plot.y + plot.h, plot.w, 2, lv.dim)
    fb.fillRect(plot.x - 2, plot.y, 2, plot.h + 2, lv.dim)
  }
  if (p.labels !== 'none') {
    drawSmall(fb, formatNumber(ys.max, p.format), plot.x - 5, Math.round(py(ys.max) - sh / 2), lv.mid, theme, 'right')
    drawSmall(fb, formatNumber(ys.min, p.format), plot.x - 5, Math.round(py(ys.min) - sh / 2), lv.mid, theme, 'right')
    drawSmall(fb, formatNumber(xs.min, p.xFormat), plot.x, plot.y + plot.h + 4, lv.mid, theme)
    drawSmall(fb, formatNumber(xs.max, p.xFormat), plot.x + plot.w, plot.y + plot.h + 4, lv.mid, theme, 'right')
    if (p.xLabel) drawSmall(fb, p.xLabel, plot.x + plot.w / 2, plot.y + plot.h + 4, lv.dim, theme, 'center')
    if (p.yLabel) drawSmall(fb, p.yLabel, plot.x + 4, plot.y, lv.dim, theme)
  }
  p.series.forEach((s, si) => {
    const style = seriesStyle(si)
    const level = si === 0 ? lv.full : si === 1 ? lv.bright : lv.mid
    if (p.trend) {
      const fit = linearFit(s.points)
      if (fit) line(fb, px(xs.min), py(fit.intercept + fit.slope * xs.min), px(xs.max), py(fit.intercept + fit.slope * xs.max), lv.dim, { width: 2, dash: 'dashed' })
    }
    for (const [x, y] of s.points) drawMarker(fb, s.marker ?? style.marker, px(x), py(y), 5, level)
  })
}

export const ScatterChart = defineComponent<ScatterChartProps>('ScatterChart', { w: 288, h: 144 }, renderScatterChart)

export interface HistogramProps extends ChartCommon {
  values: readonly number[]
  /** Bin count (default: Sturges). */
  bins?: number
  /** Mark a value (e.g. "you") with a caret above its bin. */
  mark?: number
}

export function histogramBins(values: readonly number[], bins?: number): { edges: number[]; counts: number[] } {
  const n = values.length
  const k = bins ?? Math.max(1, Math.ceil(Math.log2(Math.max(1, n)) + 1))
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const w = (hi - lo) / k || 1
  const counts = new Array(k).fill(0)
  for (const v of values) counts[Math.min(k - 1, Math.floor((v - lo) / w))]++
  return { edges: Array.from({ length: k + 1 }, (_, i) => lo + i * w), counts }
}

export function renderHistogram(fb: Framebuffer, rect: Rect, p: HistogramProps, theme: Theme): void {
  const plot = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot, p, theme)) return
  if (!p.values.length) return void drawState(fb, plot, { ...p, state: 'empty' }, theme)
  const lv = theme.levels
  const sh = smallH(theme)
  const { edges, counts } = histogramBins(p.values, p.bins)
  const k = counts.length
  const bottom = plot.y + plot.h - sh - 5
  const top = plot.y + (p.mark !== undefined ? 8 : 0) + sh + 2
  const y = linear(0, Math.max(...counts, 1), bottom, top)
  const bw = plot.w / k
  if (p.axis !== false) fb.fillRect(plot.x, bottom, plot.w, 2, lv.dim)
  counts.forEach((c, i) => {
    const x = Math.round(plot.x + i * bw)
    const w = Math.round(plot.x + (i + 1) * bw) - x - 1
    const h = Math.round(bottom - y(c))
    const hit = p.mark !== undefined && p.mark >= edges[i] && (p.mark < edges[i + 1] || i === k - 1)
    if (h > 0) fb.fillRect(x, bottom - h, Math.max(1, w), h, hit ? lv.full : lv.bright)
    if (hit) {
      const cx = x + w / 2
      for (let d = 0; d < 5; d++) fb.fillRect(Math.round(cx - d), bottom - h - 8 + d, 2 * d + 1, 1, lv.full)
    }
    if (c > 0 && k <= 12) drawSmall(fb, String(c), x + w / 2, bottom - h - sh - 2 - (hit ? 8 : 0), lv.mid, theme, 'center')
  })
  if (p.labels !== 'none') {
    drawSmall(fb, formatNumber(edges[0], p.format), plot.x, bottom + 4, lv.mid, theme)
    drawSmall(fb, formatNumber(edges[k], p.format), plot.x + plot.w, bottom + 4, lv.mid, theme, 'right')
  }
}

export const Histogram = defineComponent<HistogramProps>('Histogram', { w: 288, h: 144 }, renderHistogram)

export interface BoxStats {
  label?: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

/** Five-number summary (linear interpolation quartiles). */
export function boxStats(values: readonly number[], label?: string): BoxStats {
  const s = [...values].sort((a, b) => a - b)
  const q = (p: number) => {
    const i = (s.length - 1) * p
    const lo = Math.floor(i)
    return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo)
  }
  return { label, min: s[0], q1: q(0.25), median: q(0.5), q3: q(0.75), max: s[s.length - 1] }
}

export interface BoxPlotProps extends ChartCommon {
  boxes: readonly BoxStats[]
}

/** Horizontal box plots, one row per box: whiskers, box, 3 px median bar. */
export function renderBoxPlot(fb: Framebuffer, rect: Rect, p: BoxPlotProps, theme: Theme): void {
  const plot0 = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot0, p, theme)) return
  if (!p.boxes.length) return void drawState(fb, plot0, { ...p, state: 'empty' }, theme)
  const lv = theme.levels
  const sh = smallH(theme)
  const labelW = Math.max(0, ...p.boxes.map((b) => (b.label ? smallW(b.label, theme) + 6 : 0)))
  const [axisStrip, plot1] = cut(plot0, 'bottom', sh + 5)
  const plot: Rect = { x: plot1.x + labelW, y: plot1.y, w: plot1.w - labelW, h: plot1.h }
  const sc = niceScale(Math.min(...p.boxes.map((b) => b.min)), Math.max(...p.boxes.map((b) => b.max)), 4)
  const x = linear(sc.min, sc.max, plot.x + 2, plot.x + plot.w - 3)
  const rowH = plot.h / p.boxes.length
  p.boxes.forEach((b, i) => {
    const cy = Math.round(plot.y + rowH * i + rowH / 2)
    const bh = Math.max(6, Math.min(22, Math.round(rowH * 0.6)))
    if (b.label) drawSmall(fb, b.label, plot.x - 6, cy - Math.floor(sh / 2), lv.bright, theme, 'right')
    fb.fillRect(Math.round(x(b.min)), cy, Math.round(x(b.q1) - x(b.min)), 1, lv.mid)
    fb.fillRect(Math.round(x(b.q3)), cy, Math.round(x(b.max) - x(b.q3)), 1, lv.mid)
    fb.fillRect(Math.round(x(b.min)), cy - 3, 1, 7, lv.mid)
    fb.fillRect(Math.round(x(b.max)), cy - 3, 1, 7, lv.mid)
    strokeRect(fb, Math.round(x(b.q1)), cy - Math.floor(bh / 2), Math.max(2, Math.round(x(b.q3) - x(b.q1))), bh, lv.bright, 2)
    fb.fillRect(Math.round(x(b.median)) - 1, cy - Math.floor(bh / 2), 3, bh, lv.full)
  })
  if (p.axis !== false) fb.fillRect(plot.x, axisStrip.y, plot.w, 1, lv.dim)
  drawSmall(fb, formatNumber(sc.min, p.format), plot.x, axisStrip.y + 4, lv.mid, theme)
  drawSmall(fb, formatNumber(sc.max, p.format), plot.x + plot.w, axisStrip.y + 4, lv.mid, theme, 'right')
}

export const BoxPlot = defineComponent<BoxPlotProps>('BoxPlot', { w: 288, h: 144 }, renderBoxPlot)

export interface Candle {
  open: number
  high: number
  low: number
  close: number
  label?: string
}

export interface CandlestickChartProps extends ChartCommon {
  candles: readonly Candle[]
}

/** OHLC candles: up = hollow body, down = filled body (shape, not colour). */
export function renderCandlestickChart(fb: Framebuffer, rect: Rect, p: CandlestickChartProps, theme: Theme): void {
  const plot0 = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot0, p, theme)) return
  if (!p.candles.length) return void drawState(fb, plot0, { ...p, state: 'empty' }, theme)
  const lv = theme.levels
  const sh = smallH(theme)
  const sc = niceScale(Math.min(...p.candles.map((c) => c.low)), Math.max(...p.candles.map((c) => c.high)), 4)
  const ylw = Math.max(smallW(formatNumber(sc.min, p.format), theme), smallW(formatNumber(sc.max, p.format), theme)) + 5
  const hasLabels = p.candles.some((c) => c.label)
  const plot: Rect = { x: plot0.x + ylw, y: plot0.y + Math.ceil(sh / 2), w: plot0.w - ylw, h: plot0.h - Math.ceil(sh / 2) - (hasLabels ? sh + 5 : 2) }
  const y = linear(sc.min, sc.max, plot.y + plot.h - 1, plot.y)
  const slot = plot.w / p.candles.length
  const bw = Math.max(3, Math.round(slot * 0.6) | 1)
  drawSmall(fb, formatNumber(sc.max, p.format), plot.x - 5, Math.round(y(sc.max) - sh / 2), lv.mid, theme, 'right')
  drawSmall(fb, formatNumber(sc.min, p.format), plot.x - 5, Math.round(y(sc.min) - sh / 2), lv.mid, theme, 'right')
  if (p.axis !== false) fb.fillRect(plot.x, plot.y + plot.h, plot.w, 1, lv.dim)
  p.candles.forEach((c, i) => {
    const cx = Math.round(plot.x + slot * i + slot / 2)
    const up = c.close >= c.open
    fb.fillRect(cx, Math.round(y(c.high)), 1, Math.max(1, Math.round(y(c.low) - y(c.high))), lv.bright)
    const top = Math.round(y(Math.max(c.open, c.close)))
    const h = Math.max(2, Math.round(y(Math.min(c.open, c.close))) - top)
    const x = cx - Math.floor(bw / 2)
    if (up) {
      fb.fillRect(x, top, bw, h, 0)
      strokeRect(fb, x, top, bw, h, lv.full, 1)
    } else fb.fillRect(x, top, bw, h, lv.full)
    if (c.label && (i === 0 || i === p.candles.length - 1 || p.labels === 'normal')) drawSmall(fb, c.label, cx, plot.y + plot.h + 4, lv.mid, theme, 'center')
  })
}

export const CandlestickChart = defineComponent<CandlestickChartProps>('CandlestickChart', { w: 288, h: 144 }, renderCandlestickChart)
