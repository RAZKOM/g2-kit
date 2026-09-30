import { intersect, type Rect } from './geometry.js'

/** Highest level. Level 0 is "off" (see-through on the glasses). */
export const MAX_LEVEL = 15

/**
 * 4-bit greyscale framebuffer: one byte per pixel, values 0 (off) to 15 (full).
 * Every write goes through the current clip rect, so a component can never draw
 * outside the rect it was given.
 */
export class Framebuffer {
  readonly data: Uint8Array
  private clips: Rect[] = []
  private cx0 = 0
  private cy0 = 0
  private cx1: number
  private cy1: number

  constructor(
    readonly width: number,
    readonly height: number,
    fill = 0,
  ) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
      throw new RangeError(`Framebuffer size must be positive integers, got ${width}×${height}`)
    this.data = new Uint8Array(width * height)
    if (fill) this.data.fill(clampLevel(fill))
    this.cx1 = width
    this.cy1 = height
  }

  /** Wrap existing level data (not copied). */
  static from(width: number, height: number, data: Uint8Array): Framebuffer {
    if (data.length !== width * height) throw new RangeError(`expected ${width * height} bytes, got ${data.length}`)
    const fb = new Framebuffer(width, height)
    fb.data.set(data)
    return fb
  }

  get bounds(): Rect {
    return { x: 0, y: 0, w: this.width, h: this.height }
  }

  /** Current clip rect (intersection of all pushed clips and the buffer). */
  get clip(): Rect {
    return { x: this.cx0, y: this.cy0, w: this.cx1 - this.cx0, h: this.cy1 - this.cy0 }
  }

  pushClip(r: Rect): void {
    this.clips.push(this.clip)
    this.applyClip(intersect(this.clip, r))
  }

  popClip(): void {
    const prev = this.clips.pop()
    this.applyClip(prev ?? this.bounds)
  }

  /** Run `fn` with drawing clipped to `r`. */
  withClip<T>(r: Rect, fn: () => T): T {
    this.pushClip(r)
    try {
      return fn()
    } finally {
      this.popClip()
    }
  }

  private applyClip(r: Rect): void {
    this.cx0 = r.x
    this.cy0 = r.y
    this.cx1 = r.x + Math.max(0, r.w)
    this.cy1 = r.y + Math.max(0, r.h)
  }

  set(x: number, y: number, level: number): void {
    x = Math.floor(x)
    y = Math.floor(y)
    if (x < this.cx0 || y < this.cy0 || x >= this.cx1 || y >= this.cy1) return
    this.data[y * this.width + x] = level < 0 ? 0 : level > MAX_LEVEL ? MAX_LEVEL : level | 0
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0
    return this.data[y * this.width + x]
  }

  /** Filled rectangle, clipped. Fast path used by most primitives. */
  fillRect(x: number, y: number, w: number, h: number, level: number): void {
    const x0 = Math.max(this.cx0, Math.floor(x))
    const y0 = Math.max(this.cy0, Math.floor(y))
    const x1 = Math.min(this.cx1, Math.floor(x) + Math.floor(w))
    const y1 = Math.min(this.cy1, Math.floor(y) + Math.floor(h))
    if (x1 <= x0 || y1 <= y0) return
    const l = clampLevel(level)
    for (let j = y0; j < y1; j++) this.data.fill(l, j * this.width + x0, j * this.width + x1)
  }

  /** Horizontal span [x0, x1] inclusive. */
  hspan(x0: number, x1: number, y: number, level: number): void {
    if (x1 < x0) [x0, x1] = [x1, x0]
    this.fillRect(x0, y, x1 - x0 + 1, 1, level)
  }

  /** Fill the clip region (the whole buffer when nothing is pushed). */
  clear(level = 0): void {
    this.fillRect(this.cx0, this.cy0, this.cx1 - this.cx0, this.cy1 - this.cy0, level)
  }

  clone(): Framebuffer {
    return Framebuffer.from(this.width, this.height, this.data)
  }

  /** Copy a region out into a new buffer. Pixels outside this buffer read as 0. */
  crop(r: Rect): Framebuffer {
    const out = new Framebuffer(Math.max(1, r.w), Math.max(1, r.h))
    out.blit(this, -r.x, -r.y)
    return out
  }

  /**
   * Draw `src` at (dx, dy). With `transparent`, level-0 source pixels are skipped
   * (sprites). `flipX`/`flipY` mirror the source.
   */
  blit(src: Framebuffer, dx: number, dy: number, opts: BlitOptions = {}): void {
    const sr = opts.src ?? src.bounds
    const transparent = opts.transparent ?? false
    for (let j = 0; j < sr.h; j++) {
      const ty = dy + j
      if (ty < this.cy0 || ty >= this.cy1) continue
      const sy = opts.flipY ? sr.y + sr.h - 1 - j : sr.y + j
      for (let i = 0; i < sr.w; i++) {
        const tx = dx + i
        if (tx < this.cx0 || tx >= this.cx1) continue
        const sx = opts.flipX ? sr.x + sr.w - 1 - i : sr.x + i
        let v = src.get(sx, sy)
        if (transparent && v === 0) continue
        if (opts.map) v = opts.map(v)
        this.data[ty * this.width + tx] = v
      }
    }
  }

  equals(other: Framebuffer): boolean {
    if (other.width !== this.width || other.height !== this.height) return false
    const a = this.data
    const b = other.data
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }

  /** Bounding box of pixels that differ from `other` (same size), or null if identical. */
  diffBounds(other: Framebuffer): Rect | null {
    if (other.width !== this.width || other.height !== this.height) return this.bounds
    let x0 = this.width
    let y0 = this.height
    let x1 = -1
    let y1 = -1
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width
      for (let x = 0; x < this.width; x++) {
        if (this.data[row + x] !== other.data[row + x]) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          y1 = y
        }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
  }

  /** Cheap content hash (FNV-1a) for change detection. */
  hash(): number {
    let h = 0x811c9dc5
    const d = this.data
    for (let i = 0; i < d.length; i++) {
      h ^= d[i]
      h = Math.imul(h, 0x01000193)
    }
    return (h ^ (this.width << 16) ^ this.height) >>> 0
  }

  /** Multi-line ASCII dump ('.' = 0, hex digit otherwise). Handy for golden tests. */
  toAscii(r: Rect = this.bounds): string {
    const rows: string[] = []
    for (let y = r.y; y < r.y + r.h; y++) {
      let s = ''
      for (let x = r.x; x < r.x + r.w; x++) {
        const v = this.get(x, y)
        s += v === 0 ? '.' : v.toString(16).toUpperCase()
      }
      rows.push(s)
    }
    return rows.join('\n')
  }
}

export interface BlitOptions {
  /** Source sub-rect. */
  src?: Rect
  /** Skip level-0 source pixels. */
  transparent?: boolean
  flipX?: boolean
  flipY?: boolean
  /** Remap each copied level (e.g. dim a sprite). */
  map?: (level: number) => number
}

export function clampLevel(level: number): number {
  return level <= 0 ? 0 : level >= MAX_LEVEL ? MAX_LEVEL : Math.round(level)
}
