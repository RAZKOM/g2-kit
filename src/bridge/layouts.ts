/**
 * Validated page presets for common layouts. Each returns a `Page` with named
 * tiles. IDs: images 1–4, skeleton 10. Menus are optional.
 */
import { gridTiles } from '../core/tiles.js'
import type { Rect } from '../core/geometry.js'
import { blankTextSkeleton, listSkeleton } from '../input/skeletons.js'
import { CANVAS_H, CANVAS_W, PageBuilder, type MenuItem, type Page } from './pageBuilder.js'

const TW = 288
const TH = 144
const SKELETON_ID = 10

export interface PresetOptions {
  menu?: readonly MenuItem[]
}

function withMenu(b: PageBuilder, o: PresetOptions): PageBuilder {
  return o.menu ? b.menu(o.menu) : b
}

/**
 * 1. Two tiles + capture list (WordLens vertical mode).
 * ```
 * +-------------+-------------+
 * | left 288×144| right       |
 * +-------------+-------------+
 * | native list 576×144 (capture)
 * +---------------------------+
 * ```
 */
export function twoTilesWithList(o: PresetOptions & { items: readonly string[] }): Page<'left' | 'right'> {
  const b = new PageBuilder()
    .list(listSkeleton({ x: 0, y: TH, w: CANVAS_W, h: CANVAS_H - TH }, o.items, { id: SKELETON_ID, name: 'list' }))
    .image({ id: 1, name: 'left', x: 0, y: 0, w: TW, h: TH })
    .image({ id: 2, name: 'right', x: TW, y: 0, w: TW, h: TH })
  return withMenu(b, o).build()
}

/**
 * 2. Two tiles + drawn control (WordLens horizontal mode). The control image
 * sits over a blank capturing text container.
 * ```
 * +-------------+-------------+
 * | left        | right       |
 * +-------------+-------------+
 * |    [ control 288×64 ]     |  ← image over blank text (capture)
 * +---------------------------+
 * ```
 */
export function twoTilesWithControl(o: PresetOptions & { control?: { w: number; h: number } } = {}): Page<'left' | 'right' | 'control'> {
  const c = o.control ?? { w: TW, h: 64 }
  const b = new PageBuilder()
    .text(blankTextSkeleton({ x: 0, y: TH, w: CANVAS_W, h: CANVAS_H - TH }, { id: SKELETON_ID }))
    .image({ id: 1, name: 'left', x: 0, y: 0, w: TW, h: TH })
    .image({ id: 2, name: 'right', x: TW, y: 0, w: TW, h: TH })
    .image({ id: 3, name: 'control', x: Math.round((CANVAS_W - c.w) / 2), y: TH + Math.round((CANVAS_H - TH - c.h) / 2), w: c.w, h: c.h })
  return withMenu(b, o).build()
}

export type QuadTile = 'tl' | 'tr' | 'bl' | 'br'

/**
 * 3. Dashboard quad: four 288×144 tiles, blank capture text under one of them.
 * ```
 * +------+------+
 * |  tl  |  tr  |
 * +------+------+
 * |  bl  |  br  |   (skeleton under `captureUnder`, default br)
 * +------+------+
 * ```
 */
export function dashboardQuad(o: PresetOptions & { captureUnder?: QuadTile } = {}): Page<QuadTile> {
  const pos: Record<QuadTile, [number, number]> = { tl: [0, 0], tr: [TW, 0], bl: [0, TH], br: [TW, TH] }
  const [sx, sy] = pos[o.captureUnder ?? 'br']
  const b = new PageBuilder().text(blankTextSkeleton({ x: sx, y: sy, w: TW, h: TH }, { id: SKELETON_ID }))
  ;(['tl', 'tr', 'bl', 'br'] as const).forEach((k, i) => b.image({ id: i + 1, name: k, x: pos[k][0], y: pos[k][1], w: TW, h: TH }))
  return withMenu(b, o).build()
}

/** A page whose tiles cover one logical region, drawn as a single framebuffer. */
export type SpanPage<K extends string> = Page<K> & { span: Rect }

/**
 * 4. Hero + sidebar: a large chart spread over four tiles, plus a narrow
 * firmware text column (capture) for KPIs, updatable with `G2.setText`.
 * ```
 * +-----------------------+-----+
 * | hero (4 tiles,        | KPI |
 * |  heroWidth × 288)     | text|
 * +-----------------------+-----+
 * ```
 */
export function heroSidebar(o: PresetOptions & { heroWidth?: number; side?: 'left' | 'right'; sidebarText?: string; sidebarPadding?: number } = {}): SpanPage<'h0' | 'h1' | 'h2' | 'h3'> {
  const hw = o.heroWidth ?? 432
  if (hw < 40 || hw > CANVAS_W - 40) throw new RangeError('heroWidth must leave 40–536 px')
  const heroX = o.side === 'right' ? CANVAS_W - hw : 0
  const sideX = o.side === 'right' ? 0 : hw
  const b = new PageBuilder().text({
    id: SKELETON_ID,
    name: 'sidebar',
    x: sideX,
    y: 0,
    w: CANVAS_W - hw,
    h: CANVAS_H,
    content: o.sidebarText ?? ' ',
    capture: true,
    border: { width: 0 },
    padding: o.sidebarPadding ?? 8,
  })
  gridTiles(hw, CANVAS_H).forEach((t, i) => b.image({ id: i + 1, name: `h${i}`, x: heroX + t.x, y: t.y, w: t.w, h: t.h }))
  return { ...withMenu(b, o).build<'h0' | 'h1' | 'h2' | 'h3'>(), span: { x: heroX, y: 0, w: hw, h: CANVAS_H } }
}

/**
 * 5. Full-screen single view: four tiles cover 576×288 over a full-canvas
 * blank skeleton. Draw one logical 576×288 view; only changed tiles are sent.
 * ```
 * +------+------+
 * | t0   | t1   |
 * +------+------+   (skeleton under everything)
 * | t2   | t3   |
 * +------+------+
 * ```
 */
export function fullScreen(o: PresetOptions & { width?: number; height?: number } = {}): SpanPage<'t0' | 't1' | 't2' | 't3'> {
  const w = o.width ?? CANVAS_W
  const h = o.height ?? CANVAS_H
  const x0 = Math.round((CANVAS_W - w) / 2)
  const y0 = Math.round((CANVAS_H - h) / 2)
  const b = new PageBuilder().text(blankTextSkeleton({ x: 0, y: 0, w: CANVAS_W, h: CANVAS_H }, { id: SKELETON_ID }))
  const tiles = gridTiles(w, h)
  if (tiles.length > 4) throw new RangeError(`${w}×${h} needs ${tiles.length} tiles; max 4`)
  tiles.forEach((t, i) => b.image({ id: i + 1, name: `t${i}`, x: x0 + t.x, y: y0 + t.y, w: t.w, h: t.h }))
  return { ...withMenu(b, o).build<'t0' | 't1' | 't2' | 't3'>(), span: { x: x0, y: y0, w, h } }
}

/**
 * 6. Menu page: native list plus one preview tile that updates on selection.
 * Swipes on a native list emit no events, so the preview follows taps.
 * ```
 * +-------------+-------------+
 * | native list | preview     |
 * | 288×288     | 288×144     |
 * | (capture)   |             |
 * +-------------+-------------+
 * ```
 */
export function menuPage(o: PresetOptions & { items: readonly string[]; previewSide?: 'left' | 'right' }): Page<'preview'> {
  const right = o.previewSide !== 'left'
  const b = new PageBuilder()
    .list(listSkeleton({ x: right ? 0 : TW, y: 0, w: TW, h: CANVAS_H }, o.items, { id: SKELETON_ID, name: 'menu' }))
    .image({ id: 1, name: 'preview', x: right ? TW : 0, y: (CANVAS_H - TH) / 2, w: TW, h: TH })
  return withMenu(b, o).build()
}

/**
 * 7. Text + one tile: a firmware text container (which also captures input)
 * and a single drawn tile. Only one image on the page, so every redraw is one
 * send, and text updates (`G2.setText`) cost no image send at all. Good for
 * keyboards, pickers and anything that shows a value above a control.
 * ```
 * +-----------------------------+
 * | firmware text (capture)     |   576 × (288 - tile height)
 * +--------+==========+---------+
 * |        |  tile    |         |   288 × 144, centred
 * +--------+==========+---------+
 * ```
 * Keep the text short enough not to overflow, so swipes are not taken by
 * text scrolling.
 */
export function textWithTile(o: PresetOptions & { text?: string; tileAt?: 'top' | 'bottom'; tileHeight?: number; padding?: number; textColor?: number } = {}): Page<'tile'> & { text: { id: number; name: string } } {
  const th = o.tileHeight ?? TH
  const tileTop = o.tileAt === 'top'
  const textBox = { x: 0, y: tileTop ? th : 0, w: CANVAS_W, h: CANVAS_H - th }
  const b = new PageBuilder()
    .text({
      id: SKELETON_ID,
      name: 'text',
      ...textBox,
      content: o.text ?? ' ',
      capture: true,
      border: { width: 0 },
      padding: o.padding ?? 8,
      ...(o.textColor !== undefined ? { textColor: o.textColor } : {}),
    })
    .image({ id: 1, name: 'tile', x: Math.round((CANVAS_W - TW) / 2), y: tileTop ? 0 : CANVAS_H - th, w: TW, h: th })
  return { ...withMenu(b, o).build<'tile'>(), text: { id: SKELETON_ID, name: 'text' } }
}

/**
 * 8. Text + a two-tile span: like `textWithTile`, for views bigger than one
 * tile (a keyboard with symbols beside or below the letters). Draw with
 * `G2.drawSpan(page.span, …)`; only the tile whose pixels changed is sent.
 * ```
 * wide (576×144 span)            tall (288×288 span)
 * +------------------------+     +--------+-----------+
 * | firmware text (capture)|     | s0     | firmware  |
 * +-----------+------------+     +--------+ text      |
 * | s0        | s1         |     | s1     | (capture) |
 * +-----------+------------+     +--------+-----------+
 * ```
 */
export function textWithSpan(
  o: PresetOptions & { span: 'wide' | 'tall'; text?: string; spanAt?: 'top' | 'bottom' | 'left' | 'right'; padding?: number; textColor?: number },
): SpanPage<'s0' | 's1'> & { text: { id: number; name: string } } {
  const wide = o.span === 'wide'
  const first = o.spanAt === 'top' || o.spanAt === 'left'
  const span = wide ? { x: 0, y: first ? 0 : TH, w: CANVAS_W, h: TH } : { x: first || o.spanAt === undefined ? 0 : TW, y: 0, w: TW, h: CANVAS_H }
  const textBox = wide ? { x: 0, y: first ? TH : 0, w: CANVAS_W, h: CANVAS_H - TH } : { x: span.x === 0 ? TW : 0, y: 0, w: CANVAS_W - TW, h: CANVAS_H }
  const b = new PageBuilder().text({
    id: SKELETON_ID,
    name: 'text',
    ...textBox,
    content: o.text ?? ' ',
    capture: true,
    border: { width: 0 },
    padding: o.padding ?? 8,
    ...(o.textColor !== undefined ? { textColor: o.textColor } : {}),
  })
  b.image({ id: 1, name: 's0', x: span.x, y: span.y, w: TW, h: TH })
  b.image({ id: 2, name: 's1', x: wide ? span.x + TW : span.x, y: wide ? span.y : span.y + TH, w: TW, h: TH })
  return { ...withMenu(b, o).build<'s0' | 's1'>(), span, text: { id: SKELETON_ID, name: 'text' } }
}
