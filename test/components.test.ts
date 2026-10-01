import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Framebuffer, INK_BUDGET, TILE, createTheme, encodePreviewPng, inkRatio, outlineTheme, unsupportedTextChars } from '../src/core/index.js'
import { formatNumber, heatStep, niceScale } from '../src/charts/index.js'
import { GridKeyboardState, dateColumns, daysInMonth, marqueeFrames, timeColumns } from '../src/widgets/index.js'
import * as W from '../src/widgets/index.js'
import { ICON_NAMES, drawIcon } from '../src/icons/index.js'
import { SAMPLES, TEXT_SAMPLES } from '../examples/gallery/samples.js'

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

/**
 * Samples allowed over INK_BUDGET with the default (filled) surface, and why.
 * `outline: true`: the outline surface must bring the sample under budget.
 * A new sample over budget fails the test: make it lighter, or add it here with a reason.
 */
const INK_EXCEPTIONS: Record<string, { why: string; outline?: true }> = {
  'bar-vertical': { why: 'solid bars', outline: true },
  'bars-grouped': { why: 'solid series-0 bars', outline: true },
  'bars-stacked': { why: 'solid series-0 segments', outline: true },
  histogram: { why: 'solid bins', outline: true },
  'button-states': { why: 'shows every state, incl. pressed and active fills', outline: true },
  'toggle-on': { why: 'solid track', outline: true },
  'progress-segmented': { why: 'solid lit segments', outline: true },
  segmented: { why: 'solid selected segment', outline: true },
  'toast-error': { why: 'error toasts are inverted', outline: true },
  'tabs-boxed': { why: 'solid active tab in a small rect', outline: true },
  heatmap: { why: 'the lit cells are the data' },
  waffle: { why: 'the lit cells are the data' },
  'board-2048': { why: 'filled marks carry meaning' },
  dice: { why: 'held dice are filled (meaning)' },
  badges: { why: 'a solid badge fills most of its 96×16 rect' },
  health: { why: 'a 16 px tall bar fills most of its rect' },
}

describe('ink budget', () => {
  const size = (s: (typeof SAMPLES)[number]) => s.size ?? s.component.size ?? TILE
  const ink = new Map(SAMPLES.map((s) => [s.id, inkRatio(s.component.renderToTile(s.props, size(s)))]))

  it(`no sample lights more than ${INK_BUDGET * 100} % of its pixels unless listed`, () => {
    const over = SAMPLES.filter((s) => ink.get(s.id)! > INK_BUDGET && !INK_EXCEPTIONS[s.id]).map((s) => `${s.id} ${(ink.get(s.id)! * 100).toFixed(1)} %`)
    expect(over).toEqual([])
  })

  it('the exception list only holds samples that are over budget', () => {
    const stale = Object.keys(INK_EXCEPTIONS).filter((id) => !(ink.get(id)! > INK_BUDGET))
    expect(stale).toEqual([])
  })

  it('the outline surface brings the listed samples under budget', () => {
    const still = SAMPLES.filter((s) => INK_EXCEPTIONS[s.id]?.outline && inkRatio(s.component.renderToTile(s.props, size(s), outlineTheme)) > INK_BUDGET).map((s) => s.id)
    expect(still).toEqual([])
  })
})

describe('outline surface', () => {
  for (const s of SAMPLES) {
    const size = s.size ?? s.component.size ?? TILE
    const filled = s.component.renderToTile(s.props, size)
    const outline = s.component.renderToTile(s.props, size, outlineTheme)
    if (outline.equals(filled)) continue
    it(`${s.id}: less ink, inside its rect, PNG snapshot`, () => {
      expect(inkRatio(outline)).toBeLessThan(inkRatio(filled))
      const o = 60
      const big = new Framebuffer(size.w + 2 * o, size.h + 2 * o)
      s.component.render(big, { x: o, y: o, w: size.w, h: size.h }, s.props, outlineTheme)
      // Every lit pixel of the big canvas is inside the rect.
      expect(Math.round(inkRatio(big) * big.data.length)).toBe(Math.round(inkRatio(big, { x: o, y: o, w: size.w, h: size.h }) * size.w * size.h))
      expect(createHash('sha256').update(encodePreviewPng(outline)).digest('hex').slice(0, 16)).toMatchSnapshot()
    })
  }
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

  it('keyboardLayout: groups by rows, columns or keys; symbols as a layer, beside or below', () => {
    const labels = (l: W.KeyboardLayout, v = 0) => l.views[v].groups.map((g) => g.map((i) => l.views[v].keys[i].char ?? l.views[v].keys[i].action).join(' '))
    const rows = W.keyboardLayout()
    expect(rows.views.map((v) => v.id)).toEqual(['letters', 'symbols'])
    expect(labels(rows)).toEqual(['q w e r t y u i o p', 'a s d f g h j k l', 'z x c v b n m', 'shift symbols space delete submit'])
    expect(labels(rows, 1)[0]).toBe('1 2 3 4 5 6 7 8 9 0')
    const cols = W.keyboardLayout({ letters: 'abc', scan: 'columns', symbols: false })
    // 'vwxyz' is centred by whole keys under the 7-wide rows, so v sits under b.
    expect(labels(cols).slice(0, 2)).toEqual(['a h o', 'b i p v'])
    expect(labels(cols).at(-1)).toBe('shift space delete submit') // no symbols layer, no switch key
    const side = W.keyboardLayout({ panels: 'side', punctuation: ',.' })
    expect(side.views).toHaveLength(1)
    expect(labels(side)[2]).toBe('z x c v b n m , .')
    expect(labels(side)[3]).toBe('1 2 3 4 5') // then the symbol rows
    expect(side.size).toEqual({ w: 576, h: 144 })
    expect(W.keyboardLayout({ scan: 'keys' }).views[0].groups).toHaveLength(1)
    expect(labels(W.keyboardLayout({ digits: 'row', symbols: false }))[0]).toBe('1 2 3 4 5 6 7 8 9 0')
  })

  it('KeyboardState: open, type, shift once / lock, caps, layer switch, delete stays', () => {
    const kb = new W.KeyboardState(W.keyboardLayout({ actions: ['shift', 'caps', 'symbols', 'space', 'delete', 'submit'] }), { maxLength: 6 })
    const actions = () => {
      while (kb.group !== kb.current.groups.length - 1) kb.move(-1)
    }
    const pressAction = (name: string) => {
      actions()
      kb.tap()
      while (kb.focusedKey!.action !== name) kb.move(1)
      return kb.tap()
    }
    expect(pressAction('shift')).toBe('mode')
    expect(kb.key).toBe(-1) // back to choosing rows
    kb.move(1) // row 0
    expect(kb.tap()).toBe('opened')
    expect(kb.tap()).toBe('typed') // Q, shift once
    expect(kb.text).toBe('Q')
    expect(kb.shift).toBe('off')
    kb.tap() // reopen at q
    kb.tap()
    expect(kb.text).toBe('Qq')
    pressAction('caps')
    expect(kb.shift).toBe('lock')
    kb.move(1)
    kb.tap()
    kb.tap()
    expect(kb.text).toBe('QqQ')
    pressAction('caps')
    expect(pressAction('symbols')).toBe('mode')
    expect(kb.current.id).toBe('symbols')
    kb.move(1) // digits row
    kb.tap()
    kb.tap()
    expect(kb.text).toBe('QqQ1')
    expect(pressAction('delete')).toBe('deleted')
    expect(kb.focusedKey!.action).toBe('delete') // stays for repeated deletes
    kb.tap()
    expect(kb.text).toBe('Qq')
    expect(kb.back()).toBe(true)
    expect(kb.back()).toBe(false)
    expect(pressAction('submit')).toBe('submit')
  })

  it('KeyboardState: afterType stay, one-key groups type on the first tap, maxLength', () => {
    const kb = new W.KeyboardState(W.keyboardLayout({ letters: ['ab', 'c'], symbols: false, actions: ['submit'], afterType: 'stay' }), { maxLength: 2 })
    kb.tap()
    kb.tap()
    expect(kb.key).toBe(0) // stays on a
    kb.back()
    kb.move(1) // row [c]: one key
    expect(kb.tap()).toBe('typed')
    expect(kb.text).toBe('ac')
    expect(kb.tap()).toBe('none') // maxLength
  })

  it('typingCost: rows beat one long line; uppercase costs a shift', () => {
    const rows = W.typingCost(W.keyboardLayout(), 'hello world')
    const keys = W.typingCost(W.keyboardLayout({ scan: 'keys' }), 'hello world')
    expect(rows.missing).toBe('')
    expect(rows.gestures).toBeLessThan(keys.gestures)
    expect(W.typingCost(W.keyboardLayout(), 'Hi').gestures).toBeGreaterThan(W.typingCost(W.keyboardLayout(), 'hi').gestures)
    expect(W.typingCost(W.keyboardLayout({ symbols: false }), 'a1').missing).toBe('1')
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

describe('text components (firmware text)', () => {
  for (const s of TEXT_SAMPLES) {
    it(`${s.id} (${s.component.name})`, () => {
      const out = s.component.render(s.props)
      // Only characters the G2 firmware font draws; short lines, far under the 2000-character update limit.
      expect(unsupportedTextChars(out)).toEqual([])
      for (const line of out.split('\n')) expect([...line].length).toBeLessThan(60)
      expect(s.component.render(s.props)).toBe(out)
      expect(out).toMatchSnapshot()
    })
  }

  it('unsupportedTextChars knows the firmware font', () => {
    expect(unsupportedTextChars('Hi ━─█▏● ○▶▷◀ ↑↗ ★ ♥ ° ½ ｘ\n')).toEqual([])
    expect(unsupportedTextChars('… • 😀 µ ✓')).toEqual(['…', '•', '😀', 'µ', '✓'])
  })

  it('spinner frames wrap; progress clamps and fills by eighths; slider marks focus and edit mode', () => {
    expect([0, 1, 2, 3, 4, -1].map((frame) => W.renderTextSpinner({ frame, glyphs: 'ascii' }))).toEqual(['|', '/', '-', '\\', '|', '\\'])
    expect(W.renderTextSpinner({ frame: 2 })).toBe('→')
    expect(W.renderTextProgress({ value: 1.5, width: 4 })).toBe('━━━━ 100%')
    expect(W.renderTextProgress({ value: -1, width: 4, valueText: false, glyphs: 'ascii' })).toBe('[----]')
    expect(W.renderTextProgress({ value: 0.5625, width: 2, blocks: true, valueText: false })).toBe('█▏')
    expect(W.renderTextProgress({ value: 0.25, width: 4, blocks: true, valueText: false })).toBe('█───')
    expect(W.renderTextSlider({ value: 0, width: 4, glyphs: 'ascii' })).toBe('  [o---] 0')
    expect(W.renderTextSlider({ value: 100, width: 4, focused: true })).toBe('▶ ━━━● 100')
    expect(W.renderTextSlider({ value: 50, width: 5, editing: true, label: 'V' })).toBe('▶ V ◀ ━━●── ▶ 50')
    expect(W.renderTextSlider({ value: 50, width: 5, editing: true, label: 'V', glyphs: 'ascii' })).toBe('> V < ==o-- > 50')
  })

  it('menu: focus marker, checks, a window that follows focus; toggle', () => {
    expect(W.renderTextMenu({ items: ['A', 'B'], focus: 0 })).toBe('▶ A\n▷ B')
    const win = W.renderTextMenu({ items: ['a', 'b', 'c', 'd', 'e'], focus: 4, visible: 2 }).split('\n')
    expect(win).toEqual(['▷ d  ▲', '▶ e'])
    expect(W.renderTextMenu({ items: ['a', 'b', 'c'], focus: 0, visible: 2, checked: [true, false, false], glyphs: 'ascii' })).toBe('> [x] a\n  [ ] b  v')
    expect(W.renderTextToggle({ on: true, label: 'Wi-Fi', focused: true })).toBe('▶ Wi-Fi  ● On')
    expect(W.renderTextToggle({ on: false, glyphs: 'ascii' })).toBe('  [ ] Off')
  })

  it('hold, toast, status line, readout, ticker', () => {
    expect(W.renderTextHold({ progress: 0, label: 'Go', width: 4 })).toBe('○ Go  ────')
    expect(W.renderTextHold({ progress: 0.5, label: 'Go', width: 4, glyphs: 'ascii' })).toBe('[~] Go  [##--]')
    expect(W.renderTextHold({ progress: 1, done: true })).toBe('● Confirmed')
    expect(W.renderTextToast({ message: 'Hi' })).toBe('▶ Hi')
    expect(W.renderTextToast({ message: 'No', kind: 'error', detail: 'Retry', glyphs: 'ascii' })).toBe('[x] No\n   Retry')
    expect(W.renderTextStatusLine({ items: ['a', { label: 'b', value: 1 }], glyphs: 'ascii' })).toBe('a | b 1')
    expect(W.renderTextReadout({ value: 3, delta: 0 })).toBe('3  → ±0')
    expect(W.renderTextReadout({ value: 1.234, decimals: 1, delta: -0.25, glyphs: 'ascii' })).toBe('1.2  v -0.3')
    expect(W.renderTextReadout({ value: 'OK', label: 'Link', focused: false })).toBe('▷ Link  OK')
    expect(W.renderTextTicker({ text: 'short', offset: 3, width: 10 })).toBe('short')
    // 'abcdef' + gap '|' loops every 7 characters, negative offsets included.
    expect([0, 5, 7, -1].map((offset) => W.renderTextTicker({ text: 'abcdef', offset, width: 4, gap: '|' }))).toEqual(['abcd', 'f|ab', 'abcd', '|abc'])
  })
})
