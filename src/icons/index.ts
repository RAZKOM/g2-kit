/**
 * Small icon set, drawn from vectors on a 16-unit grid so one definition
 * renders at 8, 12 or 16 px (any size works; those three are tuned). Strokes
 * are 1 px at 8, 2 px at 12+. Each icon is a separate export so unused ones
 * tree-shake; `drawIcon(name)` pulls in the whole set.
 */
import { fillCircle, fillPolygon, fillSector, line, polyline, strokeArc, strokeCircle, strokeRect } from '../core/draw.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Point } from '../core/geometry.js'

export type IconDraw = (fb: Framebuffer, x: number, y: number, size: number, level: number) => void

/** Grid helpers: map 16-unit coordinates into the icon box. */
function grid(x: number, y: number, s: number) {
  const k = s / 16
  const P = (px: number, py: number): Point => ({ x: x + px * k, y: y + py * k })
  const w = s <= 9 ? 1 : 2
  const L = (fb: Framebuffer, pts: Array<[number, number]>, l: number, width = w) => polyline(fb, pts.map(([a, b]) => P(a, b)), l, { width })
  const F = (fb: Framebuffer, pts: Array<[number, number]>, l: number) => fillPolygon(fb, pts.map(([a, b]) => P(a, b)), l)
  return { P, k, w, L, F }
}

export const check: IconDraw = (fb, x, y, s, l) => {
  const { L } = grid(x, y, s)
  L(fb, [[2, 8], [6, 12], [14, 3]], l)
}
export const cross: IconDraw = (fb, x, y, s, l) => {
  const { L } = grid(x, y, s)
  L(fb, [[3, 3], [13, 13]], l)
  L(fb, [[13, 3], [3, 13]], l)
}
export const plus: IconDraw = (fb, x, y, s, l) => {
  const { L } = grid(x, y, s)
  L(fb, [[8, 2], [8, 14]], l)
  L(fb, [[2, 8], [14, 8]], l)
}
export const minus: IconDraw = (fb, x, y, s, l) => {
  const { L } = grid(x, y, s)
  L(fb, [[2, 8], [14, 8]], l)
}
export const arrowUp: IconDraw = (fb, x, y, s, l) => {
  const { L, F } = grid(x, y, s)
  F(fb, [[8, 1], [14, 8], [2, 8]], l)
  L(fb, [[8, 7], [8, 15]], l, Math.max(2, Math.round(s / 6)))
}
export const arrowDown: IconDraw = (fb, x, y, s, l) => {
  const { L, F } = grid(x, y, s)
  F(fb, [[2, 8], [14, 8], [8, 15]], l)
  L(fb, [[8, 1], [8, 9]], l, Math.max(2, Math.round(s / 6)))
}
export const arrowLeft: IconDraw = (fb, x, y, s, l) => {
  const { L, F } = grid(x, y, s)
  F(fb, [[1, 8], [8, 2], [8, 14]], l)
  L(fb, [[7, 8], [15, 8]], l, Math.max(2, Math.round(s / 6)))
}
export const arrowRight: IconDraw = (fb, x, y, s, l) => {
  const { L, F } = grid(x, y, s)
  F(fb, [[15, 8], [8, 2], [8, 14]], l)
  L(fb, [[1, 8], [9, 8]], l, Math.max(2, Math.round(s / 6)))
}
export const chevronUp: IconDraw = (fb, x, y, s, l) => grid(x, y, s).L(fb, [[3, 11], [8, 5], [13, 11]], l)
export const chevronDown: IconDraw = (fb, x, y, s, l) => grid(x, y, s).L(fb, [[3, 5], [8, 11], [13, 5]], l)
export const chevronLeft: IconDraw = (fb, x, y, s, l) => grid(x, y, s).L(fb, [[11, 3], [5, 8], [11, 13]], l)
export const chevronRight: IconDraw = (fb, x, y, s, l) => grid(x, y, s).L(fb, [[5, 3], [11, 8], [5, 13]], l)
export const play: IconDraw = (fb, x, y, s, l) => grid(x, y, s).F(fb, [[3, 1], [15, 8], [3, 15]], l)
export const pause: IconDraw = (fb, x, y, s, l) => {
  const { F } = grid(x, y, s)
  F(fb, [[3, 2], [7, 2], [7, 14], [3, 14]], l)
  F(fb, [[9, 2], [13, 2], [13, 14], [9, 14]], l)
}
export const stop: IconDraw = (fb, x, y, s, l) => grid(x, y, s).F(fb, [[2, 2], [14, 2], [14, 14], [2, 14]], l)
export const record: IconDraw = (fb, x, y, s, l) => fillCircle(fb, x + s / 2, y + s / 2, s * 0.38, l)
export const heart: IconDraw = (fb, x, y, s, l) => {
  const { P, k, F } = grid(x, y, s)
  const a = P(4.5, 5.5)
  const b = P(11.5, 5.5)
  fillCircle(fb, a.x, a.y, 3.8 * k, l)
  fillCircle(fb, b.x, b.y, 3.8 * k, l)
  F(fb, [[0.9, 6.5], [15.1, 6.5], [8, 14.5]], l)
}
export const heartOutline: IconDraw = (fb, x, y, s, l) => {
  const { P, k, L, w } = grid(x, y, s)
  const a = P(4.8, 5.5)
  const b = P(11.2, 5.5)
  strokeArc(fb, a.x, a.y, 3.4 * k, 225, 450, l, w)
  strokeArc(fb, b.x, b.y, 3.4 * k, 270, 495, l, w)
  L(fb, [[1.8, 7.6], [8, 14], [14.2, 7.6]], l)
}
export const star: IconDraw = (fb, x, y, s, l) => {
  const { F } = grid(x, y, s)
  const pts: Array<[number, number]> = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 7.8 : 3.3
    const a = ((i * 36 - 90) * Math.PI) / 180
    pts.push([8 + r * Math.cos(a), 8.6 + r * Math.sin(a)])
  }
  F(fb, pts, l)
}
export const starOutline: IconDraw = (fb, x, y, s, l) => {
  const { L } = grid(x, y, s)
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= 10; i++) {
    const r = i % 2 === 0 ? 7.5 : 3.3
    const a = ((i * 36 - 90) * Math.PI) / 180
    pts.push([8 + r * Math.cos(a), 8.6 + r * Math.sin(a)])
  }
  L(fb, pts, l, 1)
}
export const bolt: IconDraw = (fb, x, y, s, l) => grid(x, y, s).F(fb, [[9, 0], [3, 9], [7.5, 9], [6, 16], [13, 6.5], [8.5, 6.5], [10.5, 0]], l)
export const battery: IconDraw = (fb, x, y, s, l) => drawBattery(fb, x, y, s, l, 1)
/** Battery with a fill fraction 0–1 (segments at 12+ px). */
export function drawBattery(fb: Framebuffer, x: number, y: number, s: number, l: number, frac: number): void {
  const { P, w } = grid(x, y, s)
  const a = P(0.5, 4)
  const b = P(14, 12)
  const bw = Math.round(b.x - a.x)
  const bh = Math.round(b.y - a.y)
  strokeRect(fb, Math.round(a.x), Math.round(a.y), bw, bh, l, w === 2 && s < 14 ? 1 : w)
  const tip = P(14, 6.5)
  fb.fillRect(Math.round(tip.x), Math.round(tip.y), Math.max(1, Math.round(s / 10)), Math.max(2, Math.round((3 * s) / 16)), l)
  const inner = (w === 2 && s >= 14 ? 2 : 1) + 1
  const iw = bw - 2 * inner
  const fw = Math.round(iw * Math.max(0, Math.min(1, frac)))
  if (fw > 0) fb.fillRect(Math.round(a.x) + inner, Math.round(a.y) + inner, fw, bh - 2 * inner, l)
}
export const signal: IconDraw = (fb, x, y, s, l) => drawSignal(fb, x, y, s, l, 4)
/** Signal bars with `bars` of 4 lit (unlit bars as a 1 px stub). */
export function drawSignal(fb: Framebuffer, x: number, y: number, s: number, l: number, bars: number): void {
  const { P, k } = grid(x, y, s)
  for (let i = 0; i < 4; i++) {
    const top = P(1 + i * 4, 14 - (i + 1) * 3)
    const bw = Math.max(1, Math.round(2.6 * k))
    const bh = Math.round(y + s - 1 - top.y)
    if (i < bars) fb.fillRect(Math.round(top.x), Math.round(top.y), bw, bh, l)
    else fb.fillRect(Math.round(top.x), Math.round(y + s - 2), bw, 1, l)
  }
}
export const wifi: IconDraw = (fb, x, y, s, l) => {
  const { P, k, w } = grid(x, y, s)
  const c = P(8, 14)
  for (const r of [12, 8, 4]) strokeArc(fb, c.x, c.y, r * k, -45, 45, l, w)
  fillCircle(fb, c.x, c.y - k, 1.6 * k, l)
}
export const bluetooth: IconDraw = (fb, x, y, s, l) => grid(x, y, s).L(fb, [[4, 5], [12, 11], [8, 15], [8, 1], [12, 5], [4, 11]], l)
export const clock: IconDraw = (fb, x, y, s, l) => {
  const { P, k, L, w } = grid(x, y, s)
  const c = P(8, 8)
  strokeCircle(fb, c.x, c.y, 7 * k, l, w)
  L(fb, [[8, 4], [8, 8.5], [11, 10]], l)
}
export const bell: IconDraw = (fb, x, y, s, l) => {
  const { F, P, k } = grid(x, y, s)
  const c = P(8, 7)
  fillSector(fb, c.x, c.y, 0, 5 * k, -90, 90, l)
  F(fb, [[3, 7], [13, 7], [14.5, 12.5], [1.5, 12.5]], l)
  const d = P(8, 14)
  fillCircle(fb, d.x, d.y, 1.8 * k, l)
}
export const home: IconDraw = (fb, x, y, s, l) => {
  const { F } = grid(x, y, s)
  F(fb, [[8, 1], [15.5, 8], [1, 8]], l)
  F(fb, [[3, 8], [13, 8], [13, 15], [9.5, 15], [9.5, 10.5], [6.5, 10.5], [6.5, 15], [3, 15]], l)
}
export const search: IconDraw = (fb, x, y, s, l) => {
  const { P, k, L, w } = grid(x, y, s)
  const c = P(6.5, 6.5)
  strokeCircle(fb, c.x, c.y, 4.8 * k, l, w)
  L(fb, [[10, 10], [14.5, 14.5]], l, w + 1)
}
export const trash: IconDraw = (fb, x, y, s, l) => {
  const { L, F } = grid(x, y, s)
  L(fb, [[2, 3.5], [14, 3.5]], l)
  L(fb, [[6, 3], [6, 1.5], [10, 1.5], [10, 3]], l)
  F(fb, [[3.5, 5], [12.5, 5], [11.5, 15], [4.5, 15]], l)
}
export const calendar: IconDraw = (fb, x, y, s, l) => {
  const { P, w } = grid(x, y, s)
  const a = P(1, 3)
  const b = P(15, 15)
  strokeRect(fb, Math.round(a.x), Math.round(a.y), Math.round(b.x - a.x), Math.round(b.y - a.y), l, w)
  const h = P(1, 6)
  fb.fillRect(Math.round(h.x), Math.round(h.y), Math.round(b.x - a.x), w, l)
  const p1 = P(4.5, 1)
  const p2 = P(11.5, 1)
  fb.fillRect(Math.round(p1.x), Math.round(p1.y), w, Math.round(s / 5), l)
  fb.fillRect(Math.round(p2.x), Math.round(p2.y), w, Math.round(s / 5), l)
}
export const pin: IconDraw = (fb, x, y, s, l) => {
  const { P, k, F } = grid(x, y, s)
  const c = P(8, 6)
  fillCircle(fb, c.x, c.y, 5.5 * k, l)
  F(fb, [[3.2, 8], [12.8, 8], [8, 15.5]], l)
  fillCircle(fb, c.x, c.y, 2 * k, 0)
}
export const lock: IconDraw = (fb, x, y, s, l) => {
  const { P, k, F, w } = grid(x, y, s)
  const c = P(8, 7)
  strokeArc(fb, c.x, c.y, 4 * k, -90, 90, l, w)
  const a = P(4, 7)
  const b = P(4, 11)
  fb.fillRect(Math.round(a.x - w / 2), Math.round(a.y), w, Math.round(b.y - a.y), l)
  const d = P(12, 7)
  fb.fillRect(Math.round(d.x - w / 2), Math.round(d.y), w, Math.round(b.y - a.y), l)
  F(fb, [[2, 8], [14, 8], [14, 15], [2, 15]], l)
}
export const user: IconDraw = (fb, x, y, s, l) => {
  const { P, k } = grid(x, y, s)
  const h = P(8, 5)
  fillCircle(fb, h.x, h.y, 3.6 * k, l)
  const b = P(8, 16)
  fillSector(fb, b.x, b.y, 0, 7 * k, -90, 90, l)
}
export const menu: IconDraw = (fb, x, y, s, l) => {
  const { L } = grid(x, y, s)
  for (const yy of [3, 8, 13]) L(fb, [[2, yy], [14, yy]], l)
}
export const more: IconDraw = (fb, x, y, s, l) => {
  const { P, k } = grid(x, y, s)
  for (const xx of [3, 8, 13]) {
    const c = P(xx, 8)
    fillCircle(fb, c.x, c.y, 1.7 * k, l)
  }
}
export const info: IconDraw = (fb, x, y, s, l) => {
  const { P, k, L, w } = grid(x, y, s)
  const c = P(8, 8)
  strokeCircle(fb, c.x, c.y, 7 * k, l, w)
  const d = P(8, 4.6)
  fillCircle(fb, d.x, d.y, 1.3 * k, l)
  L(fb, [[8, 7.5], [8, 12]], l)
}
export const warning: IconDraw = (fb, x, y, s, l) => {
  const { F, P, k } = grid(x, y, s)
  F(fb, [[8, 0.5], [15.8, 15], [0.2, 15]], l)
  const a = P(8, 5.5)
  const b = P(8, 10)
  line(fb, a.x, a.y, b.x, b.y, 0, { width: Math.max(1, Math.round(1.8 * k)) })
  const d = P(8, 12.6)
  fillCircle(fb, d.x, d.y, 1.1 * k, 0)
}
export const question: IconDraw = (fb, x, y, s, l) => {
  const { P, k, L, w } = grid(x, y, s)
  const c = P(8, 5.5)
  strokeArc(fb, c.x, c.y, 3.8 * k, -80, 150, l, w)
  L(fb, [[9.6, 8.8], [8, 10.2], [8, 11.2]], l)
  const d = P(8, 14.2)
  fillCircle(fb, d.x, d.y, 1.3 * k, l)
}
export const flag: IconDraw = (fb, x, y, s, l) => {
  const { L, F } = grid(x, y, s)
  L(fb, [[3, 1], [3, 16]], l)
  F(fb, [[3, 1.5], [14, 4.5], [3, 8.5]], l)
}
export const gear: IconDraw = (fb, x, y, s, l) => {
  const { P, k } = grid(x, y, s)
  const c = P(8, 8)
  for (let i = 0; i < 8; i++) fillSector(fb, c.x, c.y, 4 * k, 7.8 * k, i * 45 - 11, i * 45 + 11, l)
  fillSector(fb, c.x, c.y, 2.6 * k, 5.6 * k, 0, 360, l)
}
export const sun: IconDraw = (fb, x, y, s, l) => {
  const { P, k } = grid(x, y, s)
  const c = P(8, 8)
  fillCircle(fb, c.x, c.y, 3.6 * k, l)
  for (let i = 0; i < 8; i++) {
    const a = ((i * 45 - 90) * Math.PI) / 180
    line(fb, c.x + Math.cos(a) * 5.6 * k, c.y + Math.sin(a) * 5.6 * k, c.x + Math.cos(a) * 7.6 * k, c.y + Math.sin(a) * 7.6 * k, l, { width: s <= 9 ? 1 : 2 })
  }
}
export const moon: IconDraw = (fb, x, y, s, l) => {
  const { P, k } = grid(x, y, s)
  const c = P(8, 8)
  fillCircle(fb, c.x, c.y, 6.5 * k, l)
  const d = P(11.5, 5)
  fillCircle(fb, d.x, d.y, 5.2 * k, 0)
}
function cloudShape(fb: Framebuffer, x: number, y: number, s: number, l: number, dy = 0): void {
  const { P, k } = grid(x, y, s)
  const a = P(5, 9 + dy)
  const b = P(9.5, 6.5 + dy)
  const c = P(12.5, 9.5 + dy)
  fillCircle(fb, a.x, a.y, 3.2 * k, l)
  fillCircle(fb, b.x, b.y, 4.2 * k, l)
  fillCircle(fb, c.x, c.y, 2.8 * k, l)
  const r0 = P(2.5, 9.5 + dy)
  const r1 = P(14.5, 12.4 + dy)
  fb.fillRect(Math.round(r0.x), Math.round(r0.y), Math.round(r1.x - r0.x), Math.round(r1.y - r0.y), l)
}
export const cloud: IconDraw = (fb, x, y, s, l) => cloudShape(fb, x, y, s, l, 1)
export const rain: IconDraw = (fb, x, y, s, l) => {
  cloudShape(fb, x, y, s, l, -2)
  const { L } = grid(x, y, s)
  for (const xx of [4.5, 8, 11.5]) L(fb, [[xx + 0.8, 12.5], [xx - 0.8, 15.5]], l)
}
export const snow: IconDraw = (fb, x, y, s, l) => {
  cloudShape(fb, x, y, s, l, -2)
  const { P, k } = grid(x, y, s)
  for (const [xx, yy] of [[4.5, 13.5], [8, 15], [11.5, 13.5]]) {
    const c = P(xx, yy)
    fillCircle(fb, c.x, c.y, 1.2 * k + 0.3, l)
  }
}
export const thunder: IconDraw = (fb, x, y, s, l) => {
  cloudShape(fb, x, y, s, l, -2.5)
  grid(x, y, s).F(fb, [[8.5, 10], [5.5, 13.5], [8, 13.5], [6.5, 16], [11, 12], [8.5, 12], [10, 10]], l)
}
export const fog: IconDraw = (fb, x, y, s, l) => {
  const { L } = grid(x, y, s)
  L(fb, [[1, 4], [15, 4]], l)
  L(fb, [[3, 8], [13, 8]], l)
  L(fb, [[1, 12], [15, 12]], l)
}
export const wind: IconDraw = (fb, x, y, s, l) => {
  const { L } = grid(x, y, s)
  L(fb, [[1, 5], [11, 5], [13, 3.5], [11.5, 1.5]], l)
  L(fb, [[1, 9], [14, 9]], l)
  L(fb, [[1, 13], [9, 13], [11, 14.5], [9.5, 16]], l)
}
export const partlyCloudy: IconDraw = (fb, x, y, s, l) => {
  const { P, k } = grid(x, y, s)
  const c = P(6, 6)
  fillCircle(fb, c.x, c.y, 3.6 * k, l)
  for (let i = 0; i < 4; i++) {
    const a = ((i * 45 - 180) * Math.PI) / 180
    line(fb, c.x + Math.cos(a) * 5.2 * k, c.y + Math.sin(a) * 5.2 * k, c.x + Math.cos(a) * 6.6 * k, c.y + Math.sin(a) * 6.6 * k, l, { width: s <= 9 ? 1 : 2 })
  }
  // Cloud in front with a 1 px dark halo so it separates from the sun.
  const cs = s * 0.75
  const ox = x + s * 0.25
  const oy = y + s * 0.22
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) cloudShape(fb, ox + dx, oy + dy, cs, 0, 0)
  cloudShape(fb, ox, oy, cs, l, 0)
}
export const drop: IconDraw = (fb, x, y, s, l) => {
  const { P, k, F } = grid(x, y, s)
  const c = P(8, 10.5)
  fillCircle(fb, c.x, c.y, 4.5 * k, l)
  F(fb, [[8, 0.5], [12.2, 9], [3.8, 9]], l)
}
export const thermometer: IconDraw = (fb, x, y, s, l) => {
  const { P, k, w } = grid(x, y, s)
  const t = P(6, 1)
  fb.fillRect(Math.round(t.x), Math.round(t.y), Math.round(4 * k), Math.round(10 * k), l)
  fb.fillRect(Math.round(t.x + w / 1.5), Math.round(t.y + w), Math.max(1, Math.round(4 * k) - 2 * Math.round(w / 1.5)), Math.round(5 * k), 0)
  const b = P(8, 12.5)
  fillCircle(fb, b.x, b.y, 3.3 * k, l)
}
export const music: IconDraw = (fb, x, y, s, l) => {
  const { P, k, F, L } = grid(x, y, s)
  const a = P(4.5, 13)
  fillCircle(fb, a.x, a.y, 2.6 * k, l)
  const b = P(12, 11)
  fillCircle(fb, b.x, b.y, 2.6 * k, l)
  L(fb, [[6.6, 13], [6.6, 3]], l)
  L(fb, [[14.1, 11], [14.1, 1]], l)
  F(fb, [[6, 2], [15, 0], [15, 3.5], [6, 5.5]], l)
}
export const mail: IconDraw = (fb, x, y, s, l) => {
  const { P, L, w } = grid(x, y, s)
  const a = P(1, 3)
  const b = P(15, 13)
  strokeRect(fb, Math.round(a.x), Math.round(a.y), Math.round(b.x - a.x), Math.round(b.y - a.y), l, w)
  L(fb, [[1.5, 3.5], [8, 9], [14.5, 3.5]], l)
}
export const eye: IconDraw = (fb, x, y, s, l) => {
  const { P, k, w } = grid(x, y, s)
  const c1 = P(8, 14)
  const c2 = P(8, 2)
  strokeArc(fb, c1.x, c1.y, 9 * k, -50, 50, l, w)
  strokeArc(fb, c2.x, c2.y, 9 * k, 130, 230, l, w)
  const c = P(8, 8)
  fillCircle(fb, c.x, c.y, 2.3 * k, l)
}
export const refresh: IconDraw = (fb, x, y, s, l) => {
  const { P, k, F, w } = grid(x, y, s)
  const c = P(8, 8.5)
  strokeArc(fb, c.x, c.y, 6 * k, 30, 330, l, w)
  F(fb, [[8.2, 0], [12, 2.6], [8.2, 5.2]], l)
}

export const ICONS = {
  check,
  cross,
  plus,
  minus,
  arrowUp,
  arrowDown,
  arrowLeft,
  arrowRight,
  chevronUp,
  chevronDown,
  chevronLeft,
  chevronRight,
  play,
  pause,
  stop,
  record,
  heart,
  heartOutline,
  star,
  starOutline,
  bolt,
  battery,
  signal,
  wifi,
  bluetooth,
  clock,
  bell,
  home,
  search,
  trash,
  calendar,
  pin,
  lock,
  user,
  menu,
  more,
  info,
  warning,
  question,
  flag,
  gear,
  sun,
  moon,
  cloud,
  rain,
  snow,
  thunder,
  fog,
  wind,
  partlyCloudy,
  drop,
  thermometer,
  music,
  mail,
  eye,
  refresh,
} satisfies Record<string, IconDraw>

export type IconName = keyof typeof ICONS

export const ICON_NAMES = Object.keys(ICONS) as IconName[]

/** Draw a named icon in a size×size box with its top-left at (x, y). */
export function drawIcon(fb: Framebuffer, name: IconName, x: number, y: number, size: number, level: number): void {
  ICONS[name](fb, Math.round(x), Math.round(y), size, level)
}

/** Weather conditions → icon, for the weather glyph. */
export const WEATHER_ICONS = {
  clear: 'sun',
  night: 'moon',
  partly: 'partlyCloudy',
  cloudy: 'cloud',
  rain: 'rain',
  snow: 'snow',
  storm: 'thunder',
  fog: 'fog',
  wind: 'wind',
  hot: 'thermometer',
} as const satisfies Record<string, IconName>

export type Weather = keyof typeof WEATHER_ICONS
