/** Feedback and chrome: toast, modal, tabs, dots, scroll indicator, status bar, HUD frame, ticker. */
import { drawBlock } from '../core/block.js'
import { defineComponent } from '../core/component.js'
import { dashedRect, fillCircle, roundRect, strokeCircle, strokeRect } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import { cut, inset, splitColumns, type Rect } from '../core/geometry.js'
import { drawText, drawTextBox, ellipsize, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { ICONS, drawBattery, drawSignal, type IconName } from '../icons/index.js'
import { renderButtonRow } from './button.js'

export interface ToastProps {
  text: string
  kind?: 'info' | 'success' | 'warning' | 'error'
  icon?: IconName
  /** Remaining-time bar at the bottom (0–1). */
  remaining?: number
}

const KIND_ICON: Record<NonNullable<ToastProps['kind']>, IconName> = { info: 'info', success: 'check', warning: 'warning', error: 'cross' }

/**
 * Transient message. Kinds differ by icon and frame: info = thin frame,
 * success = double frame, warning = dashed frame, error = inverted (with
 * `surface: 'outline'`: a frame with only the icon inverted).
 */
export function renderToast(fb: Framebuffer, rect: Rect, p: ToastProps, theme: Theme): void {
  const lv = theme.levels
  const kind = p.kind ?? 'info'
  const inv = kind === 'error'
  const solid = inv && drawBlock(fb, rect.x, rect.y, rect.w, rect.h, lv.full, theme, { radius: theme.radius })
  if (kind === 'warning') dashedRect(fb, rect.x, rect.y, rect.w, rect.h, lv.full, { dash: [6, 3], width: 2 })
  else if (!inv) {
    roundRect(fb, rect.x, rect.y, rect.w, rect.h, theme.radius, { stroke: lv.full, width: kind === 'success' ? 1 : 2 })
    if (kind === 'success') roundRect(fb, rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6, Math.max(0, theme.radius - 3), { stroke: lv.bright })
  }
  const fg = solid ? 0 : lv.full
  const r = inset(rect, 8)
  const icon = p.icon ?? KIND_ICON[kind]
  const is = r.h >= 24 ? 16 : 12
  const iy = Math.round(r.y + (r.h - is) / 2)
  if (inv && !solid) roundRect(fb, r.x - 3, iy - 3, is + 6, is + 6, 3, { fill: lv.full })
  ICONS[icon](fb, r.x, iy, is, inv ? 0 : fg)
  drawTextBox(fb, { x: r.x + is + 8, y: r.y, w: r.w - is - 8, h: r.h }, p.text, { font: theme.fonts.body, level: fg, valign: 'middle', wrap: true, maxLines: 2 })
  if (p.remaining !== undefined) fb.fillRect(rect.x + 4, rect.y + rect.h - 4, Math.round((rect.w - 8) * Math.max(0, Math.min(1, p.remaining))), 2, solid ? 0 : lv.dim)
}

export const Toast = defineComponent<ToastProps>('Toast', { w: 288, h: 48 }, renderToast)

/** Call `onDone` after `ms` (auto-dismiss helper). Returns a cancel function. */
export function autoDismiss(ms: number, onDone: () => void, timers: { set(fn: () => void, ms: number): unknown; clear(h: unknown): void } = { set: (fn, t) => setTimeout(fn, t), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) }): () => void {
  const h = timers.set(onDone, ms)
  return () => timers.clear(h)
}

export interface ModalProps {
  title: string
  body?: string
  /** Button labels, e.g. ['Cancel', 'Delete']. */
  buttons?: readonly string[]
  focus?: number
  pressed?: number
  icon?: IconName
}

/**
 * Modal / confirm dialog. Keep focus trapped by giving the page's FocusRing
 * only the dialog's buttons while it is open.
 */
export function renderModal(fb: Framebuffer, rect: Rect, p: ModalProps, theme: Theme): void {
  const lv = theme.levels
  fb.fillRect(rect.x, rect.y, rect.w, rect.h, 0)
  roundRect(fb, rect.x, rect.y, rect.w, rect.h, theme.radius, { stroke: lv.full, width: 2 })
  let r = inset(rect, 10)
  const body = theme.fonts.body
  const buttons = p.buttons ?? ['Cancel', 'OK']
  const [btnStrip, rest0] = cut(r, 'bottom', 34)
  r = rest0
  const [titleStrip, rest1] = cut(r, 'top', body.glyphH + 6)
  let tx = titleStrip.x
  if (p.icon) {
    ICONS[p.icon](fb, tx, titleStrip.y - 1, 14, lv.full)
    tx += 20
  }
  drawText(fb, ellipsize(p.title, titleStrip.x + titleStrip.w - tx, body), tx, titleStrip.y, { font: body, level: lv.full })
  fb.fillRect(titleStrip.x, titleStrip.y + body.glyphH + 2, titleStrip.w, 1, lv.dim)
  if (p.body) drawTextBox(fb, inset(rest1, { top: 4 }), p.body, { font: theme.fonts.small, scale: theme.smallScale === 1 && rest1.h >= 40 ? 1 : theme.smallScale, level: lv.bright, wrap: true })
  renderButtonRow(fb, btnStrip, { buttons: buttons.map((label) => ({ label })), focus: p.focus ?? buttons.length - 1, pressed: p.pressed }, theme)
}

export const Modal = defineComponent<ModalProps>('Modal', { w: 288, h: 144 }, renderModal)

export interface TabsProps {
  tabs: readonly string[]
  active: number
  /** Underline style (default) or boxed. */
  variant?: 'underline' | 'boxed'
}

export function renderTabs(fb: Framebuffer, rect: Rect, p: TabsProps, theme: Theme): void {
  const lv = theme.levels
  const f = theme.fonts.body
  const cells = splitColumns(rect, p.tabs.map((t) => Math.max(1, textWidth(t, f) + 12)), 2)
  if (p.variant !== 'boxed') fb.fillRect(rect.x, rect.y + rect.h - 1, rect.w, 1, lv.dim)
  cells.forEach((c, i) => {
    const on = i === p.active
    let solid = false
    if (p.variant === 'boxed') {
      if (on) solid = drawBlock(fb, c.x, c.y, c.w, c.h, lv.bright, theme, { width: 1, double: true })
      else strokeRect(fb, c.x, c.y, c.w, c.h, lv.dim, 1)
    } else if (on) fb.fillRect(c.x, c.y + c.h - 4, c.w, 4, lv.full)
    const label = ellipsize(p.tabs[i], c.w - 4, f)
    drawText(fb, label, c.x + c.w / 2, Math.round(c.y + (c.h - (p.variant === 'boxed' ? 0 : 4) - f.ascent) / 2), { font: f, level: solid ? 0 : on ? lv.full : lv.mid, align: 'center' })
  })
}

export const Tabs = defineComponent<TabsProps>('Tabs', { w: 288, h: 24 }, renderTabs)

export interface PaginationDotsProps {
  count: number
  active: number
  size?: number
  gap?: number
}

/** Page indicator: active dot filled and larger, others outlined. */
export function renderPaginationDots(fb: Framebuffer, rect: Rect, p: PaginationDotsProps, theme: Theme): void {
  const lv = theme.levels
  const s = p.size ?? 8
  const gap = p.gap ?? 6
  const total = p.count * s + (p.count - 1) * gap
  let x = rect.x + (rect.w - total) / 2
  const cy = rect.y + rect.h / 2
  for (let i = 0; i < p.count; i++) {
    if (i === p.active) fillCircle(fb, x + s / 2, cy, s / 2 + 1, lv.full)
    else strokeCircle(fb, x + s / 2, cy, s / 2 - 0.5, lv.mid, 1.5)
    x += s + gap
  }
}

export const PaginationDots = defineComponent<PaginationDotsProps>('PaginationDots', { w: 96, h: 16 }, renderPaginationDots)

export interface ScrollIndicatorProps {
  total: number
  visible: number
  offset: number
  orientation?: 'vertical' | 'horizontal'
}

/** Thumb showing position in a long list. Track dotted, thumb solid (min 6 px). */
export function renderScrollIndicator(fb: Framebuffer, rect: Rect, p: ScrollIndicatorProps, theme: Theme): void {
  const lv = theme.levels
  const vertical = p.orientation !== 'horizontal'
  const len = vertical ? rect.h : rect.w
  const thick = vertical ? rect.w : rect.h
  const frac = p.total > 0 ? Math.min(1, p.visible / p.total) : 1
  const tl = Math.max(6, Math.round(len * frac))
  const maxOff = Math.max(1, p.total - p.visible)
  const pos = Math.round((len - tl) * Math.max(0, Math.min(1, p.offset / maxOff)))
  const tw = Math.max(2, Math.min(4, thick))
  const cross = Math.round((thick - tw) / 2)
  for (let i = 0; i < len; i += 3) {
    if (vertical) fb.fillRect(rect.x + cross + Math.floor(tw / 2), rect.y + i, 1, 1, lv.dim)
    else fb.fillRect(rect.x + i, rect.y + cross + Math.floor(tw / 2), 1, 1, lv.dim)
  }
  if (vertical) fb.fillRect(rect.x + cross, rect.y + pos, tw, tl, lv.bright)
  else fb.fillRect(rect.x + pos, rect.y + cross, tl, tw, lv.bright)
}

export const ScrollIndicator = defineComponent<ScrollIndicatorProps>('ScrollIndicator', { w: 6, h: 144 }, renderScrollIndicator)

export type StatusSlot = string | { icon: IconName; text?: string }

export interface StatusBarProps {
  /** Clock text, or a Date (formatted HH:MM). */
  time?: string | Date
  /** Battery 0–1. */
  battery?: number
  charging?: boolean
  /** Signal bars 0–4, or false for disconnected. */
  signal?: number | false
  /** Extra slots on the left. */
  slots?: readonly StatusSlot[]
  title?: string
}

export function renderStatusBar(fb: Framebuffer, rect: Rect, p: StatusBarProps, theme: Theme): void {
  const lv = theme.levels
  const f = rect.h >= 16 ? theme.fonts.body : theme.fonts.small
  const ty = Math.round(rect.y + (rect.h - f.ascent) / 2)
  const is = rect.h >= 16 ? 12 : 8
  const iy = Math.round(rect.y + (rect.h - is) / 2)
  let right = rect.x + rect.w
  if (p.battery !== undefined) {
    const bw = Math.round(is * 1.5)
    drawBattery(fb, right - bw, iy, bw, lv.bright, p.battery)
    right -= bw + 3
    if (p.charging) {
      ICONS.bolt(fb, right - is, iy, is, lv.full)
      right -= is + 2
    }
    const pct = `${Math.round(p.battery * 100)}%`
    drawText(fb, pct, right, ty, { font: f, level: lv.mid, align: 'right' })
    right -= textWidth(pct, f) + 8
  }
  if (p.signal !== undefined) {
    if (p.signal === false) ICONS.cross(fb, right - is, iy, is, lv.dim)
    else drawSignal(fb, right - is, iy, is, lv.bright, p.signal)
    right -= is + 8
  }
  if (p.time !== undefined) {
    const t = typeof p.time === 'string' ? p.time : `${String(p.time.getHours()).padStart(2, '0')}:${String(p.time.getMinutes()).padStart(2, '0')}`
    drawText(fb, t, right, ty, { font: f, level: lv.full, align: 'right' })
    right -= textWidth(t, f) + 8
  }
  let x = rect.x
  if (p.title) {
    const t = ellipsize(p.title, right - x - 8, f)
    drawText(fb, t, x, ty, { font: f, level: lv.full })
    x += textWidth(t, f) + 10
  }
  for (const s of p.slots ?? []) {
    if (typeof s === 'string') {
      if (x + textWidth(s, f) > right) break
      drawText(fb, s, x, ty, { font: f, level: lv.bright })
      x += textWidth(s, f) + 8
    } else {
      if (x + is > right) break
      ICONS[s.icon](fb, x, iy, is, lv.bright)
      x += is + 3
      if (s.text) {
        drawText(fb, s.text, x, ty, { font: f, level: lv.bright })
        x += textWidth(s.text, f) + 8
      } else x += 5
    }
  }
  fb.fillRect(rect.x, rect.y + rect.h - 1, rect.w, 1, lv.faint)
}

export const StatusBar = defineComponent<StatusBarProps>('StatusBar', { w: 288, h: 20 }, renderStatusBar)

export interface HudFrameProps {
  title?: string
  /** 'brackets' (corner brackets), 'box', 'double', 'dashed', 'notched'. */
  style?: 'brackets' | 'box' | 'double' | 'dashed' | 'notched'
  /** Corner bracket length (default 12). */
  corner?: number
  level?: number
  /** Title placement: inset in the top edge (default) or a filled title bar. */
  titleStyle?: 'inset' | 'bar'
}

/** Decorative chrome around a rect. Draw content inside `hudContentRect(rect)`. */
export function renderHudFrame(fb: Framebuffer, rect: Rect, p: HudFrameProps, theme: Theme): void {
  const lv = theme.levels
  const level = p.level ?? lv.bright
  const f = theme.fonts.small
  const s = theme.smallScale
  // An inset title straddles the top edge, so the frame starts half a line down.
  const drop = p.title && p.titleStyle !== 'bar' ? Math.ceil((f.glyphH * s) / 2) : 0
  const { x, w } = rect
  const y = rect.y + drop
  const h = rect.h - drop
  const c = p.corner ?? 12
  const style = p.style ?? 'brackets'
  switch (style) {
    case 'brackets':
      for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]] as const) {
        fb.fillRect(dx > 0 ? cx : cx - c + 1, dy > 0 ? cy : cy - 1, c, 2, level)
        fb.fillRect(dx > 0 ? cx : cx - 1, dy > 0 ? cy : cy - c + 1, 2, c, level)
      }
      break
    case 'box':
      strokeRect(fb, x, y, w, h, level, 2)
      break
    case 'double':
      strokeRect(fb, x, y, w, h, level, 1)
      strokeRect(fb, x + 3, y + 3, w - 6, h - 6, lv.dim, 1)
      break
    case 'dashed':
      dashedRect(fb, x, y, w, h, level, { dash: [6, 4], width: 2 })
      break
    case 'notched': {
      const n = Math.min(c, Math.floor(Math.min(w, h) / 4))
      const pts = [
        { x: x + n, y },
        { x: x + w - 1, y },
        { x: x + w - 1, y: y + h - 1 - n },
        { x: x + w - 1 - n, y: y + h - 1 },
        { x, y: y + h - 1 },
        { x, y: y + n },
        { x: x + n, y },
      ]
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))
        for (let k = 0; k <= steps; k++) fb.fillRect(Math.round(a.x + ((b.x - a.x) * k) / (steps || 1)), Math.round(a.y + ((b.y - a.y) * k) / (steps || 1)), 2, 2, level)
      }
      break
    }
  }
  if (p.title) {
    const th = f.glyphH * s
    if (p.titleStyle === 'bar') {
      fb.fillRect(x + 2, y + 2, w - 4, th + 4, level)
      drawText(fb, ellipsize(p.title, w - 12, f, s), x + 6, y + 4, { font: f, scale: s, level: 0 })
    } else {
      const t = ellipsize(p.title.toUpperCase(), w - 2 * c - 16, f, s)
      const tw = textWidth(t, f, s)
      const tx = x + c + 6
      fb.fillRect(tx - 3, y - 1, tw + 6, th + 2, 0)
      drawText(fb, t, tx, y - Math.floor(th / 2) + 1, { font: f, scale: s, level: lv.full })
    }
  }
}

/** Content rect inside a HudFrame (clear of the frame and title). */
export function hudContentRect(rect: Rect, p: HudFrameProps = {}, theme?: Theme): Rect {
  const th = theme ? theme.fonts.small.glyphH * theme.smallScale : 7
  const top = p.title ? (p.titleStyle === 'bar' ? th + 8 : th + 6) : 6
  return inset(rect, { top, left: 6, right: 6, bottom: 6 })
}

export const HudFrame = defineComponent<HudFrameProps>('HudFrame', { w: 288, h: 144 }, renderHudFrame)

export interface TickerProps {
  text: string
  /** Scroll offset in px (advance it per frame). */
  offset: number
  font?: 'small' | 'body' | 'display'
  gap?: number
}

/**
 * Ticker / marquee. WARNING: every frame costs one image send (~100 ms), so a
 * ticker ties up the image path; keep it short or step by whole words.
 */
export function renderTicker(fb: Framebuffer, rect: Rect, p: TickerProps, theme: Theme): void {
  const f = theme.fonts[p.font ?? 'body']
  const tw = textWidth(p.text, f)
  const gap = p.gap ?? 32
  const period = tw + gap
  const y = Math.round(rect.y + (rect.h - f.ascent) / 2)
  if (tw <= rect.w) {
    drawText(fb, p.text, rect.x, y, { font: f, level: theme.levels.full })
    return
  }
  const off = ((p.offset % period) + period) % period
  for (let x = rect.x - off; x < rect.x + rect.w; x += period) drawText(fb, p.text, x, y, { font: f, level: theme.levels.full })
}

export const Ticker = defineComponent<TickerProps>('Ticker', { w: 288, h: 24 }, renderTicker)

/** Offsets for a marquee cycle, stepping `step` px (or whole words when `words`). */
export function marqueeFrames(text: string, width: number, opts: { step?: number; gap?: number; font?: { advance: number; glyphW: number }; words?: boolean } = {}): number[] {
  const adv = opts.font?.advance ?? 8
  const tw = [...text].length * adv
  if (tw <= width) return [0]
  const period = tw + (opts.gap ?? 32)
  if (opts.words) {
    const out = [0]
    let x = 0
    for (const w of text.split(' ')) {
      x += ([...w].length + 1) * adv
      if (x < period) out.push(x)
    }
    return out
  }
  const step = opts.step ?? 24
  const out: number[] = []
  for (let o = 0; o < period; o += step) out.push(o)
  if (out.length > 20) console.warn(`[g2-kit] marquee: ${out.length} frames ≈ ${(out.length * 0.1).toFixed(1)} s of image sends per cycle`)
  return out
}
