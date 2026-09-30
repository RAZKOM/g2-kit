/** Monospaced bitmap fonts compiled from '#'/'.' row strings. */

export interface BitmapFont {
  readonly name: string
  /** Glyph bitmap width/height in px. */
  readonly glyphW: number
  readonly glyphH: number
  /** Horizontal advance per character at scale 1 (glyph + spacing). */
  readonly advance: number
  /** Suggested distance between baselines at scale 1. */
  readonly lineHeight: number
  /** Rows above the baseline (cap height). Descenders sit below. */
  readonly ascent: number
  /** 1 = pixel on; glyphW × glyphH, or undefined when the font lacks the char. */
  glyph(ch: string): Uint8Array | undefined
  has(ch: string): boolean
}

export interface FontSpec {
  name: string
  glyphW: number
  glyphH: number
  advance: number
  lineHeight: number
  ascent: number
  /** Character → rows of '#' (on) / '.' (off). Missing trailing rows are blank. */
  glyphs: Record<string, readonly string[]>
  /** Char drawn for unknown characters (default '?'). */
  fallback?: string
  /** Map lowercase to uppercase when the font has no lowercase. */
  upperOnly?: boolean
}

export function defineFont(spec: FontSpec): BitmapFont {
  const compiled = new Map<string, Uint8Array>()
  for (const [ch, rows] of Object.entries(spec.glyphs)) {
    if (rows.length > spec.glyphH) throw new Error(`font ${spec.name}: glyph '${ch}' has ${rows.length} rows (max ${spec.glyphH})`)
    const bm = new Uint8Array(spec.glyphW * spec.glyphH)
    rows.forEach((row, y) => {
      if (row.length !== spec.glyphW) throw new Error(`font ${spec.name}: glyph '${ch}' row ${y} is ${row.length} wide (want ${spec.glyphW})`)
      for (let x = 0; x < row.length; x++) if (row[x] === '#') bm[y * spec.glyphW + x] = 1
    })
    compiled.set(ch, bm)
  }
  return fromBitmaps(spec, compiled)
}

/** Build a font from already-compiled bitmaps (used by derived fonts). */
export function fromBitmaps(
  meta: Omit<FontSpec, 'glyphs'>,
  bitmaps: Map<string, Uint8Array>,
): BitmapFont {
  const fallback = meta.fallback ?? '?'
  const key = (ch: string) => (meta.upperOnly ? ch.toUpperCase() : ch)
  return {
    name: meta.name,
    glyphW: meta.glyphW,
    glyphH: meta.glyphH,
    advance: meta.advance,
    lineHeight: meta.lineHeight,
    ascent: meta.ascent,
    has: (ch) => bitmaps.has(key(ch)),
    glyph: (ch) => bitmaps.get(key(ch)) ?? bitmaps.get(fallback),
  }
}

/**
 * Scale2x (EPX) upscaling: doubles a font while smoothing diagonals, so the
 * display size is derived from the body font instead of shipping a third
 * hand-drawn table. Computed lazily on first use.
 */
export function scale2xFont(src: BitmapFont, name: string, chars: string): BitmapFont {
  let cache: Map<string, Uint8Array> | null = null
  const W = src.glyphW * 2
  const H = src.glyphH * 2
  const build = () => {
    cache = new Map()
    for (const ch of chars) {
      const g = src.has(ch) ? src.glyph(ch) : undefined
      if (g) cache.set(ch, epx(g, src.glyphW, src.glyphH))
    }
    return cache
  }
  return {
    name,
    glyphW: W,
    glyphH: H,
    advance: src.advance * 2,
    lineHeight: src.lineHeight * 2,
    ascent: src.ascent * 2,
    has: (ch) => (cache ?? build()).has(ch),
    glyph: (ch) => (cache ?? build()).get(ch) ?? (cache ?? build()).get('?'),
  }
}

function epx(g: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * 2 * h * 2)
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : g[y * w + x])
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = at(x, y)
      const a = at(x, y - 1)
      const b = at(x + 1, y)
      const c = at(x - 1, y)
      const d = at(x, y + 1)
      let p1 = p
      let p2 = p
      let p3 = p
      let p4 = p
      if (c === a && c !== d && a !== b) p1 = a
      if (a === b && a !== c && b !== d) p2 = b
      if (d === c && d !== b && c !== a) p3 = c
      if (b === d && b !== a && d !== c) p4 = d
      const o = y * 2 * w * 2 + x * 2
      out[o] = p1
      out[o + 1] = p2
      out[o + w * 2] = p3
      out[o + w * 2 + 1] = p4
    }
  return out
}
