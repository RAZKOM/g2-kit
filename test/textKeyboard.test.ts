import { describe, expect, it } from 'vitest'
import { Framebuffer, GRID_SPACE, TEXT_GRID, defaultTheme, isGridChar, toFullwidth, unsupportedTextChars } from '../src/core/index.js'
import { layouts } from '../src/bridge/index.js'
import { TextKeyboardFrames, keyboardLayout, renderTextKeyboard, textKeyLabel, textKeyboardGrid } from '../src/widgets/index.js'

const lines = (s: string) => s.split('\n')
const widths = (s: string) => lines(s).map((l) => [...l].length)

describe('text grid', () => {
  it('converts printable ASCII to fullwidth, keeps grid shapes, rejects the rest', () => {
    expect(toFullwidth('OK a!')).toBe('ＯＫ　ａ！')
    expect(toFullwidth('▲◀')).toBe('▲◀')
    expect(() => toFullwidth('←')).toThrow(RangeError)
    expect(() => toFullwidth('é')).toThrow(/not on the G2 text grid/)
    expect([...'Ｑｑ１［　◆'].every(isGridChar)).toBe(true)
    expect(isGridChar('Q')).toBe(false)
    expect(TEXT_GRID).toEqual({ cell: 20, line: 27, mid: 16 })
  })
})

describe('text keyboard', () => {
  const qwerty = textKeyboardGrid(keyboardLayout())

  it('lays QWERTY out with its stagger and a centred action row', () => {
    expect(qwerty.lines).toBe(4)
    const text = renderTextKeyboard({ grid: qwerty })
    const [r0, r1, r2, actions] = lines(text)
    // Two cells per key, a half-key stagger is one cell.
    expect(r0.indexOf('ｑ') + 1).toBe(r1.indexOf('ａ'))
    expect(r1.indexOf('ａ') + 2).toBe(r2.indexOf('ｚ'))
    expect(actions).toContain('△　？１２３　＿＿＿　◀　ＯＫ')
    // Every character is on the grid, and the firmware font has them all.
    expect([...text.replaceAll('\n', '')].every(isGridChar)).toBe(true)
    expect(unsupportedTextChars(text)).toEqual([])
  })

  it('focus brackets replace spacers: no line changes width, whatever is focused or shifted', () => {
    const v = qwerty.layout.views[0]
    const base = widths(renderTextKeyboard({ grid: qwerty, view: 0 }))
    v.groups.forEach((g, gi) => {
      expect(widths(renderTextKeyboard({ grid: qwerty, group: gi }))).toEqual(base)
      g.forEach((_, ki) => {
        for (const shift of ['off', 'once', 'lock'] as const) expect(widths(renderTextKeyboard({ grid: qwerty, group: gi, key: ki, shift }))).toEqual(base)
      })
    })
    expect(lines(renderTextKeyboard({ grid: qwerty, group: 0 }))[0]).toMatch(/［ｑ　ｗ.*ｏ　ｐ］/)
    expect(lines(renderTextKeyboard({ grid: qwerty, group: 1, key: 3, shift: 'once' }))[1]).toMatch(/Ｓ　Ｄ［Ｆ］Ｇ/)
    expect(lines(renderTextKeyboard({ grid: qwerty, group: 3, key: 4 }))[3]).toContain('［ＯＫ］')
  })

  it('shift states have one width; the symbols layer swaps labels', () => {
    const shiftKey = qwerty.layout.views[0].keys.find((k) => k.action === 'shift')!
    expect((['off', 'once', 'lock'] as const).map((s) => textKeyLabel(qwerty.layout, 0, shiftKey, s))).toEqual(['△', '▲', '■'])
    expect(lines(renderTextKeyboard({ grid: qwerty, view: 1 }))[3]).toContain('ａｂｃ')
    expect(lines(renderTextKeyboard({ grid: qwerty, view: 1 }))[0]).toContain('１　２　３')
    const custom = textKeyboardGrid(keyboardLayout({ labels: { submit: 'Send' } }))
    expect(lines(renderTextKeyboard({ grid: custom }))[3]).toContain('Ｓｅｎｄ')
  })

  it('column scans stay in columns; group focus brackets each member line', () => {
    const cols = textKeyboardGrid(keyboardLayout({ scan: 'columns' }))
    const text = renderTextKeyboard({ grid: cols, group: 2 })
    const [r0, r1, r2] = lines(text)
    expect(r0.indexOf('ｅ')).toBe(r1.indexOf('ｄ'))
    expect(r1.indexOf('ｄ')).toBe(r2.indexOf('ｘ'))
    expect([r0, r1, r2].every((l) => /［.］/.test(l))).toBe(true)
  })

  it('rejects layouts that do not fit the grid', () => {
    expect(() => textKeyboardGrid(keyboardLayout({ panels: 'side' }))).toThrow(/28 fit/)
    expect(() => textKeyboardGrid(keyboardLayout({ letters: 'abc', digits: 'row' }), { maxLines: 5 })).toThrow(/6 lines/)
    expect(textKeyboardGrid(keyboardLayout({ letters: 'abc' }), { maxLines: 5 }).lines).toBe(5)
  })

  it('frames sit on the grid under each key, inside the span', () => {
    const page = layouts.textKeyboard({ lines: qwerty.lines })
    const fb = new Framebuffer(576, 144)
    TextKeyboardFrames.render(fb, { x: 0, y: 0, w: 576, h: 144 }, { grid: qwerty, origin: page.origin }, defaultTheme)
    const q = qwerty.views[0][0]
    const x = page.origin.x + q.start * TEXT_GRID.cell - 7
    const y = page.origin.y + q.line * TEXT_GRID.line + TEXT_GRID.mid - 12
    expect(fb.get(x, y + 5)).toBe(defaultTheme.levels.dim)
    expect(fb.get(x + 10, y + 12)).toBe(0) // inside the frame: the text letter goes here
    expect(page.origin.y).toBeGreaterThanOrEqual(0)
  })

  it('layouts.textKeyboard: blank capture under everything, keys box at the bottom, at most 5 lines', () => {
    const page = layouts.textKeyboard({ lines: 4 })
    const texts = page.layout.textObject!
    expect(texts.map((t) => [t.containerName, t.isEventCapture])).toEqual([['skeleton', 1], ['text', 0], ['keys', 0]])
    const keys = texts[2]
    expect([keys.xPosition, keys.width, keys.paddingLength]).toEqual([8, 560, 0])
    expect((keys.yPosition as number) + (keys.height as number)).toBe(288)
    expect(() => layouts.textKeyboard({ lines: 6 })).toThrow(RangeError)
    expect(GRID_SPACE).toBe('　')
  })
})
