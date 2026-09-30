/**
 * TextArea: retained content for one firmware text container, the text
 * counterpart of `Surface`. Named slots (plain strings or text components) are
 * joined into the container's content: one line each in insertion order, or
 * through your own `layout`. Changes commit in a microtask; the text is sent
 * only when it changed, and while one update is in flight further changes
 * coalesce into a single follow-up.
 *
 *   const status = g2.textArea('text')                  // the page's capture text, or any text container
 *   status.draw('spin', TextSpinner, { frame, label: 'Syncing' })
 *   status.set('hint', 'hold: cancel')
 *
 * A text update took ~60 ms on G2 glasses vs ~260 ms for an image send (STATUS.md).
 */
import type { TextComponent } from '../core/textComponent.js'
import { MAX_TEXT_BYTES } from './pageBuilder.js'

export type TextLayout = (parts: Readonly<Record<string, string>>, order: readonly string[]) => string

export class TextArea {
  private slots = new Map<string, () => string>()
  private layoutFn: TextLayout | null = null
  private scheduled = false
  private inFlight: Promise<void> | null = null
  private again = false
  private warned = false

  /**
   * @param send   sends the whole content (e.g. `G2.setText`); resolves true on success
   * @param shown  what the container shows now (its layout content), so an unchanged first commit is skipped
   */
  constructor(
    private readonly send: (content: string) => Promise<boolean>,
    private shown: string | null = null,
  ) {}

  /** A plain text slot. */
  set(key: string, text: string): this {
    this.slots.set(key, () => text)
    return this.changed()
  }

  /** A text component slot; call again with new props to update it. */
  draw<P>(key: string, component: TextComponent<P>, props: P): this {
    this.slots.set(key, () => component.render(props))
    return this.changed()
  }

  remove(key: string): this {
    this.slots.delete(key)
    return this.changed()
  }

  /** Compose slots yourself, e.g. `(p) => \`${p.spin} ${p.title}\n${p.bar}\``. Default: one line per slot. */
  layout(fn: TextLayout | null): this {
    this.layoutFn = fn
    return this.changed()
  }

  /** The content as it would be sent now. */
  get content(): string {
    const order = [...this.slots.keys()]
    const parts: Record<string, string> = {}
    for (const k of order) parts[k] = this.slots.get(k)!()
    const text = this.layoutFn ? this.layoutFn(parts, order) : order.map((k) => parts[k]).join('\n')
    // An empty text container would collapse; firmware containers are created with ' ' too.
    return text || ' '
  }

  /** Send the current content now if it changed (resolves when it reached the glasses). */
  flush(): Promise<void> {
    this.scheduled = false
    if (this.inFlight) {
      this.again = true
      return this.inFlight
    }
    const next = this.content
    if (next === this.shown) return Promise.resolve()
    if (!this.warned && new TextEncoder().encode(next).length > MAX_TEXT_BYTES) {
      this.warned = true
      console.warn(`[g2-kit] text area content is over ${MAX_TEXT_BYTES} bytes; the firmware may cut it`)
    }
    this.inFlight = this.send(next)
      .then((ok) => {
        if (ok) this.shown = next
      })
      .catch((err: unknown) => console.warn('[g2-kit] text update failed:', err))
      .finally(() => {
        this.inFlight = null
        if (this.again) {
          this.again = false
          void this.flush()
        }
      })
    return this.inFlight
  }

  private changed(): this {
    if (!this.scheduled) {
      this.scheduled = true
      queueMicrotask(() => {
        if (this.scheduled) void this.flush()
      })
    }
    return this
  }
}
