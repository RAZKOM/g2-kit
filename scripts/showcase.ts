/**
 * One poster image with every component, in a ~16:9 grid, for sharing.
 * Small components share a tile; each tile is captioned with the component
 * names it shows.
 *
 *   npm run showcase                         → examples/output/showcase.png
 *   tsx scripts/showcase.ts docs/img/showcase.png   (run by npm run docs:images)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { Framebuffer, SIMULATOR_CURVE, drawText, encodePreviewPng, font16x24, font5x7, font8x12, strokeRect, textWidth, wrapText, type Rect } from '../src/core/index.js'
import { SAMPLES } from '../examples/gallery/samples.js'
import * as C from '../src/charts/index.js'
import * as W from '../src/widgets/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const TW = 288
const TH = 144
const COLS = 6
const ROWS = 6
const GAP = 14
const CAP = 22 // caption strip under each tile (one body line, or two small lines)
const MARGIN = 20

type Part = { id?: string; draw?: (fb: Framebuffer, r: Rect) => void; rect: Rect }
type Cell = { parts: Part[]; caption: string; span?: number }

const sample = (id: string) => {
  const s = SAMPLES.find((x) => x.id === id)
  if (!s) throw new Error(`no sample ${id}`)
  return s
}
const full = (id: string): Cell => ({ parts: [{ id, rect: { x: 0, y: 0, w: TW, h: TH } }], caption: sample(id).component.name })
const stack = (caption: string, parts: Part[]): Cell => ({ parts, caption })
const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })

const cells: Cell[] = [
  { parts: [], caption: '', span: 2 }, // title banner
  full('bar-vertical'),
  full('line-two-series'),
  full('kpi'),
  full('gauge'),
  full('bars-stacked'),
  full('donut'),
  full('rings'),
  full('heatmap'),
  full('calendar-heatmap'),
  full('funnel'),
  full('waffle'),
  full('scatter'),
  full('histogram'),
  full('boxplot'),
  full('candles'),
  stack('Timeline · BulletChart', [{ id: 'timeline', rect: R(0, 0, TW, 98) }, { id: 'bullet', rect: R(0, 104, TW, 38) }]),
  full('legend-marks'),
  stack('Carousel · SegmentedControl · Tabs', [{ id: 'carousel-letters', rect: R(0, 0, TW, 64) }, { id: 'segmented', rect: R(0, 72, TW, 38) }, { id: 'tabs', rect: R(0, 118, TW, 26) }]),
  stack('ButtonRow · Slider · Toggle', [{ id: 'button-states', rect: R(0, 0, TW, 44) }, { id: 'slider-editing', rect: R(0, 46, TW, 58) }, { id: 'toggle-on', rect: R(0, 106, 150, 38) }, { id: 'toggle-off', rect: R(144, 106, 144, 38) }]),
  stack('TimePicker · DatePicker', [{ id: 'time-picker', rect: R(0, 0, TW, 70) }, { id: 'date-picker', rect: R(0, 74, TW, 70) }]),
  full('roller-pin'),
  full('keyboard-key'),
  full('grid-keyboard'),
  full('status-keyboard'),
  full('checklist'),
  full('modal'),
  stack('Toast · ProgressBar · StatusBar · Ticker', [{ id: 'toast-warning', rect: R(0, 0, TW, 46) }, { id: 'progress', rect: R(0, 52, TW, 42) }, { id: 'status-bar', rect: R(0, 98, TW, 20) }, { id: 'ticker', rect: R(0, 120, TW, 24) }]),
  stack('HudFrame · BigText', [
    { id: 'hud-brackets', rect: R(0, 0, TW, TH) },
    { draw: (fb, r) => W.BigText.render(fb, W.hudContentRect(r, { title: 'Target' }), { text: 'Left in 200 m' }), rect: R(0, 0, TW, TH) },
  ]),
  full('table'),
  stack('AnalogClock · TimerRing', [{ id: 'clock', rect: R(0, 0, 144, 144) }, { id: 'timer-ring', rect: R(144, 0, 144, 144) }]),
  stack('TurnArrow · CompassStrip', [{ id: 'turn-right', rect: R(0, 0, TW, 92) }, { id: 'compass', rect: R(0, 94, TW, 50) }]),
  stack('WeatherGlyph · ScoreHud · HealthBar', [{ id: 'weather', rect: R(0, 0, TW, 96) }, { id: 'score-hud', rect: R(0, 100, TW, 24) }, { id: 'health', rect: R(0, 126, 200, 18) }]),
  stack('GridBoard · Card · Rating', [{ id: 'board-wordle', rect: R(0, 0, 144, 144) }, { id: 'card', rect: R(150, 4, 138, 96) }, { id: 'rating', rect: R(144, 108, 144, 32) }]),
  stack('Dice · Button · Spinner · Badge · Sparkline · PaginationDots · ScrollIndicator', [
    { id: 'dice', rect: R(0, 0, 270, 60) },
    { id: 'button', rect: R(0, 66, 120, 36) },
    { id: 'spinner', rect: R(126, 68, 144, 32) },
    { id: 'badges', rect: R(0, 110, 70, 16) },
    { id: 'sparkline', rect: R(80, 106, 110, 26) },
    { id: 'dots', rect: R(190, 112, 80, 16) },
    { draw: (fb, r) => W.ScrollIndicator.render(fb, r, { total: 40, visible: 8, offset: 12 }), rect: R(278, 0, 6, 140) },
  ]),
]

// Every component must appear.
const shown = new Set<string>()
for (const c of cells) for (const p of c.parts) if (p.id) shown.add(sample(p.id).component.name)
shown.add('ScrollIndicator')
shown.add('BigText')
const all = new Set<string>()
for (const m of [C, W] as Array<Record<string, unknown>>)
  for (const v of Object.values(m)) if (v && typeof v === 'object' && 'renderToTile' in v) all.add((v as unknown as { name: string }).name)
const missing = [...all].filter((n) => !shown.has(n))
if (missing.length) throw new Error(`showcase is missing: ${missing.join(', ')}`)
const slots = cells.reduce((n, c) => n + (c.span ?? 1), 0)
if (slots !== COLS * ROWS) throw new Error(`${slots} slots for a ${COLS}×${ROWS} grid`)

const width = MARGIN * 2 + COLS * TW + (COLS - 1) * GAP
const height = MARGIN * 2 + ROWS * (TH + CAP) + (ROWS - 1) * GAP
const fb = new Framebuffer(width, height)
let slot = 0
for (const cell of cells) {
  const col = slot % COLS
  const row = Math.floor(slot / COLS)
  const span = cell.span ?? 1
  const x = MARGIN + col * (TW + GAP)
  const y = MARGIN + row * (TH + CAP + GAP)
  if (cell.parts.length === 0) {
    // Title banner.
    drawText(fb, 'g2-kit', x + 8, y + 8, { font: font16x24, scale: 2, level: 15 })
    drawText(fb, `${all.size} drawn UI components for Even Realities G2 plugins`, x + 10, y + 70, { font: font8x12, level: 8 })
    drawText(fb, 'charts, controls, HUD chrome and game pieces, rendered on the phone', x + 10, y + 88, { font: font8x12, level: 6 })
    drawText(fb, 'as 4-bit image tiles over one invisible input layer', x + 10, y + 104, { font: font8x12, level: 6 })
    drawText(fb, 'npm i g2-kit   ·   razkom.github.io/g2-kit', x + 10, y + 128, { font: font8x12, level: 15 })
  } else {
    const tile = new Framebuffer(TW, TH)
    for (const p of cell.parts) {
      if (p.draw) p.draw(tile, p.rect)
      else {
        const s = sample(p.id!)
        s.component.render(tile, p.rect, s.props)
      }
    }
    fb.blit(tile, x, y)
    strokeRect(fb, x - 1, y - 1, TW + 2, TH + 2, 2, 1)
    // Caption: body font if it fits the tile width, else the small font wrapped onto two lines.
    if (textWidth(cell.caption, font8x12) <= TW) drawText(fb, cell.caption, x, y + TH + 6, { font: font8x12, level: 5 })
    else wrapText(cell.caption, TW, font5x7).slice(0, 2).forEach((line, i) => drawText(fb, line, x, y + TH + 4 + i * 9, { font: font5x7, level: 5 }))
  }
  slot += span
}

// Output: argv[2] (relative to the package root), default examples/output/showcase.png.
const file = join(root, process.argv[2] ?? join('examples', 'output', 'showcase.png'))
mkdirSync(dirname(file), { recursive: true })
writeFileSync(file, encodePreviewPng(fb, { scale: 2, curve: SIMULATOR_CURVE, deflate: (d) => deflateSync(d, { level: 9 }) }))
console.log(`showcase: ${all.size} components in ${cells.length} tiles, ${width * 2}×${height * 2} px (${((width * 2) / (height * 2)).toFixed(2)}:1) → ${file}`)
