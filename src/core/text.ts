/** Bitmap text: measure, draw, align, ellipsis, wrap, auto-fit. */
import type { Framebuffer } from './framebuffer.js'
import type { Rect } from './geometry.js'
import type { BitmapFont } from './fonts/font.js'
import { font5x7 } from './fonts/font5x7.js'

export type Align = 'left' | 'center' | 'right'
export type VAlign = 'top' | 'middle' | 'bottom'

export interface TextStyle {
  font?: BitmapFont
  /** Integer pixel scale (default 1). */
  scale?: number
  level?: number
  align?: Align
}

/** Width in px of `text` (no trailing spacing). */
export function textWidth(text: string, font: BitmapFont = font5x7, scale = 1): number {
  const n = [...text].length
  return n === 0 ? 0 : (n * font.advance - (font.advance - font.glyphW)) * scale
}

/** Height of one line of glyphs (cap + descender rows). */
export function textHeight(font: BitmapFont = font5x7, scale = 1): number {
  return font.glyphH * scale
}

export function drawGlyph(fb: Framebuffer, ch: string, x: number, y: number, font: BitmapFont, scale: number, level: number): void {
  const g = font.glyph(ch)
  if (!g) return
  const W = font.glyphW
  for (let row = 0; row < font.glyphH; row++)
    for (let col = 0; col < W; col++)
      if (g[row * W + col]) {
        if (scale === 1) fb.set(x + col, y + row, level)
        else fb.fillRect(x + col * scale, y + row * scale, scale, scale, level)
      }
}

/**
 * Draw one line. `x` is the left edge, centre or right edge depending on
 * `align`; `y` is the top of the glyph box. Returns the drawn width.
 */
export function drawText(fb: Framebuffer, text: string, x: number, y: number, style: TextStyle = {}): number {
  const font = style.font ?? font5x7
  const scale = style.scale ?? 1
  const level = style.level ?? 15
  const w = textWidth(text, font, scale)
  let left = x
  if (style.align === 'center') left = Math.round(x - w / 2)
  else if (style.align === 'right') left = x - w
  let cx = left
  for (const ch of text) {
    drawGlyph(fb, ch, cx, y, font, scale, level)
    cx += font.advance * scale
  }
  return w
}

/** Truncate to fit `maxW`, appending an ellipsis ('…' if the font has it, else '..'). */
export function ellipsize(text: string, maxW: number, font: BitmapFont = font5x7, scale = 1): string {
  if (textWidth(text, font, scale) <= maxW) return text
  const ell = font.has('…') ? '…' : '..'
  const chars = [...text]
  while (chars.length > 0 && textWidth(chars.join('') + ell, font, scale) > maxW) chars.pop()
  const out = chars.join('').trimEnd()
  return textWidth(out + ell, font, scale) <= maxW ? out + ell : ''
}

/** Greedy word wrap. Words longer than a line are hard-broken. Honours '\n'. */
export function wrapText(text: string, maxW: number, font: BitmapFont = font5x7, scale = 1): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter((w) => w.length > 0)
    let cur = ''
    for (let word of words) {
      const trial = cur ? `${cur} ${word}` : word
      if (textWidth(trial, font, scale) <= maxW) {
        cur = trial
        continue
      }
      if (cur) lines.push(cur)
      // Hard-break words wider than the line.
      while (textWidth(word, font, scale) > maxW && word.length > 1) {
        const chars = [...word]
        let n = chars.length
        while (n > 1 && textWidth(chars.slice(0, n).join(''), font, scale) > maxW) n--
        lines.push(chars.slice(0, n).join(''))
        word = chars.slice(n).join('')
      }
      cur = word
    }
    lines.push(cur)
  }
  return lines
}

export interface TextBoxOptions extends TextStyle {
  valign?: VAlign
  /** Wrap onto multiple lines (default false: single line, ellipsized). */
  wrap?: boolean
  /** Max lines when wrapping; the last kept line gets an ellipsis. */
  maxLines?: number
  /** Distance between baselines in px at scale 1 (default font.lineHeight). */
  lineHeight?: number
  /** Truncate with an ellipsis instead of clipping (default true). */
  ellipsis?: boolean
}

/** Lay out and draw text inside a rect. Returns the lines drawn. */
export function drawTextBox(fb: Framebuffer, r: Rect, text: string, opts: TextBoxOptions = {}): string[] {
  const font = opts.font ?? font5x7
  const scale = opts.scale ?? 1
  const lh = (opts.lineHeight ?? font.lineHeight) * scale
  const glyphH = font.glyphH * scale
  const fitLines = Math.max(1, Math.floor((r.h - glyphH) / lh) + 1)
  const maxLines = Math.min(opts.maxLines ?? Infinity, fitLines)
  let lines = opts.wrap ? wrapText(text, r.w, font, scale) : [text.replace(/\n/g, ' ')]
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    const last = lines.length - 1
    lines[last] = ellipsize(lines[last] + (font.has('…') ? '…' : '..'), r.w, font, scale)
  }
  if (opts.ellipsis !== false) lines = lines.map((l) => ellipsize(l, r.w, font, scale))
  const blockH = (lines.length - 1) * lh + glyphH
  const va = opts.valign ?? 'top'
  let y = va === 'top' ? r.y : va === 'bottom' ? r.y + r.h - blockH : r.y + Math.round((r.h - blockH) / 2)
  const align = opts.align ?? 'left'
  const x = align === 'left' ? r.x : align === 'right' ? r.x + r.w : r.x + r.w / 2
  fb.withClip(r, () => {
    for (const l of lines) {
      drawText(fb, l, x, y, { font, scale, level: opts.level, align })
      y += lh
    }
  })
  return lines
}

export interface FitCandidate {
  font: BitmapFont
  scale?: number
}

export interface FitResult {
  font: BitmapFont
  scale: number
  lines: string[]
}

/**
 * Pick the first (largest) candidate at which `text` fits `r` without
 * truncation. Falls back to the last candidate, ellipsized.
 */
export function fitText(text: string, r: { w: number; h: number }, candidates: readonly FitCandidate[], opts: { wrap?: boolean; maxLines?: number } = {}): FitResult {
  for (const c of candidates) {
    const scale = c.scale ?? 1
    const lh = c.font.lineHeight * scale
    const glyphH = c.font.glyphH * scale
    const lines = opts.wrap ? wrapText(text, r.w, c.font, scale) : [text]
    const tooWide = lines.some((l) => textWidth(l, c.font, scale) > r.w)
    const tooMany = lines.length > (opts.maxLines ?? Infinity)
    const h = (lines.length - 1) * lh + glyphH
    if (!tooWide && !tooMany && h <= r.h) return { font: c.font, scale, lines }
  }
  const last = candidates[candidates.length - 1]
  const scale = last.scale ?? 1
  const lines = opts.wrap ? wrapText(text, r.w, last.font, scale) : [ellipsize(text, r.w, last.font, scale)]
  return { font: last.font, scale, lines }
}
