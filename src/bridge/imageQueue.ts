/**
 * The only path to `updateImageRawData`, and where page rebuilds run, so an
 * image send and a rebuild never overlap. Generalised from WordLens.
 *
 *  - One task in flight at a time; ≥ gapMs between image sends. On G2 glasses a
 *    send itself takes ~300–370 ms (measured with examples/hub-bench), and that
 *    round trip is the frame budget; the gap adds little on top.
 *  - Coalescing: a newer frame for a container replaces its pending one, and
 *    frames render lazily at send time, so only the latest state is sent.
 *  - Rebuild-aware: an `op` (page create/rebuild) drops image frames queued
 *    before it; those containers are about to be recreated.
 *  - A transient failure (sendFailed / exception) is retried once after
 *    retryMs, unless a newer frame for the same container is already waiting.
 *    Size/format failures are not retried. Failures are reported as typed
 *    `ImageSendError`s via `onError`.
 */
import { Framebuffer } from '../core/framebuffer.js'
import { encodeTile, type TileFormat } from '../core/encode.js'
import { ImageSendError, toImageResult, type ImageTarget } from './errors.js'

export type { ImageTarget } from './errors.js'

/** Whatever the host's send returns: an ImageResult string, bool, or int code. */
export type ImageSender = (target: ImageTarget, bytes: Uint8Array) => Promise<unknown>
export type Sleep = (ms: number) => Promise<void>
export type FrameSource = () => Uint8Array | Framebuffer

export interface ImageQueueOptions {
  /**
   * Minimum gap between image sends (default 25 ms). The send itself takes ~300–370 ms on G2 glasses and
   * gaps down to 0 left no frame stuck (hub-bench, STATUS.md); 25 ms keeps a small margin.
   */
  gapMs?: number
  /** Delay before the single retry of a transient failure (default 300 ms). */
  retryMs?: number
  /** Encoding for Framebuffer frames (default 'png'). */
  format?: TileFormat
  sleep?: Sleep
  now?: () => number
  /** Called after each successful send (phone-side mirror, metrics). */
  onSent?: (target: ImageTarget, bytes: Uint8Array, frame: Framebuffer | null) => void
  /** Called for each frame that finally failed (after any retry). */
  onError?: (err: ImageSendError) => void
}

type ImageTask = { kind: 'image'; target: ImageTarget; render: FrameSource }
type OpTask = { kind: 'op'; run: () => Promise<void> }
type Task = ImageTask | OpTask

export interface QueueStats {
  sent: number
  /** Frames replaced by a newer frame before being sent. */
  coalesced: number
  /** Frames dropped by a page op or a failed send. */
  dropped: number
  failed: number
  retried: number
}

export const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export class ImageQueue {
  private tasks: Task[] = []
  private running = false
  private idleWaiters: Array<() => void> = []
  private lastImageAt = -Infinity
  readonly stats: QueueStats = { sent: 0, coalesced: 0, dropped: 0, failed: 0, retried: 0 }

  constructor(
    private readonly send: ImageSender,
    private readonly opts: ImageQueueOptions = {},
  ) {}

  private get gapMs(): number {
    return this.opts.gapMs ?? 25
  }
  private get sleep(): Sleep {
    return this.opts.sleep ?? realSleep
  }
  private get now(): () => number {
    return this.opts.now ?? (() => Date.now())
  }

  /** Frames/ops waiting (not counting the one in flight). */
  get pending(): number {
    return this.tasks.length
  }

  get busy(): boolean {
    return this.running
  }

  /** Queue (or replace) the frame for one image container. */
  image(target: ImageTarget, render: FrameSource): void {
    // Only coalesce with a pending frame queued after the last op.
    for (let i = this.tasks.length - 1; i >= 0; i--) {
      const t = this.tasks[i]
      if (t.kind === 'op') break
      if (t.target.containerID === target.containerID) {
        this.tasks[i] = { kind: 'image', target, render }
        this.stats.coalesced++
        return
      }
    }
    this.tasks.push({ kind: 'image', target, render })
    this.pump()
  }

  /**
   * Queue an exclusive operation. With `dropFrames` (default true, for page
   * create/rebuild) image frames queued before it are discarded.
   */
  op(run: () => Promise<void>, opts: { dropFrames?: boolean } = {}): Promise<void> {
    if (opts.dropFrames !== false) {
      const before = this.tasks.length
      this.tasks = this.tasks.filter((t) => t.kind === 'op')
      this.stats.dropped += before - this.tasks.length
    }
    return new Promise<void>((resolve, reject) => {
      this.tasks.push({
        kind: 'op',
        run: async () => {
          try {
            await run()
            resolve()
          } catch (err) {
            reject(err)
          }
        },
      })
      this.pump()
    })
  }

  /** Drop everything pending (the in-flight task still completes). */
  clear(): void {
    this.stats.dropped += this.tasks.filter((t) => t.kind === 'image').length
    this.tasks = []
  }

  /** Resolves when nothing is queued or in flight. */
  idle(): Promise<void> {
    if (!this.running && this.tasks.length === 0) return Promise.resolve()
    return new Promise((r) => this.idleWaiters.push(r))
  }

  private hasNewerFrame(containerID: number): boolean {
    return this.tasks.some((t) => t.kind === 'image' && t.target.containerID === containerID)
  }

  private pump(): void {
    if (this.running) return
    this.running = true
    // Start on a microtask so frames queued in the same tick coalesce too.
    queueMicrotask(() => void this.drain())
  }

  private async drain(): Promise<void> {
    try {
      while (this.tasks.length > 0) {
        const task = this.tasks.shift()!
        if (task.kind === 'op') {
          await task.run()
          continue
        }
        await this.sendImage(task)
      }
    } finally {
      this.running = false
      const waiters = this.idleWaiters
      this.idleWaiters = []
      waiters.forEach((w) => w())
    }
  }

  private async sendImage(task: ImageTask): Promise<void> {
    const wait = this.lastImageAt + this.gapMs - this.now()
    if (wait > 0) await this.sleep(wait)
    let err = await this.trySend(task)
    this.lastImageAt = this.now()
    if (err && err.retryable && !this.hasNewerFrame(task.target.containerID)) {
      await this.sleep(this.opts.retryMs ?? 300)
      if (!this.hasNewerFrame(task.target.containerID)) {
        this.stats.retried++
        err = await this.trySend(task)
        this.lastImageAt = this.now()
      }
    }
    if (err) {
      this.stats.failed++
      if (this.opts.onError) this.opts.onError(err)
      else console.warn('[g2-kit]', err.message)
    }
  }

  private async trySend(task: ImageTask): Promise<ImageSendError | null> {
    let frame: Framebuffer | null = null
    let bytes: Uint8Array
    try {
      const out = task.render()
      if (out instanceof Framebuffer) {
        frame = out
        bytes = encodeTile(out, this.opts.format)
      } else bytes = out
    } catch (e) {
      return new ImageSendError('threw', task.target, e)
    }
    try {
      const result = toImageResult(await this.send(task.target, bytes))
      if (result === 'success') {
        this.stats.sent++
        this.opts.onSent?.(task.target, bytes, frame)
        return null
      }
      return new ImageSendError(result, task.target)
    } catch (e) {
      return new ImageSendError('threw', task.target, e)
    }
  }
}
