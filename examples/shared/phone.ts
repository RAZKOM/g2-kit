/**
 * Phone-side helpers shared by the examples:
 *  - start(): connect to the Even App bridge, or (with ?mock, or when no bridge
 *    appears) a keyboard-driven mock host, so the example also runs in a
 *    normal browser.
 *  - Mirror: draws the frames actually sent to the glasses (and outlines of
 *    firmware text/list containers) on a canvas on the phone page.
 */
import { Framebuffer, type Rect } from 'g2-kit/core'
import { G2, connect, type G2Event, type G2Options, type Host, type ImageTarget, type PageLayout, type RawEvent } from 'g2-kit/bridge'

const W = 576
const H = 288

export class Mirror {
  private ctx: CanvasRenderingContext2D
  private tiles = new Map<number, Rect>()
  private layout: PageLayout | null = null
  private logEl: HTMLElement | null
  private statsEl: HTMLElement | null
  private sent = 0

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = W
    canvas.height = H
    this.ctx = canvas.getContext('2d')!
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, W, H)
    this.logEl = document.getElementById('log')
    this.statsEl = document.getElementById('stats')
  }

  setLayout(layout: PageLayout): void {
    this.layout = layout
    this.tiles.clear()
    for (const im of layout.imageObject ?? []) this.tiles.set(im.containerID as number, { x: im.xPosition as number, y: im.yPosition as number, w: im.width as number, h: im.height as number })
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, W, H)
    this.drawFirmwareContainers()
  }

  private drawFirmwareContainers(): void {
    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = 'rgba(0,255,0,0.25)'
    ctx.setLineDash([3, 3])
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(0,255,0,0.8)'
    for (const t of [...(this.layout?.textObject ?? []), ...(this.layout?.listObject ?? [])]) {
      const x = t.xPosition as number
      const y = t.yPosition as number
      ctx.strokeRect(x + 0.5, y + 0.5, (t.width as number) - 1, (t.height as number) - 1)
      const content = (t.content as string | undefined)?.trim()
      const items = (t.itemContainer as { itemName?: string[] } | undefined)?.itemName
      const lines = content ? content.split('\n') : (items ?? [])
      lines.slice(0, 18).forEach((l, i) => ctx.fillText(l, x + 6, y + 16 + i * 15))
    }
    ctx.restore()
  }

  /** Mock only: repaint one firmware text container after textContainerUpgrade (images stay). */
  redrawText(id: number): void {
    const t = this.layout?.textObject?.find((x) => x.containerID === id)
    if (!t) return
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(t.xPosition as number, t.yPosition as number, t.width as number, t.height as number)
    this.drawFirmwareContainers()
  }

  /** Mock only: outline the native list's highlighted item (the firmware draws this on the glasses). */
  setListHighlight(index: number): void {
    const list = this.layout?.listObject?.find((l) => l.isEventCapture === 1)
    if (!list) return
    const x = list.xPosition as number
    const y = list.yPosition as number
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(x, y, list.width as number, list.height as number)
    this.drawFirmwareContainers()
    this.ctx.save()
    this.ctx.strokeStyle = '#0f0'
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(x + 2, y + 4 + index * 15, (list.width as number) - 4, 16)
    this.ctx.restore()
  }

  /** Paint a sent frame at its container position. */
  frame(target: ImageTarget, fb: Framebuffer | null): void {
    this.sent++
    const r = this.tiles.get(target.containerID)
    if (!r || !fb) return
    const img = this.ctx.createImageData(fb.width, fb.height)
    for (let i = 0; i < fb.data.length; i++) {
      const g = Math.round((fb.data[i] / 15) * 255)
      img.data[i * 4] = 0
      img.data[i * 4 + 1] = g
      img.data[i * 4 + 2] = 0
      img.data[i * 4 + 3] = 255
    }
    this.ctx.putImageData(img, r.x, r.y)
    if (this.statsEl) this.statsEl.textContent = `frames sent: ${this.sent}`
  }

  private renders: number[] = []
  renderTime(ms: number, tiles: number): void {
    this.renders.push(ms / Math.max(1, tiles))
    if (this.renders.length > 50) this.renders.shift()
    const sorted = [...this.renders].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    if (this.statsEl) this.statsEl.textContent = `frames sent: ${this.sent} · render ${ms.toFixed(1)} ms for ${tiles} tile(s) · median ${median.toFixed(1)} ms/tile`
  }

  log(text: string): void {
    if (!this.logEl) return
    const line = document.createElement('div')
    line.textContent = `${new Date().toLocaleTimeString()}  ${text}`
    this.logEl.prepend(line)
    while (this.logEl.childElementCount > 40) this.logEl.lastElementChild?.remove()
  }
}

/**
 * Mock host for plain browsers. Keys: ↓/↑ swipe, Enter tap, D double-tap,
 * H hold (release on key up), M menu. For a capturing list, ↓/↑ move a
 * simulated firmware highlight (no event, like the real list) and Enter taps.
 */
export function mockHost(mirror: Mirror): Host {
  let listener: ((e: RawEvent) => void) | null = null
  let layout: PageLayout | null = null
  let listIndex = 0
  const capture = () => {
    const list = layout?.listObject?.find((l) => l.isEventCapture === 1)
    return list ? { kind: 'list' as const, items: (list.itemContainer as { itemName: string[] }).itemName } : { kind: 'text' as const, items: [] }
  }
  const emit = (e: RawEvent) => listener?.(e)
  const swipe = (down: boolean) => {
    const cap = capture()
    if (cap.kind === 'list') {
      // Like the firmware: the highlight moves, the app gets no event.
      listIndex = Math.max(0, Math.min(cap.items.length - 1, listIndex + (down ? 1 : -1)))
      mirror.setListHighlight(listIndex)
    } else emit({ textEvent: { eventType: down ? 2 : 1 } })
  }
  const tap = () => {
    if (capture().kind === 'list') emit({ listEvent: listIndex ? { currentSelectItemIndex: listIndex } : {} })
    else emit({ sysEvent: {} })
  }
  const doubleTap = () => emit({ sysEvent: { eventType: 3 } })
  const holdStart = () => emit({ sysEvent: { eventType: 9 } })
  const holdEnd = () => emit({ sysEvent: { eventType: 10 } })

  window.addEventListener('keydown', (k) => {
    if (k.repeat && k.key.toLowerCase() === 'h') return
    if (k.key === 'ArrowDown' || k.key === 'ArrowUp') swipe(k.key === 'ArrowDown')
    else if (k.key === 'Enter') tap()
    else if (k.key === 'd') doubleTap()
    else if (k.key === 'h') holdStart()
    else return
    k.preventDefault()
  })
  window.addEventListener('keyup', (k) => {
    if (k.key === 'h') holdEnd()
  })

  // On-screen touchpad for phones and mouse users.
  const bar = document.createElement('div')
  bar.className = 'pad'
  const button = (label: string, title: string, down: () => void, up?: () => void) => {
    const b = document.createElement('button')
    b.textContent = label
    b.title = title
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      down()
    })
    if (up) {
      b.addEventListener('pointerup', up)
      b.addEventListener('pointerleave', (e) => e.buttons && up())
    }
    bar.append(b)
  }
  button('▲ swipe up', 'Swipe up (↑)', () => swipe(false))
  button('▼ swipe down', 'Swipe down (↓)', () => swipe(true))
  button('● tap', 'Tap (Enter)', tap)
  button('●● double', 'Double-tap (D): exit prompt', doubleTap)
  button('▬ hold', 'Hold (H): press and release', holdStart, holdEnd)
  document.getElementById('mirror')?.after(bar)

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
  return {
    async createPage(l) {
      layout = l
      listIndex = 0
      mirror.setLayout(l)
      mirror.setListHighlight(0)
      return true
    },
    async rebuildPage(l) {
      layout = l
      listIndex = 0
      mirror.setLayout(l)
      mirror.setListHighlight(0)
      return true
    },
    async sendImage() {
      await delay(90) // roughly the BLE cost of one image
      return 'success'
    },
    async updateText(t, content) {
      const c = layout?.textObject?.find((x) => x.containerID === t.containerID)
      if (c) c.content = content
      mirror.redrawText(t.containerID)
      return true
    },
    async shutDown(mode) {
      mirror.log(`shutDownPageContainer(${mode}) → exit prompt`)
      return true
    },
    onEvent(cb) {
      listener = cb
      return () => (listener = null)
    },
  }
}

/** Connect to the glasses (or a mock) with the mirror wired in. */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

/** Show uncaught errors on the phone page: the WebView has no visible console. */
function surfaceErrors(mirror: Mirror): void {
  const status = document.getElementById('status')
  const show = (what: string) => {
    mirror.log(`error: ${what}`)
    if (status) status.textContent = `Error: ${what}`
  }
  window.addEventListener('error', (e) => show(e.message))
  window.addEventListener('unhandledrejection', (e) => show(e.reason instanceof Error ? e.reason.message : String(e.reason)))
}

export async function start(opts: G2Options = {}): Promise<{ g2: G2; mirror: Mirror; mock: boolean }> {
  const mirror = new Mirror(document.getElementById('mirror') as HTMLCanvasElement)
  surfaceErrors(mirror)
  const status = document.getElementById('status')
  const q = new URLSearchParams(location.search)
  const hasBridge = () => typeof (window as unknown as { flutter_inappwebview?: unknown }).flutter_inappwebview !== 'undefined'
  const onFrame: G2Options['onFrame'] = (t, _b, fb) => mirror.frame(t, fb)
  const base: G2Options = {
    ...opts,
    onFrame,
    onError: (e) => mirror.log(`error: ${e.message}`),
    // Render time on this phone: the target is < 10 ms per 288×144 tile so BLE, not rendering, is the bottleneck.
    onCommit: ({ ms, tiles }) => mirror.renderTime(ms, tiles.length),
  }
  let g2: G2
  let mock = q.has('mock')
  if (!mock) {
    // The bridge is injected by the Even App / simulator WebView. Give it a moment.
    for (let i = 0; i < 20 && !hasBridge(); i++) await new Promise((r) => setTimeout(r, 100))
    mock = !hasBridge()
  }
  if (mock) {
    if (location.pathname.includes('/demos/')) {
      const back = document.createElement('a')
      back.href = '../../'
      back.textContent = '← all components and demos'
      document.querySelector('h1')?.before(back)
    }
    g2 = new G2(mockHost(mirror), base)
    if (status) status.textContent = 'Running in your browser with a mock host (no glasses). Use the buttons below the display, or ↓/↑ swipe · Enter tap · D double-tap · H hold.'
  } else {
    if (status) status.textContent = 'Connecting to your glasses…'
    try {
      g2 = await withTimeout(connect(base), 15000, 'no answer from the Even App bridge after 15 s')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (status) status.textContent = `Could not connect: ${msg}. Reload the page; if it persists, restart the dev server.`
      mirror.log(`connect failed: ${msg}`)
      throw err
    }
    if (status) status.textContent = 'Connected. Use the glasses touchpad.'
  }
  // Keep the mirror's layout in sync with every page shown.
  const show = g2.show.bind(g2)
  g2.show = async (page) => {
    mirror.setLayout(page.layout)
    return show(page)
  }
  g2.on('*', (e: G2Event) => {
    const extra = e.type === 'select' ? ` index=${e.index}` : e.type === 'menu' ? ` item=${e.itemID}` : ''
    mirror.log(`event: ${e.type}${extra}`)
    console.log(`[g2-kit example] event ${e.type}${extra}`)
  })
  return { g2, mirror, mock }
}
