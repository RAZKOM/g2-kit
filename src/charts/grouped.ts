/**
 * Grouped and stacked bars. Series are told apart by fill pattern (solid,
 * hatch, dots, …), not by brightness alone.
 */
import { drawBlock, isOutline } from '../core/block.js'
import { defineComponent } from '../core/component.js'
import { fillRectPaint, strokeRect } from '../core/draw.js'
import { seriesStyle, warnSeries } from '../core/encodings.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Rect } from '../core/geometry.js'
import { isSolid, type FillPattern, type Paint } from '../core/paint.js'
import type { Theme } from '../core/theme.js'
import { chartFrame, drawSmall, drawState, formatNumber, linear, showLabel, smallH, smallW, type ChartCommon } from './common.js'

export interface MultiBarSeries {
  name?: string
  values: readonly number[]
  fill?: FillPattern
}

export interface MultiBarChartProps extends ChartCommon {
  series: readonly MultiBarSeries[]
  categories?: readonly string[]
  /** 'grouped' (side by side, default) or 'stacked'. */
  mode?: 'grouped' | 'stacked'
  /** Totals above stacks / values above grouped bars. */
  valueLabels?: boolean
  highlight?: number
  max?: number
}

/** Series paint: solid for series 0, patterns after. Each bar also gets a 1 px outline so patterns have edges. */
export function seriesPaint(i: number, theme: Theme, fill?: FillPattern, dim = false): Paint {
  const pattern = fill ?? seriesStyle(i).fill
  const level = dim ? theme.levels.mid : i === 0 ? theme.levels.bright : theme.levels.full
  return pattern === 'solid' ? level : { pattern, level }
}

/** Under `surface: 'outline'` a solid paint becomes sparse dots (stacked segments keep their 1 px frame). */
function surfacePaint(paint: Paint, theme: Theme): Paint {
  return isOutline(theme) && isSolid(paint) ? { pattern: 'sparseDots', level: paint } : paint
}

export function renderMultiBarChart(fb: Framebuffer, rect: Rect, p: MultiBarChartProps, theme: Theme): void {
  const plot0 = chartFrame(fb, rect, p, theme)
  if (drawState(fb, plot0, p, theme)) return
  const S = p.series
  const n = Math.max(0, ...S.map((s) => s.values.length))
  if (!S.length || !n) return void drawState(fb, plot0, { ...p, state: 'empty' }, theme)
  warnSeries('MultiBar', S.length)
  const lv = theme.levels
  const sh = smallH(theme)
  const stacked = p.mode === 'stacked'
  const totals = Array.from({ length: n }, (_, i) => S.reduce((a, s) => a + Math.max(0, s.values[i] ?? 0), 0))
  const maxV = p.max ?? (stacked ? Math.max(...totals) : Math.max(...S.flatMap((s) => s.values)))
  const cats = p.categories
  const catDensity = !cats ? 'none' : (p.labels ?? (n <= 8 ? 'normal' : 'sparse'))
  const showValues = p.valueLabels ?? (stacked ? n <= 10 : n * S.length <= 12)
  const top = plot0.y + (showValues ? sh + 3 : 0)
  const bottom = plot0.y + plot0.h - (catDensity !== 'none' ? sh + 4 : 0)
  const y = linear(0, maxV || 1, bottom, top)
  const slot = plot0.w / n
  const groupW = Math.max(3, Math.round(slot * 0.78))
  if (p.axis !== false) fb.fillRect(plot0.x, bottom, plot0.w, 2, lv.dim)

  for (let i = 0; i < n; i++) {
    const cx = plot0.x + slot * i + slot / 2
    const x0 = Math.round(cx - groupW / 2)
    const dim = p.highlight !== undefined && p.highlight !== i
    if (stacked) {
      let base = bottom
      S.forEach((s, si) => {
        const v = Math.max(0, s.values[i] ?? 0)
        const h = Math.round(bottom - y(v))
        if (h <= 0) return
        fillRectPaint(fb, x0, base - h, groupW, h, surfacePaint(seriesPaint(si, theme, s.fill, dim), theme))
        strokeRect(fb, x0, base - h, groupW, h, dim ? lv.mid : lv.full, 1)
        // 1 px gap between segments so the stack reads as parts.
        fb.fillRect(x0, base - h, groupW, 1, 0)
        base -= h
      })
      const t = formatNumber(totals[i], p.format)
      if (showValues && smallW(t, theme) <= slot + 2) drawSmall(fb, t, cx, base - sh - 3, dim ? lv.mid : lv.full, theme, 'center')
    } else {
      const bw = Math.max(2, Math.floor((groupW - (S.length - 1) * 2) / S.length))
      S.forEach((s, si) => {
        const v = s.values[i] ?? 0
        const h = Math.max(v > 0 ? 2 : 0, Math.round(bottom - y(v)))
        const bx = x0 + si * (bw + 2)
        if (h > 0) {
          const paint = seriesPaint(si, theme, s.fill, dim)
          if (isSolid(paint)) drawBlock(fb, bx, bottom - h, bw, h, paint, theme, { texture: 'sparseDots' })
          else fillRectPaint(fb, bx, bottom - h, bw, h, paint)
          if (si > 0) strokeRect(fb, bx, bottom - h, bw, h, dim ? lv.mid : lv.full, 1)
        }
        const t = formatNumber(v, p.format)
        if (showValues && smallW(t, theme) <= bw + 6) drawSmall(fb, t, bx + bw / 2, bottom - h - sh - 3, dim ? lv.mid : lv.bright, theme, 'center')
      })
    }
    if (cats && showLabel(i, n, catDensity, p.highlight) && cats[i]) drawSmall(fb, cats[i], cx, bottom + 4, dim ? lv.mid : lv.bright, theme, 'center')
  }
}

export const MultiBarChart = defineComponent<MultiBarChartProps>('MultiBarChart', { w: 288, h: 144 }, renderMultiBarChart)
