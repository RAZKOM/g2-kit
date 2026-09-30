import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Framebuffer, TILE, createTheme, encodePreviewPng } from '../src/core/index.js'
import { formatNumber, heatStep, niceScale } from '../src/charts/index.js'
import { GridKeyboardState, dateColumns, daysInMonth, marqueeFrames, timeColumns } from '../src/widgets/index.js'
import { ICON_NAMES, drawIcon } from '../src/icons/index.js'
import { SAMPLES } from '../examples/gallery/samples.js'

describe('every gallery sample: smoke + PNG snapshot', () => {
  for (const s of SAMPLES) {
    const size = s.size ?? s.component.size ?? TILE
    it(`${s.id} (${s.component.name}, ${s.priority})`, () => {
      const fb = s.component.renderToTile(s.props, size)
      expect(fb.width).toBe(size.w)
      expect(fb.data.some((v) => v > 0)).toBe(true)
      // Deterministic.
      expect(s.component.renderToTile(s.props, size).equals(fb)).toBe(true)
      // Never draws outside its rect: render offset inside a bigger canvas.
      // Offset 60 = LCM of the fill-pattern periods (patterns are anchored to absolute pixels).
      const o = 60
      const big = new Framebuffer(size.w + 2 * o, size.h + 2 * o)
      s.component.render(big, { x: o, y: o, w: size.w, h: size.h }, s.props)
      for (let y = 0; y < big.height; y++)
        for (let x = 0; x < big.width; x++) {
          const inside = x >= o && y >= o && x < o + size.w && y < o + size.h
          if (!inside && big.get(x, y) !== 0) throw new Error(`${s.id} drew outside its rect at (${x}, ${y})`)
        }
      // Same picture at an offset (a few pixels may differ from float rounding of angles).
      const moved = big.crop({ x: o, y: o, w: size.w, h: size.h })
      let diff = 0
      for (let i = 0; i < fb.data.length; i++) if (moved.data[i] !== fb.data[i]) diff++
      expect(diff).toBeLessThanOrEqual(Math.max(4, fb.data.length * 0.002))
      // Golden PNG (hash of the preview PNG bytes).
      expect(createHash('sha256').update(encodePreviewPng(fb)).digest('hex').slice(0, 16)).toMatchSnapshot()
    })
  }

  it('covers every P0 and P1 component in the catalogue', () => {
    const names = new Set(SAMPLES.map((s) => s.component.name))
    const required = [
      // charts P0/P1
      'BarChart', 'LineChart', 'Sparkline', 'Kpi', 'Gauge', 'MultiBarChart', 'PieChart', 'ProgressRings', 'Heatmap', 'CalendarHeatmap', 'Funnel', 'BulletChart', 'Timeline', 'Legend',
      // controls
      'Carousel', 'Button', 'ButtonRow', 'Toggle', 'SegmentedControl', 'Slider', 'Roller', 'Checklist', 'StatusKeyboard', 'GridKeyboard', 'TimePicker', 'DatePicker',
      // text & chrome
      'ProgressBar', 'BigText', 'Toast', 'Modal', 'Tabs', 'PaginationDots', 'ScrollIndicator', 'StatusBar', 'HudFrame', 'Ticker',
      // faces & game
      'AnalogClock', 'TimerRing', 'CompassStrip', 'TurnArrow', 'GridBoard', 'ScoreHud',
    ]
    const missing = required.filter((n) => !names.has(n))
    expect(missing).toEqual([])
  })

  it('components respect a retuned theme', () => {
    const dim = createTheme({ levels: { full: 9, bright: 8, mid: 6, dim: 4, faint: 2 } })
    const s = SAMPLES.find((x) => x.id === 'bar-vertical')!
    const fb = s.component.renderToTile(s.props, undefined, dim)
    expect(Math.max(...fb.data)).toBeLessThanOrEqual(9)
  })
})

describe('icons', () => {
  it('every icon draws something at 8, 12 and 16 px inside its box', () => {
    for (const name of ICON_NAMES)
      for (const size of [8, 12, 16]) {
        const fb = new Framebuffer(size + 8, size + 8)
        fb.withClip({ x: 0, y: 0, w: fb.width, h: fb.height }, () => drawIcon(fb, name, 4, 4, size, 15))
        expect(fb.data.some((v) => v > 0), `${name}@${size}`).toBe(true)
        const outside = fb.diffBounds(new Framebuffer(fb.width, fb.height))!
        expect(outside.x >= 2 && outside.y >= 2 && outside.x + outside.w <= size + 6 && outside.y + outside.h <= size + 6, `${name}@${size} bounds`).toBe(true)
      }
  })
})

describe('chart helpers', () => {
  it('niceScale covers the data with 1/2/5 steps', () => {
    expect(niceScale(10, 34, 5)).toMatchObject({ min: 10, max: 35, step: 5 })
    expect(niceScale(0, 100, 5)).toMatchObject({ min: 0, max: 100, step: 20 })
    const s = niceScale(5, 5)
    expect(s.min).toBeLessThan(5)
    expect(s.max).toBeGreaterThan(5)
  })

  it('formatNumber', () => {
    expect(formatNumber(12840, 'compact')).toBe('12.8k')
    expect(formatNumber(2_500_000, 'compact')).toBe('2.5M')
    expect(formatNumber(0.042, 'percent')).toBe('4.2%')
    expect(formatNumber(0.42, 'percent')).toBe('42%')
    expect(formatNumber(21.5)).toBe('21.5')
    expect(formatNumber(182)).toBe('182')
    expect(formatNumber(3.14159, { decimals: 2, suffix: ' rad' })).toBe('3.14 rad')
    expect(formatNumber(NaN)).toBe('-')
  })

  it('heatStep buckets values', () => {
    expect(heatStep(null, 0, 10, 4)).toBe(-1)
    expect(heatStep(0, 0, 10, 4)).toBe(0)
    expect(heatStep(10, 0, 10, 4)).toBe(3)
    expect(heatStep(5, 0, 10, 4)).toBe(1)
  })
})

describe('widget helpers', () => {
  it('GridKeyboardState: rows then keys', () => {
    const k = new GridKeyboardState()
    k.move(1)
    expect(k.tap()).toBeNull()
    k.move(1)
    expect(k.tap()).toBe('I')
    expect(k.back()).toBe(true)
    expect(k.back()).toBe(false)
    k.move(-1)
    k.move(-1)
    expect(k.row).toBe(4)
  })

  it('time and date columns', () => {
    expect(timeColumns({ hours: 13, minutes: 5, twelveHour: true }).map((c) => c.values[c.index])).toEqual(['01', '05', 'PM'])
    expect(timeColumns({ hours: 7, minutes: 30, minuteStep: 15 })[1].values).toEqual(['00', '15', '30', '45'])
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(dateColumns({ year: 2026, month: 2, day: 28 })[0].values).toHaveLength(28)
    expect(dateColumns({ year: 2026, month: 9, day: 29, order: 'ymd' }).map((c) => c.values[c.index])).toEqual(['2026', 'Sep', '29'])
  })

  it('marqueeFrames', () => {
    expect(marqueeFrames('short', 288)).toEqual([0])
    expect(marqueeFrames('x'.repeat(50), 100, { step: 50, gap: 0 })).toEqual([0, 50, 100, 150, 200, 250, 300, 350])
  })
})
