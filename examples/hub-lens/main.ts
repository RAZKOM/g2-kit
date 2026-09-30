/**
 * hub-lens: diagnoses "after a page rebuild, images show only in one lens".
 * Tap on the glasses (or "Next step" on the phone) walks through steps that
 * vary how pages are changed and how images are sent. For each step, record on
 * the phone which lens shows it; "Copy results" gives a summary to paste back.
 */
import { Framebuffer, defineComponent, drawText, font16x24, font8x12, strokeRect, type Rect } from 'g2-kit/core'
import { PageBuilder, layouts, type Page } from 'g2-kit/bridge'
import { blankTextSkeleton } from 'g2-kit/input'
import { start } from '../shared/phone'
import { shareResults } from '../shared/results'

const { g2, mirror } = await start({ doubleTapExits: true })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Tile content: big step id, quarter number, border. Different per step so a stale lens is obvious. */
const Card = defineComponent<{ step: string; quarter: number; note: string }>('LensCard', { w: 288, h: 144 }, (fb: Framebuffer, r: Rect, p) => {
  strokeRect(fb, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 15, 2)
  drawText(fb, p.step, r.x + r.w / 2, r.y + 18, { font: font16x24, scale: 2, level: 15, align: 'center' })
  drawText(fb, `quarter ${p.quarter + 1}`, r.x + r.w / 2, r.y + 76, { font: font8x12, level: 8, align: 'center' })
  drawText(fb, p.note, r.x + r.w / 2, r.y + 100, { font: font8x12, level: 8, align: 'center' })
})

const full = layouts.fullScreen()
const withText = new PageBuilder()
  .text({ ...blankTextSkeleton({ x: 0, y: 144, w: 576, h: 144 }, { id: 10 }), content: 'S7: FIRMWARE TEXT (bottom half)\nDo you see this line in BOTH lenses?', padding: 12 })
  .image({ id: 1, name: 'a', x: 0, y: 0, w: 288, h: 144 })
  .image({ id: 2, name: 'b', x: 288, y: 0, w: 288, h: 144 })
  .build()

const textOnly = new PageBuilder()
  .text({ ...blankTextSkeleton({ x: 0, y: 0, w: 576, h: 288 }, { id: 10 }), content: 'S9: clearing (text-only page)…', padding: 12 })
  .build()
const three = new PageBuilder()
  .text(blankTextSkeleton({ x: 0, y: 0, w: 576, h: 288 }, { id: 10 }))
  .image({ id: 1, name: 't0', x: 0, y: 0, w: 288, h: 144 })
  .image({ id: 2, name: 't1', x: 288, y: 0, w: 288, h: 144 })
  .image({ id: 3, name: 't2', x: 0, y: 144, w: 288, h: 144 })
  .build()

/** Queue one frame per tile of `page` directly (bypasses the Surface so each step controls timing). */
async function sendAll(page: Page, step: string, note: string, gapMs = 0): Promise<void> {
  for (const [i, t] of page.tileList.entries()) {
    const fb = Card.renderToTile({ step, quarter: i, note }, { w: t.rect.w, h: t.rect.h })
    g2.queue.image({ containerID: t.id, containerName: t.name }, () => fb)
    if (gapMs) {
      await g2.queue.idle()
      await sleep(gapMs)
    }
  }
  await g2.queue.idle()
}

/** Always really rebuild (G2.show would otherwise skip identical layouts) and log what the host did. */
async function rebuild(page: Page): Promise<void> {
  const how = await g2.show(page, { rebuild: 'always' })
  mirror.log(`page ${how}`)
}

type Step = { id: string; what: string; run: () => Promise<void> }
const STEPS: Step[] = [
  { id: 'S1', what: 'startup page (create), 4 tiles sent immediately', run: async () => { await rebuild(full); await sendAll(full, 'S1', 'create') } },
  { id: 'S2', what: 'no rebuild: new pixels into the same 4 tiles', run: () => sendAll(full, 'S2', 'update only') },
  { id: 'S3', what: 'rebuild (same layout), tiles sent immediately', run: async () => { await rebuild(full); await sendAll(full, 'S3', 'rebuild') } },
  { id: 'S4', what: 'no rebuild: re-send all 4 tiles after S3', run: () => sendAll(full, 'S4', 'resend') },
  { id: 'S5', what: 'rebuild, wait 1.5 s, then send', run: async () => { await rebuild(full); await sleep(1500); await sendAll(full, 'S5', 'rebuild+1.5s') } },
  { id: 'S6', what: 'rebuild, tiles sent 500 ms apart', run: async () => { await rebuild(full); await sendAll(full, 'S6', 'slow sends', 500) } },
  { id: 'S7', what: 'rebuild to 2 tiles + visible firmware text', run: async () => { await rebuild(withText); await sendAll(withText, 'S7', 'text page') } },
  { id: 'S8', what: 'rebuild back to 4 tiles, wait 3 s, send', run: async () => { await rebuild(full); await sleep(3000); await sendAll(full, 'S8', 'rebuild+3s') } },
  {
    id: 'S9',
    what: 'rebuild to a text-only page first, then to 4 tiles',
    run: async () => {
      await rebuild(textOnly)
      await sleep(800)
      await rebuild(full)
      await sendAll(full, 'S9', 'via text page')
    },
  },
  { id: 'S10', what: 'rebuild to 3 full-size tiles', run: async () => { await rebuild(three); await sendAll(three, 'S10', '3 tiles') } },
]

// ── phone-side step list with result buttons ──
const results: Record<string, string> = {}
const panel = document.createElement('div')
panel.innerHTML = `<h2 style="font-size:15px;margin:16px 0 6px">Steps</h2><p>Tap on the glasses (or the button) to run the next step. Close each eye in turn, then record what you see.</p>`
const list = document.createElement('ol')
list.style.cssText = 'padding-left:20px;max-width:576px'
panel.append(list)
const controls = document.createElement('div')
controls.className = 'pad'
const nextBtn = document.createElement('button')
nextBtn.textContent = 'Next step ▶'
const copyBtn = document.createElement('button')
copyBtn.textContent = 'Copy results'
controls.append(nextBtn, copyBtn)
panel.append(controls)
const out = document.createElement('pre')
out.style.cssText = 'white-space:pre-wrap;font:12px monospace;color:#bff5bf'
panel.append(out)
document.getElementById('stats')?.after(panel)

function renderList(current: number): void {
  list.innerHTML = ''
  STEPS.forEach((s, i) => {
    const li = document.createElement('li')
    li.style.margin = '6px 0'
    li.innerHTML = `<b style="color:${i === current ? '#6dff6d' : '#cfe8cf'}">${s.id}</b> ${s.what} <span style="color:#86a086">${results[s.id] ? `→ ${results[s.id]}` : ''}</span><br>`
    for (const r of ['both', 'left only', 'right only', 'none']) {
      const b = document.createElement('button')
      b.textContent = r
      b.style.cssText = 'margin:4px 4px 0 0;padding:4px 8px;background:#121a12;color:#bff5bf;border:1px solid #2c3a2c;border-radius:4px'
      b.onclick = () => {
        results[s.id] = r
        renderList(current)
        summary()
      }
      li.append(b)
    }
    list.append(li)
  })
}
function summary(): void {
  out.textContent = STEPS.map((s) => `${s.id} ${s.what}: ${results[s.id] ?? '?'}`).join('\n')
}

let current = -1
let running = false
async function next(): Promise<void> {
  if (running || current >= STEPS.length - 1) return
  running = true
  current++
  renderList(current)
  const s = STEPS[current]
  mirror.log(`${s.id}: ${s.what}`)
  try {
    await s.run()
    mirror.log(`${s.id} sent`)
  } catch (e) {
    mirror.log(`${s.id} failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  running = false
}
nextBtn.onclick = () => void next()
copyBtn.onclick = () => {
  summary()
  void shareResults('hub-lens', out.textContent ?? '', copyBtn)
}
g2.on('tap', () => void next())

summary()
await next()
