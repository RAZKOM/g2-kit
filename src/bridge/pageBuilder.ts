/**
 * Validated page layouts. Produces plain objects in the SDK's shape
 * (`CreateStartUpPageContainer` / `RebuildPageContainer` fields), plus typed
 * references to the image tiles and the capture container.
 *
 * Limits (SDK 0.0.16 d.ts + README, hub docs, simulator 0.9.5 changelog):
 *   ≤ 4 image + ≤ 8 other containers, 1–12 total; image 20–288 × 20–144;
 *   exactly one isEventCapture; zOrderIndex all-or-none and unique;
 *   list ≤ 20 items, item ≤ 63 UTF-8 bytes (docs: 64 chars; simulator: 63 bytes);
 *   text ≤ 999 UTF-8 bytes (docs: 1000 chars; simulator: 999 bytes);
 *   border width 0–5, colour 0–15, radius 0–10; padding 0–32; textColor 0–4;
 *   menu ≤ 10 items, IDs non-zero unique uint32, names ≤ 32 UTF-8 bytes.
 */
import type { Rect } from '../core/geometry.js'
import { PageLayoutError, type LayoutIssue } from './errors.js'

export const CANVAS_W = 576
export const CANVAS_H = 288
export const MAX_IMAGES = 4
export const MAX_OTHERS = 8
export const MAX_CONTAINERS = 12
export const IMAGE_MIN = { w: 20, h: 20 } as const
export const IMAGE_MAX = { w: 288, h: 144 } as const
export const MAX_LIST_ITEMS = 20
export const MAX_LIST_ITEM_BYTES = 63
export const MAX_TEXT_BYTES = 999
export const MAX_MENU_ITEMS = 10
export const MAX_MENU_NAME_BYTES = 32

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface Base extends Box {
  id: number
  name: string
  /** Explicit zOrderIndex. Omit to assign in insertion order (later = front). */
  z?: number
}

export interface Border {
  width?: number
  color?: number
  radius?: number
}

export type ImageSpec = Base

export interface TextSpec extends Base {
  content?: string
  capture?: boolean
  border?: Border
  padding?: number
  /** Firmware text brightness 0–4 (default 4). */
  textColor?: number
}

export interface ListSpec extends Base {
  items: readonly string[]
  capture?: boolean
  border?: Border
  padding?: number
  /** Firmware highlight border on the selected item (default true). */
  selectBorder?: boolean
  itemWidth?: number
}

export interface MenuItem {
  id: number
  name: string
}

type AnyRecord = Record<string, unknown>

/** SDK-shaped page payload. Pass to `new CreateStartUpPageContainer(layout)`. */
export interface PageLayout {
  containerTotalNum: number
  imageObject?: AnyRecord[]
  textObject?: AnyRecord[]
  listObject?: AnyRecord[]
  menuObject?: { menuItems: Array<{ itemID: number; itemName: string }> }
}

export interface TileRef {
  id: number
  name: string
  /** Position and size on the 576×288 canvas. */
  rect: Rect
}

export interface CaptureRef {
  kind: 'text' | 'list'
  id: number
  name: string
  items?: readonly string[]
}

export interface Page<K extends string = string> {
  layout: PageLayout
  /** Image tiles by name. */
  tiles: Record<K, TileRef>
  /** Image tiles in insertion order. */
  tileList: TileRef[]
  capture: CaptureRef
}

export interface BuildOptions {
  /** Allow containers partly or fully off the 576×288 canvas (default false). */
  allowOffCanvas?: boolean
}

type Entry = { kind: 'image'; spec: ImageSpec } | { kind: 'text'; spec: TextSpec } | { kind: 'list'; spec: ListSpec }

const utf8 = (s: string) => new TextEncoder().encode(s).length

export class PageBuilder {
  private entries: Entry[] = []
  private menuItems: MenuItem[] | null = null

  image(spec: ImageSpec): this {
    this.entries.push({ kind: 'image', spec })
    return this
  }

  text(spec: TextSpec): this {
    this.entries.push({ kind: 'text', spec })
    return this
  }

  list(spec: ListSpec): this {
    this.entries.push({ kind: 'list', spec })
    return this
  }

  /**
   * Contextual menu (tap-then-hold on the glasses). Re-sent on every rebuild;
   * omitting it on a rebuild clears the menu.
   */
  menu(items: readonly MenuItem[]): this {
    this.menuItems = [...items]
    return this
  }

  /** All rule violations (empty = valid). */
  validate(opts: BuildOptions = {}): LayoutIssue[] {
    const issues: LayoutIssue[] = []
    const add = (rule: LayoutIssue['rule'], message: string, container?: string) => issues.push({ rule, message, container })
    const images = this.entries.filter((e) => e.kind === 'image')
    const others = this.entries.filter((e) => e.kind !== 'image')

    if (this.entries.length === 0) add('NO_CONTAINERS', 'a page needs at least one container')
    if (images.length > MAX_IMAGES) add('TOO_MANY_IMAGES', `${images.length} image containers; max ${MAX_IMAGES} per page`)
    if (others.length > MAX_OTHERS) add('TOO_MANY_OTHERS', `${others.length} text/list containers; max ${MAX_OTHERS} per page`)
    if (this.entries.length > MAX_CONTAINERS) add('TOO_MANY_CONTAINERS', `${this.entries.length} containers; max ${MAX_CONTAINERS}`)

    const ids = new Map<number, string>()
    const names = new Set<string>()
    for (const { kind, spec } of this.entries) {
      const label = `${kind} '${spec.name}'`
      if (!Number.isInteger(spec.id) || spec.id < 0 || spec.id > 0xffffffff) add('INVALID_ID', `containerID ${spec.id} must be a uint32`, label)
      if (ids.has(spec.id)) add('DUPLICATE_ID', `containerID ${spec.id} also used by ${ids.get(spec.id)}`, label)
      ids.set(spec.id, label)
      if (names.has(spec.name)) add('DUPLICATE_NAME', `containerName '${spec.name}' is used twice`, label)
      names.add(spec.name)

      if (kind === 'image') {
        if (spec.w < IMAGE_MIN.w || spec.w > IMAGE_MAX.w || spec.h < IMAGE_MIN.h || spec.h > IMAGE_MAX.h || !Number.isInteger(spec.w) || !Number.isInteger(spec.h))
          add('IMAGE_SIZE', `image is ${spec.w}×${spec.h}; must be ${IMAGE_MIN.w}–${IMAGE_MAX.w} × ${IMAGE_MIN.h}–${IMAGE_MAX.h} px`, label)
      } else if (spec.w <= 0 || spec.h <= 0) add('CONTAINER_SIZE', `size ${spec.w}×${spec.h} must be positive`, label)

      if (!opts.allowOffCanvas && (spec.x < 0 || spec.y < 0 || spec.x + spec.w > CANVAS_W || spec.y + spec.h > CANVAS_H))
        add('OUT_OF_BOUNDS', `box (${spec.x}, ${spec.y}, ${spec.w}×${spec.h}) leaves the ${CANVAS_W}×${CANVAS_H} canvas`, label)

      if (kind !== 'image') {
        const b = spec.border
        if (b) {
          if (b.width !== undefined && (b.width < 0 || b.width > 5)) add('BORDER', `borderWidth ${b.width}; must be 0–5`, label)
          if (b.color !== undefined && (b.color < 0 || b.color > 15)) add('BORDER', `borderColor ${b.color}; must be 0–15`, label)
          if (b.radius !== undefined && (b.radius < 0 || b.radius > 10)) add('BORDER', `borderRadius ${b.radius}; must be 0–10`, label)
        }
        if (spec.padding !== undefined && (spec.padding < 0 || spec.padding > 32)) add('PADDING', `paddingLength ${spec.padding}; must be 0–32`, label)
      }
      if (kind === 'text') {
        const bytes = utf8(spec.content ?? ' ')
        if (bytes > MAX_TEXT_BYTES) add('TEXT_LENGTH', `content is ${bytes} UTF-8 bytes; max ${MAX_TEXT_BYTES} on create/rebuild`, label)
        if (spec.textColor !== undefined && (!Number.isInteger(spec.textColor) || spec.textColor < 0 || spec.textColor > 4))
          add('TEXT_COLOR', `textColor ${spec.textColor}; must be 0–4`, label)
      }
      if (kind === 'list') {
        if (spec.items.length === 0 || spec.items.length > MAX_LIST_ITEMS)
          add('LIST_ITEMS', `${spec.items.length} items; lists hold 1–${MAX_LIST_ITEMS} (page longer lists with PagedList)`, label)
        spec.items.forEach((it, i) => {
          const n = utf8(it)
          if (n > MAX_LIST_ITEM_BYTES) add('LIST_ITEM_LENGTH', `item ${i} is ${n} UTF-8 bytes; max ${MAX_LIST_ITEM_BYTES}`, label)
        })
      }
    }

    const captures = this.entries.filter((e) => e.kind !== 'image' && e.spec.capture)
    if (captures.length !== 1)
      add('CAPTURE_COUNT', `${captures.length} containers capture input; exactly one text or list container must set capture (images cannot)`)

    const explicit = this.entries.filter((e) => e.spec.z !== undefined)
    if (explicit.length > 0 && explicit.length < this.entries.length)
      add('Z_ORDER', `zOrderIndex set on ${explicit.length} of ${this.entries.length} containers; set it on all or none`)
    const zs = new Set<number>()
    for (const e of explicit) {
      if (!Number.isInteger(e.spec.z) || e.spec.z! < 0) add('Z_ORDER', `zOrderIndex ${e.spec.z} must be a non-negative integer`, e.spec.name)
      if (zs.has(e.spec.z!)) add('Z_ORDER', `zOrderIndex ${e.spec.z} is used twice`, e.spec.name)
      zs.add(e.spec.z!)
    }

    if (this.menuItems) {
      if (this.menuItems.length > MAX_MENU_ITEMS) add('MENU_COUNT', `${this.menuItems.length} menu items; max ${MAX_MENU_ITEMS}`)
      const menuIds = new Set<number>()
      for (const m of this.menuItems) {
        if (!Number.isInteger(m.id) || m.id <= 0 || m.id > 0xffffffff) add('MENU_ID', `menu itemID ${m.id} must be a non-zero uint32`, m.name)
        if (menuIds.has(m.id)) add('MENU_ID', `menu itemID ${m.id} is used twice`, m.name)
        menuIds.add(m.id)
        if (utf8(m.name) > MAX_MENU_NAME_BYTES) add('MENU_NAME', `menu name is ${utf8(m.name)} UTF-8 bytes; max ${MAX_MENU_NAME_BYTES}`, m.name)
      }
    }
    return issues
  }

  /** Validate and emit the SDK layout. Throws `PageLayoutError` naming every broken rule. */
  build<K extends string = string>(opts: BuildOptions = {}): Page<K> {
    const issues = this.validate(opts)
    if (issues.length) throw new PageLayoutError(issues)

    const auto = this.entries.every((e) => e.spec.z === undefined)
    const z = (e: Entry, i: number) => (auto ? i + 1 : e.spec.z!)
    const imageObject: AnyRecord[] = []
    const textObject: AnyRecord[] = []
    const listObject: AnyRecord[] = []
    const tiles = {} as Record<K, TileRef>
    const tileList: TileRef[] = []
    let capture: CaptureRef | null = null

    this.entries.forEach((e, i) => {
      const { spec } = e
      const common = {
        xPosition: spec.x,
        yPosition: spec.y,
        width: spec.w,
        height: spec.h,
        containerID: spec.id,
        containerName: spec.name,
        zOrderIndex: z(e, i),
      }
      if (e.kind === 'image') {
        imageObject.push(common)
        const ref = { id: spec.id, name: spec.name, rect: { x: spec.x, y: spec.y, w: spec.w, h: spec.h } }
        tiles[spec.name as K] = ref
        tileList.push(ref)
        return
      }
      const s = e.spec
      const boxProps = {
        borderWidth: s.border?.width ?? 0,
        ...(s.border?.color !== undefined ? { borderColor: s.border.color } : {}),
        ...(s.border?.radius !== undefined ? { borderRadius: s.border.radius } : {}),
        paddingLength: s.padding ?? 0,
        isEventCapture: s.capture ? 1 : 0,
      }
      if (e.kind === 'text') {
        textObject.push({
          ...common,
          ...boxProps,
          content: e.spec.content ?? ' ',
          ...(e.spec.textColor !== undefined ? { textColor: e.spec.textColor } : {}),
        })
        if (e.spec.capture) capture = { kind: 'text', id: spec.id, name: spec.name }
      } else {
        listObject.push({
          ...common,
          ...boxProps,
          itemContainer: {
            itemCount: e.spec.items.length,
            isItemSelectBorderEn: e.spec.selectBorder === false ? 0 : 1,
            itemName: [...e.spec.items],
            ...(e.spec.itemWidth !== undefined ? { itemWidth: e.spec.itemWidth } : {}),
          },
        })
        if (e.spec.capture) capture = { kind: 'list', id: spec.id, name: spec.name, items: [...e.spec.items] }
      }
    })

    const layout: PageLayout = {
      containerTotalNum: this.entries.length,
      ...(imageObject.length ? { imageObject } : {}),
      ...(textObject.length ? { textObject } : {}),
      ...(listObject.length ? { listObject } : {}),
      ...(this.menuItems ? { menuObject: { menuItems: this.menuItems.map((m) => ({ itemID: m.id, itemName: m.name })) } } : {}),
    }
    return { layout, tiles, tileList, capture: capture! }
  }
}
