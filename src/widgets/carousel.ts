/**
 * Carousel / wheel picker, generalised from WordLens's letter strip: the
 * selected item sits boxed in the centre at a larger size; neighbours run out
 * to both edges, dimmer with distance, and wrap. Only whole items are drawn
 * (a clipped glyph reads as noise). Swipe → index ± 1 → one tile redraw.
 */
import { defineComponent } from '../core/component.js'
import { fillTriangle, strokeRect } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Rect } from '../core/geometry.js'
import { drawText, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { ICONS, type IconName } from '../icons/index.js'
import { themeFont, type FontName } from './common.js'

export type CarouselItem = string | { label?: string; icon?: IconName }

export interface CarouselProps {
  items: readonly CarouselItem[]
  index: number
  /** Wrap around the ends (default true). Without wrap, arrows show more items exist. */
  wrap?: boolean
  orientation?: 'horizontal' | 'vertical'
  /** Font for the selected item (default 'display' if it fits, else 'body'). */
  selectedFont?: FontName
  itemFont?: FontName
  /** Box around the selection (default true). */
  box?: boolean
  /** Levels by distance from the selection: [selected, 1 away, 2 away, farther]. */
  ramp?: readonly [number, number, number, number]
  /** Gap between items in px (default 8). */
  gap?: number
}

const wrapIdx = (i: number, n: number) => ((i % n) + n) % n

interface Measured {
  w: number
  h: number
  draw: (fb: Framebuffer, x: number, y: number, level: number) => void
}

function measure(item: CarouselItem, font: ReturnType<typeof themeFont>, iconSize: number): Measured {
  const label = typeof item === 'string' ? item : (item.label ?? '')
  const icon = typeof item === 'string' ? undefined : item.icon
  const tw = label ? textWidth(label, font.font, font.scale) : 0
  const th = font.font.glyphH * font.scale
  const gap = icon && label ? 4 : 0
  const w = (icon ? iconSize : 0) + gap + tw
  const h = Math.max(icon ? iconSize : 0, label ? th : 0)
  return {
    w,
    h,
    draw(fb, x, y, level) {
      let cx = x
      if (icon) {
        ICONS[icon](fb, cx, y + Math.round((h - iconSize) / 2), iconSize, level)
        cx += iconSize + gap
      }
      if (label) drawText(fb, label, cx, y + Math.round((h - th) / 2), { font: font.font, scale: font.scale, level })
    },
  }
}

export function renderCarousel(fb: Framebuffer, rect: Rect, p: CarouselProps, theme: Theme): void {
  const n = p.items.length
  if (n === 0) return
  const lv = theme.levels
  const ramp = p.ramp ?? [lv.full, lv.bright, lv.mid, lv.dim]
  const wrap = p.wrap !== false
  const vertical = p.orientation === 'vertical'
  const index = wrap ? wrapIdx(p.index, n) : Math.max(0, Math.min(n - 1, p.index))
  const gap = p.gap ?? 8
  const pad = 6
  const along = vertical ? rect.h : rect.w
  const across = vertical ? rect.w : rect.h

  // Selected: biggest font that fits the cross axis (and the main axis).
  const selNames: FontName[] = p.selectedFont ? [p.selectedFont] : ['display', 'body', 'small']
  let sel = measure(p.items[index], themeFont(theme, selNames[0]), 24)
  for (const name of selNames) {
    const f = themeFont(theme, name)
    const iconSize = name === 'display' ? 24 : name === 'body' ? 16 : 12
    sel = measure(p.items[index], f, iconSize)
    if (sel.h + 2 * pad + 4 <= across && sel.w + 2 * pad + 4 <= along) break
  }
  const itemFont = themeFont(theme, p.itemFont ?? 'body')
  const itemIcon = p.itemFont === 'small' ? 12 : 16

  const box = p.box !== false
  const selBoxW = sel.w + 2 * pad
  const selBoxH = sel.h + 2 * pad
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const bx = Math.round(cx - selBoxW / 2)
  const by = Math.round(cy - selBoxH / 2)
  if (box) strokeRect(fb, bx, by, selBoxW, selBoxH, ramp[0], 2)
  sel.draw(fb, bx + pad, by + pad, ramp[0])

  const selHalf = (vertical ? selBoxH : selBoxW) / 2
  for (const dir of [1, -1]) {
    let edge = (vertical ? cy : cx) + dir * selHalf
    for (let k = 1; k < n; k++) {
      const raw = index + dir * k
      if (!wrap && (raw < 0 || raw >= n)) break
      if (wrap && k > n / 2 + (dir === 1 ? 0 : -0.5)) break // each item appears once
      const m = measure(p.items[wrapIdx(raw, n)], itemFont, itemIcon)
      const size = vertical ? m.h : m.w
      const start = dir === 1 ? edge + gap : edge - gap - size
      const lo = vertical ? rect.y : rect.x
      if (start < lo + 2 || start + size > lo + along - 2) break
      const level = ramp[Math.min(3, k)]
      if (vertical) m.draw(fb, Math.round(cx - m.w / 2), Math.round(start), level)
      else m.draw(fb, Math.round(start), Math.round(cy - m.h / 2), level)
      edge = dir === 1 ? start + size : start
    }
  }

  // Without wrap, show that more items exist beyond the visible ones.
  if (!wrap) {
    const s = 4
    if (index > 0) {
      if (vertical) fillTriangle(fb, { x: cx - s, y: rect.y + s + 1 }, { x: cx + s, y: rect.y + s + 1 }, { x: cx, y: rect.y + 1 }, lv.dim)
      else fillTriangle(fb, { x: rect.x + 1, y: cy }, { x: rect.x + s + 1, y: cy - s }, { x: rect.x + s + 1, y: cy + s }, lv.dim)
    }
    if (index < n - 1) {
      if (vertical) fillTriangle(fb, { x: cx - s, y: rect.y + rect.h - s - 1 }, { x: cx + s, y: rect.y + rect.h - s - 1 }, { x: cx, y: rect.y + rect.h - 1 }, lv.dim)
      else fillTriangle(fb, { x: rect.x + rect.w - 1, y: cy }, { x: rect.x + rect.w - s - 1, y: cy - s }, { x: rect.x + rect.w - s - 1, y: cy + s }, lv.dim)
    }
  }
}

export const Carousel = defineComponent<CarouselProps>('Carousel', { w: 288, h: 64 }, renderCarousel)
