/**
 * Hybrid skeleton: a native list for one mode (firmware highlight, taps
 * report an index) and a blank text container + drawn control for another
 * (swipes reach the app, so the control can react per gesture). Switching
 * mode changes the capture container, so it needs a page rebuild.
 */
import type { Box, ListSpec, TextSpec } from '../bridge/pageBuilder.js'
import { blankTextSkeleton, listSkeleton, type ListSkeletonOptions } from './skeletons.js'

export type HybridMode = 'list' | 'drawn'

export class HybridSkeleton {
  constructor(
    readonly box: Box,
    public items: readonly string[],
    public mode: HybridMode = 'drawn',
    private readonly opts: ListSkeletonOptions = {},
  ) {}

  /** The capture container for the current mode (add it to the PageBuilder). */
  spec(): TextSpec | ListSpec {
    return this.mode === 'list' ? listSkeleton(this.box, this.items, this.opts) : blankTextSkeleton(this.box, this.opts)
  }

  /** Switch mode; returns true if a rebuild is needed. */
  setMode(mode: HybridMode): boolean {
    if (mode === this.mode) return false
    this.mode = mode
    return true
  }

  toggle(): HybridMode {
    this.mode = this.mode === 'list' ? 'drawn' : 'list'
    return this.mode
  }
}
