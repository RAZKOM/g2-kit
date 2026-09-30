/**
 * G2: the one object an app talks to. Wraps a Host (the SDK bridge, or a fake
 * in tests), the ImageQueue and a Surface.
 *
 *   const g2 = await connect()
 *   await g2.show(layouts.twoTilesWithList({ items: ['Refresh'] }))
 *   g2.draw('left', BarChart, { data })
 *   g2.on('select', (e) => ...)
 */
import type { Component } from '../core/component.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Rect } from '../core/geometry.js'
import { defaultTheme, type Theme } from '../core/theme.js'
import type { TileFormat } from '../core/encode.js'
import type { ImageSendError, ImageTarget } from './errors.js'
import { normalizeEvent, type G2Event, type G2EventType, type NormalizeOptions, type RawEvent } from './events.js'
import { ImageQueue, type Sleep } from './imageQueue.js'
import type { Page, PageLayout, TileRef } from './pageBuilder.js'
import { Surface, type Mounted } from './surface.js'

/** Everything g2-kit needs from the platform. `sdkHost()` builds one from the real bridge. */
export interface Host {
  createPage(layout: PageLayout): Promise<boolean>
  rebuildPage(layout: PageLayout): Promise<boolean>
  /** Returns the SDK's ImageRawDataUpdateResult (or anything `toImageResult` understands). */
  sendImage(target: ImageTarget, bytes: Uint8Array): Promise<unknown>
  updateText?(target: { containerID: number; containerName: string }, content: string): Promise<boolean>
  /** 1 = show the system exit confirmation (required on the root page). */
  shutDown(mode: 0 | 1): Promise<boolean>
  onEvent(cb: (raw: RawEvent) => void): () => void
}

export interface G2Options extends NormalizeOptions {
  theme?: Theme
  /** Image encoding (default 'png', the proven path). */
  format?: TileFormat
  gapMs?: number
  retryMs?: number
  sleep?: Sleep
  /** Called with every frame that reached the glasses (phone-side mirror). */
  onFrame?: (tile: ImageTarget, bytes: Uint8Array, frame: Framebuffer | null) => void
  onError?: (err: ImageSendError | Error) => void
  /** Called after each commit with the render time and the tiles queued. */
  onCommit?: (info: { ms: number; tiles: TileRef[] }) => void
  /** Commit automatically in a microtask after `draw`/`update` (default true). */
  autoCommit?: boolean
  /**
   * Handle double-tap by showing the system exit prompt (default true).
   * Official guidance: double-tap must always reach the exit prompt.
   */
  doubleTapExits?: boolean
}

type Handler<T extends G2EventType> = (e: Extract<G2Event, { type: T }>) => void

export class G2 {
  readonly queue: ImageQueue
  readonly surface: Surface
  page: Page | null = null
  private created = false
  private handlers = new Map<string, Set<(e: G2Event) => void>>()
  private named = new Map<string, { component: Component<unknown>; mounted: Mounted<unknown> }>()
  private commitScheduled = false
  private unsubscribe: (() => void) | null = null
  readonly theme: Theme

  constructor(
    readonly host: Host,
    private readonly opts: G2Options = {},
  ) {
    this.theme = opts.theme ?? defaultTheme
    this.queue = new ImageQueue(host.sendImage.bind(host), {
      gapMs: opts.gapMs,
      retryMs: opts.retryMs,
      format: opts.format,
      sleep: opts.sleep,
      onSent: opts.onFrame,
      onError: (err) => {
        this.surface.forget(err.target.containerID)
        if (opts.onError) opts.onError(err)
        else console.warn('[g2-kit]', err.message)
      },
    })
    this.surface = new Surface([], (tile, render) => this.queue.image({ containerID: tile.id, containerName: tile.name }, render), this.theme)
    this.unsubscribe = host.onEvent((raw) => this.handleRaw(raw))
  }

  /**
   * Show a page. The first call creates the startup page (falling back to a
   * rebuild after a WebView reload, when create fails); later calls rebuild.
   * Image pixels are sent only after the layout call resolves.
   */
  async show(page: Page): Promise<void> {
    this.page = page
    this.named.clear()
    this.surface.reset(page.tileList)
    await this.queue.op(async () => {
      if (!this.created) {
        this.created = true
        if (await this.host.createPage(page.layout)) return
        // A WebView reload leaves the startup page in place, so create fails: rebuild over it.
        if (await this.host.rebuildPage(page.layout)) return
        throw new Error('createStartUpPageContainer and rebuildPageContainer both failed')
      }
      if (!(await this.host.rebuildPage(page.layout))) throw new Error('rebuildPageContainer failed')
    })
  }

  /** Re-send every tile (e.g. after returning to the foreground). */
  redraw(): void {
    this.surface.invalidate()
    this.scheduleCommit()
  }

  tile(ref: string | TileRef): TileRef {
    if (typeof ref !== 'string') return ref
    const t = this.page?.tiles[ref]
    if (!t) throw new Error(`no tile '${ref}' on the current page (have: ${Object.keys(this.page?.tiles ?? {}).join(', ') || 'none'})`)
    return t
  }

  /**
   * Draw a component on a tile (or a sub-rect of it). Calling again with the
   * same tile/key updates props; only changed tiles are sent.
   */
  draw<P>(at: string | TileRef, component: Component<P>, props: P, opts: { rect?: Rect; key?: string; theme?: Theme } = {}): Mounted<P> {
    const tile = this.tile(at)
    const key = opts.key ?? `${tile.name}${opts.rect ? `@${opts.rect.x},${opts.rect.y},${opts.rect.w},${opts.rect.h}` : ''}`
    const existing = this.named.get(key)
    if (existing && existing.component === component) {
      ;(existing.mounted as Mounted<P>).set(props)
      return existing.mounted as Mounted<P>
    }
    existing?.mounted.remove()
    const mounted = this.wrap(this.surface.mount(component, props, { tile, rect: opts.rect }, opts.theme ?? this.theme))
    this.named.set(key, { component: component as Component<unknown>, mounted: mounted as Mounted<unknown> })
    this.scheduleCommit()
    return mounted
  }

  /** Draw one component across a canvas rect that spans several tiles (tile spanning). */
  drawSpan<P>(rect: Rect, component: Component<P>, props: P, opts: { key?: string; theme?: Theme } = {}): Mounted<P> {
    const key = opts.key ?? `span@${rect.x},${rect.y},${rect.w},${rect.h}`
    const existing = this.named.get(key)
    if (existing && existing.component === component) {
      ;(existing.mounted as Mounted<P>).set(props)
      return existing.mounted as Mounted<P>
    }
    existing?.mounted.remove()
    const mounted = this.wrap(this.surface.mount(component, props, { rect }, opts.theme ?? this.theme))
    this.named.set(key, { component: component as Component<unknown>, mounted: mounted as Mounted<unknown> })
    this.scheduleCommit()
    return mounted
  }

  /** Mounted handles from `draw` auto-commit on update. */
  private wrap<P>(m: Mounted<P>): Mounted<P> {
    const self = this
    return {
      get rect() {
        return m.rect
      },
      get props() {
        return m.props
      },
      update(next) {
        m.update(next)
        self.scheduleCommit()
      },
      set(next) {
        m.set(next)
        self.scheduleCommit()
      },
      touch() {
        m.touch()
        self.scheduleCommit()
      },
      remove() {
        m.remove()
        self.scheduleCommit()
      },
    }
  }

  /** Render dirty rects now and queue changed tiles. */
  commit(): TileRef[] {
    this.commitScheduled = false
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const tiles = this.surface.commit()
    if (this.opts.onCommit && tiles.length) this.opts.onCommit({ ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0, tiles })
    return tiles
  }

  private scheduleCommit(): void {
    if (this.opts.autoCommit === false || this.commitScheduled) return
    this.commitScheduled = true
    queueMicrotask(() => {
      if (this.commitScheduled) this.commit()
    })
  }

  /** Replace a firmware text container's content (e.g. the hero sidebar). Does not drop queued frames. */
  async setText(target: string | { id: number; name: string }, content: string): Promise<boolean> {
    if (!this.host.updateText) throw new Error('host does not support textContainerUpgrade')
    const t = typeof target === 'string' ? this.findContainer(target) : target
    let ok = false
    await this.queue.op(async () => {
      ok = await this.host.updateText!({ containerID: t.id, containerName: t.name }, content)
    }, { dropFrames: false })
    return ok
  }

  private findContainer(name: string): { id: number; name: string } {
    const layout = this.page?.layout
    for (const list of [layout?.textObject, layout?.listObject, layout?.imageObject])
      for (const c of list ?? []) if (c.containerName === name) return { id: c.containerID as number, name }
    throw new Error(`no container '${name}' on the current page`)
  }

  /** Subscribe to a normalised event type ('*' for all). Returns an unsubscribe function. */
  on<T extends G2EventType>(type: T, fn: Handler<T>): () => void
  on(type: '*', fn: (e: G2Event) => void): () => void
  on(type: string, fn: (e: never) => void): () => void {
    const set = this.handlers.get(type) ?? new Set()
    set.add(fn as (e: G2Event) => void)
    this.handlers.set(type, set)
    return () => set.delete(fn as (e: G2Event) => void)
  }

  /** Feed a raw SDK event (done automatically for host events). */
  handleRaw(raw: RawEvent): G2Event {
    const e = normalizeEvent(raw, this.opts)
    this.dispatch(e)
    return e
  }

  /** Dispatch an already-normalised event (tests, simulators, replay). */
  dispatch(e: G2Event): void {
    if (e.type === 'ignore') return
    if (e.type === 'foreground') this.redraw()
    if (e.type === 'doubleTap' && this.opts.doubleTapExits !== false && !this.handlers.get('doubleTap')?.size) void this.exit()
    for (const fn of this.handlers.get(e.type) ?? []) fn(e)
    for (const fn of this.handlers.get('*') ?? []) fn(e)
  }

  /** Show the system exit confirmation (mode 1, required from the root page). */
  exit(mode: 0 | 1 = 1): Promise<boolean> {
    return this.host.shutDown(mode)
  }

  /** Wait until every queued frame and op has been sent. */
  settle(): Promise<void> {
    if (this.commitScheduled) this.commit()
    return this.queue.idle()
  }

  dispose(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.queue.clear()
  }
}
