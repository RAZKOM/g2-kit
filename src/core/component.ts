/**
 * The component contract. Every chart and widget is a pure function of props:
 *
 *   render(fb, rect, props, theme?)   draw into a rect of any framebuffer
 *   renderToTile(props, size?)        convenience: a fresh tile-sized framebuffer
 *
 * No component owns the SDK. Drawing is clipped to `rect`.
 */
import { Framebuffer } from './framebuffer.js'
import type { Rect, Size } from './geometry.js'
import { defaultTheme, type Theme } from './theme.js'

/** Largest image a single container accepts. */
export const TILE_W = 288
export const TILE_H = 144
export const TILE: Size = { w: TILE_W, h: TILE_H }

export interface Component<P> {
  readonly name: string
  /** Recommended size (documented in DESIGN.md). */
  readonly size: Size
  render(fb: Framebuffer, rect: Rect, props: P, theme?: Theme): void
  renderToTile(props: P, size?: Size, theme?: Theme): Framebuffer
}

export type RenderFn<P> = (fb: Framebuffer, rect: Rect, props: P, theme: Theme) => void

export function defineComponent<P>(name: string, size: Size, draw: RenderFn<P>): Component<P> {
  const render = (fb: Framebuffer, rect: Rect, props: P, theme: Theme = defaultTheme) => fb.withClip(rect, () => draw(fb, rect, props, theme))
  return {
    name,
    size,
    render,
    renderToTile(props, s = size, theme = defaultTheme) {
      const fb = new Framebuffer(s.w, s.h)
      render(fb, { x: 0, y: 0, w: s.w, h: s.h }, props, theme)
      return fb
    },
  }
}
