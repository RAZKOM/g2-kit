/**
 * Parametric 7-segment numerals for big, glanceable numbers. Any height; every
 * digit has the same width, so updating values never shifts the layout.
 *
 *    aaa
 *   f   b
 *    ggg
 *   e   c
 *    ddd
 */
import type { Framebuffer } from '../framebuffer.js'
import { fillPolygon } from '../draw.js'

const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  _: 'd',
  ' ': '',
  A: 'abcefg',
  b: 'cdefg',
  C: 'adef',
  c: 'deg',
  d: 'bcdeg',
  E: 'adefg',
  F: 'aefg',
  H: 'bcefg',
  h: 'cefg',
  L: 'def',
  n: 'ceg',
  o: 'cdeg',
  P: 'abefg',
  r: 'eg',
  t: 'defg',
  U: 'bcdef',
  u: 'cde',
  y: 'bcdfg',
  '°': 'abfg',
}

export interface SevenSegStyle {
  /** Digit height in px (default 32). */
  height?: number
  /** Digit width (default height × 0.55). */
  width?: number
  /** Segment thickness (default height / 8, min 2). */
  thickness?: number
  level?: number
  /** Draw unlit segments at this level (e.g. FAINT) for an LCD look; omit for off. */
  unlit?: number
  /** Gap between digits (default thickness). */
  spacing?: number
}

function metrics(style: SevenSegStyle) {
  const h = style.height ?? 32
  const w = style.width ?? Math.round(h * 0.55)
  const t = style.thickness ?? Math.max(2, Math.round(h / 8))
  const gap = style.spacing ?? t
  // '.' and ':' take a narrow slot.
  return { h, w, t, gap, narrow: t * 2 }
}

/** Width of a 7-seg string. */
export function measureSevenSeg(text: string, style: SevenSegStyle = {}): number {
  const m = metrics(style)
  let w = 0
  for (const ch of text) w += (ch === '.' || ch === ':' ? m.narrow : m.w) + m.gap
  return Math.max(0, w - m.gap)
}

function segment(fb: Framebuffer, s: string, x: number, y: number, w: number, h: number, t: number, level: number): void {
  const half = t / 2
  const mid = y + h / 2
  // Horizontal segments are hexagons; vertical ones too, with 1 px clearance.
  const horiz = (cy: number) =>
    fillPolygon(fb, [
      { x: x + half + 1, y: cy },
      { x: x + t + 1, y: cy - half },
      { x: x + w - t - 1, y: cy - half },
      { x: x + w - half - 1, y: cy },
      { x: x + w - t - 1, y: cy + half },
      { x: x + t + 1, y: cy + half },
    ], level)
  const vert = (cx: number, y0: number, y1: number) =>
    fillPolygon(fb, [
      { x: cx, y: y0 + half + 1 },
      { x: cx + half, y: y0 + t + 1 },
      { x: cx + half, y: y1 - t - 1 },
      { x: cx, y: y1 - half - 1 },
      { x: cx - half, y: y1 - t - 1 },
      { x: cx - half, y: y0 + t + 1 },
    ], level)
  switch (s) {
    case 'a':
      return horiz(y + half)
    case 'g':
      return horiz(mid)
    case 'd':
      return horiz(y + h - half)
    case 'f':
      return vert(x + half, y, mid + half)
    case 'b':
      return vert(x + w - half, y, mid + half)
    case 'e':
      return vert(x + half, mid - half, y + h)
    case 'c':
      return vert(x + w - half, mid - half, y + h)
  }
}

/** Draw a 7-seg string with its top-left at (x, y). Returns the drawn width. */
export function drawSevenSeg(fb: Framebuffer, text: string, x: number, y: number, style: SevenSegStyle = {}): number {
  const m = metrics(style)
  const level = style.level ?? 15
  let cx = x
  for (const ch of text) {
    if (ch === '.' || ch === ':') {
      const r = m.t
      if (ch === '.') fb.fillRect(cx + (m.narrow - r) / 2, y + m.h - r, r, r, level)
      else {
        fb.fillRect(cx + (m.narrow - r) / 2, y + Math.round(m.h * 0.3) - r / 2, r, r, level)
        fb.fillRect(cx + (m.narrow - r) / 2, y + Math.round(m.h * 0.7) - r / 2, r, r, level)
      }
      cx += m.narrow + m.gap
      continue
    }
    const on = SEGMENTS[ch] ?? SEGMENTS[ch.toUpperCase()] ?? SEGMENTS[ch.toLowerCase()] ?? ''
    for (const s of 'abcdefg') {
      if (on.includes(s)) segment(fb, s, cx, y, m.w, m.h, m.t, level)
      else if (style.unlit !== undefined && ch !== ' ') segment(fb, s, cx, y, m.w, m.h, m.t, style.unlit)
    }
    cx += m.w + m.gap
  }
  return cx - x - m.gap
}
