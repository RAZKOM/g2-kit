/**
 * Renders every gallery sample to PNG (green, 2×, with the brightness curve
 * measured in evenhub-simulator) plus an HTML catalogue and a contact sheet.
 *
 *   npm run gallery                 → examples/output/
 *   tsx examples/gallery/render.ts <outDir> --site   (used by build:site)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { Framebuffer, INK_BUDGET, SIMULATOR_CURVE, TILE, drawText, encodePreviewPng, font5x7, inkRatio, outlineTheme, strokeRect } from '../../src/core/index.js'
import { SAMPLES, type Sample } from './samples.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : join(here, '..', 'output'))
const site = process.argv.includes('--site')
mkdirSync(out, { recursive: true })
const deflate = (d: Uint8Array) => deflateSync(d, { level: 9 })
const png = (fb: Framebuffer, scale = 2) => encodePreviewPng(fb, { scale, curve: SIMULATOR_CURVE, deflate })

const GROUPS: Record<Sample['group'], string> = {
  charts: 'Charts',
  controls: 'Input controls',
  'text & chrome': 'Text, feedback & chrome',
  'data faces': 'Glanceable data faces',
  game: 'Game kit',
  legend: 'Legends & encodings',
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const CHARTS = new Set(['Sparkline', 'Kpi', 'Gauge', 'ProgressRings', 'Heatmap', 'CalendarHeatmap', 'Funnel', 'Timeline', 'Legend', 'Histogram', 'BoxPlot'])
const importPath = (name: string) => (name.endsWith('Chart') || CHARTS.has(name) ? 'g2-kit/charts' : 'g2-kit/widgets')
function propsCode(s: Sample): string {
  // A compiled keyboard layout prints as the options it came from.
  const json = JSON.stringify(s.props, (_k, v) => (typeof v === 'function' ? undefined : v && typeof v === 'object' && 'views' in v && 'options' in v ? { keyboardLayout: v.options } : v), 2) ?? '{}'
  return `import { ${s.component.name} } from '${importPath(s.component.name)}'\n\ng2.draw('left', ${s.component.name}, ${json})`
}

const pct = (r: number) => `${Math.round(r * 100)}%`
const inkBadge = (r: number) => `<span class="ink${r > INK_BUDGET ? ' over' : ''}" title="lit pixels${r > INK_BUDGET ? `, over the ${pct(INK_BUDGET)} budget` : ''}">ink ${pct(r)}</span>`

const frames: Array<{ fb: Framebuffer; title: string }> = []
const figures: Partial<Record<Sample['group'], string[]>> = {}
const timings: Array<[string, number]> = []
// Samples whose picture changes under `surface: 'outline'`, for the comparison section.
const surfaces: Array<{ sample: Sample; size: { w: number; h: number }; filled: Framebuffer; outline: Framebuffer }> = []
for (const sample of SAMPLES) {
  const size = sample.size ?? sample.component.size ?? TILE
  const t0 = performance.now()
  const fb = sample.component.renderToTile(sample.props, size)
  timings.push([sample.id, performance.now() - t0])
  const ink = inkRatio(fb)
  frames.push({ fb, title: `${sample.id} ${pct(ink)}` })
  writeFileSync(join(out, `${sample.id}.png`), png(fb))
  const outline = sample.component.renderToTile(sample.props, size, outlineTheme)
  if (!outline.equals(fb)) {
    surfaces.push({ sample, size, filled: fb, outline })
    writeFileSync(join(out, `${sample.id}.outline.png`), png(outline))
  }
  ;(figures[sample.group] ??= []).push(`<figure id="${sample.id}">
  <img src="${sample.id}.png" width="${size.w * 2}" height="${size.h * 2}" alt="${esc(sample.title)}" loading="lazy">
  <figcaption><b>${esc(sample.title)}</b><span><code>${sample.component.name}</code> · ${size.w}×${size.h} · ${sample.priority} · ${inkBadge(ink)}</span>${sample.note ? `<em>${esc(sample.note)}</em>` : ''}
  <details><summary>props</summary><pre>${esc(propsCode(sample))}</pre></details></figcaption>
</figure>`)
}

const surfaceRows = surfaces.map(({ sample, size, filled, outline }) => `<figure class="pair" id="${sample.id}-surface">
  <div><img src="${sample.id}.png" width="${size.w * 2}" height="${size.h * 2}" alt="${esc(sample.title)}, filled" loading="lazy"><span>filled · ${inkBadge(inkRatio(filled))}</span></div>
  <div><img src="${sample.id}.outline.png" width="${size.w * 2}" height="${size.h * 2}" alt="${esc(sample.title)}, outline" loading="lazy"><span>outline · ${inkBadge(inkRatio(outline))}</span></div>
  <figcaption><b>${esc(sample.title)}</b><span><code>${sample.component.name}</code></span></figcaption>
</figure>`)
const inkTotal = (fbs: Framebuffer[]) => fbs.reduce((a, f) => a + inkRatio(f) * f.data.length, 0) / fbs.reduce((a, f) => a + f.data.length, 0)

const DEMOS = [
  ['quickstart', 'Quickstart', 'Bar chart + KPI above a native list: the README snippet.'],
  ['dashboard', 'Dashboard', 'Four panels; swipe moves focus, tap opens one chart across all four tiles.'],
  ['picker', 'Pickers', 'Carousel typing, a time picker with edit mode, a keyboard prompt.'],
  ['keyboard', 'Keyboard', 'Every keyboard option: letters, symbols layer / beside / below, rows or columns, action keys.'],
  ['game', 'Tic-tac-toe', 'The game kit with one gesture axis.'],
  ['calibrate', 'Calibration card', '16 levels, theme levels, patterns and fonts, for tuning a device.'],
] as const

const slug = (g: string) => `g-${g.replace(/\W+/g, '-')}`
const groups = Object.entries(figures) as Array<[Sample['group'], string[]]>
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>g2-kit gallery</title>
<meta name="description" content="Drawn charts, controls and HUD pieces for Even Realities G2 plugins.">
<style>
  :root { color-scheme: dark; --bg: #0b0d0b; --fg: #d6ecd6; --muted: #86a086; --line: #1f2a1f; --accent: #6dff6d; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 1280px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 28px; margin: 0; } h1 small { font-size: 14px; color: var(--muted); font-weight: 400; margin-left: 8px; }
  .lede { color: var(--muted); max-width: 70ch; margin: 8px 0 24px; }
  nav { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 24px 0; font-size: 14px; }
  a { color: var(--accent); }
  h2 { font-size: 18px; margin: 40px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
  .demos { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
  .demo { display: block; padding: 14px; border: 1px solid var(--line); border-radius: 8px; text-decoration: none; color: var(--fg); background: #0f140f; }
  .demo:hover { border-color: var(--accent); } .demo b { color: var(--accent); display: block; margin-bottom: 4px; } .demo span { color: var(--muted); font-size: 13px; }
  .grid { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }
  figure { margin: 0; max-width: 100%; }
  img { display: block; max-width: 100%; height: auto; image-rendering: pixelated; background: #000; outline: 1px solid var(--line); }
  figcaption { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; font-size: 13px; max-width: 576px; }
  figcaption span, figcaption em { color: var(--muted); }
  details summary { cursor: pointer; color: var(--muted); font-size: 12px; }
  pre { background: #0f140f; border: 1px solid var(--line); padding: 8px; overflow: auto; font-size: 12px; max-height: 280px; margin: 4px 0 0; }
  .note { color: var(--muted); font-size: 13px; font-weight: 400; }
  .ink { white-space: nowrap; } .ink.over { color: #ffcf6d; }
  .pair { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: flex-start; }
  .pair > div { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--muted); max-width: 100%; }
  .pair figcaption { flex-basis: 100%; margin-top: 0; }
</style></head><body><main>
<h1>g2-kit <small>${SAMPLES.length} samples · ${new Set(SAMPLES.map((s) => s.component.name)).size} components</small></h1>
<p class="lede">Charts, controls and HUD pieces for Even Realities G2 Hub plugins, drawn on the phone into 4-bit image tiles.
Previews are 2× and use the brightness curve measured in evenhub-simulator 0.9.5; real-glasses brightness is not yet verified.
Unofficial; not affiliated with Even Realities.</p>
${site ? `<h2>Live demos <span class="note">run in your browser with a mock host: on-screen gesture buttons, or ↓ ↑ Enter D H</span></h2>
<div class="demos">${DEMOS.map(([id, t, d]) => `<a class="demo" href="demos/${id}/?mock"><b>${t} →</b><span>${d}</span></a>`).join('')}</div>` : ''}
<nav>${groups.map(([g]) => `<a href="#${slug(g)}">${GROUPS[g]}</a>`).join('')}<a href="#g-surface">Filled vs outline</a></nav>
${groups.map(([g, figs]) => `<h2 id="${slug(g)}">${GROUPS[g]}</h2><div class="grid">${figs.join('\n')}</div>`).join('\n')}
<h2 id="g-surface">Filled vs outline <span class="note">theme <code>surface: 'outline'</code>: ink ${pct(inkTotal(surfaces.map((s) => s.filled)))} → ${pct(inkTotal(surfaces.map((s) => s.outline)))} over these ${surfaces.length} samples</span></h2>
<p class="lede">Every lit pixel sits between the wearer and the world. With <code>createTheme({ surface: 'outline' })</code> (or <code>outlineTheme</code>),
components draw frames and light textures where they would paint solid blocks. Ink is the share of lit pixels; the budget is ${pct(INK_BUDGET)}.</p>
<div class="grid">${surfaceRows.join('\n')}</div>
</main></body></html>`
writeFileSync(join(out, 'index.html'), html)

/** Contact sheet: frames at 1:1 on one image, packed into rows, each labelled. */
function contactSheet(items: ReadonlyArray<{ fb: Framebuffer; title: string }>, width = 1200): Framebuffer {
  const pad = 8
  const labelH = 10
  let x = pad
  let y = pad
  let rowH = 0
  const placed: Array<{ fb: Framebuffer; title: string; x: number; y: number }> = []
  for (const f of items) {
    if (x + f.fb.width + pad > width) {
      x = pad
      y += rowH + labelH + pad
      rowH = 0
    }
    placed.push({ ...f, x, y })
    x += f.fb.width + pad
    rowH = Math.max(rowH, f.fb.height)
  }
  const sheet = new Framebuffer(width, y + rowH + labelH + pad)
  for (const p of placed) {
    sheet.blit(p.fb, p.x, p.y)
    strokeRect(sheet, p.x - 1, p.y - 1, p.fb.width + 2, p.fb.height + 2, 2, 1)
    drawText(sheet, p.title, p.x, p.y + p.fb.height + 2, { font: font5x7, level: 6 })
  }
  return sheet
}
writeFileSync(join(out, 'contact-sheet.png'), png(contactSheet(frames), 1))
// Filled and outline side by side (one cell per pair, so a pair never wraps), for the squint test.
const pairs = surfaces.map(({ sample, filled, outline }) => {
  const fb = new Framebuffer(filled.width * 2 + 6, filled.height)
  fb.blit(filled, 0, 0)
  fb.blit(outline, filled.width + 6, 0)
  return { fb, title: `${sample.id} ${pct(inkRatio(filled))} > ${pct(inkRatio(outline))}` }
})
writeFileSync(join(out, 'surface-sheet.png'), png(contactSheet(pairs), 1))

timings.sort((a, b) => b[1] - a[1])
const over = SAMPLES.filter((_, i) => inkRatio(frames[i].fb) > INK_BUDGET).map((s) => s.id)
console.log(`gallery: ${SAMPLES.length} samples → ${out}`)
console.log(`slowest renders: ${timings.slice(0, 5).map(([id, ms]) => `${id} ${ms.toFixed(1)} ms`).join(', ')}`)
console.log(`ink over ${pct(INK_BUDGET)}: ${over.length ? over.join(', ') : 'none'}`)
console.log(`outline surface: ${surfaces.length} samples change, ink ${pct(inkTotal(surfaces.map((s) => s.filled)))} → ${pct(inkTotal(surfaces.map((s) => s.outline)))}`)
