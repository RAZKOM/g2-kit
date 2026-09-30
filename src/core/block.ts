/**
 * Solid blocks drawn per `theme.surface`. Components call `drawBlock` wherever
 * they would paint a solid area (a positive bar, an active button, a toggle's
 * track), so one theme switch trades fills for frames everywhere.
 */
import { fillRectPaint, roundRect, strokeRect } from './draw.js'
import type { Framebuffer } from './framebuffer.js'
import type { FillPattern } from './paint.js'
import type { Theme } from './theme.js'

export interface BlockOptions {
  /** Corner radius (default square). */
  radius?: number
  /** Frame width in outline mode (default 2). */
  width?: number
  /** Pattern inside the frame in outline mode (default none). */
  texture?: FillPattern
  /** A second 1 px frame inside the first in outline mode (reads as "selected"). */
  double?: boolean
}

/** True when the theme draws blocks as outlines. */
export function isOutline(theme: Theme): boolean {
  return theme.surface === 'outline'
}

/**
 * A block at `level`: solid under the default surface, a frame (plus optional
 * texture) under `surface: 'outline'`. Blocks too small for a frame stay solid.
 * Returns true when the block was drawn solid, i.e. content on it should be
 * punched out at level 0 rather than drawn at a lit level.
 */
export function drawBlock(fb: Framebuffer, x: number, y: number, w: number, h: number, level: number, theme: Theme, opts: BlockOptions = {}): boolean {
  const r = opts.radius ?? 0
  const bw = opts.width ?? 2
  if (!isOutline(theme) || w < 2 * bw + 3 || h < 2 * bw + 3) {
    if (r > 0) roundRect(fb, x, y, w, h, r, { fill: level })
    else fb.fillRect(x, y, w, h, level)
    return true
  }
  if (opts.texture) {
    // Texture first, inset by the frame, so the frame's edge stays clean.
    if (r > 0) roundRect(fb, x + bw, y + bw, w - 2 * bw, h - 2 * bw, Math.max(0, r - bw), { fill: { pattern: opts.texture, level } })
    else fillRectPaint(fb, x + bw, y + bw, w - 2 * bw, h - 2 * bw, { pattern: opts.texture, level })
  }
  if (r > 0) roundRect(fb, x, y, w, h, r, { stroke: level, width: bw })
  else strokeRect(fb, x, y, w, h, level, bw)
  if (opts.double && w > 2 * bw + 6 && h > 2 * bw + 6) {
    const k = bw + 1
    if (r > 0) roundRect(fb, x + k, y + k, w - 2 * k, h - 2 * k, Math.max(0, r - k), { stroke: level, width: 1 })
    else strokeRect(fb, x + k, y + k, w - 2 * k, h - 2 * k, level, 1)
  }
  return false
}
