/**
 * Compile-time check (runs under `npm run typecheck`): the real SDK module must
 * satisfy g2-kit's structural SdkModule, so `connect({ sdk })` works for apps
 * that import the SDK themselves. Type-only import: nothing from the SDK runs.
 */
import { expectTypeOf, it } from 'vitest'
import type * as RealSdk from '@evenrealities/even_hub_sdk'
import type { SdkModule } from '../src/bridge/index.js'

it('the real SDK module is assignable to SdkModule', () => {
  expectTypeOf<typeof RealSdk>().toMatchTypeOf<SdkModule>()
})
