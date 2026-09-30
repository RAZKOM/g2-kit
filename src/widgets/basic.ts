/** Toggle, progress bar and big text: small P0 widgets. */
import { drawBlock, isOutline, outlineTexture } from '../core/block.js'
import { defineComponent } from '../core/component.js'
import { fillCircle, fillRectPaint, roundRect, strokeCircle, strokeRect } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import { cut, type Rect } from '../core/geometry.js'
import { drawText, drawTextBox, ellipsize, fitText, textWidth, type Align, type VAlign } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { themeFont, type FontName } from './common.js'

export interface ToggleProps {
  on: boolean
  label?: string
  focused?: boolean
  disabled?: boolean
  /** Print ON/OFF inside the track (default true when there is room). */
  stateText?: boolean
}

/**
 * Toggle / switch. Off: outlined track, hollow knob on the left.
 * On: filled track, knob punched out on the right. Shape and position differ,
 * not just brightness.
 */
export function renderToggle(fb: Framebuffer, rect: Rect, p: ToggleProps, theme: Theme): void {
  const lv = theme.levels
  const h = Math.min(rect.h - 6, 28)
  const w = Math.round(h * 2)
  const r = rect
  const trackX = r.x + r.w - w - 3
  const trackY = Math.round(r.y + (r.h - h) / 2)
  if (p.label) {
    const f = themeFont(theme, 'body')
    const maxW = trackX - r.x - 8
    drawText(fb, ellipsize(p.label, maxW, f.font), r.x + 2, Math.round(r.y + (r.h - f.font.ascent) / 2), { font: f.font, level: p.disabled ? lv.dim : p.focused ? lv.full : lv.bright })
  }
  const R = Math.floor(h / 2)
  const level = p.disabled ? lv.dim : lv.full
  // On: a solid track with the knob punched out, or (outline surface) a lit frame with a solid knob.
  const solid = p.on && drawBlock(fb, trackX, trackY, w, h, p.disabled ? lv.dim : lv.bright, theme, { radius: R })
  if (!p.on) roundRect(fb, trackX, trackY, w, h, R, { stroke: p.disabled ? lv.faint : lv.mid, width: 2 })
  const kx = p.on ? trackX + w - R : trackX + R
  const ky = trackY + h / 2
  if (solid) {
    fillCircle(fb, kx, ky, R - 3, 0)
    fillCircle(fb, kx, ky, R - 6, level)
  } else if (p.on) fillCircle(fb, kx, ky, R - 5, level)
  else strokeCircle(fb, kx, ky, R - 5, level, 2)
  if (p.stateText !== false && h >= 18) {
    const f = theme.fonts.small
    const t = p.on ? 'ON' : 'OFF'
    const tx = p.on ? trackX + (w - 2 * R) / 2 + 2 : trackX + 2 * R + (w - 2 * R) / 2 - 2
    drawText(fb, t, Math.round(tx), Math.round(ky - f.ascent / 2), { font: f, level: solid ? 0 : p.on ? lv.bright : lv.mid, align: 'center' })
  }
  if (p.focused) strokeRect(fb, trackX - 3, trackY - 3, w + 6, h + 6, lv.full, 1)
}

export const Toggle = defineComponent<ToggleProps>('Toggle', { w: 160, h: 36 }, renderToggle)

export interface ProgressBarProps {
  /** 0–1, or value/max when `max` is set. */
  value: number
  max?: number
  /** Split into N segments (lit segments are filled, unlit are outlines). */
  segments?: number
  /** Label above the bar; `true` shows the percentage on the right. */
  label?: string
  showValue?: boolean
  /** Custom value text (default: percentage). */
  valueText?: string
  /** Bar height (default: fits the rect, max 16). */
  barHeight?: number
}

export function renderProgressBar(fb: Framebuffer, rect: Rect, p: ProgressBarProps, theme: Theme): void {
  const lv = theme.levels
  const frac = Math.max(0, Math.min(1, p.max ? p.value / p.max : p.value))
  let r = rect
  const f = theme.fonts.body
  if (p.label) {
    const [strip, rest] = cut(r, 'top', f.glyphH + 4)
    drawText(fb, ellipsize(p.label, strip.w, f), strip.x, strip.y, { font: f, level: lv.bright })
    r = rest
  }
  const vt = p.valueText ?? `${Math.round(frac * 100)}%`
  if (p.showValue !== false) {
    const vw = textWidth(vt, f) + 6
    const [strip, rest] = cut(r, 'right', vw)
    drawText(fb, vt, strip.x + strip.w, Math.round(strip.y + (strip.h - f.ascent) / 2), { font: f, level: lv.full, align: 'right' })
    r = rest
  }
  const bh = Math.min(p.barHeight ?? 16, r.h)
  const by = Math.round(r.y + (r.h - bh) / 2)
  // The done part: solid; hatched under the outline surface; a 2 px frame with `surfaceTexture: false`.
  const outline = isOutline(theme)
  const texture = outlineTexture(theme)
  const fillDone = (x: number, y: number, w: number, h: number) => {
    if (!outline) fb.fillRect(x, y, w, h, lv.bright)
    else if (texture) fillRectPaint(fb, x, y, w, h, { pattern: 'hatch', level: lv.bright })
    else strokeRect(fb, x, y, w, h, lv.bright, 2)
  }
  if (p.segments && p.segments > 1) {
    const n = p.segments
    const gap = 3
    const sw = (r.w - gap * (n - 1)) / n
    const lit = frac * n
    for (let i = 0; i < n; i++) {
      const x = Math.round(r.x + i * (sw + gap))
      const w = Math.round(r.x + (i + 1) * (sw + gap) - gap) - x
      if (i + 1 <= lit + 1e-9) {
        fillDone(x, by, w, bh)
        if (texture) strokeRect(fb, x, by, w, bh, lv.bright, 1)
      } else if (i < lit) {
        // Partially lit segment: fill proportionally, rest outline.
        strokeRect(fb, x, by, w, bh, lv.dim, 1)
        fillDone(x, by, Math.round(w * (lit - i)), bh)
      } else strokeRect(fb, x, by, w, bh, lv.dim, 1)
    }
    return
  }
  strokeRect(fb, r.x, by, r.w, bh, lv.mid, 1)
  const fw = Math.round((r.w - 4) * frac)
  if (fw > 0) {
    fillDone(r.x + 2, by + 2, fw, bh - 4)
    // A solid leading edge keeps the value crisp over the hatch.
    if (outline) fb.fillRect(r.x + fw, by + 2, 2, bh - 4, lv.bright)
  }
  // End tick at 100% so an almost-full bar still reads as not done.
  fb.fillRect(r.x + r.w - 1, by - 2, 1, bh + 4, lv.mid)
}

export const ProgressBar = defineComponent<ProgressBarProps>('ProgressBar', { w: 260, h: 40 }, renderProgressBar)

export interface BigTextProps {
  text: string
  align?: Align
  valign?: VAlign
  /** Wrap onto several lines (default true). */
  wrap?: boolean
  maxLines?: number
  level?: number
  /** Candidate fonts, largest first (default display×2, display, body×2, body, small). */
  fonts?: ReadonlyArray<{ font: FontName; scale?: number }>
}

/** Headline that auto-fits: the largest font at which the text fits without truncation. */
export function renderBigText(fb: Framebuffer, rect: Rect, p: BigTextProps, theme: Theme): void {
  const cands = (p.fonts ?? [{ font: 'display', scale: 2 }, { font: 'display' }, { font: 'body', scale: 2 }, { font: 'body' }, { font: 'small' }]).map((c) => themeFont(theme, c.font, c.scale))
  const fit = fitText(p.text, rect, cands, { wrap: p.wrap !== false, maxLines: p.maxLines })
  drawTextBox(fb, rect, fit.lines.join('\n'), {
    font: fit.font,
    scale: fit.scale,
    level: p.level ?? theme.levels.full,
    align: p.align ?? 'center',
    valign: p.valign ?? 'middle',
    wrap: true,
    maxLines: p.maxLines,
  })
}

export const BigText = defineComponent<BigTextProps>('BigText', { w: 288, h: 144 }, renderBigText)
