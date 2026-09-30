/**
 * hub-text: text components, inline and in boxes of their own. Text updates
 * cost no image send (~60 ms on G2 vs ~260 ms for an image), so they can
 * animate several times a second.
 *
 *  1. Inline (layouts.textWithTile): a fake sync. The page's text container
 *     (also the input capture) shows a TextSpinner on the status line and a
 *     TextProgress bar below it, one text area with three slots; the image tile
 *     is drawn once and never re-sent. Tap: settings.
 *  2. Boxes (layouts.textBoxes): a settings page, a TextSlider per firmware
 *     text container, driven by FocusRing edit mode. Swipe moves focus, tap
 *     edits, swipe changes the value, tap keeps it, hold undoes. "Done" goes
 *     back. A focus move updates two boxes; the tile shows a chart of the values.
 *
 * The phone page counts text updates per second and their median time.
 */
import { layouts } from 'g2-kit/bridge'
import { BarChart, Kpi } from 'g2-kit/charts'
import { FocusRing, stepValue } from 'g2-kit/input'
import { TextProgress, TextSlider, TextSpinner } from 'g2-kit/widgets'
import { start } from '../shared/phone'

const { g2, mirror } = await start()

// Time every text update (the phone page shows rate and median).
const times: number[] = []
if (g2.host.updateText) {
  const update = g2.host.updateText.bind(g2.host)
  g2.host.updateText = async (t, c) => {
    const t0 = performance.now()
    try {
      return await update(t, c)
    } finally {
      times.push(performance.now() - t0)
    }
  }
}
setInterval(() => {
  const recent = times.splice(0)
  if (!recent.length) return
  const sorted = [...recent].sort((a, b) => a - b)
  const stats = document.getElementById('textstats')
  if (stats) stats.textContent = `text updates: ${recent.length}/s, median ${sorted[Math.floor(sorted.length / 2)].toFixed(0)} ms`
}, 1000)

let screen: 'sync' | 'settings' = 'sync'
let timer: ReturnType<typeof setInterval> | null = null

// ── 1. inline: spinner + progress in the page's own text container ──
async function showSync(): Promise<void> {
  screen = 'sync'
  const page = layouts.textWithTile({ text: ' ' })
  await g2.show(page)
  g2.draw('tile', Kpi, { label: 'Synced today', value: 1284, format: 'compact', footnote: 'files' })
  const area = g2.textArea(page.text)
  // One line with the spinner inline, then the bar, then a hint.
  area.layout((p) => `${p.spin} ${p.title}\n${p.bar}\n\n${p.hint}`)
  area.set('title', 'Syncing photos').set('hint', 'tap: settings   double-tap: exit')
  let frame = 0
  let done = 0
  const tick = () => {
    area.draw('spin', TextSpinner, { frame: frame++ })
    area.draw('bar', TextProgress, { value: done, max: 40, valueText: `${done}/40` })
    if (++done > 40) done = 0
  }
  tick()
  if (timer) clearInterval(timer)
  // ~7 updates/s: text keeps up (~60 ms each); an image tile would manage ~3.
  timer = setInterval(tick, 150)
}

// ── 2. boxes: a TextSlider per text container ──
const values = { volume: 40, brightness: 70, speed: 3 }
let snapshot = { ...values }
const SLIDERS = [
  { id: 'volume', label: 'Volume', min: 0, max: 100, step: 5 },
  { id: 'brightness', label: 'Brightness', min: 0, max: 100, step: 10 },
  { id: 'speed', label: 'Speed', min: 1, max: 5, step: 1 },
] as const
const settingsPage = layouts.textBoxes({
  // 144 px of text above the tile, one firmware line per box (~27 px + padding; a box that overflows would
  // scroll, and the capture box would eat swipes): a header with Done and hints, then one box per slider.
  boxes: [
    { name: 'head', h: 36 },
    { name: 'volume', h: 36 },
    { name: 'brightness', h: 36 },
    { name: 'speed', h: 36 },
  ],
  tile: { w: 288, h: 144 },
})
const ring = new FocusRing(
  [
    ...SLIDERS.map((s) => ({
      id: s.id,
      edit: {
        begin: () => (snapshot = { ...values }),
        adjust: (d: 1 | -1) => (values[s.id] = stepValue(values[s.id], d, { min: s.min, max: s.max, step: s.step })),
        cancel: () => Object.assign(values, snapshot),
      },
    })),
    { id: 'done', activate: () => void showSync() },
  ],
  { onChange: () => drawSettings() },
)

function drawSettings(): void {
  if (screen !== 'settings') return
  const done = ring.is('done')
  // One line per box: a box that overflows scrolls, and the capture box would then eat swipes.
  const hint = ring.editing ? 'swipe: change   tap: keep   hold: undo' : done ? 'tap: back' : 'swipe: move   tap: edit'
  g2.textArea(settingsPage.boxes.head).set('t', `${done ? '>' : ' '} Done      ${hint}`)
  for (const s of SLIDERS)
    g2.textArea(settingsPage.boxes[s.id]).draw('s', TextSlider, { label: s.label, value: values[s.id], min: s.min, max: s.max, width: 10, focused: ring.is(s.id) && !ring.editing, editing: ring.is(s.id) && ring.editing })
  g2.draw('tile', BarChart, { data: [{ label: 'Vol', value: values.volume }, { label: 'Bri', value: values.brightness }, { label: 'Spd', value: values.speed * 20 }], max: 100, valueLabels: false })
}

async function showSettings(): Promise<void> {
  if (timer) clearInterval(timer)
  timer = null
  screen = 'settings'
  await g2.show(settingsPage)
  ring.focus(0, false)
  drawSettings()
}

g2.on('*', (e) => {
  if (screen === 'sync') {
    if (e.type === 'tap') void showSettings()
  } else ring.handle(e)
})

await showSync()
mirror.log('ready')
