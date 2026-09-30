/** Shared chart plumbing: scales, number formats, titles, states, axes. */
import type { Framebuffer } from '../core/framebuffer.js'
import { cut, inset, type Insets, type Rect } from '../core/geometry.js'
import { drawText, drawTextBox, ellipsize, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'

export type LabelDensity = 'none' | 'sparse' | 'normal'

export type NumberFormat =
  | 'auto'
  | 'compact' // 1.2k, 3.4M
  | 'percent' // 0.42 → 42%
  | 'integer'
  | { decimals?: number; compact?: boolean; percent?: boolean; prefix?: string; suffix?: string }
  | ((v: number) => string)

export type ChartState = 'ready' | 'empty' | 'loading' | 'error'

/** Options every chart accepts. */
export interface ChartCommon {
  title?: string
  /** Space around the plot (default theme.padding). */
  margin?: Insets
  /** Draw the baseline/axis ticks (default true). */
  axis?: boolean
  /** How many labels to draw (default 'sparse'). */
  labels?: LabelDensity
  format?: NumberFormat
  /** Non-ready states replace the chart with a message. */
  state?: ChartState
  message?: string
}

/** Human-friendly number formatting. Monospaced digits keep updates steady. */
export function formatNumber(v: number, fmt: NumberFormat = 'auto'): string {
  if (!Number.isFinite(v)) return '-'
  if (typeof fmt === 'function') return fmt(v)
  if (fmt === 'percent') return `${round(v * 100, Math.abs(v) < 0.1 ? 1 : 0)}%`
  if (fmt === 'integer') return String(Math.round(v))
  if (fmt === 'compact') return compact(v, 1)
  if (fmt === 'auto') {
    if (Math.abs(v) >= 10000) return compact(v, 1)
    return String(round(v, Math.abs(v) < 100 && !Number.isInteger(v) ? 1 : 0))
  }
  const d = fmt.decimals
  let s: string
  if (fmt.percent) s = `${d === undefined ? round(v * 100, 0) : (v * 100).toFixed(d)}%`
  else if (fmt.compact) s = compact(v, d ?? 1)
  else s = d === undefined ? String(v) : v.toFixed(d)
  return `${fmt.prefix ?? ''}${s}${fmt.suffix ?? ''}`
}

function round(v: number, d: number): number {
  const f = 10 ** d
  return Math.round(v * f) / f
}

function compact(v: number, d: number): string {
  const a = Math.abs(v)
  const units: Array<[number, string]> = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ]
  for (const [n, u] of units) if (a >= n) return `${round(v / n, a / n >= 100 ? 0 : d)}${u}`
  return String(round(v, a < 10 && !Number.isInteger(v) ? d : 0))
}

export interface NiceScale {
  min: number
  max: number
  step: number
  ticks: number[]
}

/** "Nice" axis bounds and ticks (1/2/5 × 10^n steps) covering [lo, hi]. */
export function niceScale(lo: number, hi: number, maxTicks = 5): NiceScale {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, step: 1, ticks: [0, 1] }
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1
    lo -= pad
    hi += pad
  }
  const step = niceNum((hi - lo) / Math.max(1, maxTicks - 1), true)
  const min = Math.floor(lo / step) * step
  const max = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = min; v <= max + step / 2; v += step) ticks.push(round(v, 10))
  return { min, max, step, ticks }
}

function niceNum(x: number, roundIt: boolean): number {
  const exp = Math.floor(Math.log10(x))
  const f = x / 10 ** exp
  let nf: number
  if (roundIt) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10
  else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nf * 10 ** exp
}

/** Linear map from a domain to a pixel range. */
export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0)
  return (v) => r0 + (v - d0) * k
}

/** Small-label font height (theme small font × smallScale). */
export function smallH(theme: Theme): number {
  return theme.fonts.small.glyphH * theme.smallScale
}

export function drawSmall(fb: Framebuffer, text: string, x: number, y: number, level: number, theme: Theme, align: 'left' | 'center' | 'right' = 'left'): number {
  return drawText(fb, text, x, y, { font: theme.fonts.small, scale: theme.smallScale, level, align })
}

export function smallW(text: string, theme: Theme): number {
  return textWidth(text, theme.fonts.small, theme.smallScale)
}

/**
 * Title strip + margins. Returns the remaining plot rect. Titles use the body
 * font when there is room, else the small font.
 */
export function chartFrame(fb: Framebuffer, rect: Rect, common: ChartCommon, theme: Theme): Rect {
  let r = inset(rect, common.margin ?? theme.padding)
  if (common.title) {
    const useBody = r.h >= 80
    const font = useBody ? theme.fonts.body : theme.fonts.small
    const scale = useBody ? 1 : theme.smallScale
    const h = font.glyphH * scale
    const [strip, rest] = cut(r, 'top', h + 4)
    drawText(fb, ellipsize(common.title, strip.w, font, scale), strip.x, strip.y, { font, scale, level: theme.levels.full })
    r = rest
  }
  return r
}

/** Draw the empty/loading/error state. Returns true if it drew one (skip the chart). */
export function drawState(fb: Framebuffer, rect: Rect, common: ChartCommon, theme: Theme): boolean {
  const state = common.state ?? 'ready'
  if (state === 'ready') return false
  const text = common.message ?? (state === 'empty' ? 'No data' : state === 'loading' ? 'Loading…' : 'Error')
  const lv = theme.levels
  const r = inset(rect, 4)
  if (state === 'error') {
    // Dashed frame + "!" badge: reads as a problem without relying on brightness.
    for (let x = r.x; x < r.x + r.w; x += 6) {
      fb.fillRect(x, r.y, 3, 2, lv.mid)
      fb.fillRect(x, r.y + r.h - 2, 3, 2, lv.mid)
    }
  }
  if (state === 'loading') {
    // Three dots, static (animation costs a send per frame).
    const cx = r.x + r.w / 2
    for (let i = -1; i <= 1; i++) fb.fillRect(Math.round(cx + i * 10 - 2), r.y + Math.round(r.h / 2) + 10, 4, 4, lv.mid)
  }
  drawTextBox(fb, r, text, { font: theme.fonts.body, level: state === 'empty' ? lv.mid : lv.bright, align: 'center', valign: 'middle', wrap: true })
  return true
}

/** Show a label at index i under the given density (sparse: first, last, and highlighted). */
export function showLabel(i: number, n: number, density: LabelDensity, highlight?: number): boolean {
  if (density === 'none') return false
  if (density === 'normal') return true
  return i === 0 || i === n - 1 || i === highlight
}

/** Pick every k-th label so that labels of width `w` fit into `space` px each. */
export function labelStride(n: number, space: number, w: number): number {
  if (space <= 0) return n
  return Math.max(1, Math.ceil((w + 4) / space))
}
