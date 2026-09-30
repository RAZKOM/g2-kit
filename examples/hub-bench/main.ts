/**
 * hub-bench: how fast can images go to the glasses, and what makes a send
 * slower? (ROADMAP H1, H1b, H6)
 *
 * Each run sends N numbered frames to one tile through an ImageQueue and times
 * every `updateImageRawData` from call to result. A sweep varies one factor per
 * run while the others stay at the base setting (gap 25 ms, 288×144, PNG,
 * simple content):
 *   gap      150 / 100 / 75 / 50 / 25 / 0 ms between sends
 *   size     288×144, 288×72, 144×144, 144×72, 72×72
 *   format   png (8-bit), png4, gray8 (raw), gray4 (raw, packed)
 *   content  blank, simple counter, dense pattern, bar chart filled vs outline surface
 * When a run ends, the tile should read N/N and look right: record that on the
 * phone ("no" if it is stuck, garbled or missing), then "Copy results".
 * Tap on the glasses (or "Run next") runs the next case; double-tap exits.
 *
 * Page: a firmware text container (what to check, no image cost) above one
 * tile of the case's size. Text is only updated between runs, never while the
 * bench queue is sending.
 */
import { encodeTile, type Framebuffer, type TileFormat } from 'g2-kit/core'
import { ImageQueue, PageBuilder, type ImageTarget, type Page } from 'g2-kit/bridge'
import { start } from '../shared/phone'
import { shareResults } from '../shared/results'
import { BenchFrame, type Content } from './frame'

const { g2, mirror, mock } = await start()

type Sweep = 'gap' | 'size' | 'format' | 'content'
interface Case {
  gap: number
  w: number
  h: number
  format: TileFormat
  content: Content
}

const BASE: Case = { gap: 25, w: 288, h: 144, format: 'png', content: 'simple' }
const SWEEPS: Record<Sweep, (gaps: number[]) => Case[]> = {
  gap: (gaps) => gaps.map((gap) => ({ ...BASE, gap })),
  size: () => [[288, 144], [288, 72], [144, 144], [144, 72], [72, 72]].map(([w, h]) => ({ ...BASE, w, h })),
  format: () => (['png', 'png4', 'gray8', 'gray4'] as const).map((format) => ({ ...BASE, format })),
  content: () => (['blank', 'simple', 'busy', 'chart', 'chart-outline'] as const).map((content) => ({ ...BASE, content })),
}
const label = (c: Case, sweep: Sweep) =>
  sweep === 'gap' ? `gap ${c.gap} ms` : sweep === 'size' ? `${c.w}×${c.h}` : sweep === 'format' ? c.format : c.content

interface Run extends Case {
  name: string
  frames: number
  ms: number
  /** updateImageRawData round trips (ms), including a retry's. */
  rts: number[]
  /** Render + encode per frame (ms). */
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
const sweepSelect = $<HTMLSelectElement>('sweep')
const q = new URLSearchParams(location.search)
if (q.get('frames')) framesInput.value = q.get('frames')!
if (q.get('gaps')) gapsInput.value = q.get('gaps')!
if (q.get('sweep') && q.get('sweep')! in SWEEPS) sweepSelect.value = q.get('sweep')!

const frames = () => Math.max(5, Math.min(200, Math.round(Number(framesInput.value) || 30)))
const gaps = () => gapsInput.value.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0)
const sweep = () => sweepSelect.value as Sweep
const cases = () => SWEEPS[sweep()](gaps())
$('gapsLabel').style.display = sweep() === 'gap' ? '' : 'none'

const runs: Run[] = []
let running = false

// ── stats ──
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b)
const pick = (xs: number[], f: number) => (xs.length ? sorted(xs)[Math.min(xs.length - 1, Math.floor(xs.length * f))] : NaN)
const median = (xs: number[]) => pick(xs, 0.5)
const ms = (n: number) => (Number.isFinite(n) ? n.toFixed(0) : '-')
const fps = (r: Run) => r.frames / (r.ms / 1000)

// ── glasses ──
const TEXT = { id: 10, name: 'text' }
const pages = new Map<string, Page<'tile'>>()
/** Firmware text (capture) above one tile of w×h, centred at the bottom. */
function pageFor(w: number, h: number): Page<'tile'> {
  const key = `${w}x${h}`
  let p = pages.get(key)
  if (!p) {
    p = new PageBuilder()
      .text({ ...TEXT, x: 0, y: 0, w: 576, h: 288 - h, content: ' ', capture: true, border: { width: 0 }, padding: 8 })
      .image({ id: 1, name: 'tile', x: Math.round((576 - w) / 2), y: 288 - h, w, h })
      .build<'tile'>()
    pages.set(key, p)
  }
  return p
}
const targetOf = (p: Page<'tile'>): ImageTarget => ({ containerID: p.tiles.tile.id, containerName: p.tiles.tile.name })

function intro(): string {
  const c = cases()
  return `hub-bench: ${sweep()} sweep, ${frames()} frames per run (${c.map((x) => label(x, sweep())).join(', ')})
tap: run ${label(c[runs.length] ?? c[0], sweep())}   double-tap: exit`
}

function say(text: string): Promise<boolean> {
  return g2.setText(TEXT, text)
}

async function runCase(c: Case): Promise<Run> {
  const n = frames()
  const name = label(c, sweep())
  const run: Run = { ...c, name, frames: n, ms: 0, rts: [], encode: [], bytes: 0, failed: 0, retried: 0 }
  const page = pageFor(c.w, c.h)
  await g2.show(page) // rebuilds only when the tile size changes
  await say(`${name}: sending ${n} frames...`)
  await g2.settle()
  const target = targetOf(page)
  let last: Framebuffer | null = null
  // A fresh queue per run: same pacing and retry code as G2's, with this case's gap and format.
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
      gapMs: c.gap,
      onSent: (t) => mirror.frame(t, last),
      onError: (err) => mirror.log(`${name}: ${err.message}`),
    },
  )
  const t0 = performance.now()
  for (let i = 1; i <= n; i++) {
    queue.image(target, () => {
      const e0 = performance.now()
      last = BenchFrame.renderToTile({ i, n, name, content: c.content }, { w: c.w, h: c.h })
      const bytes = encodeTile(last, c.format)
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
  if (runs.length >= cases().length) reset()
  running = true
  try {
    const run = await runCase(cases()[runs.length])
    runs.push(run)
    const line = `${run.name}: ${fps(run).toFixed(1)} frames/s, send ${ms(median(run.rts))} ms (max ${ms(pick(run.rts, 1))})`
    mirror.log(line)
    console.log(`[hub-bench] ${line}, interval ${ms(run.ms / run.frames)} ms, failed ${run.failed}, retried ${run.retried}, ${run.bytes} bytes`)
    render()
    const next = cases()[runs.length]
    await say(`${line}${run.failed ? `, ${run.failed} failed` : ''}
Does the tile show ${run.frames}/${run.frames} and look right? Record it on the phone.
${next === undefined ? 'Sweep done: save the results on the phone. tap: start over' : `tap: run ${label(next, sweep())}`}`)
  } catch (e) {
    mirror.log(`run failed: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    running = false
  }
}

async function runAll(): Promise<void> {
  if (runs.length >= cases().length) reset()
  while (runs.length < cases().length) {
    await runNext()
    // A moment to look at the last frame before the next run starts.
    if (runs.length < cases().length) await new Promise((r) => setTimeout(r, 2000))
  }
}

function reset(): void {
  runs.length = 0
  $('gapsLabel').style.display = sweep() === 'gap' ? '' : 'none'
  render()
  if (!running) void say(intro())
}

// ── phone results ──
function render(): void {
  const body = $('rows')
  body.innerHTML = ''
  runs.forEach((r) => {
    const tr = document.createElement('tr')
    const cells = [r.name, r.frames, fps(r).toFixed(1), ms(r.ms / r.frames), ms(median(r.rts)), ms(pick(r.rts, 0.95)), ms(pick(r.rts, 1)), `${r.failed}${r.retried ? ` (+${r.retried} retried)` : ''}`, median(r.encode).toFixed(1), r.bytes]
    for (const c of cells) {
      const td = document.createElement('td')
      td.textContent = String(c)
      tr.append(td)
    }
    const td = document.createElement('td')
    td.style.textAlign = 'left'
    for (const [value, text] of [['yes', `yes, ${r.frames}/${r.frames}`], ['no', 'no / stuck / garbled']] as const) {
      const b = document.createElement('button')
      b.textContent = text
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
  const base = `base: gap ${BASE.gap} ms, ${BASE.w}×${BASE.h}, ${BASE.format}, ${BASE.content}`
  const head = `hub-bench ${new Date().toISOString().slice(0, 16)} · ${mock ? 'mock host (browser)' : 'glasses'} · ${sweep()} sweep · ${runs[0].frames} frames per run · ${base}`
  const lines = runs.map(
    (r) =>
      `${r.name.padEnd(14)}: ${fps(r).toFixed(1).padStart(5)} frames/s, interval ${ms(r.ms / r.frames)} ms, send median ${ms(median(r.rts))} / p95 ${ms(pick(r.rts, 0.95))} / max ${ms(pick(r.rts, 1))} ms, failed ${r.failed}, retried ${r.retried}, encode ${median(r.encode).toFixed(1)} ms, ${r.bytes} bytes; tile shows N/N: ${r.seen ?? '?'}`,
  )
  return [head, ...lines].join('\n')
}

$('next').onclick = () => void runNext()
$('all').onclick = () => void runAll()
$('reset').onclick = () => reset()
$<HTMLButtonElement>('copy').onclick = () => void shareResults(`hub-bench-${sweep()}`, summary(), $<HTMLButtonElement>('copy'))
for (const el of [framesInput, gapsInput, sweepSelect]) el.addEventListener('change', () => reset())

g2.on('tap', () => void runNext())

const first = cases()[0]
const firstPage = pageFor(first.w, first.h)
await g2.show(firstPage)
await say(intro())
g2.queue.image(targetOf(firstPage), () => BenchFrame.renderToTile({ i: 0, n: frames(), name: label(first, sweep()), content: first.content }, { w: first.w, h: first.h }))
mirror.log('ready: pick a sweep, then tap on the glasses or "Run next"')
