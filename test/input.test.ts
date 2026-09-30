import { describe, expect, it, vi } from 'vitest'
import type { G2Event } from '../src/bridge/events.js'
import { PageBuilder } from '../src/bridge/pageBuilder.js'
import {
  BACK,
  FocusRing,
  HoldToConfirm,
  HybridSkeleton,
  MORE,
  PagedList,
  TapConfirm,
  blankTextSkeleton,
  listSkeleton,
  stepIndex,
  stepValue,
  type Timers,
} from '../src/input/index.js'

const ev = (type: 'next' | 'prev' | 'tap' | 'hold' | 'doubleTap' | 'release'): G2Event =>
  type === 'next' || type === 'prev' ? { type, from: 'text' } : { type }

describe('skeletons', () => {
  it('blank text skeleton is a capturing, invisible text container', () => {
    const s = blankTextSkeleton({ x: 0, y: 144, w: 576, h: 144 })
    expect(s).toMatchObject({ content: ' ', capture: true, border: { width: 0 }, padding: 0 })
    const page = new PageBuilder().text(s).build()
    expect(page.layout.textObject![0]).toMatchObject({ isEventCapture: 1, content: ' ', borderWidth: 0 })
  })

  it('list skeleton captures and keeps items', () => {
    const page = new PageBuilder().list(listSkeleton({ x: 0, y: 0, w: 288, h: 288 }, ['A', 'B'])).build()
    expect(page.capture).toEqual({ kind: 'list', id: 100, name: 'list', items: ['A', 'B'] })
  })

  it('hybrid switches capture container kind', () => {
    const h = new HybridSkeleton({ x: 0, y: 144, w: 576, h: 144 }, ['A', 'B'])
    expect('content' in h.spec()).toBe(true)
    expect(h.setMode('list')).toBe(true)
    expect(h.setMode('list')).toBe(false)
    expect('items' in h.spec()).toBe(true)
  })
})

describe('PagedList (> 20 items through a native list)', () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

  it('keeps ≤ 20 labels per page with MORE / BACK', () => {
    const pl = new PagedList(letters)
    expect(pl.pageCount).toBe(2)
    expect(pl.labels(0)).toHaveLength(20)
    expect(pl.labels(0).at(-1)).toBe(MORE)
    expect(pl.labels(1)[0]).toBe(BACK)
    expect(pl.labels(1).length).toBeLessThanOrEqual(20)
    const all = [...pl.labels(0), ...pl.labels(1)].filter((l) => l !== MORE && l !== BACK)
    expect(all).toEqual(letters)
  })

  it('maps taps to items with global indices and page changes', () => {
    const pl = new PagedList(letters)
    expect(pl.select(2)).toEqual({ kind: 'item', item: 'C', index: 2 })
    expect(pl.select(19)).toEqual({ kind: 'page', page: 1 })
    expect(pl.select(1)).toEqual({ kind: 'item', item: 'T', index: 19 })
    expect(pl.select(0)).toEqual({ kind: 'page', page: 0 })
    expect(pl.select(99)).toEqual({ kind: 'none' })
  })

  it('prefers the reported name over the index', () => {
    const pl = new PagedList(letters)
    expect(pl.select(0, 'E')).toEqual({ kind: 'item', item: 'E', index: 4 })
  })

  it('handles three pages and short lists', () => {
    const many = Array.from({ length: 50 }, (_, i) => `#${i}`)
    const pl = new PagedList(many)
    expect(pl.pageCount).toBe(3)
    for (let p = 0; p < 3; p++) expect(pl.labels(p).length).toBeLessThanOrEqual(20)
    expect(new PagedList(['a', 'b']).labels()).toEqual(['a', 'b'])
  })
})

describe('FocusRing', () => {
  function ring(extra: Partial<ConstructorParameters<typeof FocusRing>[1]> = {}) {
    const log: string[] = []
    let value = 5
    const r = new FocusRing(
      [
        { id: 'a', activate: () => log.push('a!') },
        { id: 'b', disabled: true },
        {
          id: 'slider',
          edit: {
            begin: () => log.push(`begin ${value}`),
            adjust: (d) => (value += d),
            commit: () => log.push(`commit ${value}`),
            cancel: () => {
              value = 5
              log.push('cancel')
            },
          },
        },
        { id: 'd', secondary: () => log.push('d2') },
      ],
      { onChange: (s) => log.push(`@${s.id}${s.editing ? '*' : ''}`), onBack: () => log.push('back'), onApp: () => log.push('app'), ...extra },
    )
    return { r, log, value: () => value }
  }

  it('swipes move focus, skipping disabled items, wrapping by default', () => {
    const { r } = ring()
    expect(r.focused?.id).toBe('a')
    r.handle(ev('next'))
    expect(r.focused?.id).toBe('slider')
    r.handle(ev('next'))
    r.handle(ev('next'))
    expect(r.focused?.id).toBe('a')
    r.handle(ev('prev'))
    expect(r.focused?.id).toBe('d')
  })

  it('does not wrap when wrap: false', () => {
    const { r } = ring({ wrap: false })
    r.handle(ev('prev'))
    expect(r.focused?.id).toBe('a')
  })

  it('tap activates; hold runs secondary or back; double-tap is app-level', () => {
    const { r, log } = ring()
    r.handle(ev('tap'))
    r.handle(ev('hold'))
    r.focus('d')
    r.handle(ev('hold'))
    r.handle(ev('doubleTap'))
    expect(log.filter((l) => !l.startsWith('@'))).toEqual(['a!', 'back', 'd2', 'app'])
  })

  it('edit mode: tap enters, swipes adjust, tap commits', () => {
    const { r, log, value } = ring()
    r.focus('slider')
    r.handle(ev('tap'))
    expect(r.editing).toBe(true)
    r.handle(ev('next'))
    r.handle(ev('next'))
    r.handle(ev('prev'))
    expect(value()).toBe(6)
    expect(r.focused?.id).toBe('slider') // focus did not move
    r.handle(ev('tap'))
    expect(r.editing).toBe(false)
    expect(log).toContain('commit 6')
  })

  it('edit mode: hold cancels and restores', () => {
    const { r, log, value } = ring()
    r.focus('slider')
    r.handle(ev('tap'))
    r.handle(ev('next'))
    r.handle(ev('hold'))
    expect(r.editing).toBe(false)
    expect(value()).toBe(5)
    expect(log).toContain('cancel')
  })

  it('custom gesture map', () => {
    const { r, log } = ring({ gestures: { next: 'focusPrev', prev: 'focusNext', hold: 'none' } })
    r.handle(ev('next'))
    expect(r.focused?.id).toBe('d')
    // hold is mapped to 'none': neither d's secondary nor onBack runs.
    expect(r.handle(ev('hold'))).toBe(false)
    expect(log).not.toContain('d2')
    expect(log).not.toContain('back')
  })

  it('reports state for rendering', () => {
    const { r } = ring()
    expect(r.state).toEqual({ index: 0, id: 'a', editing: false })
    expect(r.is('a')).toBe(true)
  })
})

describe('step helpers', () => {
  it('stepIndex wraps or clamps', () => {
    expect(stepIndex(0, -1, 5)).toBe(4)
    expect(stepIndex(4, 1, 5)).toBe(0)
    expect(stepIndex(0, -1, 5, false)).toBe(0)
  })
  it('stepValue snaps, clamps and wraps', () => {
    expect(stepValue(0.3, 1, { min: 0, max: 1, step: 0.1 })).toBe(0.4)
    expect(stepValue(1, 1, { min: 0, max: 1, step: 0.1 })).toBe(1)
    expect(stepValue(59, 1, { min: 0, max: 59, wrap: true })).toBe(0)
    expect(stepValue(0, -1, { min: 0, max: 59, wrap: true })).toBe(59)
  })
})

function fakeTimers(): Timers & { advance(ms: number): void } {
  let t = 0
  const intervals = new Map<number, { fn: () => void; ms: number; next: number }>()
  let id = 0
  return {
    now: () => t,
    set(fn, ms) {
      intervals.set(++id, { fn, ms, next: t + ms })
      return id
    },
    clear(h) {
      intervals.delete(h as number)
    },
    advance(ms) {
      const end = t + ms
      for (;;) {
        const due = [...intervals.entries()].filter(([, v]) => v.next <= end).sort((a, b) => a[1].next - b[1].next)[0]
        if (!due) break
        t = due[1].next
        due[1].next += due[1].ms
        due[1].fn()
      }
      t = end
    },
  }
}

describe('HoldToConfirm', () => {
  it('confirms after the duration while held', () => {
    const timers = fakeTimers()
    const onConfirm = vi.fn()
    const progress: number[] = []
    const h = new HoldToConfirm({ durationMs: 1000, tickMs: 250, timers, onConfirm, onProgress: (p) => progress.push(p) })
    expect(h.handleEvent({ type: 'hold' })).toBe(true)
    timers.advance(1000)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(progress).toEqual([0, 0.25, 0.5, 0.75, 1])
    h.handleEvent({ type: 'release' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancels on early release', () => {
    const timers = fakeTimers()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const h = new HoldToConfirm({ durationMs: 1000, timers, onConfirm, onCancel })
    h.handleEvent({ type: 'hold' })
    timers.advance(400)
    h.handleEvent({ type: 'release' })
    timers.advance(2000)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(h.progress()).toBe(0)
  })
})

describe('TapConfirm', () => {
  it('arms then confirms; times out', () => {
    const timers = fakeTimers()
    const onConfirm = vi.fn()
    const onDisarm = vi.fn()
    const c = new TapConfirm({ timeoutMs: 2000, onConfirm, onDisarm, timers })
    expect(c.tap()).toBe('armed')
    expect(c.tap()).toBe('confirmed')
    expect(onConfirm).toHaveBeenCalledTimes(1)
    c.tap()
    timers.advance(2500)
    expect(c.armed).toBe(false)
    expect(onDisarm).toHaveBeenCalledTimes(1)
  })
})
