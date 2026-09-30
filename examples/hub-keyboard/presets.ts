/** Keyboard configurations shown by hub-keyboard and the README poster (no DOM, so scripts can import it). */
import type { KeyboardOptions } from 'g2-kit/widgets'

export interface KeyboardPreset {
  id: string
  name: string
  options: KeyboardOptions
}

export const PRESETS: KeyboardPreset[] = [
  { id: 'qwerty', name: 'QWERTY, symbols layer', options: {} },
  {
    id: 'abc-columns',
    name: 'ABC by columns, caps lock',
    options: { letters: 'abc', scan: 'columns', punctuation: '.,', actions: ['caps', 'symbols', 'space', 'delete', 'submit'], labels: { submit: 'Send' } },
  },
  { id: 'side', name: 'Symbols beside (2 tiles)', options: { panels: 'side' } },
  { id: 'stack', name: 'Symbols below, digits row', options: { panels: 'stack', digits: 'row', actions: ['shift', 'space', 'delete', 'cancel', 'submit'] } },
  { id: 'minimal', name: 'Letters only', options: { symbols: false, punctuation: '.', actions: ['space', 'delete', 'submit'] } },
  { id: 'azerty', name: 'AZERTY, stay on key', options: { letters: 'azerty', afterType: 'stay' } },
]

/** A few short messages, to estimate gestures per character with `typingCost`. */
export const SAMPLE_TEXT = ['on my way', 'running late, be there in 10', 'ok', 'thanks!', 'call you back soon', 'meeting moved to 3pm', 'Buy milk and eggs', 'where are you?']
