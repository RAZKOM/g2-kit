/**
 * Regenerates the README images in docs/img/ (compressed PNG):
 *  - the legend samples
 *  - simulator screenshots from examples/output/sim/ (run `npm run sim:check` first),
 *    flattened onto black
 *
 *   npm run docs:images
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'
import { Framebuffer, SIMULATOR_CURVE, TILE, assemblePng, encodePreviewPng } from '../src/core/index.js'
import { SAMPLES } from '../examples/gallery/samples.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'docs', 'img')
mkdirSync(out, { recursive: true })
const deflate = (d: Uint8Array) => deflateSync(d, { level: 9 })
const write = (name: string, fb: Framebuffer, scale = 2) => {
  writeFileSync(join(out, name), encodePreviewPng(fb, { scale, curve: SIMULATOR_CURVE, deflate }))
  console.log(`docs/img/${name}`)
}

for (const id of ['legend-series', 'legend-marks']) {
  const s = SAMPLES.find((x) => x.id === id)!
  write(`${id}.png`, s.component.renderToTile(s.props, s.size ?? TILE))
}

/** Minimal PNG decoder for the simulator's RGBA screenshots. */
function decodeRgba(path: string): { w: number; h: number; px: Uint8Array } {
  const b = readFileSync(path)
  let o = 8
  let w = 0
  let h = 0
  const idat: Buffer[] = []
  while (o < b.length) {
    const len = b.readUInt32BE(o)
    const t = b.toString('ascii', o + 4, o + 8)
    const d = b.subarray(o + 8, o + 8 + len)
    if (t === 'IHDR') {
      w = d.readUInt32BE(0)
      h = d.readUInt32BE(4)
      if (d[8] !== 8 || d[9] !== 6) throw new Error(`${path}: expected 8-bit RGBA`)
    }
    if (t === 'IDAT') idat.push(d)
    o += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * 4
  const px = new Uint8Array(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const r = raw[y * (stride + 1) + 1 + x]
      const a = x >= 4 ? px[y * stride + x - 4] : 0
      const up = y ? px[(y - 1) * stride + x] : 0
      const c = x >= 4 && y ? px[(y - 1) * stride + x - 4] : 0
      let v = r
      if (f === 1) v += a
      else if (f === 2) v += up
      else if (f === 3) v += (a + up) >> 1
      else if (f === 4) {
        const p = a + up - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c
      }
      px[y * stride + x] = v & 255
    }
  }
  return { w, h, px }
}

const SIM: Record<string, string> = {
  'sim-quickstart.png': 'hub-quickstart-start.png',
  'sim-dashboard.png': 'hub-dashboard-focus-users.png',
  'sim-detail.png': 'hub-dashboard-detail.png',
  'sim-time-picker.png': 'hub-picker-time-editing.png',
  'sim-carousel.png': 'hub-picker-typed.png',
  'sim-keyboard.png': 'hub-picker-keys-typed.png',
  'sim-game.png': 'hub-game-later.png',
  'sim-calibration.png': 'hub-calibrate-card.png',
}
for (const [name, src] of Object.entries(SIM)) {
  const path = join(root, 'examples', 'output', 'sim', src)
  if (!existsSync(path)) {
    console.log(`skip ${name}: run npm run sim:check first (${src} missing)`)
    continue
  }
  const { w, h, px } = decodeRgba(path)
  const raw = new Uint8Array((1 + w * 3) * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const j = y * (1 + w * 3) + 1 + x * 3
      const a = px[i + 3] / 255
      raw[j] = px[i] * a
      raw[j + 1] = px[i + 1] * a
      raw[j + 2] = px[i + 2] * a
    }
  writeFileSync(join(out, name), assemblePng(w, h, 8, 2, raw, deflate))
  console.log(`docs/img/${name}`)
}
