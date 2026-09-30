/**
 * Tile spanning: draw one logical framebuffer (e.g. 576×288) and split it into
 * ≤ 4 image tiles of ≤ 288×144. Tracks what was last sent per tile so only
 * changed tiles are re-sent (each send costs ~350 ms on glasses).
 */
import { TILE_H, TILE_W } from './component.js'
import { Framebuffer } from './framebuffer.js'
import type { Rect } from './geometry.js'

/** Split a w×h region into a grid of tiles no larger than maxW×maxH, as even as possible. */
export function gridTiles(w: number, h: number, maxW = TILE_W, maxH = TILE_H): Rect[] {
  const cols = Math.ceil(w / maxW)
  const rows = Math.ceil(h / maxH)
  const out: Rect[] = []
  for (let r = 0; r < rows; r++) {
    const y0 = Math.round((r * h) / rows)
    const y1 = Math.round(((r + 1) * h) / rows)
    for (let c = 0; c < cols; c++) {
      const x0 = Math.round((c * w) / cols)
      const x1 = Math.round(((c + 1) * w) / cols)
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })
    }
  }
  return out
}

export class TiledCanvas {
  readonly fb: Framebuffer
  private sent: Array<Framebuffer | null>

  /**
   * @param tiles tile rects in logical coordinates; default: an even grid.
   */
  constructor(
    width: number,
    height: number,
    readonly tiles: readonly Rect[] = gridTiles(width, height),
  ) {
    for (const t of tiles)
      if (t.w > TILE_W || t.h > TILE_H) throw new RangeError(`tile ${t.w}×${t.h} exceeds ${TILE_W}×${TILE_H}`)
    this.fb = new Framebuffer(width, height)
    this.sent = tiles.map(() => null)
  }

  /** Pixels of tile `i` as its own framebuffer. */
  tile(i: number): Framebuffer {
    return this.fb.crop(this.tiles[i])
  }

  /** Indices of tiles whose pixels differ from what was last marked sent. */
  changed(): number[] {
    const out: number[] = []
    this.tiles.forEach((_, i) => {
      const prev = this.sent[i]
      if (!prev || !prev.equals(this.tile(i))) out.push(i)
    })
    return out
  }

  /** Record tile `i` as sent with its current pixels (or with `frame`). */
  markSent(i: number, frame: Framebuffer = this.tile(i)): void {
    this.sent[i] = frame
  }

  /** Forget what was sent (after a page rebuild everything must be re-sent). */
  invalidate(): void {
    this.sent = this.tiles.map(() => null)
  }

  /** Tiles overlapping a logical rect. */
  tilesIn(r: Rect): number[] {
    return this.tiles.flatMap((t, i) => (t.x < r.x + r.w && r.x < t.x + t.w && t.y < r.y + r.h && r.y < t.y + t.h ? [i] : []))
  }
}
