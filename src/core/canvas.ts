/**
 * Optional Canvas2D adapter for people who want to draw with the browser
 * canvas API and still push 4-bit tiles. The kit's own components never use it.
 * Structural types only, so this module has no DOM dependency at import time.
 */
import type { Framebuffer } from './framebuffer.js'
import { fromRGBA, type QuantizeOptions } from './encode.js'

interface ImageDataLike {
  width: number
  height: number
  data: ArrayLike<number>
}

interface Ctx2DLike {
  getImageData(x: number, y: number, w: number, h: number): ImageDataLike
}

interface CanvasLike {
  width: number
  height: number
  getContext(type: '2d'): unknown
}

export class CanvasAdapter {
  /** Quantise the whole canvas (or a region) into a Framebuffer. */
  static toFramebuffer(canvas: CanvasLike, opts: QuantizeOptions & { x?: number; y?: number; w?: number; h?: number } = {}): Framebuffer {
    const ctx = canvas.getContext('2d') as Ctx2DLike | null
    if (!ctx) throw new Error('CanvasAdapter: no 2d context')
    const x = opts.x ?? 0
    const y = opts.y ?? 0
    const w = opts.w ?? canvas.width
    const h = opts.h ?? canvas.height
    const img = ctx.getImageData(x, y, w, h)
    return fromRGBA(img.width, img.height, img.data, opts)
  }

  /** Quantise an ImageData-like object. */
  static fromImageData(img: ImageDataLike, opts: QuantizeOptions = {}): Framebuffer {
    return fromRGBA(img.width, img.height, img.data, opts)
  }
}
