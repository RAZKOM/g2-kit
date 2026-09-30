/**
 * Skeletons: real but visually empty containers that capture gestures.
 * Exactly one container per page captures input and image containers are not
 * interactive, so drawn UI sits on image tiles over a skeleton.
 *
 *  - blankTextSkeleton: a ' ' text container. Swipes arrive as SCROLL_TOP /
 *    SCROLL_BOTTOM textEvents, taps as sysEvents; also double-tap and hold.
 *    The workhorse for drawn controls.
 *  - listSkeleton: a native list when the firmware highlight is good enough;
 *    tap reports the selected index. Swipes move the firmware highlight and
 *    emit no events.
 *
 * Place the skeleton on-canvas under the images that draw the UI (lowest z).
 */
import type { Box, ListSpec, TextSpec } from '../bridge/pageBuilder.js'

export interface SkeletonOptions {
  id?: number
  name?: string
  z?: number
}

/** Blank capturing text container. Nothing visible: no border, content ' '. */
export function blankTextSkeleton(box: Box, opts: SkeletonOptions = {}): TextSpec {
  return {
    ...box,
    id: opts.id ?? 100,
    name: opts.name ?? 'skeleton',
    ...(opts.z !== undefined ? { z: opts.z } : {}),
    content: ' ',
    capture: true,
    border: { width: 0 },
    padding: 0,
  }
}

export interface ListSkeletonOptions extends SkeletonOptions {
  padding?: number
  selectBorder?: boolean
}

/** Native capturing list (≤ 20 items; use PagedList for more). */
export function listSkeleton(box: Box, items: readonly string[], opts: ListSkeletonOptions = {}): ListSpec {
  return {
    ...box,
    id: opts.id ?? 100,
    name: opts.name ?? 'list',
    ...(opts.z !== undefined ? { z: opts.z } : {}),
    items,
    capture: true,
    border: { width: 0 },
    padding: opts.padding ?? 4,
    selectBorder: opts.selectBorder ?? true,
  }
}

export const MORE = 'MORE >>'
export const BACK = '<< BACK'

export type PagedSelection<T> =
  | { kind: 'item'; item: T; index: number }
  | { kind: 'page'; page: number }
  | { kind: 'none' }

/**
 * Pages a long item list through a ≤ 20-item native list with MORE >> /
 * << BACK entries (the WordLens pattern). Changing page needs a page rebuild;
 * a rebuilt list highlights index 0.
 */
export class PagedList<T = string> {
  page = 0
  readonly pages: T[][]

  constructor(
    readonly items: readonly T[],
    readonly label: (item: T) => string = String,
    readonly perPage = 20,
  ) {
    if (perPage < 3) throw new RangeError('perPage must be ≥ 3')
    this.pages = []
    if (items.length <= perPage) this.pages.push([...items])
    else {
      // First page: MORE at the end; middle pages: BACK first, MORE last; last page: BACK first.
      let i = 0
      while (i < items.length) {
        const first = this.pages.length === 0
        const room = perPage - (first ? 1 : 2)
        const rest = items.length - i
        const take = !first && rest <= perPage - 1 ? rest : room
        this.pages.push(items.slice(i, i + take) as T[])
        i += take
      }
    }
  }

  get pageCount(): number {
    return this.pages.length
  }

  /** Labels for the native list on the current page, including paging entries. */
  labels(page = this.page): string[] {
    const out = this.pages[page].map(this.label)
    if (this.pages.length === 1) return out
    if (page > 0) out.unshift(BACK)
    if (page < this.pages.length - 1) out.push(MORE)
    return out
  }

  /** Map a list tap (index and optional reported name) to an item or a page change. */
  select(index: number, name: string | null = null): PagedSelection<T> {
    const labels = this.labels()
    let i = index
    if (name !== null) {
      const at = labels.indexOf(name.trim())
      if (at >= 0) i = at
    }
    const label = labels[i]
    if (label === undefined) return { kind: 'none' }
    if (this.pages.length > 1 && label === MORE && i === labels.length - 1) {
      this.page = Math.min(this.page + 1, this.pages.length - 1)
      return { kind: 'page', page: this.page }
    }
    if (this.pages.length > 1 && label === BACK && i === 0 && this.page > 0) {
      this.page = this.page - 1
      return { kind: 'page', page: this.page }
    }
    const offset = this.page > 0 ? 1 : 0
    const local = i - offset
    const item = this.pages[this.page][local]
    if (item === undefined) return { kind: 'none' }
    const globalIndex = this.pages.slice(0, this.page).reduce((n, p) => n + p.length, 0) + local
    return { kind: 'item', item, index: globalIndex }
  }
}
