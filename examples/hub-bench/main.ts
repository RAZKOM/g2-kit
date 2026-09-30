/**
 * hub-bench: how fast can images go to the glasses? (ROADMAP H1)
 *
 * For each gap in the sweep, N numbered frames go to one 288×144 tile through
 * an ImageQueue with that `gapMs`, and every `updateImageRawData` round trip
 * is timed. The phone page shows frames/s and round-trip stats per gap. When a
 * run ends, the tile should read N/N: if it shows an earlier number (or stops
 * updating), frames got stuck at that gap. Record it per run, then "Copy
 * results". Tap on the glasses (or "Run next") runs the next gap; double-tap
 * exits.
 *
 * Page: layouts.textWithTile, so the firmware text above the tile says what to
 * check, at no image cost. Text is only updated between runs, never while the
 * bench queue is sending.
 */
import { defineComponent, drawText, encodeTile, fillRectPaint, font16x24, font8x12, strokeRect, type Framebuffer } from 'g2-kit/core'
import { ImageQueue, layouts, type ImageTarget } from 'g2-kit/bridge'
import { start } from '../shared/phone'
import { shareResults } from '../shared/results'

const { g2, mirror, mock } = await start()

type Content = 'simple' | 'busy'

/** One frame: big counter, the gap, a progress bar. 'busy' adds a dense pattern (compresses worse in transit). */
const BenchFrame = defineComponent<{ i: number; n: number; gap: number; content: Content }>('BenchFrame', { w: 288, h: 144 }, (fb, r, p) => {
  if (p.content === 'busy') fillRectPaint(fb, r.x, r.y, r.w, r.h, { pattern: 'crossHatch', level: 4 })
  fb.fillRect(r.x + 24, r.y + 12, r.w - 48, 82, 0)
  strokeRect(fb, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 15, 2)
  drawText(fb, `${p.i}/${p.n}`, r.x + r.w / 2, r.y + 16, { font: font16x24, scale: 2, level: 15, align: 'center' })
  drawText(fb, `gap ${p.gap} ms`, r.x + r.w / 2, r.y + 72, { font: font8x12, level: 8, align: 'center' })
  const bar = { x: r.x + 10, y: r.y + r.h - 26, w: r.w - 20, h: 14 }
  fb.fillRect(bar.x, bar.y, bar.w, bar.h, 0)
  strokeRect(fb, bar.x, bar.y, bar.w, bar.h, 6, 1)
  fb.fillRect(bar.x + 2, bar.y + 2, Math.round(((bar.w - 4) * p.i) / p.n), bar.h - 4, 15)
})

interface Run {
  gap: number
  frames: number
  content: Content
  ms: number
  /** updateImageRawData round trips (ms), including a retry's. */
  rts: number[]
  /** Render + PNG encode per frame (ms). */
  encode: number[]
  bytes: number
  failed: number
  retried: number
  /** What the user saw on the tile at the end of the run. */
  seen?: 'yes' | 'no'
}

// ── phone controls ──
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const framesInput = $<HTMLInputElement>('frames')
const gapsInput = $<HTMLInputElement>('gaps')
const contentSelect = $<HTMLSelectElement>('content')
const q = new URLSearchParams(location.search)
if (q.get('frames')) framesInput.value = q.get('frames')!
if (q.get('gaps')) gapsInput.value = q.get('gaps')!
if (q.get('content') === 'busy') contentSelect.value = 'busy'

const frames = () => Math.max(5, Math.min(200, Math.round(Number(framesInput.value) || 30)))
const gaps = () => gapsInput.value.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0)
const content = () => contentSelect.value as Content

const runs: Run[] = []
let running = false

// ── stats ──
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b)
const pick = (xs: number[], f: number) => (xs.length ? sorted(xs)[Math.min(xs.length - 1, Math.floor(xs.length * f))] : NaN)
const median = (xs: number[]) => pick(xs, 0.5)
const ms = (n: number) => (Number.isFinite(n) ? n.toFixed(0) : '-')
const fps = (r: Run) => r.frames / (r.ms / 1000)

// ── glasses ──
const page = layouts.textWithTile({ text: intro() })
const tile = page.tiles.tile
const target: ImageTarget = { containerID: tile.id, containerName: tile.name }

function intro(): string {
  return `hub-bench: ${frames()} frames per run, gaps ${gaps().join(', ')} ms
tap: run gap ${gaps()[runs.length] ?? gaps()[0]} ms   double-tap: exit`
}

function say(text: string): Promise<boolean> {
  return g2.setText(page.text, text)
}

async function runGap(gap: number): Promise<Run> {
  const n = frames()
  const run: Run = { gap, frames: n, content: content(), ms: 0, rts: [], encode: [], bytes: 0, failed: 0, retried: 0 }
  await say(`gap ${gap} ms: sending ${n} frames...`)
  await g2.settle()
  let last: Framebuffer | null = null
  // A fresh queue per run: same pacing and retry code as G2's, with this run's gapMs.
  const queue = new ImageQueue(
    async (t, bytes) => {
      const t0 = performance.now()
      try {
        return await g2.host.sendImage(t, bytes)
      } finally {
        run.rts.push(performance.now() - t0)
      }
    },
    {
      gapMs: gap,
      onSent: (t) => mirror.frame(t, last),
      onError: (err) => mirror.log(`gap ${gap}: ${err.message}`),
    },
  )
  const t0 = performance.now()
  for (let i = 1; i <= n; i++) {
    queue.image(target, () => {
      const e0 = performance.now()
      last = BenchFrame.renderToTile({ i, n, gap, content: run.content })
      const bytes = encodeTile(last)
      run.encode.push(performance.now() - e0)
      run.bytes = bytes.length
      return bytes
    })
    await queue.idle()
  }
  run.ms = performance.now() - t0
  run.failed = queue.stats.failed
  run.retried = queue.stats.retried
  return run
}

async function runNext(): Promise<void> {
  if (running) return
  if (runs.length >= gaps().length) reset()
  running = true
  try {
    const gap = gaps()[runs.length]
    const run = await runGap(gap)
    runs.push(run)
    const line = `gap ${gap} ms: ${fps(run).toFixed(1)} frames/s, send ${ms(median(run.rts))} ms (max ${ms(pick(run.rts, 1))})`
    mirror.log(line)
    console.log(`[hub-bench] ${line}, interval ${ms(run.ms / run.frames)} ms, failed ${run.failed}, retried ${run.retried}, ${run.bytes} bytes`)
    render()
    const next = gaps()[runs.length]
    await say(`${line}${run.failed ? `, ${run.failed} failed` : ''}
Does the tile show ${run.frames}/${run.frames}? Record it on the phone.
${next === undefined ? 'All gaps done: copy the results on the phone. tap: start over' : `tap: run gap ${next} ms`}`)
  } catch (e) {
    mirror.log(`run failed: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    running = false
  }
}

async function runAll(): Promise<void> {
  if (runs.length >= gaps().length) reset()
  while (runs.length < gaps().length) {
    await runNext()
    // A moment to look at the last frame before the next run starts.
    if (runs.length < gaps().length) await new Promise((r) => setTimeout(r, 2000))
  }
}

function reset(): void {
  runs.length = 0
  render()
  if (!running) void say(intro())
}

// ── phone results ──
function render(): void {
  const body = $('rows')
  body.innerHTML = ''
  runs.forEach((r) => {
    const tr = document.createElement('tr')
    const cells = [r.gap, r.frames, fps(r).toFixed(1), ms(r.ms / r.frames), ms(median(r.rts)), ms(pick(r.rts, 0.95)), ms(pick(r.rts, 1)), `${r.failed}${r.retried ? ` (+${r.retried} retried)` : ''}`, median(r.encode).toFixed(1), r.bytes]
    for (const c of cells) {
      const td = document.createElement('td')
      td.textContent = String(c)
      tr.append(td)
    }
    const td = document.createElement('td')
    td.style.textAlign = 'left'
    for (const [value, label] of [['yes', `yes, ${r.frames}/${r.frames}`], ['no', 'no / stuck']] as const) {
      const b = document.createElement('button')
      b.textContent = label
      if (r.seen === value) b.className = 'on'
      b.onclick = () => {
        r.seen = value
        render()
      }
      td.append(b)
    }
    tr.append(td)
    body.append(tr)
  })
  $('summary').textContent = summary()
}

function summary(): string {
  if (!runs.length) return ''
  const head = `hub-bench ${new Date().toISOString().slice(0, 16)} · ${mock ? 'mock host (browser)' : 'glasses'} · ${runs[0].frames} frames per run · ${runs[0].content} tiles, ${runs[0].bytes} bytes each`
  const lines = runs.map(
    (r) =>
      `gap ${String(r.gap).padStart(3)} ms: ${fps(r).toFixed(1).padStart(5)} frames/s, interval ${ms(r.ms / r.frames)} ms, send median ${ms(median(r.rts))} / p95 ${ms(pick(r.rts, 0.95))} / max ${ms(pick(r.rts, 1))} ms, failed ${r.failed}, retried ${r.retried}, encode ${median(r.encode).toFixed(1)} ms; tile shows N/N: ${r.seen ?? '?'}`,
  )
  return [head, ...lines].join('\n')
}

$('next').onclick = () => void runNext()
$('all').onclick = () => void runAll()
$('reset').onclick = () => reset()
$<HTMLButtonElement>('copy').onclick = () => void shareResults('hub-bench', summary(), $<HTMLButtonElement>('copy'))
for (const el of [framesInput, gapsInput, contentSelect]) el.addEventListener('change', () => reset())

g2.on('tap', () => void runNext())

await g2.show(page)
g2.queue.image(target, () => BenchFrame.renderToTile({ i: 0, n: frames(), gap: gaps()[0] ?? 0, content: content() }))
mirror.log('ready: tap on the glasses or "Run next"')
