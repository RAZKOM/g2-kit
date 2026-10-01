/**
 * Text components (strings for firmware text containers, see core/textComponent):
 * spinner, progress bar, slider, menu, toggle, hold-to-confirm.
 *
 * Default glyphs are the box-drawing, block and shape characters the G2
 * firmware font draws (━ ─ █ ● ○ ▶ ▷ ← ↑); `glyphs: 'ascii'` falls back to
 * plain ASCII (# - = o >). Meaning is carried by characters, not brightness:
 * ▶ marks focus, ◀ ▶ edit mode, ● on / selected, ━ or █ the done part of a bar.
 * The font is proportional, so markers that swap (▶ / ▷, ● / ○) are pairs of
 * the same shape to keep lines from shifting.
 */
import { defineTextComponent } from '../core/textComponent.js'

export type TextGlyphs = 'unicode' | 'ascii'

const SPINNER_FRAMES = {
  /** ↑ ↗ → ↘ ↓ ↙ ← ↖ (default) */
  arrows: ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'],
  triangle: ['▲', '▶', '▼', '◀'],
  pulse: ['○', '◎', '●', '◎'],
  half: ['◐', '◑'],
  /** ASCII */
  line: ['|', '/', '-', '\\'],
  dots: ['.  ', '.. ', '...', ' ..', '  .', '   '],
  bar: ['[=   ]', '[ =  ]', '[  = ]', '[   =]', '[  = ]', '[ =  ]'],
} as const

export interface TextSpinnerProps {
  /** Frame counter; any integer (wraps). */
  frame: number
  /** Frame set (default 'arrows'; 'line' with `glyphs: 'ascii'`). */
  style?: keyof typeof SPINNER_FRAMES
  /** Text after the spinner, e.g. 'Syncing'. */
  label?: string
  glyphs?: TextGlyphs
}

export function renderTextSpinner(p: TextSpinnerProps): string {
  const frames = SPINNER_FRAMES[p.style ?? (p.glyphs === 'ascii' ? 'line' : 'arrows')]
  const f = frames[((Math.round(p.frame) % frames.length) + frames.length) % frames.length]
  return p.label ? `${f} ${p.label}` : f
}

/** Busy indicator as text: one text update per frame (~60 ms on G2), so it can animate several times a second. */
export const TextSpinner = defineTextComponent<TextSpinnerProps>('TextSpinner', renderTextSpinner)

/** Partial cells for `blocks`: 1/8 … 7/8 of a full block. */
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']

export interface TextProgressProps {
  /** 0–1, or value/max when `max` is set. */
  value: number
  max?: number
  /** Bar length in characters (default 20). */
  width?: number
  label?: string
  /** Value after the bar: percentage (default), custom text, or none (false). */
  valueText?: string | false
  /** Solid blocks with eighth-cell precision (█▋───) instead of a line (━━━───). Unicode only. */
  blocks?: boolean
  /** Characters for the done and remaining parts (overrides the style). */
  chars?: { done: string; todo: string }
  glyphs?: TextGlyphs
}

export function renderTextProgress(p: TextProgressProps): string {
  const frac = Math.max(0, Math.min(1, p.max ? p.value / p.max : p.value))
  const width = Math.max(1, Math.round(p.width ?? 20))
  const ascii = p.glyphs === 'ascii'
  let bar: string
  if (p.blocks && !ascii && !p.chars) {
    const eighths = Math.round(frac * width * 8)
    const full = Math.floor(eighths / 8)
    const part = EIGHTHS[eighths % 8]
    bar = '█'.repeat(full) + part + '─'.repeat(Math.max(0, width - full - (part ? 1 : 0)))
  } else {
    const c = p.chars ?? (ascii ? { done: '#', todo: '-' } : { done: '━', todo: '─' })
    const done = Math.round(frac * width)
    bar = c.done.repeat(done) + c.todo.repeat(width - done)
    if (ascii && !p.chars) bar = `[${bar}]`
  }
  const value = p.valueText === false ? '' : ` ${p.valueText ?? `${Math.round(frac * 100)}%`}`
  return `${p.label ? `${p.label} ` : ''}${bar}${value}`
}

/** Progress / loading bar as text, e.g. `Download ━━━━━━━━──────────── 40%`. */
export const TextProgress = defineTextComponent<TextProgressProps>('TextProgress', renderTextProgress)

/** Focus markers: a filled and a hollow form of one shape, so focused and unfocused lines stay aligned. */
function marker(focused: boolean | undefined, glyphs: TextGlyphs | undefined): string {
  return glyphs === 'ascii' ? (focused ? '>' : ' ') : focused ? '▶' : '▷'
}

export interface TextSliderProps {
  value: number
  min?: number
  max?: number
  label?: string
  /** Track length in characters (default 12). */
  width?: number
  /** ▶ before the label (▷ otherwise). */
  focused?: boolean
  /** ◀ … ▶ around the track: swipes change the value. */
  editing?: boolean
  /** Value text (default: the number). */
  format?: (v: number) => string
  glyphs?: TextGlyphs
}

export function renderTextSlider(p: TextSliderProps): string {
  const min = p.min ?? 0
  const max = p.max ?? 100
  const width = Math.max(2, Math.round(p.width ?? 12))
  const t = Math.max(0, Math.min(1, (p.value - min) / (max - min || 1)))
  const at = Math.round(t * (width - 1))
  const ascii = p.glyphs === 'ascii'
  const [done, knob, todo] = ascii ? ['=', 'o', '-'] : ['━', '●', '─']
  const track = `${done.repeat(at)}${knob}${todo.repeat(width - 1 - at)}`
  const value = (p.format ?? ((v: number) => String(Math.round(v * 100) / 100)))(p.value)
  const head = `${marker(p.focused || p.editing, p.glyphs)} ${p.label ? `${p.label} ` : ''}`
  if (p.editing) return ascii ? `${head}< ${track} > ${value}` : `${head}◀ ${track} ▶ ${value}`
  return ascii ? `${head}[${track}] ${value}` : `${head}${track} ${value}`
}

/** Slider as text, e.g. `▶ Volume ━━━━●─────── 40`; editing shows ◀ … ▶. Pair with FocusRing edit mode. */
export const TextSlider = defineTextComponent<TextSliderProps>('TextSlider', renderTextSlider)

export interface TextMenuProps {
  items: readonly string[]
  /** Focused item (▶); -1 for none. */
  focus?: number
  /** Checked items (● / ○ before the label), for multi-select lists. */
  checked?: readonly boolean[]
  /** Most items shown at once (default all); the window follows focus, ▲ / ▼ mark more. */
  visible?: number
  glyphs?: TextGlyphs
}

export function renderTextMenu(p: TextMenuProps): string {
  const n = p.items.length
  const focus = p.focus ?? -1
  const visible = Math.max(1, Math.min(n, p.visible ?? n))
  const offset = Math.max(0, Math.min(n - visible, focus - Math.floor(visible / 2)))
  const ascii = p.glyphs === 'ascii'
  const lines: string[] = []
  for (let i = offset; i < offset + visible; i++) {
    const check = p.checked ? `${p.checked[i] ? (ascii ? '[x]' : '●') : ascii ? '[ ]' : '○'} ` : ''
    let line = `${marker(i === focus, p.glyphs)} ${check}${p.items[i]}`
    if (i === offset && offset > 0) line += ascii ? '  ^' : '  ▲'
    if (i === offset + visible - 1 && offset + visible < n) line += ascii ? '  v' : '  ▼'
    lines.push(line)
  }
  return lines.join('\n')
}

/**
 * Menu / list as text, one item per line with ▶ on the focused one: a cheap menu with no image
 * (the "fake buttons" pattern). Keep `visible` to what the container fits: a capture container that
 * overflows scrolls and eats swipes.
 */
export const TextMenu = defineTextComponent<TextMenuProps>('TextMenu', renderTextMenu)

export interface TextToggleProps {
  on: boolean
  label?: string
  focused?: boolean
  glyphs?: TextGlyphs
}

export function renderTextToggle(p: TextToggleProps): string {
  const ascii = p.glyphs === 'ascii'
  const state = p.on ? (ascii ? '[x] On' : '● On') : ascii ? '[ ] Off' : '○ Off'
  return `${marker(p.focused, p.glyphs)} ${p.label ? `${p.label}  ` : ''}${state}`
}

/** Toggle as text: `▶ Wi-Fi  ● On` / `▷ Wi-Fi  ○ Off`. */
export const TextToggle = defineTextComponent<TextToggleProps>('TextToggle', renderTextToggle)

export interface TextHoldProps {
  /** 0–1 while held (HoldToConfirm's `onProgress`). */
  progress: number
  /** What holding does (default 'Hold to confirm'). */
  label?: string
  /** Confirmed: shows `doneLabel` instead of the bar. */
  done?: boolean
  doneLabel?: string
  /** Bar length in characters (default 12). */
  width?: number
  glyphs?: TextGlyphs
}

export function renderTextHold(p: TextHoldProps): string {
  const ascii = p.glyphs === 'ascii'
  if (p.done) return `${ascii ? '[x]' : '●'} ${p.doneLabel ?? 'Confirmed'}`
  const holding = p.progress > 0
  // Glyphs checked on G2 glasses only (● ○ ━ ─); ◉ and the eighth blocks are blank in the simulator.
  const mark = ascii ? (holding ? '[~]' : '[ ]') : holding ? '●' : '○'
  const bar = renderTextProgress({ value: p.progress, width: p.width ?? 12, valueText: false, glyphs: p.glyphs })
  return `${mark} ${p.label ?? 'Hold to confirm'}  ${bar}`
}

/**
 * Hold-to-confirm feedback as text: `○ Hold to delete  ────────────`, filling (`●`, `━━━━━━──────`) while held, then
 * `● Confirmed`. Drive it from `HoldToConfirm`'s `onProgress` / `onConfirm`. A text update takes ~60 ms on G2,
 * so the bar can move ~10 times a second; an image ring managed ~2 (hub-probe H4).
 */
export const TextHold = defineTextComponent<TextHoldProps>('TextHold', renderTextHold)
