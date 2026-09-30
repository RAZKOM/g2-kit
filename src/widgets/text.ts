/**
 * Text components (strings for firmware text containers, see core/textComponent):
 * spinner, progress bar, slider. ASCII only, so any firmware font shows them.
 * Meaning is carried by characters, not brightness: a `>` marks focus, `< >`
 * edit mode, `#` the done part of a bar.
 */
import { defineTextComponent } from '../core/textComponent.js'

const SPINNER_FRAMES = {
  line: ['|', '/', '-', '\\'],
  dots: ['.  ', '.. ', '...', ' ..', '  .', '   '],
  bar: ['[=   ]', '[ =  ]', '[  = ]', '[   =]', '[  = ]', '[ =  ]'],
} as const

export interface TextSpinnerProps {
  /** Frame counter; any integer (wraps). */
  frame: number
  /** Frame set (default 'line': | / - \). */
  style?: keyof typeof SPINNER_FRAMES
  /** Text after the spinner, e.g. 'Syncing'. */
  label?: string
}

export function renderTextSpinner(p: TextSpinnerProps): string {
  const frames = SPINNER_FRAMES[p.style ?? 'line']
  const f = frames[((Math.round(p.frame) % frames.length) + frames.length) % frames.length]
  return p.label ? `${f} ${p.label}` : f
}

/** Busy indicator as text: one text update per frame (~60 ms on G2), so it can animate at several frames/s. */
export const TextSpinner = defineTextComponent<TextSpinnerProps>('TextSpinner', renderTextSpinner)

export interface TextProgressProps {
  /** 0–1, or value/max when `max` is set. */
  value: number
  max?: number
  /** Bar length in characters (default 20). */
  width?: number
  label?: string
  /** Value after the bar: percentage (default), custom text, or none (false). */
  valueText?: string | false
  /** Characters for the done and remaining parts (default '#' and '-'). */
  chars?: { done: string; todo: string }
}

export function renderTextProgress(p: TextProgressProps): string {
  const frac = Math.max(0, Math.min(1, p.max ? p.value / p.max : p.value))
  const width = Math.max(1, Math.round(p.width ?? 20))
  const done = Math.round(frac * width)
  const c = p.chars ?? { done: '#', todo: '-' }
  const bar = `[${c.done.repeat(done)}${c.todo.repeat(width - done)}]`
  const value = p.valueText === false ? '' : ` ${p.valueText ?? `${Math.round(frac * 100)}%`}`
  return `${p.label ? `${p.label} ` : ''}${bar}${value}`
}

/** Progress / loading bar as text, e.g. `Download [########------------] 40%`. */
export const TextProgress = defineTextComponent<TextProgressProps>('TextProgress', renderTextProgress)

export interface TextSliderProps {
  value: number
  min?: number
  max?: number
  label?: string
  /** Track length in characters (default 12). */
  width?: number
  /** `>` before the label. */
  focused?: boolean
  /** `< … >` around the track: swipes change the value. */
  editing?: boolean
  /** Value text (default: the number). */
  format?: (v: number) => string
}

export function renderTextSlider(p: TextSliderProps): string {
  const min = p.min ?? 0
  const max = p.max ?? 100
  const width = Math.max(2, Math.round(p.width ?? 12))
  const t = Math.max(0, Math.min(1, (p.value - min) / (max - min || 1)))
  const at = Math.round(t * (width - 1))
  const track = `${'='.repeat(at)}o${'-'.repeat(width - 1 - at)}`
  const value = (p.format ?? ((v: number) => String(Math.round(v * 100) / 100)))(p.value)
  const head = `${p.focused || p.editing ? '>' : ' '} ${p.label ? `${p.label} ` : ''}`
  return p.editing ? `${head}< ${track} > ${value}` : `${head}[${track}] ${value}`
}

/** Slider as text, e.g. `> Volume [=====o------] 40`; editing shows `< … >`. Pair with FocusRing edit mode. */
export const TextSlider = defineTextComponent<TextSliderProps>('TextSlider', renderTextSlider)
