/** hub-bench tile content (no DOM, so scripts can render it). */
import { defineComponent, drawText, fillRectPaint, font16x24, font8x12, outlineTheme, strokeRect } from 'g2-kit/core'
import { BarChart, type BarChartProps } from 'g2-kit/charts'

export type Content = 'blank' | 'simple' | 'busy' | 'chart' | 'chart-outline'

/** The gallery's bar chart ('bar-vertical'): solid bars, or frames with the outline surface. */
const CHART: BarChartProps = {
  title: 'Steps / day',
  data: [['M', 6200], ['T', 8400], ['W', 4100], ['T', 9900], ['F', 7300], ['S', 12100], ['S', 3000]].map(([label, value]) => ({ label: label as string, value: value as number })),
  highlight: 5,
  peak: true,
  format: 'compact',
}

/** One frame: a counter (big when there is room), and the case's content. */
export const BenchFrame = defineComponent<{ i: number; n: number; name: string; content: Content }>('BenchFrame', { w: 288, h: 144 }, (fb, r, p) => {
  const counter = `${p.i}/${p.n}`
  if (p.content === 'chart' || p.content === 'chart-outline') {
    // The gallery bar chart, filled or outline, with a small counter in the corner so every frame differs.
    BarChart.render(fb, r, CHART, p.content === 'chart-outline' ? outlineTheme : undefined)
    const w = counter.length * font8x12.advance + 6
    fb.fillRect(r.x + r.w - w, r.y, w, font8x12.glyphH + 4, 0)
    drawText(fb, counter, r.x + r.w - 3, r.y + 2, { font: font8x12, level: 15, align: 'right' })
    return
  }
  if (p.content === 'busy') fillRectPaint(fb, r.x, r.y, r.w, r.h, { pattern: 'crossHatch', level: 4 })
  if (p.content === 'blank') {
    drawText(fb, counter, r.x + 3, r.y + 3, { font: font8x12, level: 15 })
    return
  }
  const scale = counter.length * font16x24.advance * 2 <= r.w - 16 && r.h >= 100 ? 2 : 1
  const big = counter.length * font16x24.advance * scale <= r.w - 8 && r.h >= 40
  const font = big ? font16x24 : font8x12
  const th = font.glyphH * (big ? scale : 1)
  const tw = counter.length * font.advance * (big ? scale : 1)
  // Clear behind the counter (and the case name below it) so both read on the dense pattern.
  fb.fillRect(r.x + (r.w - tw) / 2 - 6, r.y + 6, tw + 12, r.h >= 100 ? 82 : th + 8, 0)
  strokeRect(fb, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 15, 2)
  drawText(fb, counter, r.x + r.w / 2, r.y + 10, { font, scale: big ? scale : 1, level: 15, align: 'center' })
  if (r.h >= 100) drawText(fb, p.name, r.x + r.w / 2, r.y + 72, { font: font8x12, level: 8, align: 'center' })
  const bar = { x: r.x + 8, y: r.y + r.h - Math.min(22, r.h / 4), w: r.w - 16, h: Math.min(14, r.h / 6) }
  fb.fillRect(bar.x, bar.y, bar.w, bar.h, 0)
  strokeRect(fb, bar.x, bar.y, bar.w, bar.h, 6, 1)
  fb.fillRect(bar.x + 2, bar.y + 2, Math.round(((bar.w - 4) * p.i) / p.n), bar.h - 4, 15)
})
