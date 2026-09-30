/** Integer pixel rectangle. `w`/`h` may be 0 (empty). */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Size {
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export type Insets = number | { top?: number; right?: number; bottom?: number; left?: number }

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h }
}

export function isEmpty(r: Rect): boolean {
  return r.w <= 0 || r.h <= 0
}

export function inset(r: Rect, by: Insets): Rect {
  const t = typeof by === 'number' ? by : (by.top ?? 0)
  const ri = typeof by === 'number' ? by : (by.right ?? 0)
  const b = typeof by === 'number' ? by : (by.bottom ?? 0)
  const l = typeof by === 'number' ? by : (by.left ?? 0)
  return { x: r.x + l, y: r.y + t, w: Math.max(0, r.w - l - ri), h: Math.max(0, r.h - t - b) }
}

export function intersect(a: Rect, b: Rect): Rect {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

export function union(a: Rect | null, b: Rect | null): Rect | null {
  if (!a || isEmpty(a)) return b && !isEmpty(b) ? { ...b } : null
  if (!b || isEmpty(b)) return { ...a }
  const x0 = Math.min(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const x1 = Math.max(a.x + a.w, b.x + b.w)
  const y1 = Math.max(a.y + a.h, b.y + b.h)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function overlaps(a: Rect, b: Rect): boolean {
  return !isEmpty(intersect(a, b))
}

export function contains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
}

export function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** Split horizontally into columns. `parts` are weights, or fixed px when > 1 and `fixed` is set. */
export function splitColumns(r: Rect, weights: readonly number[], gap = 0): Rect[] {
  const total = weights.reduce((a, b) => a + b, 0)
  const avail = r.w - gap * (weights.length - 1)
  const out: Rect[] = []
  let x = r.x
  let acc = 0
  weights.forEach((wt, i) => {
    acc += wt
    const xEnd = i === weights.length - 1 ? r.x + r.w : r.x + Math.round((acc / total) * avail) + gap * i
    out.push({ x, y: r.y, w: xEnd - x, h: r.h })
    x = xEnd + gap
  })
  return out
}

/** Split vertically into rows by weight. */
export function splitRows(r: Rect, weights: readonly number[], gap = 0): Rect[] {
  return splitColumns({ x: r.y, y: r.x, w: r.h, h: r.w }, weights, gap).map((c) => ({ x: c.y, y: c.x, w: c.h, h: c.w }))
}

/** Take a fixed-size strip off one edge; returns [strip, rest]. */
export function cut(r: Rect, edge: 'top' | 'bottom' | 'left' | 'right', size: number): [Rect, Rect] {
  const s = Math.max(0, Math.min(size, edge === 'top' || edge === 'bottom' ? r.h : r.w))
  switch (edge) {
    case 'top':
      return [{ x: r.x, y: r.y, w: r.w, h: s }, { x: r.x, y: r.y + s, w: r.w, h: r.h - s }]
    case 'bottom':
      return [{ x: r.x, y: r.y + r.h - s, w: r.w, h: s }, { x: r.x, y: r.y, w: r.w, h: r.h - s }]
    case 'left':
      return [{ x: r.x, y: r.y, w: s, h: r.h }, { x: r.x + s, y: r.y, w: r.w - s, h: r.h }]
    case 'right':
      return [{ x: r.x + r.w - s, y: r.y, w: s, h: r.h }, { x: r.x, y: r.y, w: r.w - s, h: r.h }]
  }
}

/** A rect of `size` aligned inside `outer`. */
export function place(outer: Rect, size: Size, align: 'start' | 'center' | 'end' = 'center', valign: 'start' | 'center' | 'end' = 'center'): Rect {
  const dx = align === 'start' ? 0 : align === 'end' ? outer.w - size.w : Math.floor((outer.w - size.w) / 2)
  const dy = valign === 'start' ? 0 : valign === 'end' ? outer.h - size.h : Math.floor((outer.h - size.h) / 2)
  return { x: outer.x + dx, y: outer.y + dy, w: size.w, h: size.h }
}

/** Degrees → radians with 0° at 12 o'clock, increasing clockwise (screen y grows downward). */
export function polar(cx: number, cy: number, r: number, deg: number): Point {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}
