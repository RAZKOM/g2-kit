/**
 * hub-picker: three drawn input methods over blank text skeletons.
 *
 *  1. Carousel (twoTilesWithControl): swipe moves the carousel, one 288×64
 *     tile per gesture; tap types; hold deletes. TIME / KEYS open 2 and 3.
 *  2. Time picker: FocusRing over hours / minutes / Done. Tap enters edit
 *     mode, swipes roll the value, tap commits, hold cancels.
 *  3. Keyboard (textWithTile): an ABC grid on one tile under a firmware text
 *     container showing the typed text. Swipe moves rows, tap enters a row,
 *     swipe moves keys, tap types, hold goes back up. One tile send per move;
 *     typing updates the text container (no image send).
 */
import { layouts } from 'g2-kit/bridge'
import { FocusRing, stepValue } from 'g2-kit/input'
import { BigText, ButtonRow, Carousel, GridKeyboard, GridKeyboardState, TimePicker } from 'g2-kit/widgets'
import { start } from '../shared/phone'

const { g2, mirror } = await start()

const ITEMS = ['TIME', 'KEYS', 'SPC', 'DEL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
let index = ITEMS.indexOf('A')
let typed = ''
let screen: 'carousel' | 'time' | 'keys' = 'carousel'

// ── 1. carousel ──
const carouselPage = layouts.twoTilesWithControl()

function drawTyped(): void {
  g2.draw('left', BigText, { text: typed.length ? typed : 'Swipe, then tap', level: typed.length ? 15 : 7, maxLines: 3 })
}
function drawHelp(): void {
  g2.draw('right', BigText, { text: 'tap: type\nhold: delete\nTIME, KEYS: more', fonts: [{ font: 'body' }], align: 'left', level: 10 })
}
function drawCarousel(): void {
  g2.draw('control', Carousel, { items: ITEMS, index })
}

async function showCarousel(): Promise<void> {
  screen = 'carousel'
  await g2.show(carouselPage)
  drawTyped()
  drawHelp()
  drawCarousel()
}

function onCarousel(type: string): void {
  if (type === 'next' || type === 'prev') {
    index = (index + (type === 'next' ? 1 : -1) + ITEMS.length) % ITEMS.length
    drawCarousel() // one tile
    return
  }
  if (type === 'hold') {
    typed = typed.slice(0, -1)
    drawTyped()
    return
  }
  if (type !== 'tap') return
  const item = ITEMS[index]
  if (item === 'TIME') return void showTime()
  if (item === 'KEYS') return void showKeys()
  typed = item === 'DEL' ? typed.slice(0, -1) : item === 'SPC' ? `${typed} ` : typed + item
  drawTyped()
}

// ── 2. time picker ──
const time = { hours: 7, minutes: 30 }
let snapshot = { ...time }
const timePage = layouts.twoTilesWithControl({ control: { w: 288, h: 48 } })
const ring = new FocusRing(
  [
    { id: 'hours', edit: { begin: () => (snapshot = { ...time }), adjust: (d) => (time.hours = stepValue(time.hours, d, { min: 0, max: 23, wrap: true })), cancel: () => Object.assign(time, snapshot) } },
    { id: 'minutes', edit: { begin: () => (snapshot = { ...time }), adjust: (d) => (time.minutes = stepValue(time.minutes, d, { min: 0, max: 55, step: 5, wrap: true })), cancel: () => Object.assign(time, snapshot) } },
    { id: 'done', activate: () => void showCarousel() },
  ],
  { onChange: () => drawTime() },
)

function drawTime(): void {
  if (screen !== 'time') return
  const focus = ring.index < 2 ? ring.index : -1
  g2.draw('left', TimePicker, { ...time, focus, editing: ring.editing, label: 'Alarm', minuteStep: 5 })
  g2.draw('right', BigText, { text: ring.editing ? 'swipe: change\ntap: keep\nhold: undo' : 'swipe: move\ntap: edit', fonts: [{ font: 'body' }], align: 'left', level: 10 })
  g2.draw('control', ButtonRow, { buttons: [{ label: 'Hours' }, { label: 'Min' }, { label: 'Done' }], focus: ring.index, pressed: ring.editing ? ring.index : undefined })
}

async function showTime(): Promise<void> {
  screen = 'time'
  await g2.show(timePage)
  ring.focus(0, false)
  drawTime()
}

// ── 3. keyboard ──
// One 288×144 keyboard tile under a firmware text container that shows the typed text (and captures
// input). Every key move is one tile send; typing updates the text container with no image send.
const kbPage = layouts.textWithTile()
const kb = new GridKeyboardState()
let kbText = ''

function kbTextContent(): string {
  const hint = kb.col < 0 ? 'swipe: pick a row   tap: open it   hold: done' : 'swipe: pick a key   tap: type it   hold: back to rows'
  return `> ${kbText}_

${hint}`
}

function drawKeys(): void {
  g2.draw('tile', GridKeyboard, { row: kb.row, col: kb.col })
}

async function showKeys(): Promise<void> {
  screen = 'keys'
  kb.row = 0
  kb.col = -1
  await g2.show(layouts.textWithTile({ text: kbTextContent() }))
  drawKeys()
}

function onKeys(type: string): void {
  const level = kb.col
  if (type === 'next' || type === 'prev') kb.move(type === 'next' ? 1 : -1)
  else if (type === 'hold') {
    if (!kb.back()) return void showCarousel()
  } else if (type === 'tap') {
    const key = kb.tap()
    if (key === 'OK') {
      typed = kbText
      return void showCarousel()
    }
    if (key === 'DEL') kbText = kbText.slice(0, -1)
    else if (key === 'SPACE') kbText += ' '
    else if (key) kbText += key
    if (key) void g2.setText(kbPage.text.name, kbTextContent())
  } else return
  // The hint changes when moving between row and key level.
  if ((level < 0) !== (kb.col < 0)) void g2.setText(kbPage.text.name, kbTextContent())
  drawKeys()
}

g2.on('*', (e) => {
  if (screen === 'carousel') onCarousel(e.type)
  else if (screen === 'time') ring.handle(e)
  else onKeys(e.type)
})

await showCarousel()
mirror.log('ready')
