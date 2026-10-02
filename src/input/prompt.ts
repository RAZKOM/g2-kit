/**
 * One-call text entry. `promptText` rebuilds to a page with a firmware text
 * container that shows what has been typed (updates cost no image send) and a
 * keyboard. By default that is a text keyboard (`layouts.textKeyboard`): the
 * keys are firmware text over key frames drawn once, so moving the focus is a
 * ~60 ms text update instead of a ~350 ms image send. Layouts too wide for the
 * text grid (symbols beside the letters) and `style: 'drawn'` use the drawn
 * `Keyboard`: one tile (`layouts.textWithTile`), or two tiles
 * (`layouts.textWithSpan`) when the symbols sit beside or below the letters.
 * While it runs, `g2.modal` gives it the gestures; double-tap still reaches
 * the exit prompt. It resolves with the text on the submit key, or null on
 * cancel; the caller then shows its own page again.
 *
 *   const name = await promptText(g2, { label: 'Name' })
 *   await showHome()
 */
import type { G2Event } from '../bridge/events.js'
import type { G2 } from '../bridge/g2.js'
import { textKeyboard, textWithSpan, textWithTile } from '../bridge/layouts.js'
import { Keyboard, KeyboardState, keyboardLayout, type KeyboardLayout, type KeyboardOptions } from '../widgets/keyboard.js'
import { TextKeyboardFrames, renderTextKeyboard, textKeyboardGrid, type TextKeyboardGrid } from '../widgets/textKeyboard.js'

export interface PromptTextOptions {
  /** Starting text (default ''). */
  value?: string
  /** Shown before the text, e.g. 'Name' (default: a '>' prompt). */
  label?: string
  /** Most characters accepted (default 60, so the text container does not scroll). */
  maxLength?: number
  /** The keyboard: a compiled layout or options for `keyboardLayout` (default QWERTY, symbols on a second layer). */
  keyboard?: KeyboardLayout | KeyboardOptions
  /** Gesture hints under the text (default true). */
  hints?: boolean
  /**
   * 'text' (default): keys as firmware text over drawn frames, focus moves without image sends; falls back
   * to 'drawn' when the layout does not fit the text grid (28 cells, 5 lines). 'drawn': the `Keyboard` image.
   */
  style?: 'text' | 'drawn'
  /** Drawn keyboard: at the bottom (default) or top; for a tall keyboard, left (default) or right. */
  keyboardAt?: 'top' | 'bottom' | 'left' | 'right'
  /** Resolve with null when aborted (e.g. a timeout). */
  signal?: AbortSignal
  /** Called with the text after every change (live preview, keeping a draft across an abort). */
  onChange?: (text: string) => void
}

const isLayout = (k: KeyboardLayout | KeyboardOptions): k is KeyboardLayout => 'views' in k

/**
 * Show a keyboard and resolve with the typed text on submit, or null on
 * cancel (a cancel key, or hold while choosing a row/column), abort, or app
 * exit. Gestures: swipe moves through rows (or columns), tap opens one, swipe
 * moves through its keys, tap types, hold goes back.
 */
export function promptText(g2: G2, opts: PromptTextOptions = {}): Promise<string | null> {
  const layout = opts.keyboard && isLayout(opts.keyboard) ? opts.keyboard : keyboardLayout(opts.keyboard)
  const kb = new KeyboardState(layout, { text: opts.value, maxLength: opts.maxLength ?? 60 })
  const at = opts.keyboardAt
  let grid: TextKeyboardGrid | null = null
  if (opts.style !== 'drawn') {
    try {
      grid = textKeyboardGrid(layout, { maxLines: 5 })
    } catch {
      grid = null // too wide or tall for the text grid: draw it instead
    }
  }
  const textPage = grid ? textKeyboard({ lines: grid.lines, text: content() }) : null
  const page =
    textPage ??
    (layout.panels === 'layers'
      ? textWithTile({ text: content(), tileAt: at === 'top' ? 'top' : 'bottom' })
      : textWithSpan({ span: layout.panels === 'side' ? 'wide' : 'tall', spanAt: at, text: content() }))

  function content(): string {
    const line = `${opts.label ? `${opts.label}: ` : '> '}${kb.text}_`
    if (opts.hints === false) return line
    const what = layout.scan === 'columns' ? 'column' : 'row'
    const hint =
      layout.scan === 'keys'
        ? 'swipe: pick a key   tap: type it   hold: cancel'
        : kb.key < 0
          ? `swipe: pick a ${what}   tap: open it   hold: cancel`
          : `swipe: pick a key   tap: type it   hold: back to ${what}s`
    return `${line}\n\n${hint}`
  }
  const drawKeys = () => {
    if (textPage && grid) {
      // Focus and case: one text update. Frames: re-sent only when their pixels change (view, shift lock).
      const { view, group, key, shift } = kb.props
      g2.textArea(textPage.keys).set('k', renderTextKeyboard({ grid, view, group, key, shift }))
      g2.drawSpan(textPage.span, TextKeyboardFrames, { grid, view, shift, origin: textPage.origin })
    } else if ('span' in page) g2.drawSpan(page.span, Keyboard, kb.props)
    else g2.draw(page.tiles.tile, Keyboard, kb.props)
  }
  let shown = content()
  const updateText = () => {
    const next = content()
    if (next === shown) return
    shown = next
    void g2.setText(page.text, next).catch((err: unknown) => console.warn('[g2-kit] promptText:', err))
  }

  return new Promise((resolve, reject) => {
    let done = false
    const settle = (): boolean => {
      if (done) return false
      done = true
      release()
      opts.signal?.removeEventListener('abort', abort)
      return true
    }
    const finish = (value: string | null) => {
      if (settle()) resolve(value)
    }
    const abort = () => finish(null)

    const release = g2.modal((e: G2Event) => {
      switch (e.type) {
        case 'next':
        case 'prev':
          kb.move(e.type === 'next' ? 1 : -1)
          drawKeys()
          return true
        case 'hold':
          if (!kb.back()) finish(null)
          else {
            drawKeys()
            updateText() // the hint changes
          }
          return true
        case 'tap': {
          const effect = kb.tap()
          if (effect === 'submit') finish(kb.text)
          else if (effect === 'cancel') finish(null)
          else {
            drawKeys()
            updateText()
            if (effect === 'typed' || effect === 'deleted') opts.onChange?.(kb.text)
          }
          return true
        }
        case 'release':
          return true
        case 'exit':
          finish(null)
          return false
        default:
          return false
      }
    })

    if (opts.signal?.aborted) return abort()
    opts.signal?.addEventListener('abort', abort)
    g2.show(page).then(
      () => {
        if (!done) drawKeys()
      },
      (err: unknown) => {
        if (settle()) reject(err)
      },
    )
  })
}
