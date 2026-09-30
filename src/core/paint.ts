/**
 * Fill patterns, stroke dash patterns and "paints". On a green see-through
 * display only a handful of grey levels are reliably distinct, so series and
 * categories are told apart by pattern and shape first, brightness second.
 * Patterns are anchored to absolute pixel coordinates so neighbouring shapes
 * line up.
 */

export type FillPattern =
  | 'solid'
  | 'hatch' // diagonal ╱
  | 'backHatch' // diagonal ╲
  | 'crossHatch'
  | 'dots'
  | 'checker'
  | 'vStripes'
  | 'hStripes'
  | 'sparseDots'

/** Pattern name → "is this pixel on". Spacing is ≥ 2 px so it survives the display. */
export const FILL_PATTERNS: Readonly<Record<FillPattern, (x: number, y: number) => boolean>> = {
  solid: () => true,
  hatch: (x, y) => (((x + y) % 5) + 5) % 5 < 2,
  backHatch: (x, y) => (((x - y) % 5) + 5) % 5 < 2,
  crossHatch: (x, y) => (((x + y) % 6) + 6) % 6 < 2 || (((x - y) % 6) + 6) % 6 < 2,
  dots: (x, y) => (x & 3) < 2 && (y & 3) < 2,
  checker: (x, y) => (((x >> 1) + (y >> 1)) & 1) === 0,
  vStripes: (x) => (x & 3) < 2,
  hStripes: (_x, y) => (y & 3) < 2,
  sparseDots: (x, y) => (x & 3) === 0 && (y & 3) === 0,
}

/** A paint is a plain level, or a pattern drawn at `level` over optional `bg`. */
export type Paint = number | { pattern: FillPattern; level: number; bg?: number }

/** Resolve a paint to a per-pixel level; -1 means "leave the pixel alone". */
export function paintAt(paint: Paint, x: number, y: number): number {
  if (typeof paint === 'number') return paint
  return FILL_PATTERNS[paint.pattern](x, y) ? paint.level : (paint.bg ?? -1)
}

export function isSolid(paint: Paint): paint is number {
  return typeof paint === 'number'
}

export type DashStyle = 'solid' | 'dashed' | 'dotted' | 'dashDot' | 'longDash'

/** On/off run lengths in pixels along the path. Empty = solid. */
export const DASH_PATTERNS: Readonly<Record<DashStyle, readonly number[]>> = {
  solid: [],
  dashed: [6, 4],
  dotted: [2, 3],
  dashDot: [8, 3, 2, 3],
  longDash: [12, 5],
}

export type Dash = DashStyle | readonly number[]

export function dashArray(dash: Dash | undefined): readonly number[] {
  if (!dash) return []
  return typeof dash === 'string' ? DASH_PATTERNS[dash] : dash
}

/** Stateful dash walker: call `step()` per pixel along a path. */
export class DashCursor {
  private i = 0
  private left: number
  constructor(private readonly runs: readonly number[]) {
    this.left = runs[0] ?? Infinity
  }
  /** True if the current pixel is "on"; advances by one pixel. */
  step(): boolean {
    if (this.runs.length === 0) return true
    const on = this.i % 2 === 0
    this.left--
    if (this.left <= 0) {
      this.i = (this.i + 1) % this.runs.length
      this.left = this.runs[this.i]
    }
    return on
  }
}
