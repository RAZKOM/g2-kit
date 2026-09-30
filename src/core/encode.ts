/**
 * Pixel formats for the SDK and conversions from 8-bit sources.
 *
 * `updateImageRawData` takes `imageData` as number[] | Uint8Array | ArrayBuffer | base64.
 * Encoded PNG is the proven path (simulator + glasses, via WordLens). The
 * simulator (≥ 0.9.2) also accepts raw Gray8 and packed Gray4; those are
 * offered here but are unverified on hardware.
 */
import { Framebuffer } from './framebuffer.js'
import { encodePng } from './png.js'

export type TileFormat = 'png' | 'png4' | 'gray8' | 'gray4'

/** Encode a tile for `updateImageRawData`. Default: 8-bit greyscale PNG. */
export function encodeTile(fb: Framebuffer, format: TileFormat = 'png'): Uint8Array {
  switch (format) {
    case 'png':
      return encodePng(fb)
    case 'png4':
      return encodePng(fb, { bitDepth: 4 })
    case 'gray8':
      return toGray8(fb)
    case 'gray4':
      return pack4(fb)
  }
}

/** One byte per pixel, level × 17 (0–255). */
export function toGray8(fb: Framebuffer): Uint8Array {
  const out = new Uint8Array(fb.data.length)
  for (let i = 0; i < out.length; i++) out[i] = Math.min(15, fb.data[i]) * 17
  return out
}

/**
 * Two pixels per byte, row-major. `order: 'high'` puts the left pixel in the
 * high nibble (PNG convention, default); 'low' puts it in the low nibble.
 * Rows are not padded: an odd total pixel count leaves the last nibble 0.
 */
export function pack4(fb: Framebuffer, order: 'high' | 'low' = 'high'): Uint8Array {
  const n = fb.data.length
  const out = new Uint8Array(Math.ceil(n / 2))
  for (let i = 0; i < n; i++) {
    const l = fb.data[i] & 15
    const first = (i & 1) === 0
    out[i >> 1] |= (first === (order === 'high')) ? l << 4 : l
  }
  return out
}

export function unpack4(bytes: Uint8Array, width: number, height: number, order: 'high' | 'low' = 'high'): Framebuffer {
  const fb = new Framebuffer(width, height)
  for (let i = 0; i < width * height; i++) {
    const b = bytes[i >> 1] ?? 0
    const first = (i & 1) === 0
    fb.data[i] = first === (order === 'high') ? b >> 4 : b & 15
  }
  return fb
}

/** Nearest level for an 8-bit grey value. */
export function quantize(v: number): number {
  return Math.max(0, Math.min(15, Math.round(v / 17)))
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

export type Dither = 'none' | 'bayer4'

export interface QuantizeOptions {
  /**
   * 'none' (default): nearest level. 'bayer4': ordered dither, for photos only.
   * Dither shimmers on the glasses; do not use it for UI.
   */
  dither?: Dither
  /** Gamma applied before quantising (1 = linear, default). */
  gamma?: number
  /** Invert (useful for dark-on-light source art). */
  invert?: boolean
}

function prep(v: number, o: QuantizeOptions): number {
  if (o.invert) v = 255 - v
  if (o.gamma && o.gamma !== 1) v = 255 * Math.pow(v / 255, o.gamma)
  return v
}

function quantizeAt(v: number, x: number, y: number, o: QuantizeOptions): number {
  if (o.dither === 'bayer4') {
    const t = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5
    return Math.max(0, Math.min(15, Math.round(v / 17 + t)))
  }
  return quantize(v)
}

/** 8-bit grey (one byte per pixel) → Framebuffer. */
export function fromGray8(width: number, height: number, grey: ArrayLike<number>, opts: QuantizeOptions = {}): Framebuffer {
  const fb = new Framebuffer(width, height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) fb.data[y * width + x] = quantizeAt(prep(grey[y * width + x], opts), x, y, opts)
  return fb
}

/** RGBA (e.g. `ImageData.data`) → Framebuffer via Rec. 601 luma, alpha over black. */
export function fromRGBA(width: number, height: number, rgba: ArrayLike<number>, opts: QuantizeOptions = {}): Framebuffer {
  const fb = new Framebuffer(width, height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = rgba[i + 3] / 255
      const luma = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * a
      fb.data[y * width + x] = quantizeAt(prep(luma, opts), x, y, opts)
    }
  return fb
}
