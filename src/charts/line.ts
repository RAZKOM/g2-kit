/**
 * Line chart: up to 3 series told apart by dash + marker, optional patterned
 * area under the first series, min/max annotations, nice auto y-range.
 * Sparkline: the same idea at 16–32 px tall with a last-value dot.
 */
import { defineComponent } from '../core/component.js'
import { fillPolygon, polyline } from '../core/draw.js'
import { drawMarker, seriesStyle, warnSeries, type MarkerShape } from '../core/encodings.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Point, Rect } from '../core/geometry.js'
import type { Dash, FillPattern } from '../core/paint.js'
import type { Theme } from '../core/theme.js'
import { chartFrame, drawSmall, drawState, formatNumber, linear, niceScale, smallH, smallW, type ChartCommon } from './common.js'

export interface LineSeries {
  name?: string
  values: ReadonlyArray<number | null>
  dash?: Dash
  marker?: MarkerShape | 'none'
  /** Pattern under this series (down to the baseline). */
  area?: FillPattern
  level?: number
}

export interface LineChartProps extends ChartCommon {
  series: readonly LineSeries[] | ReadonlyArray<number | null>
  /** X labels; with sparse density only first/last are drawn. */
  xLabels?: readonly string[]
  yMin?: number
  yMax?: number
  /** Markers at points: 'auto' (all when ≤ 12 points, else last), 'all', 'last', 'none'. */
  markers?: 'auto' | 'all' | 'last' | 'none'
  /** Label the max (▲) and min (▼) of the first series. */
  annotateMinMax?: boolean
  /** Area fill for the first series when it has none (e.g. 'dots'). */
  area?: FillPattern
  /** Include zero in the y-range (default false). */
  zero?: boolean
}

function toSeries(s: LineChartProps['series']): LineSeries[] {
  if (s.length === 0) return []
  return typeof s[0] === 'object' && s[0] !== null ? (s as LineSeries[]) : [{ values: s as ReadonlyArray<number | null> }]
}

/** Split a series into runs of consecutive non-null points. */
function runs(values: ReadonlyArray<number | null>, px: (i: number) => number, py: (v: number) => number): Point[][] {
  const out: Point[][] = []
  let cur: Point[] = []
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      if (cur.length) out.push(cur)
      cur = []
    } else cur.push({ x: Math.round(px(i)), y: Math.round(py(v)) })
  })
  if (cur.length) out.push(cur)
  return out
}

export function renderLineChart(fb: Framebuffer, rect: Rect, p: LineChartProps, theme: Theme): void {
  const plot0 = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot0, p, theme)) return
  const series = toSeries(p.series)
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)))
  if (all.length === 0) return void drawState(fb, plot0, { ...p, state: 'empty' }, theme)
  warnSeries('LineChart', series.length)

  const lv = theme.levels
  const sh = smallH(theme)
  const density = p.labels ?? 'sparse'
  let lo = p.yMin ?? Math.min(...all)
  let hi = p.yMax ?? Math.max(...all)
  if (p.zero) {
    lo = Math.min(0, lo)
    hi = Math.max(0, hi)
  }
  const scale = p.yMin !== undefined && p.yMax !== undefined ? { min: lo, max: hi, ticks: [lo, hi], step: hi - lo } : niceScale(lo, hi, 5)
  const tickLabels = density === 'none' ? [] : density === 'sparse' ? [scale.min, scale.max] : scale.ticks
  const yLabelW = tickLabels.length ? Math.max(...tickLabels.map((t) => smallW(formatNumber(t, p.format), theme))) + 5 : 0
  const xLab = p.xLabels && density !== 'none'
  const mm = p.annotateMinMax ? sh + 4 : 0
  const plot: Rect = { x: plot0.x + yLabelW, y: plot0.y + mm + (tickLabels.length ? Math.ceil(sh / 2) : 0), w: plot0.w - yLabelW, h: 0 }
  plot.h = plot0.y + plot0.h - plot.y - (xLab ? sh + 4 : 0) - (tickLabels.length ? Math.ceil(sh / 2) : 0) - mm
  const n = Math.max(...series.map((s) => s.values.length))
  const px = linear(0, Math.max(1, n - 1), plot.x + 3, plot.x + plot.w - 4)
  const py = linear(scale.min, scale.max, plot.y + plot.h - 1, plot.y)

  // Axis: baseline + left tick marks only (no hairline grid).
  if (p.axis !== false) {
    fb.fillRect(plot.x, plot.y + plot.h, plot.w, 2, lv.dim)
    for (const t of tickLabels) fb.fillRect(plot.x - 3, Math.round(py(t)), 3, 1, lv.dim)
  }
  for (const t of tickLabels) drawSmall(fb, formatNumber(t, p.format), plot.x - 5, Math.round(py(t) - sh / 2), lv.mid, theme, 'right')
  if (xLab && p.xLabels) {
    const labels = p.xLabels
    labels.forEach((l, i) => {
      const show = density === 'normal' ? true : i === 0 || i === labels.length - 1
      if (!show || !l) return
      const x = px(i)
      const align = i === 0 ? 'left' : i === labels.length - 1 ? 'right' : 'center'
      drawSmall(fb, l, align === 'left' ? Math.max(plot.x, x - 3) : align === 'right' ? Math.min(plot.x + plot.w, x + 3) : x, plot.y + plot.h + 4, lv.mid, theme, align)
    })
  }

  series.forEach((s, si) => {
    const style = seriesStyle(si)
    const level = s.level ?? (si === 0 ? lv.full : si === 1 ? lv.bright : lv.mid)
    const segs = runs(s.values, px, py)
    const area = s.area ?? (si === 0 ? p.area : undefined)
    if (area) {
      const base = plot.y + plot.h - 1
      for (const seg of segs)
        if (seg.length > 1) fillPolygon(fb, [...seg, { x: seg[seg.length - 1].x, y: base }, { x: seg[0].x, y: base }], { pattern: area, level: lv.dim })
    }
    for (const seg of segs) polyline(fb, seg, level, { width: theme.stroke, dash: s.dash ?? style.dash })
    const markerMode = p.markers ?? 'auto'
    const marker = s.marker ?? style.marker
    if (marker !== 'none' && markerMode !== 'none') {
      const pts = segs.flat()
      const every = markerMode === 'all' || (markerMode === 'auto' && n <= 12)
      const list = every ? pts : pts.slice(-1)
      for (const pt of list) drawMarker(fb, marker, pt.x, pt.y, 7, level)
    }
  })

  if (p.annotateMinMax) {
    const s = series[0].values
    let maxI = -1
    let minI = -1
    s.forEach((v, i) => {
      if (v === null) return
      if (maxI < 0 || v > (s[maxI] as number)) maxI = i
      if (minI < 0 || v < (s[minI] as number)) minI = i
    })
    const note = (i: number, above: boolean) => {
      const v = s[i] as number
      const text = formatNumber(v, p.format)
      const x = Math.round(px(i))
      const w = smallW(text, theme)
      const tx = Math.max(plot.x + w / 2, Math.min(plot.x + plot.w - w / 2, x))
      const y = Math.round(py(v))
      // Keep annotations inside the plot so they never sit on axis labels; flip if needed.
      let ty = above ? y - sh - 6 : y + 6
      if (!above && ty + sh > plot.y + plot.h - 2) ty = y - sh - 6
      if (above && ty < plot0.y) ty = y + 6
      if (ty < plot0.y || ty + sh > plot.y + plot.h) return
      drawSmall(fb, text, tx, ty, lv.bright, theme, 'center')
    }
    if (maxI >= 0) note(maxI, true)
    if (minI >= 0 && minI !== maxI) note(minI, false)
  }
}

export const LineChart = defineComponent<LineChartProps>('LineChart', { w: 288, h: 144 }, renderLineChart)

export interface SparklineProps {
  values: ReadonlyArray<number | null>
  /** Shaded band (e.g. normal range), drawn as dots. */
  band?: readonly [number, number]
  /** Dot on the last value (default true). */
  lastDot?: boolean
  /** Small ticks at the min and max points. */
  extremes?: boolean
  area?: FillPattern
  min?: number
  max?: number
  level?: number
  stroke?: number
}

export function renderSparkline(fb: Framebuffer, rect: Rect, p: SparklineProps, theme: Theme): void {
  const vals = p.values.filter((v): v is number => v !== null && Number.isFinite(v))
  if (vals.length === 0) return
  const lv = theme.levels
  const dot = p.lastDot !== false ? 3 : 0
  let lo = p.min ?? Math.min(...vals, ...(p.band ?? []))
  let hi = p.max ?? Math.max(...vals, ...(p.band ?? []))
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const stroke = p.stroke ?? theme.stroke
  const n = p.values.length
  const px = linear(0, Math.max(1, n - 1), rect.x + 1, rect.x + rect.w - 2 - dot)
  const py = linear(lo, hi, rect.y + rect.h - 1 - Math.max(dot, stroke), rect.y + Math.max(dot, stroke - 1))
  if (p.band) {
    const y0 = Math.round(py(p.band[1]))
    const y1 = Math.round(py(p.band[0]))
    for (let y = y0; y <= y1; y += 2) for (let x = rect.x + ((y >> 1) & 1); x < rect.x + rect.w; x += 3) fb.set(x, y, lv.faint)
  }
  const segs = runs(p.values, px, py)
  if (p.area) {
    const base = rect.y + rect.h - 1
    for (const seg of segs) if (seg.length > 1) fillPolygon(fb, [...seg, { x: seg[seg.length - 1].x, y: base }, { x: seg[0].x, y: base }], { pattern: p.area, level: lv.dim })
  }
  const level = p.level ?? lv.bright
  for (const seg of segs) polyline(fb, seg, level, { width: stroke })
  const pts = segs.flat()
  if (p.extremes && pts.length > 2) {
    const minP = pts.reduce((a, b) => (b.y > a.y ? b : a))
    const maxP = pts.reduce((a, b) => (b.y < a.y ? b : a))
    fb.fillRect(maxP.x - 1, maxP.y - 3, 3, 2, lv.full)
    fb.fillRect(minP.x - 1, minP.y + 2, 3, 2, lv.full)
  }
  if (dot && pts.length) {
    const last = pts[pts.length - 1]
    drawMarker(fb, 'dot', last.x, last.y, 5, lv.full)
  }
}

export const Sparkline = defineComponent<SparklineProps>('Sparkline', { w: 96, h: 24 }, renderSparkline)
