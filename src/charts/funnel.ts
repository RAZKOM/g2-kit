/** Funnel, bullet chart and step/event timeline. */
import { defineComponent } from '../core/component.js'
import { fillRectPaint, fillTriangle, strokeRect } from '../core/draw.js'
import { drawMarker, type MarkerShape } from '../core/encodings.js'
import type { Framebuffer } from '../core/framebuffer.js'
import { cut, type Rect } from '../core/geometry.js'
import { drawText, ellipsize, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { chartFrame, drawSmall, drawState, formatNumber, linear, smallH, smallW, type ChartCommon, type NumberFormat } from './common.js'

export interface FunnelProps extends ChartCommon {
  stages: ReadonlyArray<{ label: string; value: number }>
  /** Show step conversion % between stages (default true). */
  conversion?: boolean
}

/** Horizontal funnel: centred bars with widths ∝ value; conversion % at the right. */
export function renderFunnel(fb: Framebuffer, rect: Rect, p: FunnelProps, theme: Theme): void {
  const plot = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot, p, theme)) return
  const st = p.stages
  if (!st.length) return void drawState(fb, plot, { ...p, state: 'empty' }, theme)
  const lv = theme.levels
  const sh = smallH(theme)
  const max = Math.max(...st.map((s) => s.value), 1)
  const convW = p.conversion !== false ? smallW('100%', theme) + 8 : 0
  const labelW = Math.min(Math.round(plot.w * 0.32), Math.max(...st.map((s) => smallW(s.label, theme))) + 6)
  const barArea: Rect = { x: plot.x + labelW, y: plot.y, w: plot.w - labelW - convW, h: plot.h }
  const rowH = barArea.h / st.length
  const bh = Math.max(4, Math.round(rowH * 0.7))
  st.forEach((s, i) => {
    const cy = barArea.y + rowH * i + rowH / 2
    const w = Math.max(2, Math.round((s.value / max) * barArea.w))
    const x = Math.round(barArea.x + (barArea.w - w) / 2)
    const y = Math.round(cy - bh / 2)
    fb.fillRect(x, y, w, bh, i === 0 ? lv.full : i % 2 ? lv.bright : lv.mid)
    const vt = formatNumber(s.value, p.format)
    if (smallW(vt, theme) + 6 < w) drawSmall(fb, vt, x + w / 2, Math.round(cy - sh / 2), 0, theme, 'center')
    else drawSmall(fb, vt, x + w + 3, Math.round(cy - sh / 2), lv.bright, theme)
    drawSmall(fb, ellipsize(s.label, labelW - 6, theme.fonts.small, theme.smallScale), plot.x + labelW - 6, Math.round(cy - sh / 2), lv.bright, theme, 'right')
    if (p.conversion !== false && i > 0) {
      const prev = st[i - 1].value
      const pc = prev > 0 ? `${Math.round((s.value / prev) * 100)}%` : '-'
      drawSmall(fb, pc, plot.x + plot.w, Math.round(cy - rowH / 2 - sh / 2), lv.mid, theme, 'right')
      // Small down-arrow between stages.
      const ax = plot.x + plot.w - convW / 2 - 8
      fillTriangle(fb, { x: ax - 3, y: cy - rowH / 2 + 3 }, { x: ax + 3, y: cy - rowH / 2 + 3 }, { x: ax, y: cy - rowH / 2 + 7 }, lv.dim)
    }
  })
}

export const Funnel = defineComponent<FunnelProps>('Funnel', { w: 288, h: 144 }, renderFunnel)

export interface BulletChartProps {
  label?: string
  value: number
  target?: number
  /** Qualitative band upper bounds, ascending (e.g. [poor, ok, good]); last is the max. */
  ranges?: readonly number[]
  max?: number
  format?: NumberFormat
  /** Show the value text at the right (default true). */
  showValue?: boolean
}

/**
 * Bullet chart: value bar over qualitative bands, with a target line. Bands
 * use patterns (sparse dots → dots → checker), so they read without colour.
 */
export function renderBulletChart(fb: Framebuffer, rect: Rect, p: BulletChartProps, theme: Theme): void {
  const lv = theme.levels
  let r = rect
  if (p.label) {
    const f = theme.fonts.body
    const lw = Math.min(Math.round(r.w * 0.3), textWidth(p.label, f) + 8)
    const [strip, rest] = cut(r, 'left', lw)
    drawText(fb, ellipsize(p.label, strip.w - 6, f), strip.x, Math.round(strip.y + (strip.h - f.ascent) / 2), { font: f, level: lv.bright })
    r = rest
  }
  const vt = formatNumber(p.value, p.format)
  if (p.showValue !== false) {
    const vw = textWidth(vt, theme.fonts.body) + 8
    const [strip, rest] = cut(r, 'right', vw)
    drawText(fb, vt, strip.x + strip.w, Math.round(strip.y + (strip.h - theme.fonts.body.ascent) / 2), { font: theme.fonts.body, level: lv.full, align: 'right' })
    r = rest
  }
  const ranges = p.ranges ?? []
  const max = p.max ?? Math.max(p.value, p.target ?? 0, ...ranges) * (ranges.length ? 1 : 1.1)
  const x = linear(0, max || 1, r.x, r.x + r.w - 1)
  const bandH = Math.min(r.h - 4, 22)
  const by = Math.round(r.y + (r.h - bandH) / 2)
  const pats = ['sparseDots', 'dots', 'checker'] as const
  let prev = 0
  ranges.forEach((hi, i) => {
    const x0 = Math.round(x(prev))
    const x1 = Math.round(x(Math.min(hi, max)))
    fillRectPaint(fb, x0, by, x1 - x0, bandH, { pattern: pats[Math.min(i, pats.length - 1)], level: lv.dim })
    if (i > 0) fb.fillRect(x0, by, 1, bandH, lv.dim)
    prev = hi
  })
  if (!ranges.length) strokeRect(fb, r.x, by, r.w, bandH, lv.dim, 1)
  const vh = Math.max(4, Math.round(bandH / 3))
  fb.fillRect(r.x, Math.round(by + (bandH - vh) / 2), Math.max(1, Math.round(x(Math.min(p.value, max)) - r.x)), vh, lv.full)
  if (p.target !== undefined) {
    const tx = Math.round(x(Math.min(p.target, max)))
    fb.fillRect(tx - 1, by - 3, 3, bandH + 6, lv.full)
  }
}

export const BulletChart = defineComponent<BulletChartProps>('BulletChart', { w: 288, h: 36 }, renderBulletChart)

export interface TimelineEvent {
  at: number
  /** End time for a span; omit for a point event. */
  end?: number
  label?: string
  /** Lane (row) index for spans/points (default 0). */
  lane?: number
  marker?: MarkerShape
}

export interface TimelineProps extends ChartCommon {
  events: readonly TimelineEvent[]
  start: number
  end: number
  /** Current time marker. */
  now?: number
  /** Tick labels (e.g. [[t, '9:00'], …]); default: start and end formatted. */
  ticks?: ReadonlyArray<readonly [number, string]>
  lanes?: number
  /** Show event labels (default when ≤ 6 events). */
  eventLabels?: boolean
}

/** Points or spans on a time axis, optionally in lanes, with a "now" marker. */
export function renderTimeline(fb: Framebuffer, rect: Rect, p: TimelineProps, theme: Theme): void {
  const plot = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot, p, theme)) return
  const lv = theme.levels
  const sh = smallH(theme)
  const lanes = p.lanes ?? Math.max(1, ...p.events.map((e) => (e.lane ?? 0) + 1))
  const axisY = plot.y + plot.h - sh - 6
  const x = linear(p.start, p.end, plot.x + 4, plot.x + plot.w - 5)
  const laneH = (axisY - plot.y - 4) / lanes
  const showLabels = p.eventLabels ?? p.events.length <= 6
  if (p.axis !== false) fb.fillRect(plot.x, axisY, plot.w, 2, lv.dim)
  const ticks = p.ticks ?? [
    [p.start, formatNumber(p.start, p.format)],
    [p.end, formatNumber(p.end, p.format)],
  ]
  ticks.forEach(([t, label], i) => {
    const tx = Math.round(x(t))
    fb.fillRect(tx, axisY - 2, 1, 6, lv.dim)
    const align = i === 0 ? 'left' : i === ticks.length - 1 ? 'right' : 'center'
    drawSmall(fb, label, align === 'left' ? tx - 2 : align === 'right' ? tx + 2 : tx, axisY + 5, lv.mid, theme, align)
  })
  for (const e of p.events) {
    const lane = e.lane ?? 0
    const cy = Math.round(plot.y + 2 + laneH * lane + laneH / 2)
    const x0 = Math.round(x(e.at))
    if (e.end !== undefined) {
      const x1 = Math.round(x(e.end))
      const h = Math.max(4, Math.min(14, Math.round(laneH * 0.55)))
      fb.fillRect(x0, cy - Math.floor(h / 2), Math.max(2, x1 - x0), h, lv.bright)
      if (showLabels && e.label) {
        const w = smallW(e.label, theme)
        if (w + 4 < x1 - x0) drawSmall(fb, e.label, x0 + 3, cy - Math.floor(sh / 2), 0, theme)
        else drawSmall(fb, e.label, x0, cy - Math.floor(h / 2) - sh - 2, lv.bright, theme)
      }
    } else {
      fb.fillRect(x0, cy, 1, axisY - cy, lv.faint)
      drawMarker(fb, e.marker ?? 'diamond', x0, cy, 9, lv.full)
      if (showLabels && e.label) drawSmall(fb, e.label, x0 + 7, cy - Math.floor(sh / 2), lv.bright, theme)
    }
  }
  if (p.now !== undefined && p.now >= p.start && p.now <= p.end) {
    const nx = Math.round(x(p.now))
    for (let y = plot.y; y < axisY; y += 4) fb.fillRect(nx, y, 2, 2, lv.full)
    fillTriangle(fb, { x: nx - 4, y: axisY + 1 }, { x: nx + 5, y: axisY + 1 }, { x: nx + 0.5, y: axisY - 5 }, lv.full)
  }
}

export const Timeline = defineComponent<TimelineProps>('Timeline', { w: 288, h: 96 }, renderTimeline)
