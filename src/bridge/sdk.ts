/**
 * The only module that touches `@evenrealities/even_hub_sdk` (a peer
 * dependency). It is imported dynamically so the rest of the kit loads in
 * Node and in tests without the SDK.
 */
import { EV, type RawEvent } from './events.js'
import { G2, type G2Options, type Host } from './g2.js'
import type { PageLayout } from './pageBuilder.js'

/** The subset of the SDK module g2-kit uses (structural, so no type import is required). */
export interface SdkModule {
  waitForEvenAppBridge(): Promise<SdkBridge>
  CreateStartUpPageContainer: new (data: never) => unknown
  RebuildPageContainer: new (data: never) => unknown
  ImageRawDataUpdate: new (data: never) => unknown
  TextContainerUpgrade: new (data: never) => unknown
  StartUpPageCreateResult: { success: number }
  OsEventTypeList: Record<string, unknown>
}

export interface SdkBridge {
  createStartUpPageContainer(c: never): Promise<unknown>
  rebuildPageContainer(c: never): Promise<boolean>
  updateImageRawData(d: never): Promise<unknown>
  textContainerUpgrade(c: never): Promise<boolean>
  shutDownPageContainer(mode?: number): Promise<boolean>
  onEvenHubEvent(cb: (e: never) => void): () => void
}

/** Fail loudly if our mirrored event constants drift from the SDK enum. */
export function checkEnumDrift(os: Record<string, unknown>): void {
  const pairs: Array<[number, string]> = [
    [EV.CLICK, 'CLICK_EVENT'],
    [EV.SCROLL_TOP, 'SCROLL_TOP_EVENT'],
    [EV.SCROLL_BOTTOM, 'SCROLL_BOTTOM_EVENT'],
    [EV.DOUBLE_CLICK, 'DOUBLE_CLICK_EVENT'],
    [EV.FOREGROUND_ENTER, 'FOREGROUND_ENTER_EVENT'],
    [EV.FOREGROUND_EXIT, 'FOREGROUND_EXIT_EVENT'],
    [EV.ABNORMAL_EXIT, 'ABNORMAL_EXIT_EVENT'],
    [EV.SYSTEM_EXIT, 'SYSTEM_EXIT_EVENT'],
    [EV.IMU, 'IMU_DATA_REPORT'],
    [EV.LONG_PRESS, 'LONG_PRESS_EVENT'],
    [EV.LONG_PRESS_RELEASE, 'LONG_PRESS_RELEASE_EVENT'],
  ]
  for (const [ours, name] of pairs) {
    const theirs = os[name]
    if (theirs === undefined) {
      if (name.startsWith('LONG_PRESS')) console.warn(`[g2-kit] SDK has no ${name}; long press needs SDK ≥ 0.0.15`)
      continue
    }
    if (theirs !== ours) throw new Error(`[g2-kit] event enum drift: ${name} is ${String(theirs)} in the SDK, ${ours} in g2-kit`)
  }
}

/** Build a Host over a live SDK bridge. */
export function sdkHost(sdk: SdkModule, bridge: SdkBridge): Host {
  return {
    async createPage(layout: PageLayout) {
      const r = await bridge.createStartUpPageContainer(new sdk.CreateStartUpPageContainer(layout as never) as never)
      return r === sdk.StartUpPageCreateResult.success || r === 0
    },
    rebuildPage: (layout) => bridge.rebuildPageContainer(new sdk.RebuildPageContainer(layout as never) as never),
    sendImage: (target, bytes) =>
      bridge.updateImageRawData(
        new sdk.ImageRawDataUpdate({ containerID: target.containerID, containerName: target.containerName, imageData: bytes } as never) as never,
      ),
    updateText: (target, content) =>
      bridge.textContainerUpgrade(
        new sdk.TextContainerUpgrade({
          containerID: target.containerID,
          containerName: target.containerName,
          content,
        } as never) as never,
      ),
    shutDown: (mode) => bridge.shutDownPageContainer(mode),
    onEvent: (cb) => bridge.onEvenHubEvent((e) => cb(e as RawEvent)),
  }
}

/**
 * Wait for the Even App bridge and return a ready G2. Pass `sdk` to supply
 * the module yourself (e.g. `import * as sdk from '@evenrealities/even_hub_sdk'`).
 */
export async function connect(opts: G2Options & { sdk?: SdkModule } = {}): Promise<G2> {
  const sdk = opts.sdk ?? ((await import('@evenrealities/even_hub_sdk')) as unknown as SdkModule)
  checkEnumDrift(sdk.OsEventTypeList)
  const bridge = await sdk.waitForEvenAppBridge()
  return new G2(sdkHost(sdk, bridge), opts)
}
