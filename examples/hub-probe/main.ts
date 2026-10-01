/**
 * hub-probe: hardware questions in one page (ROADMAP H3–H5). Pick a
 * probe on the phone; each says what to do on the glasses and what to record.
 * "Copy results" saves everything on the PC (examples/output/results/).
 *
 *  H5 render   times every gallery sample's render + PNG encode in this phone's WebView. No glasses input.
 *  H3 swipes   swipe N times; counts the events that arrive, with the tile redrawn per swipe or not.
 *  H4 hold     hold on the touchpad; HoldToConfirm fills an image ring or a TextHold bar (1.5 s). Logs
 *              hold → release times and how many frames / text updates went out while held.
 *
 * H2 (images over 288×144) is answered: they crash the app and the glasses (STATUS.md). Don't probe it again.
 *
 * Double-tap exits. `?probe=swipes` (render | swipes | hold) opens that probe first (sim:check uses it);
 * `&hold=text` starts H4 with the text bar.
 */
import { Framebuffer, defineComponent, drawText, encodePng, fillSector, font16x24, font8x12, type Rect } from 'g2-kit/core'
import { PageBuilder, layouts } from 'g2-kit/bridge'
import { HoldToConfirm, blankTextSkeleton } from 'g2-kit/input'
import { BigText, TextHold } from 'g2-kit/widgets'
import { SAMPLES } from '../gallery/samples'
import { start } from '../shared/phone'
import { shareResults } from '../shared/results'

const { g2, mirror } = await start({ doubleTapExits: true })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const now = () => performance.now()
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN)
const ms = (n: number) => (Number.isFinite(n) ? `${n.toFixed(n < 10 ? 1 : 0)} ms` : '–')

/** One 288×144 tile in the middle over an invisible capture skeleton: used by H3, H4 and H5. */
const TILE = { x: 144, y: 72, w: 288, h: 144 }
const probePage = new PageBuilder()
  .text(blankTextSkeleton({ x: 0, y: 0, w: 576, h: 288 }, { id: 10 }))
  .image({ id: 1, name: 'probe', ...TILE })
  .build<'probe'>()

const HoldRing = defineComponent<{ progress: number; label: string }>('ProbeHoldRing', { w: 288, h: 144 }, (fb: Framebuffer, r: Rect, p) => {
  const cx = r.x + 72
  const cy = r.y + r.h / 2
  fillSector(fb, cx, cy, 44, 56, 0, 360, 2)
  if (p.progress > 0) fillSector(fb, cx, cy, 44, 56, 0, 360 * Math.min(1, p.progress), 15)
  drawText(fb, `${Math.round(p.progress * 100)}%`, cx, cy - 12, { font: font16x24, level: 15, align: 'center' })
  drawText(fb, p.label, r.x + 214, cy - 6, { font: font8x12, level: 10, align: 'center' })
})

// ── results, shared by all probes ──
const results: Record<string, string[]> = { H5: [], H3: [], H4: [] }
function record(probe: string, line: string): void {
  results[probe].push(line)
  mirror.log(`${probe}: ${line}`)
  console.log(`[hub-probe] ${probe}: ${line}`)
  renderSummary()
}

// ── phone UI ──
const panel = document.createElement('div')
document.getElementById('stats')?.after(panel)
const tabs = document.createElement('div')
tabs.className = 'pad'
const body = document.createElement('div')
body.style.maxWidth = '576px'
const footer = document.createElement('div')
footer.className = 'pad'
const copyBtn = button('Copy results', () => void shareResults('hub-probe', summaryText(), copyBtn))
footer.append(copyBtn)
const summaryEl = document.createElement('pre')
summaryEl.style.cssText = 'white-space:pre-wrap;font:12px monospace;color:#bff5bf;max-width:576px'
panel.append(tabs, body, footer, summaryEl)

function button(label: string, onclick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.onclick = onclick
  return b
}
function small(label: string, onclick: () => void): HTMLButtonElement {
  const b = button(label, onclick)
  b.style.cssText = 'margin:4px 4px 0 0;padding:6px 10px;background:#121a12;color:#bff5bf;border:1px solid #2c3a2c;border-radius:4px'
  return b
}
function para(html: string): HTMLParagraphElement {
  const p = document.createElement('p')
  p.innerHTML = html
  return p
}
/** A question with one-tap answers; the latest answer is kept. */
function question(probe: string, q: string, answers: string[]): HTMLDivElement {
  const div = document.createElement('div')
  div.style.margin = '8px 0'
  const label = document.createElement('div')
  const draw = (a?: string) => (label.innerHTML = `${q} <b style="color:#6dff6d">${a ?? ''}</b>`)
  draw()
  div.append(label)
  for (const a of answers)
    div.append(
      small(a, () => {
        results[probe] = results[probe].filter((l) => !l.startsWith(`${q}:`))
        record(probe, `${q}: ${a}`)
        draw(a)
      }),
    )
  return div
}
function summaryText(): string {
  const head = `hub-probe ${new Date().toISOString()}\n${navigator.userAgent}`
  return [head, ...Object.entries(results).map(([k, v]) => `[${k}]\n${v.length ? v.join('\n') : '(not run)'}`)].join('\n\n')
}
function renderSummary(): void {
  summaryEl.textContent = summaryText()
}

type Mode = 'render' | 'swipes' | 'hold'
let mode: Mode = 'render'
const PROBES: Array<[Mode, string, () => Promise<void>]> = [
  ['render', 'H5 render', showRender],
  ['swipes', 'H3 swipes', showSwipes],
  ['hold', 'H4 hold', showHold],
]
function open(m: Mode): Promise<void> {
  mode = m
  body.innerHTML = ''
  return PROBES.find((p) => p[0] === m)![2]()
}
for (const [m, label] of PROBES) tabs.append(button(label, () => void open(m)))

async function showProbePage(text: string): Promise<void> {
  await g2.show(probePage)
  g2.draw('probe', BigText, { text, fonts: [{ font: 'body' }], level: 12 })
}

// ── H5: render time in this WebView ──
async function showRender(): Promise<void> {
  body.append(para('<b>H5 render.</b> Times every gallery sample on this phone (render, then PNG encode). Takes a few seconds; keep the page open.'))
  const out = document.createElement('pre')
  out.style.cssText = 'white-space:pre-wrap;font:12px monospace;color:#bff5bf'
  body.append(small('Run again', () => void runRender(out)), out)
  await showProbePage('H5: timing renders\non the phone')
  await runRender(out)
}

async function runRender(out: HTMLElement): Promise<void> {
  const RUNS = 9
  const rows: Array<{ id: string; render: number; encode: number }> = []
  for (const [i, s] of SAMPLES.entries()) {
    const size = s.size ?? s.component.size
    s.component.renderToTile(s.props, size) // warm-up
    const times: number[] = []
    let fb = s.component.renderToTile(s.props, size)
    for (let k = 0; k < RUNS; k++) {
      const t0 = now()
      fb = s.component.renderToTile(s.props, size)
      times.push(now() - t0)
    }
    const enc: number[] = []
    for (let k = 0; k < 3; k++) {
      const t0 = now()
      encodePng(fb)
      enc.push(now() - t0)
    }
    rows.push({ id: s.id, render: median(times), encode: median(enc) })
    out.textContent = `sample ${i + 1} / ${SAMPLES.length}…`
    await sleep(0)
  }
  rows.sort((a, b) => b.render - a.render)
  const renders = rows.map((r) => r.render)
  const encodes = rows.map((r) => r.encode)
  const p90 = [...renders].sort((a, b) => a - b)[Math.floor(renders.length * 0.9)]
  const total = rows.map((r) => r.render + r.encode)
  const over10 = rows.filter((r) => r.render + r.encode > 10).length
  results.H5 = [
    `${rows.length} samples, ${RUNS} runs each: render median ${ms(median(renders))}, p90 ${ms(p90)}, worst ${rows[0].id} ${ms(rows[0].render)}`,
    `PNG encode median ${ms(median(encodes))}, worst ${ms(Math.max(...encodes))}; render + encode median ${ms(median(total))}; ${over10} samples over 10 ms`,
    `slowest: ${rows.slice(0, 5).map((r) => `${r.id} ${ms(r.render)} + ${ms(r.encode)}`).join(', ')}`,
  ]
  out.textContent = results.H5.join('\n')
  console.log(`[hub-probe] H5\n${out.textContent}`)
  renderSummary()
  g2.draw('probe', BigText, { text: `H5 done\nmedian ${ms(median(total))}/tile`, fonts: [{ font: 'body' }], level: 12 })
}

// ── H3: swipe throughput ──
const swipe = { next: 0, prev: 0, times: [] as number[], draw: true, sent0: 0, coalesced0: 0, runs: 0 }
let swipeStatus: HTMLElement | null = null
let didInput: HTMLInputElement | null = null

async function showSwipes(): Promise<void> {
  body.append(
    para(
      '<b>H3 swipes.</b> Swipe in one direction exactly the number below, as fast as you can, counting them. Then "Save run". ' +
        'Do at least: fast with drawing on, fast with drawing off, and slow (~1 per second) with drawing on.',
    ),
  )
  didInput = document.createElement('input')
  didInput.type = 'number'
  didInput.value = '20'
  didInput.style.cssText = 'width:60px;margin-right:8px;background:#121a12;color:#bff5bf;border:1px solid #2c3a2c;padding:6px'
  const drawBtn = small('', () => {
    swipe.draw = !swipe.draw
    drawBtn.textContent = `Drawing: ${swipe.draw ? 'on' : 'off'}`
    resetSwipes()
  })
  drawBtn.textContent = `Drawing: ${swipe.draw ? 'on' : 'off'}`
  const label = document.createElement('label')
  label.append('Swipes I did: ', didInput)
  swipeStatus = document.createElement('pre')
  swipeStatus.style.cssText = 'font:13px monospace;color:#6dff6d'
  const row = document.createElement('div')
  row.append(label, drawBtn, small('Save run', saveSwipes), small('Reset', resetSwipes))
  body.append(row, swipeStatus)
  await showProbePage('H3: swipe forward\nN times, fast')
  resetSwipes()
}

function resetSwipes(): void {
  Object.assign(swipe, { next: 0, prev: 0, times: [], sent0: g2.queue.stats.sent, coalesced0: g2.queue.stats.coalesced })
  updateSwipes()
}

function swipeGaps(): number[] {
  return swipe.times.slice(1).map((t, i) => t - swipe.times[i])
}

function updateSwipes(): void {
  if (!swipeStatus) return
  const gaps = swipeGaps()
  swipeStatus.textContent =
    `next ${swipe.next} · prev ${swipe.prev}\n` +
    `tile sends ${g2.queue.stats.sent - swipe.sent0} · coalesced ${g2.queue.stats.coalesced - swipe.coalesced0}\n` +
    `gap between events: min ${ms(Math.min(...gaps))}, median ${ms(median(gaps))}`
}

function onSwipe(type: 'next' | 'prev'): void {
  swipe[type]++
  swipe.times.push(now())
  if (swipe.draw) g2.draw('probe', BigText, { text: `next ${swipe.next}\nprev ${swipe.prev}`, level: 15 })
  updateSwipes()
}

function saveSwipes(): void {
  const gaps = swipeGaps()
  const did = Number(didInput?.value ?? 0)
  record(
    'H3',
    `run ${++swipe.runs} (drawing ${swipe.draw ? 'on' : 'off'}): swiped ${did}, got next ${swipe.next} prev ${swipe.prev}, ` +
      `sends ${g2.queue.stats.sent - swipe.sent0}, coalesced ${g2.queue.stats.coalesced - swipe.coalesced0}, ` +
      `event gap min ${ms(Math.min(...gaps))} median ${ms(median(gaps))}`,
  )
  resetSwipes()
  if (swipe.draw) g2.draw('probe', BigText, { text: 'saved\nswipe again', fonts: [{ font: 'body' }], level: 12 })
}

// ── H4: long press ──
const HOLD_MS = 1500
/** Image: a ring on the 288×144 tile. Text: a TextHold bar in a text box (text updates are ~4× faster). */
let holdStyle: 'image' | 'text' = new URLSearchParams(location.search).get('hold') === 'text' ? 'text' : 'image'
const holdPage = layouts.textBoxes({ boxes: [{ name: 'hold', h: 36 }, { name: 'hint', h: 36 }] })
let holdStart = 0
let holdSent0 = 0
let holdText0 = 0
let holdFrames = 0
let holds = 0
let releases = 0
let textUpdates = 0
if (g2.host.updateText) {
  const update = g2.host.updateText.bind(g2.host)
  g2.host.updateText = (t, c) => {
    textUpdates++
    return update(t, c)
  }
}
const sentWhileHeld = () =>
  holdStyle === 'text' ? `text updates sent ${textUpdates - holdText0}` : `tiles sent ${g2.queue.stats.sent - holdSent0}`

function drawHold(progress: number, done = false): void {
  if (holdStyle === 'image') g2.draw('probe', HoldRing, { progress, label: done ? 'confirmed!' : progress > 0 ? 'keep holding' : 'hold to fill' })
  else g2.textArea(holdPage.boxes.hold).draw('h', TextHold, { progress, label: 'Hold to confirm', done })
}

const ring = new HoldToConfirm({
  durationMs: HOLD_MS,
  tickMs: 50,
  onProgress: (p) => {
    if (mode !== 'hold') return
    if (p > 0) holdFrames++
    drawHold(p)
  },
  onConfirm: () => {
    record('H4', `${holdStyle} hold ${holds}: confirmed after ${ms(now() - holdStart)}; updates asked ${holdFrames}, ${sentWhileHeld()}`)
    drawHold(1, true)
  },
  onCancel: () => record('H4', `${holdStyle} hold ${holds}: released early after ${ms(now() - holdStart)}; ${sentWhileHeld()}`),
})

async function showHold(): Promise<void> {
  const what = holdStyle === 'text' ? 'text bar' : 'ring'
  const toggle = small(`Style: ${holdStyle} (switch)`, () => {
    holdStyle = holdStyle === 'text' ? 'image' : 'text'
    void open('hold')
  })
  body.append(
    para(
      `<b>H4 hold.</b> Touch and hold the touchpad until the ${what} is full (${HOLD_MS / 1000} s after the hold arrives), then let go. ` +
        'Do it 5 times, then once letting go early. Then answer below; switch style and repeat.',
    ),
    toggle,
    question('H4', `${holdStyle}: started filling after I touched`, ['instantly', '~0.5 s', '~1 s', '> 1 s']),
    question('H4', `${holdStyle}: it filled`, ['smoothly', 'in steps, fine', 'too jumpy', 'did not move']),
    question('H4', `${holdStyle}: letting go stopped it`, ['always', 'sometimes late', 'not always']),
  )
  if (holdStyle === 'image') {
    await g2.show(probePage)
  } else {
    await g2.show(holdPage)
    g2.textArea(holdPage.boxes.hint).set('t', 'Text bar: hold until full, then let go')
  }
  drawHold(0)
}

function onHoldEvent(type: string): void {
  if (type === 'hold') {
    holds++
    holdStart = now()
    holdSent0 = g2.queue.stats.sent
    holdText0 = textUpdates
    holdFrames = 0
  } else if (type === 'release') {
    releases++
    record('H4', `release ${releases} (of ${holds} holds) arrived ${ms(now() - holdStart)} after the hold event`)
  }
}

// ── gestures ──
g2.on('*', (e) => {
  if (mode === 'swipes' && (e.type === 'next' || e.type === 'prev')) onSwipe(e.type)
  else if (mode === 'hold') {
    onHoldEvent(e.type)
    ring.handleEvent(e)
  }
})

renderSummary()
const first = new URLSearchParams(location.search).get('probe') as Mode | null
await open(first && PROBES.some((p) => p[0] === first) ? first : 'render')
