/**
 * hub-keyboard: every Keyboard option on one page.
 *
 * The glasses run promptText in a loop with the configuration chosen on the
 * phone. Changing anything on the phone aborts the prompt and reopens it with
 * the new keyboard, keeping the text (promptText's onChange keeps the draft).
 * A cancel (hold while choosing a row, or a cancel key) switches to the next
 * preset, so configurations can be compared from the glasses alone; submit
 * logs the message and starts a new one. The phone page counts the gestures
 * each message took and compares them with `typingCost`, the fewest possible.
 */
import type { G2Event } from 'g2-kit/bridge'
import { promptText } from 'g2-kit/input'
import { keyboardLayout, typingCost, type ActionName, type KeyboardOptions } from 'g2-kit/widgets'
import { start } from '../shared/phone'
import { PRESETS, SAMPLE_TEXT } from './presets'

const { g2, mirror } = await start()

const ACTIONS: ActionName[] = ['shift', 'caps', 'symbols', 'space', 'delete', 'cancel', 'submit']
const DEFAULT_ACTIONS: ActionName[] = ['shift', 'symbols', 'space', 'delete', 'submit']

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const presetSelect = $<HTMLSelectElement>('preset')
const field = {
  letters: $<HTMLSelectElement>('letters'),
  panels: $<HTMLSelectElement>('panels'),
  digits: $<HTMLSelectElement>('digits'),
  scan: $<HTMLSelectElement>('scan'),
  afterType: $<HTMLSelectElement>('afterType'),
  punctuation: $<HTMLInputElement>('punctuation'),
  submitLabel: $<HTMLInputElement>('submitLabel'),
}
const actionBoxes = new Map<ActionName, HTMLInputElement>()
for (const a of ACTIONS) {
  const label = document.createElement('label')
  const box = document.createElement('input')
  box.type = 'checkbox'
  label.append(box, a)
  $('actions').append(label)
  actionBoxes.set(a, box)
}
PRESETS.forEach((p, i) => presetSelect.add(new Option(p.name, String(i))))

let presetIndex = Math.max(0, PRESETS.findIndex((p) => p.id === new URLSearchParams(location.search).get('preset')))
let options: KeyboardOptions = PRESETS[presetIndex].options
let draft = ''
let ctrl: AbortController | null = null
const count = { gestures: 0 }

/** Show `o` in the form. */
function fillForm(o: KeyboardOptions): void {
  presetSelect.value = String(presetIndex)
  field.letters.value = typeof o.letters === 'string' ? o.letters : 'qwerty'
  field.panels.value = o.symbols === false ? 'none' : (o.panels ?? 'layers')
  field.digits.value = o.digits === false ? 'none' : (o.digits ?? 'symbols')
  field.scan.value = o.scan ?? 'rows'
  field.afterType.value = o.afterType ?? 'group'
  field.punctuation.value = o.punctuation ?? ''
  field.submitLabel.value = o.labels?.submit ?? ''
  const actions = o.actions ?? DEFAULT_ACTIONS
  for (const [a, box] of actionBoxes) box.checked = actions.includes(a)
}

/** Options from the form, leaving out defaults so the code sample stays short. */
function readForm(): KeyboardOptions {
  const o: KeyboardOptions = {}
  if (field.letters.value !== 'qwerty') o.letters = field.letters.value as 'qwertz' | 'azerty' | 'abc'
  if (field.panels.value === 'none') o.symbols = false
  else if (field.panels.value !== 'layers') o.panels = field.panels.value as 'side' | 'stack'
  if (field.digits.value !== 'symbols') o.digits = field.digits.value === 'none' ? false : 'row'
  if (field.scan.value !== 'rows') o.scan = field.scan.value as 'columns' | 'keys'
  if (field.afterType.value !== 'group') o.afterType = 'stay'
  if (field.punctuation.value) o.punctuation = field.punctuation.value
  if (field.submitLabel.value) o.labels = { submit: field.submitLabel.value }
  const actions = ACTIONS.filter((a) => actionBoxes.get(a)!.checked)
  if (actions.join() !== DEFAULT_ACTIONS.join()) o.actions = actions
  return o
}

function showNumbers(): void {
  const layout = keyboardLayout(options)
  const costs = SAMPLE_TEXT.map((t) => typingCost(layout, t))
  const chars = SAMPLE_TEXT.join('').length
  const perChar = costs.reduce((a, c) => a + c.gestures, 0) / chars
  const missing = [...new Set(costs.map((c) => c.missing).join(''))].join('')
  const draftCost = draft ? typingCost(layout, draft) : null
  $('numbers').textContent = [
    `Estimate on short messages: ${perChar.toFixed(2)} gestures per character (fewest possible; QWERTY default ≈ 5.1)${missing ? `; cannot type ${JSON.stringify(missing)}` : ''}.`,
    `This message: ${count.gestures} gestures for ${draft.length} characters${draftCost ? `; fewest possible ${draftCost.gestures}` : ''}.`,
  ].join('\n')
  $('code').textContent = `import { promptText } from 'g2-kit/input'\n\nconst text = await promptText(g2, { keyboard: ${JSON.stringify(options, null, 2)} })`
}

/** Apply the form (or a preset): reopen the prompt with the new keyboard, keeping the text. */
function apply(o: KeyboardOptions): void {
  options = o
  showNumbers()
  ctrl?.abort()
}

presetSelect.addEventListener('change', () => {
  presetIndex = Number(presetSelect.value)
  fillForm(PRESETS[presetIndex].options)
  apply(PRESETS[presetIndex].options)
})
for (const el of [...Object.values(field), ...actionBoxes.values()]) el.addEventListener('change', () => apply(readForm()))

// Count gestures (the prompt consumes them before any `on` handler, so count at dispatch).
const dispatch = g2.dispatch.bind(g2)
g2.dispatch = (e: G2Event) => {
  if (e.type === 'next' || e.type === 'prev' || e.type === 'tap' || e.type === 'hold') {
    count.gestures++
    queueMicrotask(showNumbers)
  }
  dispatch(e)
}

fillForm(options)
showNumbers()
mirror.log(`keyboard: ${PRESETS[presetIndex].name}`)
for (;;) {
  ctrl = new AbortController()
  const signal = ctrl.signal
  const text = await promptText(g2, {
    keyboard: options,
    value: draft,
    label: options === PRESETS[presetIndex].options ? `${presetIndex + 1}/${PRESETS.length} ${PRESETS[presetIndex].id}` : 'custom',
    signal,
    onChange: (t) => {
      draft = t
      showNumbers()
    },
  })
  if (signal.aborted) continue // settings changed: reopen with the same text
  if (text === null) {
    // Cancel: next preset.
    presetIndex = (presetIndex + 1) % PRESETS.length
    options = PRESETS[presetIndex].options
    fillForm(options)
    mirror.log(`keyboard: ${PRESETS[presetIndex].name}`)
  } else {
    mirror.log(`sent "${text}" in ${count.gestures} gestures`)
    console.log(`[hub-keyboard] sent "${text}" in ${count.gestures} gestures`)
    draft = ''
  }
  count.gestures = 0
  showNumbers()
}
