/**
 * Retained layer. A Surface owns one logical 576×288 canvas covered by up to
 * four image tiles. Components are mounted at canvas rects (possibly spanning
 * tiles); updating one marks its rect dirty; `commit()` re-renders only the
 * dirty rects and hands only tiles whose pixels actually changed to the sink
 * (normally the ImageQueue). One gesture → one tile redraw is the goal: four
 * tiles cost ~400 ms.
 */
import type { Component } from '../core/component.js'
import { Framebuffer } from '../core/framebuffer.js'
import { intersect, isEmpty, overlaps, union, type Rect } from '../core/geometry.js'
import { defaultTheme, type Theme } from '../core/theme.js'
import { CANVAS_H, CANVAS_W, type TileRef } from './pageBuilder.js'

export type TileSink = (tile: TileRef, render: () => Framebuffer) => void

/** Where to mount: a tile (whole or a local sub-rect) or a canvas rect. */
export type MountAt = TileRef | { tile: TileRef; rect?: Rect } | { rect: Rect }

export interface Mounted<P> {
  readonly rect: Rect
  readonly props: P
  /** Merge a partial update (or map the old props) and mark dirty. */
  update(next: Partial<P> | ((prev: P) => P)): void
  /** Replace props and mark dirty. */
  set(next: P): void
  /** Force a redraw with unchanged props (e.g. time-based components). */
  touch(): void
  remove(): void
}

interface Mount {
  rect: Rect
  draw: (fb: Framebuffer, rect: Rect) => void
}

function resolveAt(at: MountAt): Rect {
  if ('id' in at) return { ...at.rect }
  if ('tile' in at) {
    const t = at.tile.rect
    return at.rect ? { x: t.x + at.rect.x, y: t.y + at.rect.y, w: at.rect.w, h: at.rect.h } : { ...t }
  }
  return { ...at.rect }
}

export class Surface {
  readonly canvas = new Framebuffer(CANVAS_W, CANVAS_H)
  private mounts: Mount[] = []
  private dirty: Rect | null = null
  /** What each tile will show once the queue drains (null = unknown). */
  private expected = new Map<number, Framebuffer | null>()
  private tiles: TileRef[]

  constructor(
    tiles: readonly TileRef[],
    private readonly sink: TileSink,
    private readonly theme: Theme = defaultTheme,
  ) {
    this.tiles = [...tiles]
  }

  get tileList(): readonly TileRef[] {
    return this.tiles
  }

  /** New page: drop all mounts, clear the canvas, forget what was sent. */
  reset(tiles: readonly TileRef[]): void {
    this.tiles = [...tiles]
    this.mounts = []
    this.canvas.clear(0)
    this.expected.clear()
    this.dirty = null
  }

  /** After a rebuild of the same page: everything must be re-sent. */
  invalidate(): void {
    this.expected.clear()
    this.markDirty({ x: 0, y: 0, w: CANVAS_W, h: CANVAS_H })
  }

  /** A send failed: the tile's content on the glasses is unknown. */
  forget(tileId: number): void {
    this.expected.set(tileId, null)
    const t = this.tiles.find((x) => x.id === tileId)
    if (t) this.markDirty(t.rect)
  }

  markDirty(r: Rect): void {
    this.dirty = union(this.dirty, r)
  }

  /** Mount a component. Later mounts draw on top of earlier ones. */
  mount<P>(component: Component<P>, props: P, at: MountAt, theme: Theme = this.theme): Mounted<P> {
    let current = props
    const rect = resolveAt(at)
    const m: Mount = { rect, draw: (fb, r) => component.render(fb, r, current, theme) }
    this.mounts.push(m)
    this.markDirty(rect)
    const self = this
    return {
      rect,
      get props() {
        return current
      },
      update(next) {
        current = typeof next === 'function' ? next(current) : { ...current, ...next }
        self.markDirty(rect)
      },
      set(next) {
        current = next
        self.markDirty(rect)
      },
      touch() {
        self.markDirty(rect)
      },
      remove() {
        const i = self.mounts.indexOf(m)
        if (i >= 0) self.mounts.splice(i, 1)
        self.markDirty(rect)
      },
    }
  }

  /** Mount a raw draw function (escape hatch for custom drawing). */
  mountDraw(draw: (fb: Framebuffer, rect: Rect) => void, at: MountAt): Mounted<null> {
    return this.mount({ name: 'draw', size: { w: 0, h: 0 }, render: (fb, r) => fb.withClip(r, () => draw(fb, r)), renderToTile: () => new Framebuffer(1, 1) }, null, at)
  }

  /**
   * Re-render dirty rects and send changed tiles. Returns the tiles handed to
   * the sink (empty when nothing visible changed).
   */
  commit(): TileRef[] {
    const d = this.dirty
    this.dirty = null
    if (d && !isEmpty(d)) {
      const r = intersect(d, this.canvas.bounds)
      this.canvas.withClip(r, () => {
        this.canvas.clear(0)
        for (const m of this.mounts) if (overlaps(m.rect, r)) this.canvas.withClip(m.rect, () => m.draw(this.canvas, m.rect))
      })
    }
    const sent: TileRef[] = []
    for (const t of this.tiles) {
      const frame = this.canvas.crop(t.rect)
      const prev = this.expected.get(t.id)
      if (prev && prev.equals(frame)) continue
      this.expected.set(t.id, frame)
      this.sink(t, () => this.canvas.crop(t.rect))
      sent.push(t)
    }
    return sent
  }
}
