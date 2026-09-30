/**
 * Heatmap (rows × cols, e.g. 7 days × 24 hours) and calendar heatmap (GitHub
 * style, weeks × weekdays). Values map to a few distinct levels; optionally a
 * centred square whose size also grows with the value, so the reading does
 * not depend on brightness alone.
 */
import { defineComponent } from '../core/component.js'
import { strokeRect } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Rect } from '../core/geometry.js'
import type { Theme } from '../core/theme.js'
import { chartFrame, drawSmall, drawState, smallH, smallW, type ChartCommon } from './common.js'

export interface HeatmapProps extends ChartCommon {
  /** values[row][col]; null = no data (drawn as a faint dot). */
  values: ReadonlyArray<ReadonlyArray<number | null>>
  rowLabels?: readonly string[]
  colLabels?: readonly string[]
  min?: number
  max?: number
  /** Distinct steps (default 4). */
  steps?: number
  /** 'level' (default): brightness only; 'size': square size only; 'both'. */
  encoding?: 'level' | 'size' | 'both'
  gap?: number
  /** Outline one cell (e.g. "now"). */
  highlight?: readonly [number, number]
}

/** Map a value to a step index 0..steps-1 (−1 for no data). */
export function heatStep(v: number | null, min: number, max: number, steps: number): number {
  if (v === null || !Number.isFinite(v)) return -1
  if (max <= min) return v > min ? steps - 1 : 0
  return Math.max(0, Math.min(steps - 1, Math.floor(((v - min) / (max - min)) * steps - 1e-9)))
}

function stepLevel(step: number, steps: number, theme: Theme): number {
  const lo = theme.levels.faint
  const hi = theme.levels.full
  return Math.round(lo + ((hi - lo) * step) / Math.max(1, steps - 1))
}

function drawCell(fb: Framebuffer, x: number, y: number, w: number, h: number, step: number, steps: number, enc: HeatmapProps['encoding'], theme: Theme): void {
  if (step < 0) {
    fb.fillRect(Math.round(x + w / 2) - 1, Math.round(y + h / 2) - 1, 2, 2, theme.levels.faint)
    return
  }
  const level = enc === 'size' ? theme.levels.bright : stepLevel(step, steps, theme)
  if (enc === 'size' || enc === 'both') {
    const k = (step + 1) / steps
    const sw = Math.max(2, Math.round(w * (0.3 + 0.7 * k)))
    const sh = Math.max(2, Math.round(h * (0.3 + 0.7 * k)))
    fb.fillRect(Math.round(x + (w - sw) / 2), Math.round(y + (h - sh) / 2), sw, sh, level)
  } else fb.fillRect(x, y, w, h, level)
}

export function renderHeatmap(fb: Framebuffer, rect: Rect, p: HeatmapProps, theme: Theme): void {
  const plot = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot, p, theme)) return
  const rows = p.values.length
  const cols = Math.max(0, ...p.values.map((r) => r.length))
  if (!rows || !cols) return void drawState(fb, plot, { ...p, state: 'empty' }, theme)
  const lv = theme.levels
  const flat = p.values.flat().filter((v): v is number => v !== null && Number.isFinite(v))
  const min = p.min ?? Math.min(...flat)
  const max = p.max ?? Math.max(...flat)
  const steps = p.steps ?? 4
  const sh = smallH(theme)
  const labelW = p.rowLabels ? Math.max(...p.rowLabels.map((l) => smallW(l, theme))) + 4 : 0
  const labelH = p.colLabels ? sh + 3 : 0
  const gap = p.gap ?? 1
  const gw = plot.w - labelW
  const gh = plot.h - labelH
  const cw = Math.max(2, Math.floor((gw + gap) / cols) - gap)
  const ch = Math.max(2, Math.floor((gh + gap) / rows) - gap)
  const x0 = plot.x + labelW
  const y0 = plot.y
  for (let r = 0; r < rows; r++) {
    if (p.rowLabels?.[r] && (p.labels !== 'none')) drawSmall(fb, p.rowLabels[r], x0 - 4, y0 + r * (ch + gap) + Math.round((ch - sh) / 2), lv.mid, theme, 'right')
    for (let c = 0; c < cols; c++) {
      const v = p.values[r][c] ?? null
      drawCell(fb, x0 + c * (cw + gap), y0 + r * (ch + gap), cw, ch, heatStep(v, min, max, steps), steps, p.encoding ?? 'level', theme)
    }
  }
  if (p.colLabels && p.labels !== 'none') {
    const every = Math.max(1, Math.ceil((Math.max(...p.colLabels.map((l) => smallW(l, theme))) + 4) / (cw + gap)))
    p.colLabels.forEach((l, c) => {
      if (!l || (p.labels !== 'normal' && c % every !== 0)) return
      drawSmall(fb, l, x0 + c * (cw + gap) + cw / 2, y0 + rows * (ch + gap) + 2, lv.mid, theme, 'center')
    })
  }
  if (p.highlight) {
    const [r, c] = p.highlight
    strokeRect(fb, x0 + c * (cw + gap) - 2, y0 + r * (ch + gap) - 2, cw + 4, ch + 4, lv.full, 1)
  }
}

export const Heatmap = defineComponent<HeatmapProps>('Heatmap', { w: 288, h: 144 }, renderHeatmap)

export interface CalendarHeatmapProps extends ChartCommon {
  /** Daily values, oldest first, ending on `end` (default today). */
  days: ReadonlyArray<number | null>
  /** Last day (default: today). Used to align weekdays. */
  end?: Date
  /** First day of the week: 0 = Sunday, 1 = Monday (default). */
  weekStart?: 0 | 1
  steps?: number
  encoding?: 'level' | 'size' | 'both'
  /** Show M/W/F row labels (default true). */
  dayLabels?: boolean
}

export function renderCalendarHeatmap(fb: Framebuffer, rect: Rect, p: CalendarHeatmapProps, theme: Theme): void {
  const plot = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot, p, theme)) return
  if (!p.days.length) return void drawState(fb, plot, { ...p, state: 'empty' }, theme)
  const lv = theme.levels
  const end = p.end ?? new Date()
  const ws = p.weekStart ?? 1
  const endDow = (end.getDay() - ws + 7) % 7
  const n = p.days.length
  const startDow = (((endDow - (n - 1)) % 7) + 7) % 7
  const weeks = Math.ceil((startDow + n) / 7)
  const flat = p.days.filter((v): v is number => v !== null && Number.isFinite(v))
  const min = Math.min(0, ...flat)
  const max = Math.max(...flat, 1)
  const steps = p.steps ?? 4
  const sh = smallH(theme)
  const labelW = p.dayLabels !== false ? smallW('W', theme) + 4 : 0
  const gap = 2
  const cell = Math.max(3, Math.min(Math.floor((plot.w - labelW + gap) / weeks) - gap, Math.floor((plot.h + gap) / 7) - gap))
  const gridW = weeks * (cell + gap) - gap
  const x0 = plot.x + labelW + Math.max(0, Math.floor((plot.w - labelW - gridW) / 2))
  const y0 = plot.y + Math.max(0, Math.floor((plot.h - (7 * (cell + gap) - gap)) / 2))
  if (p.dayLabels !== false) {
    const names = ws === 1 ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    for (const d of [0, 2, 4]) drawSmall(fb, names[d], x0 - 4, y0 + d * (cell + gap) + Math.round((cell - sh) / 2), lv.dim, theme, 'right')
  }
  for (let i = 0; i < n; i++) {
    const slot = startDow + i
    const wk = Math.floor(slot / 7)
    const dow = slot % 7
    const x = x0 + wk * (cell + gap)
    const y = y0 + dow * (cell + gap)
    const v = p.days[i]
    const st = heatStep(v, min, max, steps)
    if (v === null || v === 0) strokeRect(fb, x, y, cell, cell, lv.faint, 1)
    else drawCell(fb, x, y, cell, cell, st, steps, p.encoding ?? 'level', theme)
  }
  // Today: outline.
  const lastSlot = startDow + n - 1
  strokeRect(fb, x0 + Math.floor(lastSlot / 7) * (cell + gap) - 2, y0 + (lastSlot % 7) * (cell + gap) - 2, cell + 4, cell + 4, lv.full, 1)
}

export const CalendarHeatmap = defineComponent<CalendarHeatmapProps>('CalendarHeatmap', { w: 288, h: 144 }, renderCalendarHeatmap)
