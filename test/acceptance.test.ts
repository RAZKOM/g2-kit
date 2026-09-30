/**
 * Acceptance: the README quickstart, end to end against a stub of the SDK
 * module (same class/enum shapes as @evenrealities/even_hub_sdk 0.0.16).
 */
import { describe, expect, it } from 'vitest'
import { connect, layouts, type SdkModule } from '../src/bridge/index.js'
import { BarChart, Kpi } from '../src/charts/index.js'

function stubSdk() {
  const calls: Array<{ method: string; arg: Record<string, unknown> }> = []
  let listener: ((e: unknown) => void) | null = null
  class Model {
    constructor(data: Record<string, unknown> = {}) {
      Object.assign(this, data)
    }
  }
  const bridge = {
    async createStartUpPageContainer(c: Record<string, unknown>) {
      calls.push({ method: 'create', arg: c })
      return 0
    },
    async rebuildPageContainer(c: Record<string, unknown>) {
      calls.push({ method: 'rebuild', arg: c })
      return true
    },
    async updateImageRawData(d: Record<string, unknown>) {
      calls.push({ method: 'image', arg: d })
      return 'success'
    },
    async textContainerUpgrade() {
      return true
    },
    async shutDownPageContainer(mode?: number) {
      calls.push({ method: 'shutdown', arg: { mode } })
      return true
    },
    onEvenHubEvent(cb: (e: unknown) => void) {
      listener = cb
      return () => (listener = null)
    },
  }
  const sdk = {
    waitForEvenAppBridge: async () => bridge,
    CreateStartUpPageContainer: Model,
    RebuildPageContainer: Model,
    ImageRawDataUpdate: Model,
    TextContainerUpgrade: Model,
    StartUpPageCreateResult: { success: 0 },
    OsEventTypeList: { CLICK_EVENT: 0, SCROLL_TOP_EVENT: 1, SCROLL_BOTTOM_EVENT: 2, DOUBLE_CLICK_EVENT: 3, FOREGROUND_ENTER_EVENT: 4, FOREGROUND_EXIT_EVENT: 5, ABNORMAL_EXIT_EVENT: 6, SYSTEM_EXIT_EVENT: 7, IMU_DATA_REPORT: 8, LONG_PRESS_EVENT: 9, LONG_PRESS_RELEASE_EVENT: 10 },
  } as unknown as SdkModule
  return { sdk, calls, emit: (e: unknown) => listener?.(e) }
}

describe('README quickstart', () => {
  it('bar chart + KPI in two tiles above a capturing list, tap handled, in < 20 lines', async () => {
    const { sdk, calls, emit } = stubSdk()
    const fetchJson = async () => ({ days: [{ label: 'M', value: 3 }, { label: 'T', value: 5 }], today: 7421, delta: 0.12 })
    const selected: string[] = []

    // ── the quickstart (what an app writes) ──
    const data = await fetchJson()
    const g2 = await connect({ sdk, gapMs: 0 })
    const page = layouts.twoTilesWithList({ items: ['Refresh', 'Details'] })
    await g2.show(page)
    g2.draw('left', BarChart, { title: 'Steps', data: data.days })
    g2.draw('right', Kpi, { label: 'Today', value: data.today, delta: data.delta, deltaFormat: 'percent' })
    g2.on('select', (e) => selected.push(page.capture.items![e.index]))
    // ── end ──

    await g2.settle()
    expect(calls.map((c) => c.method)).toEqual(['create', 'image', 'image'])
    const create = calls[0].arg
    expect((create.listObject as unknown[]).length).toBe(1)
    expect((create.imageObject as Array<{ width: number; height: number }>).map((i) => [i.width, i.height])).toEqual([
      [288, 144],
      [288, 144],
    ])
    const img = calls[1].arg.imageData as Uint8Array
    expect([...img.subarray(0, 4)]).toEqual([137, 80, 78, 71]) // PNG
    emit({ listEvent: { currentSelectItemIndex: 1 } })
    emit({ listEvent: {} })
    expect(selected).toEqual(['Details', 'Refresh'])
    emit({ sysEvent: { eventType: 3 } })
    expect(calls.at(-1)).toEqual({ method: 'shutdown', arg: { mode: 1 } })
  })
})
