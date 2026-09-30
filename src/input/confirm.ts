/**
 * Confirmation helpers for destructive actions.
 *
 * HoldToConfirm: fills a ring while the user holds; confirms after
 * `durationMs`. It relies on LONG_PRESS (start) and LONG_PRESS_RELEASE
 * (end) events. The docs say both arrive (SDK ≥ 0.0.14) and that a rebuild
 * mid-press still delivers the release; how long after touch-down the
 * LONG_PRESS event fires, and whether the ring can refresh fast enough while
 * held, is UNVERIFIED on hardware. Each progress redraw costs one image send
 * (~100 ms), so progress ticks at 100 ms at best.
 *
 * TapConfirm: tap arms ("tap again to confirm"), a second tap within
 * `timeoutMs` confirms. Works everywhere; the safe default.
 */
import type { G2Event } from '../bridge/events.js'

export interface Timers {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
  now(): number
}

export const realTimers: Timers = {
  set: (fn, ms) => setInterval(fn, ms),
  clear: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  now: () => Date.now(),
}

export interface HoldToConfirmOptions {
  durationMs?: number
  tickMs?: number
  onProgress?(fraction: number): void
  onConfirm(): void
  onCancel?(): void
  timers?: Timers
}

export class HoldToConfirm {
  private start: number | null = null
  private handle: unknown = null
  private done = false
  private readonly t: Timers

  constructor(private readonly o: HoldToConfirmOptions) {
    this.t = o.timers ?? realTimers
  }

  get holding(): boolean {
    return this.start !== null
  }

  progress(): number {
    if (this.start === null) return this.done ? 1 : 0
    return Math.min(1, (this.t.now() - this.start) / (this.o.durationMs ?? 1200))
  }

  /** Returns true when the event was a hold/release this helper consumed. */
  handleEvent(e: G2Event): boolean {
    if (e.type === 'hold') {
      this.begin()
      return true
    }
    if (e.type === 'release' && this.start !== null) {
      this.end()
      return true
    }
    return false
  }

  begin(): void {
    if (this.start !== null) return
    this.done = false
    this.start = this.t.now()
    this.o.onProgress?.(0)
    this.handle = this.t.set(() => this.tick(), this.o.tickMs ?? 100)
  }

  end(): void {
    if (this.start === null) return
    const finished = this.progress() >= 1
    this.stop()
    if (!finished && !this.done) {
      this.o.onProgress?.(0)
      this.o.onCancel?.()
    }
  }

  private tick(): void {
    const p = this.progress()
    this.o.onProgress?.(p)
    if (p >= 1 && !this.done) {
      this.done = true
      this.stop()
      this.o.onConfirm()
    }
  }

  private stop(): void {
    if (this.handle !== null) this.t.clear(this.handle)
    this.handle = null
    this.start = null
  }
}

export interface TapConfirmOptions {
  timeoutMs?: number
  onArm?(): void
  onConfirm(): void
  onDisarm?(): void
  timers?: Pick<Timers, 'now'> & { set(fn: () => void, ms: number): unknown; clear(h: unknown): void }
}

export class TapConfirm {
  armed = false
  private handle: unknown = null
  private readonly t: NonNullable<TapConfirmOptions['timers']>

  constructor(private readonly o: TapConfirmOptions) {
    this.t = o.timers ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>), now: () => Date.now() }
  }

  /** Call on tap. First tap arms, second confirms. */
  tap(): 'armed' | 'confirmed' {
    if (this.armed) {
      this.disarm(false)
      this.o.onConfirm()
      return 'confirmed'
    }
    this.armed = true
    this.o.onArm?.()
    this.handle = this.t.set(() => this.disarm(true), this.o.timeoutMs ?? 3000)
    return 'armed'
  }

  /** Any other gesture cancels an armed confirmation. */
  disarm(notify = true): void {
    if (this.handle !== null) this.t.clear(this.handle)
    this.handle = null
    if (!this.armed) return
    this.armed = false
    if (notify) this.o.onDisarm?.()
  }
}
