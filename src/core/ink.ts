/**
 * Ink: how much of a picture is lit. On the glasses every lit pixel sits between
 * the wearer and the world, so a HUD should light as little as it can while
 * staying readable. The gallery, the bench and the tests report it per sample.
 */
import type { Framebuffer } from './framebuffer.js'
import type { Rect } from './geometry.js'

/** Suggested ceiling for one component's ink ratio (the gallery test flags samples above it). */
export const INK_BUDGET = 0.25

/**
 * Fraction of pixels in `rect` (default: the whole buffer) that are lit, i.e. at
 * level ≥ `min` (default 1). 0 = fully see-through, 1 = every pixel on.
 */
export function inkRatio(fb: Framebuffer, rect: Rect = fb.bounds, min = 1): number {
  const x0 = Math.max(0, rect.x)
  const y0 = Math.max(0, rect.y)
  const x1 = Math.min(fb.width, rect.x + rect.w)
  const y1 = Math.min(fb.height, rect.y + rect.h)
  if (x1 <= x0 || y1 <= y0) return 0
  let lit = 0
  const d = fb.data
  for (let y = y0; y < y1; y++) {
    const row = y * fb.width
    for (let i = row + x0; i < row + x1; i++) if (d[i] >= min) lit++
  }
  return lit / ((x1 - x0) * (y1 - y0))
}
