/**
 * Buttons and button rows. States differ by shape, not only brightness:
 *   normal   1 px dim outline, bright label
 *   focused  2 px full outline + corner ticks
 *   pressed  full fill, dark label, 1 px dark inset (looks pushed)
 *   active   bright fill, dark label (selected / on); double frame with `surface: 'outline'`
 *   disabled dashed faint outline, dim label
 */
import { drawBlock } from '../core/block.js'
import { defineComponent } from '../core/component.js'
import { dashedRect, roundRect, strokeRect } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import { splitColumns, type Rect } from '../core/geometry.js'
import { drawText, ellipsize, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { ICONS, type IconName } from '../icons/index.js'
import { themeFont, type ControlState, type FontName } from './common.js'

export interface ButtonProps {
  label?: string
  icon?: IconName
  state?: ControlState
  /** 'pill' (rounded ends) or 'square' (default). */
  variant?: 'pill' | 'square'
  font?: FontName
}

export function renderButton(fb: Framebuffer, rect: Rect, p: ButtonProps, theme: Theme): void {
  const lv = theme.levels
  const state = p.state ?? 'normal'
  const { x, y, w, h } = rect
  const radius = p.variant === 'pill' ? Math.floor(h / 2) : Math.min(theme.radius, Math.floor(h / 4))
  let filled = false
  // Pressed is a brief flash, so it stays solid under every surface.
  if (state === 'pressed') {
    roundRect(fb, x, y, w, h, radius, { fill: lv.full })
    filled = true
  } else if (state === 'active') filled = drawBlock(fb, x, y, w, h, lv.bright, theme, { radius, double: true })
  else if (state === 'disabled') {
    if (p.variant === 'pill') roundRect(fb, x, y, w, h, radius, { stroke: lv.faint })
    else dashedRect(fb, x, y, w, h, lv.dim, { dash: [3, 3] })
  } else roundRect(fb, x, y, w, h, radius, { stroke: state === 'focused' ? lv.full : lv.dim, width: state === 'focused' ? 2 : 1 })
  if (state === 'pressed') roundRect(fb, x + 2, y + 2, w - 4, h - 4, Math.max(0, radius - 2), { stroke: 0 })
  if (state === 'focused' && p.variant !== 'pill') {
    // Corner ticks outside the frame: focus reads even when the outline is small.
    const t = 4
    for (const [cx, cy, dx, dy] of [[x - 2, y - 2, 1, 1], [x + w + 1, y - 2, -1, 1], [x - 2, y + h + 1, 1, -1], [x + w + 1, y + h + 1, -1, -1]] as const) {
      fb.fillRect(dx > 0 ? cx : cx - t + 1, cy, t, 1, lv.full)
      fb.fillRect(cx, dy > 0 ? cy : cy - t + 1, 1, t, lv.full)
    }
  }
  const text = filled ? 0 : state === 'disabled' ? lv.dim : state === 'focused' || state === 'active' ? lv.full : lv.bright
  // Content: icon + label, centred; shrink the font if needed.
  const fonts: FontName[] = p.font ? [p.font] : ['body', 'small']
  const inner = w - 2 * Math.max(6, radius)
  for (const name of fonts) {
    const f = themeFont(theme, name)
    const iconSize = name === 'small' ? 8 : h >= 28 ? 16 : 12
    const gap = p.icon && p.label ? 4 : 0
    const lw = p.label ? textWidth(p.label, f.font, f.scale) : 0
    const total = (p.icon ? iconSize : 0) + gap + lw
    if (total > inner && name !== fonts[fonts.length - 1]) continue
    const label = p.label ? ellipsize(p.label, inner - (p.icon ? iconSize + gap : 0), f.font, f.scale) : ''
    const tw = label ? textWidth(label, f.font, f.scale) : 0
    let cx = Math.round(x + (w - ((p.icon ? iconSize : 0) + gap + tw)) / 2)
    if (p.icon) {
      ICONS[p.icon](fb, cx, Math.round(y + (h - iconSize) / 2), iconSize, text)
      cx += iconSize + gap
    }
    if (label) drawText(fb, label, cx, Math.round(y + (h - f.font.ascent * f.scale) / 2), { font: f.font, scale: f.scale, level: text })
    break
  }
}

export const Button = defineComponent<ButtonProps>('Button', { w: 96, h: 32 }, renderButton)

export interface ButtonRowProps {
  buttons: ReadonlyArray<{ label?: string; icon?: IconName; disabled?: boolean; active?: boolean }>
  /** Focused index (-1 for none). */
  focus?: number
  /** Index currently pressed (brief feedback after a tap). */
  pressed?: number
  variant?: 'pill' | 'square'
  gap?: number
  direction?: 'horizontal' | 'vertical'
}

export function renderButtonRow(fb: Framebuffer, rect: Rect, p: ButtonRowProps, theme: Theme): void {
  const n = p.buttons.length
  if (!n) return
  const gap = p.gap ?? 8
  const inset = 3 // room for focus ticks
  const r = { x: rect.x + inset, y: rect.y + inset, w: rect.w - 2 * inset, h: rect.h - 2 * inset }
  const cells =
    p.direction === 'vertical'
      ? splitColumns({ x: r.y, y: r.x, w: r.h, h: r.w }, p.buttons.map(() => 1), gap).map((c) => ({ x: c.y, y: c.x, w: c.h, h: c.w }))
      : splitColumns(r, p.buttons.map(() => 1), gap)
  p.buttons.forEach((b, i) => {
    const state: ControlState = b.disabled ? 'disabled' : p.pressed === i ? 'pressed' : p.focus === i ? 'focused' : b.active ? 'active' : 'normal'
    renderButton(fb, cells[i], { label: b.label, icon: b.icon, state, variant: p.variant }, theme)
  })
}

export const ButtonRow = defineComponent<ButtonRowProps>('ButtonRow', { w: 288, h: 44 }, renderButtonRow)

/** Square outline used for simple focus rings around arbitrary rects. */
export function drawFocusRing(fb: Framebuffer, r: Rect, theme: Theme): void {
  strokeRect(fb, r.x - 3, r.y - 3, r.w + 6, r.h + 6, theme.levels.full, 2)
}
