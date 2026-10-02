/**
 * The firmware text grid. The G2 font is proportional, but fullwidth characters (Ｑ, ｑ, １, ［, ＿, the
 * ideographic space) and some shapes all advance exactly 20 px, from the text box's left edge (padding 0),
 * with lines 27 px apart. So text built only from those characters is a grid that drawn images can line up
 * with: key frames under keyboard letters, marks under labels. Measured in evenhub-simulator 0.9.5 and lined
 * up on G2 glasses (ROADMAP H7). Arrows (← → 17 px, ↑ ↓ ↗ 14 px) and ASCII are not on the grid.
 *
 * A text box can't move (a text update changes its content only), so anything that moves on the grid, e.g.
 * a focus marker, is characters swapped in place for characters of the same width.
 */

export const TEXT_GRID = {
  /** Advance of a grid character, px. */
  cell: 20,
  /** Line pitch, px. */
  line: 27,
  /** A fullwidth glyph's vertical middle below its line's top, px. */
  mid: 16,
} as const

/** The ideographic space: an empty grid cell. */
export const GRID_SPACE = '　'

/** Shapes measured at 20 px, usable as grid characters next to fullwidth ASCII. */
export const GRID_SHAPES = '⇒▲△▶▷◀◁▼▽●○◎◆◇■□★※┃'

/** True for characters that take exactly one grid cell. */
export function isGridChar(ch: string): boolean {
  const c = ch.codePointAt(0)!
  return (c >= 0xff01 && c <= 0xff5e) || ch === GRID_SPACE || GRID_SHAPES.includes(ch)
}

/**
 * Printable ASCII to fullwidth (`OK` → `ＯＫ`, space → ideographic space); grid characters pass through.
 * Throws on anything else, since it would knock the rest of the line off the grid.
 */
export function toFullwidth(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (ch === ' ') out += GRID_SPACE
    else if (c > 0x20 && c < 0x7f) out += String.fromCodePoint(c - 0x21 + 0xff01)
    else if (isGridChar(ch)) out += ch
    else throw new RangeError(`'${ch}' is not on the G2 text grid (fullwidth ASCII, ideographic space, ${GRID_SHAPES})`)
  }
  return out
}
