// Temporary experiment: send raw 8-bit ramps (0..255) to see how the host maps 8-bit grey to 4-bit.
import { assemblePng } from 'g2-kit/core'
import { PageBuilder } from 'g2-kit/bridge'
import { blankTextSkeleton } from 'g2-kit/input'
import { start } from '../shared/phone'
const { g2 } = await start()
const page = new PageBuilder().text(blankTextSkeleton({ x: 0, y: 0, w: 576, h: 288 }, { id: 10 }))
  .image({ id: 1, name: 'ramp', x: 0, y: 0, w: 256, h: 40 })
  .image({ id: 2, name: 'gray8', x: 0, y: 60, w: 256, h: 40 })
  .image({ id: 3, name: 'gray4', x: 0, y: 120, w: 256, h: 40 })
  .build()
await g2.show(page)
const png = () => { const raw = new Uint8Array(257 * 40); for (let y = 0; y < 40; y++) for (let x = 0; x < 256; x++) raw[y * 257 + 1 + x] = x; return assemblePng(256, 40, 8, 0, raw) }
g2.queue.image({ containerID: 1, containerName: 'ramp' }, png)
g2.queue.image({ containerID: 2, containerName: 'gray8' }, () => { const b = new Uint8Array(256 * 40); for (let i = 0; i < b.length; i++) b[i] = i % 256; return b })
g2.queue.image({ containerID: 3, containerName: 'gray4' }, () => { const b = new Uint8Array(128 * 40); for (let i = 0; i < b.length; i++) { const x = (i % 128) * 2; const l0 = x >> 4, l1 = (x + 1) >> 4; b[i] = (l0 << 4) | l1 } return b })
