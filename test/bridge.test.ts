import { describe, expect, it, vi } from 'vitest'
import { Framebuffer } from '../src/core/framebuffer.js'
import { defineComponent } from '../src/core/component.js'
import {
  G2,
  ImageQueue,
  ImageSendError,
  PageBuilder,
  PageLayoutError,
  Surface,
  TextArea,
  checkEnumDrift,
  layouts,
  normalizeEvent,
  resolveListItem,
  toImageResult,
  type G2Event,
  type Host,
  type ImageTarget,
  type PageLayout,
  type RawEvent,
} from '../src/bridge/index.js'
import { promptText } from '../src/input/index.js'
import { TextProgress, TextSlider, TextSpinner } from '../src/widgets/index.js'

const noSleep = () => Promise.resolve()
const T = (id: number): ImageTarget => ({ containerID: id, containerName: `img${id}` })
const bytes = (n: number) => () => new Uint8Array([n])

describe('event normalisation: observed truth table (simulator 0.9.5, SDK ≥ 0.0.15)', () => {
  const cases: Array<[string, RawEvent, unknown]> = [
    ['native list tap → listEvent with only currentSelectItemIndex', { listEvent: { currentSelectItemIndex: 3 } }, { type: 'select', index: 3, name: null }],
    ['native list tap on item 0 → index omitted (protobuf zero)', { listEvent: {} }, { type: 'select', index: 0, name: null }],
    ['list tap with a reported name', { listEvent: { currentSelectItemIndex: 1, currentSelectItemName: 'B', containerID: 10 } }, { type: 'select', index: 1, name: 'B', containerID: 10 }],
    ['text container swipe down → textEvent SCROLL_BOTTOM', { textEvent: { eventType: 2 } }, { type: 'next', from: 'text' }],
    ['text container swipe up → textEvent SCROLL_TOP', { textEvent: { eventType: 1 } }, { type: 'prev', from: 'text' }],
    ['text container tap → sysEvent with eventType omitted', { sysEvent: {} }, { type: 'tap' }],
    ['explicit CLICK_EVENT 0 on sysEvent', { sysEvent: { eventType: 0 } }, { type: 'tap' }],
    ['text tap arriving as textEvent', { textEvent: {} }, { type: 'tap' }],
    ['double-tap → sysEvent type 3', { sysEvent: { eventType: 3 } }, { type: 'doubleTap' }],
    ['long press start → type 9', { sysEvent: { eventType: 9, eventSource: 1 } }, { type: 'hold', source: 'right' }],
    ['long press release → type 10', { sysEvent: { eventType: 10, eventSource: 2 } }, { type: 'release', source: 'ring' }],
    ['foreground enter', { sysEvent: { eventType: 4 } }, { type: 'foreground' }],
    ['foreground exit', { sysEvent: { eventType: 5 } }, { type: 'background' }],
    ['system exit', { sysEvent: { eventType: 7 } }, { type: 'exit', abnormal: false }],
    ['abnormal exit', { sysEvent: { eventType: 6 } }, { type: 'exit', abnormal: true }],
    ['menu item click', { menuItemClickEvent: { itemID: 4 } }, { type: 'menu', itemID: 4 }],
    ['menu item 0 is invalid', { menuItemClickEvent: {} }, { type: 'ignore' }],
    ['list edge scroll (not observed on hardware, handled if it appears)', { listEvent: { eventType: 2 } }, { type: 'next', from: 'list' }],
    ['imu sample', { sysEvent: { eventType: 8, imuData: { x: 1, y: 2, z: 3 } } }, { type: 'imu', x: 1, y: 2, z: 3 }],
    ['empty envelope', {}, { type: 'ignore' }],
  ]
  for (const [name, raw, expected] of cases) it(name, () => expect(normalizeEvent(raw)).toEqual(expected))

  it('resolves CLICK per envelope: a scroll plus an empty sysEvent is not a tap', () => {
    expect(normalizeEvent({ textEvent: { eventType: 2 }, sysEvent: {} })).toEqual({ type: 'next', from: 'text' })
  })

  it('long press wins over a simultaneous tap default', () => {
    expect(normalizeEvent({ textEvent: {}, sysEvent: { eventType: 9 } }).type).toBe('hold')
  })

  it('swipe direction is configurable', () => {
    expect(normalizeEvent({ textEvent: { eventType: 2 } }, { nextIs: 'up' }).type).toBe('prev')
    expect(normalizeEvent({ textEvent: { eventType: 1 } }, { nextIs: 'up' }).type).toBe('next')
  })

  it('resolveListItem prefers the reported name', () => {
    expect(resolveListItem(['A', 'B'], 0, ' B ')).toBe('B')
    expect(resolveListItem(['A', 'B'], 1, null)).toBe('B')
    expect(resolveListItem(['A', 'B'], 5, 'Z')).toBeNull()
  })

  it('enum drift check throws on mismatch and warns for missing long press', () => {
    const ok = { CLICK_EVENT: 0, SCROLL_TOP_EVENT: 1, SCROLL_BOTTOM_EVENT: 2, DOUBLE_CLICK_EVENT: 3, FOREGROUND_ENTER_EVENT: 4, FOREGROUND_EXIT_EVENT: 5, ABNORMAL_EXIT_EVENT: 6, SYSTEM_EXIT_EVENT: 7, IMU_DATA_REPORT: 8, LONG_PRESS_EVENT: 9, LONG_PRESS_RELEASE_EVENT: 10 }
    expect(() => checkEnumDrift(ok)).not.toThrow()
    expect(() => checkEnumDrift({ ...ok, DOUBLE_CLICK_EVENT: 4 })).toThrow(/drift/)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { LONG_PRESS_EVENT: _a, LONG_PRESS_RELEASE_EVENT: _b, ...old } = ok
    checkEnumDrift(old)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('ImageQueue', () => {
  function recorder(result: (n: number) => unknown = () => 'success') {
    const log: string[] = []
    let n = 0
    const send = async (t: ImageTarget, b: Uint8Array) => {
      log.push(`${t.containerID}:${b[0]}`)
      return result(n++)
    }
    return { log, send }
  }

  it('sends serially in order', async () => {
    const r = recorder()
    const q = new ImageQueue(r.send, { sleep: noSleep })
    q.image(T(1), bytes(1))
    q.image(T(2), bytes(2))
    q.image(T(3), bytes(3))
    await q.idle()
    expect(r.log).toEqual(['1:1', '2:2', '3:3'])
  })

  it('never overlaps sends', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const q = new ImageQueue(
      async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((r) => setTimeout(r, 1))
        inFlight--
        return 'success'
      },
      { sleep: noSleep },
    )
    for (let i = 0; i < 5; i++) q.image(T(i), bytes(i))
    await q.idle()
    expect(maxInFlight).toBe(1)
  })

  it('coalesces pending frames per container (latest wins, keeps its slot)', async () => {
    const r = recorder()
    const q = new ImageQueue(r.send, { sleep: noSleep })
    q.image(T(1), bytes(1)) // starts sending immediately
    q.image(T(2), bytes(20))
    q.image(T(3), bytes(30))
    q.image(T(2), bytes(21))
    q.image(T(2), bytes(22))
    await q.idle()
    expect(r.log).toEqual(['1:1', '2:22', '3:30'])
    expect(q.stats.coalesced).toBe(2)
  })

  it('renders lazily at send time', async () => {
    const r = recorder()
    const q = new ImageQueue(r.send, { sleep: noSleep })
    let state = 1
    q.image(T(1), () => new Uint8Array([state]))
    state = 9
    await q.idle()
    expect(r.log).toEqual(['1:9'])
  })

  it('a page op drops frames queued before it; frames after it are kept', async () => {
    const r = recorder()
    let release!: () => void
    const q = new ImageQueue(async (t, b) => {
      await new Promise<void>((res) => (release = res))
      return r.send(t, b)
    }, { sleep: noSleep })
    q.image(T(1), bytes(1))
    await Promise.resolve()
    await Promise.resolve() // T(1) is now in flight
    q.image(T(2), bytes(2)) // stale: queued before the rebuild
    const rebuilt = q.op(async () => {
      r.log.push('rebuild')
    })
    q.image(T(2), bytes(3)) // after the op: must not coalesce with the stale one
    release()
    await rebuilt
    await new Promise((res) => setTimeout(res, 0))
    release()
    await q.idle()
    expect(r.log).toEqual(['1:1', 'rebuild', '2:3'])
    expect(q.stats.dropped).toBe(1)
  })

  it('frames queued in the same tick as a rebuild are never sent', async () => {
    const r = recorder()
    const q = new ImageQueue(r.send, { sleep: noSleep })
    q.image(T(1), bytes(1))
    void q.op(async () => void r.log.push('rebuild'))
    await q.idle()
    expect(r.log).toEqual(['rebuild'])
  })

  it('ops with dropFrames:false keep pending frames', async () => {
    const r = recorder()
    const q = new ImageQueue(r.send, { sleep: noSleep })
    q.image(T(1), bytes(1))
    q.image(T(2), bytes(2))
    void q.op(async () => void r.log.push('text'), { dropFrames: false })
    await q.idle()
    expect(r.log).toEqual(['1:1', '2:2', 'text'])
  })

  it('paces sends by gapMs', async () => {
    let t = 0
    const sleeps: number[] = []
    const q = new ImageQueue(async () => 'success', {
      gapMs: 100,
      now: () => t,
      sleep: async (ms) => {
        sleeps.push(ms)
        t += ms
      },
    })
    q.image(T(1), bytes(1))
    q.image(T(2), bytes(2))
    await q.idle()
    expect(sleeps).toEqual([100])
  })

  it('defaults to a 25 ms gap (sends take ~350 ms on glasses; hub-bench)', async () => {
    let t = 0
    const sleeps: number[] = []
    const q = new ImageQueue(async () => 'success', { now: () => t, sleep: async (ms) => void sleeps.push(ms) })
    q.image(T(1), bytes(1))
    q.image(T(2), bytes(2))
    await q.idle()
    expect(sleeps).toEqual([25])
  })

  it('retries a transient failure once, then reports a typed error', async () => {
    const r = recorder(() => 'sendFailed')
    const errors: ImageSendError[] = []
    const q = new ImageQueue(r.send, { sleep: noSleep, onError: (e) => errors.push(e) })
    q.image(T(1), bytes(1))
    await q.idle()
    expect(r.log).toEqual(['1:1', '1:1'])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(ImageSendError)
    expect(errors[0].code).toBe('sendFailed')
    expect(q.stats.retried).toBe(1)
  })

  it('does not retry deterministic failures (size/format)', async () => {
    const r = recorder(() => 'imageSizeInvalid')
    const errors: ImageSendError[] = []
    const q = new ImageQueue(r.send, { sleep: noSleep, onError: (e) => errors.push(e) })
    q.image(T(1), bytes(1))
    await q.idle()
    expect(r.log).toEqual(['1:1'])
    expect(errors[0].code).toBe('imageSizeInvalid')
    expect(errors[0].message).toMatch(/288×144/)
  })

  it('skips the retry when a newer frame is waiting', async () => {
    const r = recorder((n) => (n === 0 ? 'sendFailed' : 'success'))
    let release!: () => void
    const gate = new Promise<void>((res) => (release = res))
    const q = new ImageQueue(async (t, b) => {
      await gate
      return r.send(t, b)
    }, { sleep: noSleep, onError: () => {} })
    q.image(T(1), bytes(1))
    await new Promise((res) => setTimeout(res, 0)) // frame 1 in flight
    q.image(T(1), bytes(2))
    release()
    await q.idle()
    expect(r.log).toEqual(['1:1', '1:2'])
  })

  it('a thrown send becomes a retryable ImageSendError', async () => {
    const errors: ImageSendError[] = []
    const q = new ImageQueue(async () => {
      throw new Error('bridge gone')
    }, { sleep: noSleep, onError: (e) => errors.push(e) })
    q.image(T(1), bytes(1))
    await q.idle()
    expect(errors[0].code).toBe('threw')
    expect(q.stats.retried).toBe(1)
  })

  it('encodes Framebuffer frames and reports them to onSent', async () => {
    const seen: Array<[number, number, boolean]> = []
    const q = new ImageQueue(async () => 'success', { sleep: noSleep, onSent: (t, b, f) => seen.push([t.containerID, b.length, f !== null]) })
    q.image(T(1), () => new Framebuffer(4, 2))
    await q.idle()
    expect(seen[0][0]).toBe(1)
    expect(seen[0][2]).toBe(true)
  })

  it('normalises host result codes', () => {
    expect(toImageResult('success')).toBe('success')
    expect(toImageResult('ImageRawDataUpdateResult.sendFailed')).toBe('sendFailed')
    expect(toImageResult(2)).toBe('imageSizeInvalid')
    expect(toImageResult(true)).toBe('success')
    expect(toImageResult('weird')).toBe('unknown')
  })
})

describe('PageBuilder validation', () => {
  const img = (id: number, extra = {}) => ({ id, name: `i${id}`, x: 0, y: 0, w: 100, h: 100, ...extra })
  const cap = { id: 50, name: 'cap', x: 0, y: 0, w: 576, h: 288, capture: true }

  const expectRule = (b: PageBuilder, rule: string, re?: RegExp) => {
    try {
      b.build()
      throw new Error('expected build to fail')
    } catch (e) {
      expect(e).toBeInstanceOf(PageLayoutError)
      const err = e as PageLayoutError
      expect(err.issues.map((i) => i.rule)).toContain(rule)
      expect(err.message).toContain(`[${rule}]`)
      if (re) expect(err.message).toMatch(re)
    }
  }

  it('rejects more than 4 images', () => {
    const b = new PageBuilder().text(cap)
    for (let i = 1; i <= 5; i++) b.image(img(i))
    expectRule(b, 'TOO_MANY_IMAGES', /5 image containers; max 4/)
  })

  it('rejects more than 8 text/list containers', () => {
    const b = new PageBuilder().text(cap)
    for (let i = 1; i <= 8; i++) b.text({ id: i, name: `t${i}`, x: 0, y: 0, w: 10, h: 10 })
    expectRule(b, 'TOO_MANY_OTHERS')
  })

  it('rejects oversize and undersize images', () => {
    expectRule(new PageBuilder().text(cap).image(img(1, { w: 289 })), 'IMAGE_SIZE', /20–288 × 20–144/)
    expectRule(new PageBuilder().text(cap).image(img(1, { h: 10 })), 'IMAGE_SIZE')
  })

  it('rejects containers off the canvas unless allowed', () => {
    const b = () => new PageBuilder().text(cap).image(img(1, { x: 500 }))
    expectRule(b(), 'OUT_OF_BOUNDS', /576×288/)
    expect(() => b().build({ allowOffCanvas: true })).not.toThrow()
  })

  it('requires exactly one capture container', () => {
    expectRule(new PageBuilder().image(img(1)), 'CAPTURE_COUNT', /0 containers capture/)
    expectRule(new PageBuilder().text(cap).text({ ...cap, id: 51, name: 'cap2' }), 'CAPTURE_COUNT', /2 containers/)
  })

  it('rejects duplicate IDs and names', () => {
    expectRule(new PageBuilder().text(cap).image(img(50)), 'DUPLICATE_ID')
    expectRule(new PageBuilder().text(cap).image({ ...img(1), name: 'cap' }), 'DUPLICATE_NAME')
  })

  it('zOrder: all-or-none and unique', () => {
    expectRule(new PageBuilder().text({ ...cap, z: 1 }).image(img(1)), 'Z_ORDER', /all or none/)
    expectRule(new PageBuilder().text({ ...cap, z: 1 }).image(img(1, { z: 1 })), 'Z_ORDER', /used twice/)
  })

  it('list limits: 20 items, 63 bytes per item', () => {
    const items = Array.from({ length: 21 }, (_, i) => `item ${i}`)
    expectRule(new PageBuilder().list({ id: 1, name: 'l', x: 0, y: 0, w: 100, h: 100, items, capture: true }), 'LIST_ITEMS', /PagedList/)
    expectRule(new PageBuilder().list({ id: 1, name: 'l', x: 0, y: 0, w: 100, h: 100, items: ['x'.repeat(64)], capture: true }), 'LIST_ITEM_LENGTH')
  })

  it('text, border, padding and brightness ranges', () => {
    expectRule(new PageBuilder().text({ ...cap, content: 'é'.repeat(500) }), 'TEXT_LENGTH', /1000 UTF-8 bytes; max 999/)
    expectRule(new PageBuilder().text({ ...cap, border: { width: 6 } }), 'BORDER')
    expectRule(new PageBuilder().text({ ...cap, padding: 33 }), 'PADDING')
    expectRule(new PageBuilder().text({ ...cap, textColor: 5 }), 'TEXT_COLOR')
  })

  it('menu limits', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ id: i + 1, name: `m${i}` }))
    expectRule(new PageBuilder().text(cap).menu(many), 'MENU_COUNT')
    expectRule(new PageBuilder().text(cap).menu([{ id: 0, name: 'x' }]), 'MENU_ID')
    expectRule(new PageBuilder().text(cap).menu([{ id: 1, name: 'x' }, { id: 1, name: 'y' }]), 'MENU_ID', /used twice/)
    expectRule(new PageBuilder().text(cap).menu([{ id: 1, name: 'x'.repeat(33) }]), 'MENU_NAME')
  })

  it('reports every broken rule at once', () => {
    const b = new PageBuilder().image(img(1, { w: 999 }))
    const rules = b.validate().map((i) => i.rule)
    expect(rules).toEqual(expect.arrayContaining(['IMAGE_SIZE', 'OUT_OF_BOUNDS', 'CAPTURE_COUNT']))
  })

  it('emits the SDK shape with auto zOrder in insertion order', () => {
    const page = new PageBuilder().text(cap).image(img(1)).menu([{ id: 3, name: 'Quit' }]).build()
    expect(page.layout).toEqual({
      containerTotalNum: 2,
      imageObject: [{ xPosition: 0, yPosition: 0, width: 100, height: 100, containerID: 1, containerName: 'i1', zOrderIndex: 2 }],
      textObject: [
        {
          xPosition: 0,
          yPosition: 0,
          width: 576,
          height: 288,
          containerID: 50,
          containerName: 'cap',
          zOrderIndex: 1,
          borderWidth: 0,
          paddingLength: 0,
          isEventCapture: 1,
          content: ' ',
        },
      ],
      menuObject: { menuItems: [{ itemID: 3, itemName: 'Quit' }] },
    })
    expect(page.capture).toEqual({ kind: 'text', id: 50, name: 'cap' })
    expect(page.tiles.i1.rect).toEqual({ x: 0, y: 0, w: 100, h: 100 })
  })
})

describe('layout presets', () => {
  it('all presets validate', () => {
    expect(layouts.twoTilesWithList({ items: ['A', 'B'] }).tileList).toHaveLength(2)
    expect(layouts.twoTilesWithControl().tiles.control.rect).toEqual({ x: 144, y: 184, w: 288, h: 64 })
    expect(layouts.dashboardQuad().tileList).toHaveLength(4)
    const hero = layouts.heroSidebar({ sidebarText: 'KPI' })
    expect(hero.tileList).toHaveLength(4)
    expect(hero.span).toEqual({ x: 0, y: 0, w: 432, h: 288 })
    expect(hero.capture.kind).toBe('text')
    expect(layouts.fullScreen().tileList.map((t) => t.rect.w * t.rect.h).reduce((a, b) => a + b)).toBe(576 * 288)
    expect(layouts.menuPage({ items: ['One'] }).capture.kind).toBe('list')
    const tw = layouts.textWithTile({ text: 'HELLO' })
    expect(tw.tileList).toHaveLength(1)
    expect(tw.tiles.tile.rect).toEqual({ x: 144, y: 144, w: 288, h: 144 })
    expect(tw.layout.textObject![0]).toMatchObject({ content: 'HELLO', isEventCapture: 1, yPosition: 0, height: 144 })
    expect(layouts.textWithTile({ tileAt: 'top' }).tiles.tile.rect.y).toBe(0)
  })

  it('skeletons sit below the images (lowest zOrder)', () => {
    const { layout } = layouts.twoTilesWithControl()
    const textZ = layout.textObject![0].zOrderIndex as number
    for (const im of layout.imageObject!) expect(im.zOrderIndex as number).toBeGreaterThan(textZ)
  })
})

const Fill = defineComponent<{ level: number }>('Fill', { w: 10, h: 10 }, (fb, r, p) => fb.fillRect(r.x, r.y, r.w, r.h, p.level))

describe('Surface', () => {
  function setup() {
    const page = layouts.dashboardQuad()
    const sent: string[] = []
    const frames = new Map<string, () => Framebuffer>()
    const s = new Surface(page.tileList, (t, render) => {
      sent.push(t.name)
      frames.set(t.name, render)
    })
    return { page, s, sent, frames }
  }

  it('first commit sends all tiles, then only changed ones', () => {
    const { page, s, sent } = setup()
    const a = s.mount(Fill, { level: 5 }, page.tiles.tl)
    s.mount(Fill, { level: 9 }, page.tiles.br)
    expect(s.commit().map((t) => t.name)).toEqual(['tl', 'tr', 'bl', 'br'])
    sent.length = 0
    a.update({ level: 6 })
    expect(s.commit().map((t) => t.name)).toEqual(['tl'])
    a.update({ level: 6 })
    expect(s.commit()).toEqual([])
  })

  it('a mount spanning tiles only resends the tiles it touched', () => {
    const { s } = setup()
    const m = s.mount(Fill, { level: 3 }, { rect: { x: 280, y: 0, w: 16, h: 10 } })
    s.commit()
    m.update({ level: 4 })
    expect(s.commit().map((t) => t.name)).toEqual(['tl', 'tr'])
  })

  it('renders lazily from the canvas and clips to mount rects', () => {
    const { page, s, frames } = setup()
    s.mount(Fill, { level: 7 }, { tile: page.tiles.tr, rect: { x: 10, y: 10, w: 5, h: 5 } })
    s.commit()
    const f = frames.get('tr')!()
    expect(f.width).toBe(288)
    expect(f.get(12, 12)).toBe(7)
    expect(f.get(9, 9)).toBe(0)
    expect(f.get(15, 15)).toBe(0)
  })

  it('invalidate/forget force resends', () => {
    const { page, s } = setup()
    s.mount(Fill, { level: 1 }, page.tiles.tl)
    s.commit()
    s.forget(page.tiles.bl.id)
    expect(s.commit().map((t) => t.name)).toEqual(['bl'])
    s.invalidate()
    expect(s.commit()).toHaveLength(4)
  })

  it('removing a mount clears its pixels', () => {
    const { page, s, frames } = setup()
    const m = s.mount(Fill, { level: 9 }, page.tiles.tl)
    s.commit()
    m.remove()
    s.commit()
    expect(frames.get('tl')!().get(0, 0)).toBe(0)
  })
})

function fakeHost(opts: { createOk?: boolean } = {}) {
  const calls: string[] = []
  let listener: ((e: RawEvent) => void) | null = null
  const host: Host = {
    async createPage(l: PageLayout) {
      calls.push(`create:${l.containerTotalNum}`)
      return opts.createOk ?? true
    },
    async rebuildPage(l: PageLayout) {
      calls.push(`rebuild:${l.containerTotalNum}`)
      return true
    },
    async sendImage(t) {
      calls.push(`img:${t.containerName}`)
      return 'success'
    },
    async updateText(t, c) {
      calls.push(`text:${t.containerName}:${c}`)
      return true
    },
    async shutDown(mode) {
      calls.push(`exit:${mode}`)
      return true
    },
    onEvent(cb) {
      listener = cb
      return () => (listener = null)
    },
  }
  return { host, calls, emit: (e: RawEvent) => listener?.(e) }
}

describe('G2', () => {
  it('creates the page, then sends tiles only after it resolves', async () => {
    const { host, calls } = fakeHost()
    const g2 = new G2(host, { sleep: noSleep })
    await g2.show(layouts.twoTilesWithList({ items: ['A'] }))
    g2.draw('left', Fill, { level: 5 })
    g2.draw('right', Fill, { level: 7 })
    await g2.settle()
    expect(calls).toEqual(['create:3', 'img:left', 'img:right'])
  })

  it('falls back to rebuild when create fails (WebView reload)', async () => {
    const { host, calls } = fakeHost({ createOk: false })
    const g2 = new G2(host, { sleep: noSleep })
    await g2.show(layouts.dashboardQuad())
    expect(calls).toEqual(['create:5', 'rebuild:5'])
    await g2.show(layouts.dashboardQuad({ captureUnder: 'tl' }))
    expect(calls.at(-1)).toBe('rebuild:5')
  })

  it('skips the rebuild when the new page has the same containers; redraws every tile', async () => {
    const { host, calls } = fakeHost()
    const g2 = new G2(host, { sleep: noSleep })
    const page = layouts.fullScreen()
    expect(await g2.show(page)).toBe('created')
    g2.drawSpan(page.span, Fill, { level: 3 })
    await g2.settle()
    calls.length = 0
    expect(await g2.show(layouts.fullScreen())).toBe('reused')
    g2.drawSpan(page.span, Fill, { level: 5 })
    await g2.settle()
    expect(calls.filter((c) => c.startsWith('rebuild'))).toEqual([])
    expect(calls.filter((c) => c.startsWith('img:')).length).toBe(4)
    expect(await g2.show(layouts.dashboardQuad())).toBe('rebuilt')
    expect(await g2.show(layouts.dashboardQuad(), { rebuild: 'always' })).toBe('rebuilt')
    expect(calls.filter((c) => c.startsWith('rebuild')).length).toBe(2)
  })

  it('redrawing the same tile updates in place: one send per change', async () => {
    const { host, calls } = fakeHost()
    const g2 = new G2(host, { sleep: noSleep })
    await g2.show(layouts.twoTilesWithControl())
    g2.draw('control', Fill, { level: 1 })
    await g2.settle()
    calls.length = 0
    g2.draw('control', Fill, { level: 2 })
    await g2.settle()
    g2.draw('control', Fill, { level: 2 })
    await g2.settle()
    expect(calls).toEqual(['img:control'])
  })

  it('routes normalised events and exits on double-tap by default', async () => {
    const { host, calls, emit } = fakeHost()
    const g2 = new G2(host, { sleep: noSleep })
    const seen: string[] = []
    g2.on('next', () => seen.push('next'))
    g2.on('select', (e) => seen.push(`select:${e.index}`))
    g2.on('*', (e) => seen.push(`*${e.type}`))
    emit({ textEvent: { eventType: 2 } })
    emit({ listEvent: { currentSelectItemIndex: 2 } })
    emit({ sysEvent: { eventType: 3 } })
    expect(seen).toEqual(['next', '*next', 'select:2', '*select', '*doubleTap'])
    expect(calls).toContain('exit:1')
  })

  it('foreground re-sends every tile', async () => {
    const { host, calls, emit } = fakeHost()
    const g2 = new G2(host, { sleep: noSleep })
    await g2.show(layouts.twoTilesWithList({ items: ['A'] }))
    g2.draw('left', Fill, { level: 3 })
    await g2.settle()
    calls.length = 0
    emit({ sysEvent: { eventType: 4 } })
    await g2.settle()
    expect(calls.sort()).toEqual(['img:left', 'img:right'])
  })

  it('modal sees events first: consumed ones stop there, the rest fall through (double-tap still exits)', () => {
    const { host, calls } = fakeHost()
    const g2 = new G2(host, { sleep: noSleep })
    const seen: string[] = []
    g2.on('*', (e) => seen.push(`app:${e.type}`))
    const release = g2.modal((e) => {
      seen.push(`modal:${e.type}`)
      return e.type === 'next'
    })
    expect(g2.hasModal).toBe(true)
    g2.dispatch({ type: 'next', from: 'text' })
    g2.dispatch({ type: 'doubleTap' })
    release()
    g2.dispatch({ type: 'next', from: 'text' })
    expect(seen).toEqual(['modal:next', 'modal:doubleTap', 'app:doubleTap', 'app:next'])
    expect(calls).toContain('exit:1')
    expect(g2.hasModal).toBe(false)
  })

  it('modals stack: the newest sees events first and may release itself while handling', () => {
    const { host } = fakeHost()
    const g2 = new G2(host, { sleep: noSleep })
    const seen: string[] = []
    g2.modal((e) => (seen.push(`outer:${e.type}`), true))
    const inner = g2.modal((e) => {
      seen.push(`inner:${e.type}`)
      inner()
      return true
    })
    g2.dispatch({ type: 'tap' })
    g2.dispatch({ type: 'tap' })
    expect(seen).toEqual(['inner:tap', 'outer:tap'])
  })

  it('setText runs through the queue without dropping frames', async () => {
    const { host, calls } = fakeHost()
    const g2 = new G2(host, { sleep: noSleep })
    await g2.show(layouts.heroSidebar())
    g2.draw('h0', Fill, { level: 3 })
    g2.commit()
    await g2.setText('sidebar', 'KPI 42')
    await g2.settle()
    expect(calls).toContain('text:sidebar:KPI 42')
    expect(calls.filter((c) => c.startsWith('img:')).length).toBe(4)
  })
})

describe('promptText', () => {
  const next: G2Event = { type: 'next', from: 'text' }
  const prev: G2Event = { type: 'prev', from: 'text' }
  const tap: G2Event = { type: 'tap' }
  const hold: G2Event = { type: 'hold' }
  async function setup() {
    const { host, calls } = fakeHost()
    const g2 = new G2(host, { sleep: noSleep })
    await g2.show(layouts.twoTilesWithControl())
    calls.length = 0
    // Let show() resolve and the keyboard draw, then wait for the sends.
    const flush = async () => {
      await new Promise((r) => setTimeout(r, 0))
      await g2.settle()
    }
    // One gesture at a time, each sent before the next (the queue would coalesce a burst).
    const send = async (...events: G2Event[]) => {
      for (const e of events) {
        g2.dispatch(e)
        await flush()
      }
    }
    return { g2, calls, flush, send }
  }
  const texts = (calls: string[]) => calls.filter((c) => c.startsWith('text:'))

  // Rows: [a b c] [d e f] [space delete submit].
  const tiny = { letters: ['abc', 'def'], symbols: false, actions: ['space', 'delete', 'submit'] } as const

  it('text keyboard (default): focus moves are text updates only, the frames are drawn once', async () => {
    const { g2, calls, flush, send } = await setup()
    const result = promptText(g2, { value: 'a', label: 'Name', keyboard: tiny })
    await flush()
    // Skeleton, two frame tiles, the typed-text box and the keys box; the frames go out once.
    expect(calls[0]).toBe('rebuild:5')
    expect(calls.filter((c) => c.startsWith('img:')).sort()).toEqual(['img:s0', 'img:s1'])
    const keys = (cs: string[]) => cs.filter((c) => c.startsWith('text:keys:')).map((c) => c.slice('text:keys:'.length))
    expect(keys(calls).at(-1)!.split('\n')[0]).toMatch(/［ａ　ｂ　ｃ］/) // row 0 chosen
    calls.length = 0
    // Row 1, open it (d), next key (e), type it: no image sends at all.
    await send(next, tap, next)
    expect(calls.filter((c) => c.startsWith('img:'))).toEqual([])
    expect(keys(calls).at(-1)!.split('\n')[1]).toContain('［ｅ］')
    await send(tap)
    expect(calls.filter((c) => c.startsWith('text:text:')).at(-1)).toContain('Name: ae_')
    await send(next, tap, next, next, tap)
    await expect(result).resolves.toBe('ae')
    expect(g2.hasModal).toBe(false)
  })

  it('text keyboard falls back to the drawn one when the layout is too wide', async () => {
    const { g2, calls, flush, send } = await setup()
    const result = promptText(g2, { keyboard: { panels: 'side' } })
    await flush()
    expect(calls[0]).toBe('rebuild:3') // textWithSpan
    await send(hold)
    await expect(result).resolves.toBeNull()
  })

  it('rebuilds to text + one tile, types into the text container, resolves the text on submit', async () => {
    const { g2, calls, flush, send } = await setup()
    const result = promptText(g2, { value: 'a', label: 'Name', keyboard: tiny, style: 'drawn' })
    await flush()
    expect(calls).toEqual(['rebuild:2', 'img:tile'])
    calls.length = 0
    // Row 1, open it (d), next key (e), type it: one tile send per gesture, the text line updates.
    await send(next, tap, next, tap)
    expect(calls.filter((c) => c.startsWith('img:')).length).toBe(4)
    expect(texts(calls).at(-1)).toContain('Name: ae_')
    expect(texts(calls).at(-1)).toContain('swipe: pick a row')
    // Typing went back to choosing rows: down to the action row, open it, move to submit.
    await send(next, tap, next, next, tap)
    await expect(result).resolves.toBe('ae')
    expect(g2.hasModal).toBe(false)
  })

  it('delete stays on its key, maxLength caps typing, space types a space', async () => {
    const { g2, calls, flush, send } = await setup()
    const result = promptText(g2, { value: 'abc', maxLength: 3, hints: false, keyboard: tiny, style: 'drawn' })
    await flush()
    await send(tap, tap) // row 0, key a: already at maxLength
    expect(texts(calls)).toEqual([])
    await send(hold, prev, tap, next, tap) // action row → delete
    expect(texts(calls).at(-1)).toBe('text:text:> ab_')
    await send(prev, tap) // space
    expect(texts(calls).at(-1)).toBe('text:text:> ab _')
    await send(tap, next, next, tap) // reopen (lands on space), submit
    await expect(result).resolves.toBe('ab ')
  })

  it('symbols beside the letters use a two-tile span', async () => {
    const { g2, calls, flush, send } = await setup()
    const result = promptText(g2, { keyboard: { panels: 'side' } })
    await flush()
    expect(calls[0]).toBe('rebuild:3')
    expect(calls.filter((c) => c.startsWith('img:')).sort()).toEqual(['img:s0', 'img:s1'])
    calls.length = 0
    // The letters cross the tile seam, so a row move redraws both tiles (and nothing else).
    await send(next)
    expect(calls.sort()).toEqual(['img:s0', 'img:s1'])
    await send(hold)
    await expect(result).resolves.toBeNull()
  })
  it('hold at row level cancels with null; double-tap falls through to the exit prompt', async () => {
    const { g2, calls, flush, send } = await setup()
    const result = promptText(g2)
    await flush()
    await send({ type: 'doubleTap' })
    expect(calls).toContain('exit:1')
    await send(hold)
    await expect(result).resolves.toBeNull()
    expect(g2.hasModal).toBe(false)
  })

  it('an abort signal resolves null', async () => {
    const { g2, flush } = await setup()
    const ac = new AbortController()
    const result = promptText(g2, { signal: ac.signal })
    await flush()
    ac.abort()
    await expect(result).resolves.toBeNull()
    expect(g2.hasModal).toBe(false)
  })
})

describe('TextArea / g2.textArea', () => {
  it('composes slots into one text update, skips unchanged content and coalesces bursts', async () => {
    const sent: string[] = []
    let release: (() => void) | null = null
    const area = new TextArea(async (c) => {
      sent.push(c)
      await new Promise<void>((r) => (release = r))
      return true
    }, ' ')
    area.set('title', 'Upload').draw('bar', TextProgress, { value: 0.5, width: 4, glyphs: 'ascii' })
    await Promise.resolve()
    expect(sent).toEqual(['Upload\n[##--] 50%'])
    // Three changes while the first update is in flight: one follow-up with the latest.
    area.draw('bar', TextProgress, { value: 0.75, width: 4, glyphs: 'ascii' })
    area.draw('bar', TextProgress, { value: 1, width: 4, glyphs: 'ascii' })
    area.set('title', 'Done')
    await Promise.resolve()
    release!()
    await new Promise((r) => setTimeout(r, 0))
    expect(sent).toEqual(['Upload\n[##--] 50%', 'Done\n[####] 100%'])
    release!()
    await area.flush()
    // Same content again: no update.
    area.set('title', 'Done')
    await area.flush()
    expect(sent).toHaveLength(2)
    // Custom layout: spinner inline with a title.
    area.layout((p) => `${p.title} ${p.bar}`)
    const done = area.flush()
    release!()
    await done
    expect(sent.at(-1)).toBe('Done [####] 100%')
  })

  it('g2.textArea updates a text container by name through setText, and resets on show()', async () => {
    const { host, calls } = fakeHost()
    const g2 = new G2(host, { sleep: noSleep })
    const page = layouts.textBoxes({ boxes: [{ name: 'status', h: 60 }, { name: 'volume', h: 40 }], tile: { w: 288, h: 144 } })
    await g2.show(page)
    calls.length = 0
    g2.textArea('status').draw('spin', TextSpinner, { frame: 1, label: 'Syncing', glyphs: 'ascii' })
    g2.textArea(page.boxes.volume).draw('v', TextSlider, { label: 'Volume', value: 40, focused: true, width: 6, glyphs: 'ascii' })
    await g2.settle()
    expect(calls).toEqual(['text:status:Syncing /', 'text:volume:> Volume [==o---] 40'])
    expect(g2.textArea('status')).toBe(g2.textArea('status'))
    // The initial layout content counts as shown: an area set to the same text sends nothing.
    await g2.show(layouts.textWithTile({ text: 'hello' }))
    calls.length = 0
    g2.textArea('text').set('t', 'hello')
    await g2.settle()
    expect(calls).toEqual([])
  })

  it('textBoxes: first box captures, heights must fit above the tile', () => {
    const page = layouts.textBoxes({ boxes: [{ name: 'a', h: 100 }, { name: 'b', h: 44 }], tile: { w: 288, h: 144 } })
    const texts = page.layout.textObject!
    expect(texts.map((t) => [t.containerName, t.isEventCapture])).toEqual([['a', 1], ['b', 0]])
    expect(page.boxes.b.id).toBe(11)
    expect(() => layouts.textBoxes({ boxes: [{ name: 'a', h: 200 }], tile: { w: 288, h: 144 } })).toThrow(RangeError)
  })
})
