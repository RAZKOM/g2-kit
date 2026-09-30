/**
 * Dependency-free PNG encoders.
 *  - `encodePng`: 8-bit greyscale (level × 17). This is what `updateImageRawData`
 *    is fed; the host decodes it and converts to 4-bit.
 *  - `encodePreviewPng`: green-on-black RGBA, the way the glasses look, with
 *    level 0 optionally transparent. For phone mirrors, docs and the gallery.
 * Deflate uses stored blocks: deterministic, tiny code, and payload size barely
 * matters because the SDK LZ4-compresses in transit (SDK ≥ 0.0.12).
 */
import type { Framebuffer } from './framebuffer.js'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let c = 0xffffffff
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function zlibStored(data: Uint8Array): Uint8Array {
  const MAX = 65535
  const blocks = Math.max(1, Math.ceil(data.length / MAX))
  const out = new Uint8Array(2 + data.length + blocks * 5 + 4)
  let o = 0
  out[o++] = 0x78
  out[o++] = 0x01
  for (let b = 0; b < blocks; b++) {
    const start = b * MAX
    const len = Math.min(MAX, data.length - start)
    out[o++] = b === blocks - 1 ? 1 : 0
    out[o++] = len & 0xff
    out[o++] = (len >>> 8) & 0xff
    out[o++] = ~len & 0xff
    out[o++] = (~len >>> 8) & 0xff
    out.set(data.subarray(start, start + len), o)
    o += len
  }
  const ad = adler32(data)
  out[o++] = (ad >>> 24) & 0xff
  out[o++] = (ad >>> 16) & 0xff
  out[o++] = (ad >>> 8) & 0xff
  out[o++] = ad & 0xff
  return out
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out, 4, 8 + data.length))
  return out
}

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

/** Assemble a PNG from filtered scanlines (each row already prefixed with filter byte 0). */
/**
 * zlib compressor for IDAT, e.g. `(d) => zlib.deflateSync(d)` in Node. Optional:
 * without it the data is stored uncompressed (fine for tiles, which the SDK
 * compresses in transit; use it for files you publish).
 */
export type Deflate = (data: Uint8Array) => Uint8Array

export function assemblePng(width: number, height: number, bitDepth: number, colorType: number, raw: Uint8Array, deflate?: Deflate): Uint8Array {
  const ihdr = new Uint8Array(13)
  const v = new DataView(ihdr.buffer)
  v.setUint32(0, width)
  v.setUint32(4, height)
  ihdr[8] = bitDepth
  ihdr[9] = colorType
  const parts = [SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflate ? deflate(raw) : zlibStored(raw)), chunk('IEND', new Uint8Array(0))]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export interface PngOptions {
  /** 8 (default, proven on simulator and glasses via WordLens) or 4 (half the bytes; unverified on hardware). */
  bitDepth?: 8 | 4
  deflate?: Deflate
}

/** Greyscale PNG of a framebuffer. */
export function encodePng(fb: Framebuffer, opts: PngOptions = {}): Uint8Array {
  const { width, height, data } = fb
  if (opts.bitDepth === 4) {
    const stride = Math.ceil(width / 2)
    const raw = new Uint8Array((stride + 1) * height)
    for (let y = 0; y < height; y++) {
      const row = y * (stride + 1)
      for (let x = 0; x < width; x++) {
        const l = data[y * width + x] & 15
        raw[row + 1 + (x >> 1)] |= x & 1 ? l : l << 4
      }
    }
    return assemblePng(width, height, 4, 0, raw, opts.deflate)
  }
  const raw = new Uint8Array((width + 1) * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw[y * (width + 1) + 1 + x] = Math.min(15, data[y * width + x]) * 17
  }
  return assemblePng(width, height, 8, 0, raw, opts.deflate)
}

export interface PreviewOptions {
  /** Level 0 transparent (default false: opaque black). */
  transparent?: boolean
  /** Integer upscale for docs (default 1). */
  scale?: number
  /** Peak colour (default pure green, the glasses' hue). */
  rgb?: readonly [number, number, number]
  /**
   * Brightness per level, 0–255 (16 entries). Default: linear (level × 17).
   * Pass `SIMULATOR_CURVE` to match what evenhub-simulator 0.9.5 shows.
   */
  curve?: readonly number[]
  deflate?: Deflate
}

/** Green-on-black RGBA PNG: what the frame looks like on the glasses. */
export function encodePreviewPng(fb: Framebuffer, opts: PreviewOptions = {}): Uint8Array {
  const s = Math.max(1, Math.floor(opts.scale ?? 1))
  const [pr, pg, pb] = opts.rgb ?? [0, 255, 0]
  const W = fb.width * s
  const H = fb.height * s
  const raw = new Uint8Array((1 + W * 4) * H)
  for (let y = 0; y < H; y++) {
    const row = y * (1 + W * 4)
    for (let x = 0; x < W; x++) {
      const l = Math.min(15, fb.data[Math.floor(y / s) * fb.width + Math.floor(x / s)])
      const k = opts.curve ? opts.curve[l] / 255 : l / 15
      const i = row + 1 + x * 4
      raw[i] = Math.round(pr * k)
      raw[i + 1] = Math.round(pg * k)
      raw[i + 2] = Math.round(pb * k)
      raw[i + 3] = opts.transparent && l === 0 ? 0 : 255
    }
  }
  return assemblePng(W, H, 8, 6, raw, opts.deflate)
}
