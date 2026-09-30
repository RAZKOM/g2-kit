/**
 * Render-time benchmark: every gallery sample, rendered repeatedly, plus the
 * PNG encode that every send pays. Target: < 10 ms per 288×144 tile on a
 * mid-range phone, so BLE (~100 ms per image) stays the bottleneck.
 *
 *   npm run bench            (Node on this machine)
 *
 * Phone numbers come from the examples: their page shows the median render
 * time per tile measured in the phone WebView.
 */
import { TILE, encodePng } from '../src/core/index.js'
import { SAMPLES } from '../examples/gallery/samples.js'

const RUNS = Number(process.argv[2] ?? 40)
const rows: Array<{ id: string; median: number; p95: number; encode: number }> = []
for (const s of SAMPLES) {
  const size = s.size ?? s.component.size ?? TILE
  for (let i = 0; i < 5; i++) s.component.renderToTile(s.props, size) // warm-up
  const times: number[] = []
  let fb = s.component.renderToTile(s.props, size)
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    fb = s.component.renderToTile(s.props, size)
    times.push(performance.now() - t0)
  }
  const t1 = performance.now()
  for (let i = 0; i < 10; i++) encodePng(fb)
  const encode = (performance.now() - t1) / 10
  times.sort((a, b) => a - b)
  rows.push({ id: s.id, median: times[Math.floor(RUNS / 2)], p95: times[Math.floor(RUNS * 0.95)], encode })
}
rows.sort((a, b) => b.median - a.median)
const fmt = (n: number) => n.toFixed(2).padStart(6)
console.log(`render time per sample over ${RUNS} runs (ms), slowest first; node ${process.version}`)
console.log(`${'sample'.padEnd(22)} median    p95  png-encode`)
for (const r of rows.slice(0, 15)) console.log(`${r.id.padEnd(22)} ${fmt(r.median)} ${fmt(r.p95)} ${fmt(r.encode)}`)
const worst = rows[0]
const all = rows.map((r) => r.median).sort((a, b) => a - b)
console.log(`\n${rows.length} samples · median of medians ${all[Math.floor(all.length / 2)].toFixed(2)} ms · worst ${worst.id} ${worst.median.toFixed(2)} ms`)
console.log(rows.every((r) => r.p95 < 10) ? 'all p95 < 10 ms on this machine' : `over 10 ms: ${rows.filter((r) => r.p95 >= 10).map((r) => r.id).join(', ')}`)
