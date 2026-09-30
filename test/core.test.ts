import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  Framebuffer,
  TiledCanvas,
  createTheme,
  defaultTheme,
  drawBlock,
  drawMarker,
  drawSevenSeg,
  drawText,
  drawTextBox,
  ellipsize,
  encodePng,
  encodePreviewPng,
  encodeTile,
  fillCircle,
  fillPolygon,
  fillRectPaint,
  fillSector,
  fitText,
  font16x24,
  font5x7,
  font8x12,
  fromGray8,
  fromRGBA,
  gridTiles,
  inkRatio,
  line,
  outlineTheme,
  measureSevenSeg,
  pack4,
  polyline,
  quantize,
  roundRect,
  splitColumns,
  strokeArc,
  strokeCircle,
  strokeRect,
  textWidth,
  toGray8,
  unpack4,
  wrapText,
} from '../src/core/index.js'

/** Decode our own (stored-deflate) PNG back to raw scanlines. */
function decodePng(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let o = 8
  let width = 0
  let height = 0
  let depth = 0
  let type = 0
  const idat: Uint8Array[] = []
  while (o < png.length) {
    const len = view.getUint32(o)
    const t = String.fromCharCode(...png.subarray(o + 4, o + 8))
    const data = png.subarray(o + 8, o + 8 + len)
    if (t === 'IHDR') {
      const v = new DataView(data.buffer, data.byteOffset)
      width = v.getUint32(0)
      height = v.getUint32(4)
      depth = data[8]
      type = data[9]
    }
    if (t === 'IDAT') idat.push(data)
    o += 12 + len
  }
  const raw = new Uint8Array(inflateSync(Buffer.concat(idat)))
  return { width, height, depth, type, raw }
}

function ramp(w = 7, h = 5): Framebuffer {
  const fb = new Framebuffer(w, h)
  for (let i = 0; i < w * h; i++) fb.data[i] = i % 16
  return fb
}

describe('Framebuffer', () => {
  it('clamps levels and ignores out-of-bounds writes', () => {
    const fb = new Framebuffer(4, 2)
    fb.set(0, 0, 99)
    fb.set(1, 0, -3)
    fb.set(9, 9, 5)
    fb.set(-1, 0, 5)
    expect(fb.toAscii()).toBe('F...\n....')
  })

  it('clips every write to the pushed clip rect', () => {
    const fb = new Framebuffer(6, 4)
    fb.withClip({ x: 1, y: 1, w: 3, h: 2 }, () => {
      fb.fillRect(0, 0, 6, 4, 9)
      fb.set(0, 0, 9)
    })
    fb.set(5, 3, 1)
    expect(fb.toAscii()).toBe('......\n.999..\n.999..\n.....1')
  })

  it('nested clips intersect and pop back', () => {
    const fb = new Framebuffer(6, 1)
    fb.pushClip({ x: 1, y: 0, w: 4, h: 1 })
    fb.pushClip({ x: 3, y: 0, w: 9, h: 1 })
    fb.clear(5)
    fb.popClip()
    fb.set(1, 0, 1)
    fb.popClip()
    fb.set(0, 0, 2)
    expect(fb.toAscii()).toBe('21.55.')
  })

  it('blits with transparency, flips and crop', () => {
    const sprite = Framebuffer.from(3, 1, new Uint8Array([1, 0, 3]))
    const fb = new Framebuffer(5, 2, 7)
    fb.blit(sprite, 1, 0, { transparent: true })
    fb.blit(sprite, 1, 1, { flipX: true })
    expect(fb.toAscii()).toBe('717377\n73.177'.slice(0, 5) + '\n' + '73.17')
    expect(fb.crop({ x: 1, y: 1, w: 3, h: 1 }).toAscii()).toBe('3.1')
  })

  it('diffBounds finds the changed box', () => {
    const a = new Framebuffer(10, 10)
    const b = a.clone()
    expect(a.diffBounds(b)).toBeNull()
    b.set(2, 3, 1)
    b.set(6, 5, 1)
    expect(a.diffBounds(b)).toEqual({ x: 2, y: 3, w: 5, h: 3 })
    expect(a.hash()).not.toBe(b.hash())
  })
})

describe('ink and surfaces', () => {
  it('inkRatio counts lit pixels, optionally in a rect and above a level', () => {
    const fb = new Framebuffer(4, 2)
    expect(inkRatio(fb)).toBe(0)
    fb.fillRect(0, 0, 2, 1, 1)
    fb.set(3, 1, 15)
    expect(inkRatio(fb)).toBe(3 / 8)
    expect(inkRatio(fb, { x: 0, y: 0, w: 2, h: 1 })).toBe(1)
    expect(inkRatio(fb, { x: 2, y: 0, w: 9, h: 9 })).toBe(1 / 4)
    expect(inkRatio(fb, undefined, 2)).toBe(1 / 8)
    expect(inkRatio(fb, { x: 9, y: 9, w: 2, h: 2 })).toBe(0)
  })

  it('drawBlock: solid by default, a frame under surface outline', () => {
    const solid = new Framebuffer(9, 9)
    expect(drawBlock(solid, 0, 0, 9, 9, 8, defaultTheme)).toBe(true)
    expect(inkRatio(solid)).toBe(1)
    const frame = new Framebuffer(9, 9)
    expect(drawBlock(frame, 0, 0, 9, 9, 8, outlineTheme)).toBe(false)
    expect(frame.toAscii().split('\n')[4]).toBe('88.....88')
    const dotted = new Framebuffer(9, 9)
    drawBlock(dotted, 0, 0, 9, 9, 8, outlineTheme, { texture: 'sparseDots', double: true })
    expect(inkRatio(dotted)).toBeGreaterThan(inkRatio(frame))
    expect(inkRatio(dotted)).toBeLessThan(1)
    // Too small for a frame: stays solid.
    const tiny = new Framebuffer(6, 6)
    expect(drawBlock(tiny, 0, 0, 6, 6, 8, outlineTheme)).toBe(true)
    expect(createTheme({ surface: 'outline' }).surface).toBe('outline')
  })
})

describe('pack / encode round trips', () => {
  it('pack4 → unpack4 is lossless (both nibble orders, odd sizes)', () => {
    const fb = ramp(7, 5)
    for (const order of ['high', 'low'] as const) {
      const bytes = pack4(fb, order)
      expect(bytes.length).toBe(Math.ceil(35 / 2))
      expect(unpack4(bytes, 7, 5, order).equals(fb)).toBe(true)
    }
    expect(pack4(Framebuffer.from(2, 1, new Uint8Array([0xa, 0x3]))))
      .toEqual(new Uint8Array([0xa3]))
  })

  it('gray8 → quantize is lossless', () => {
    const fb = ramp()
    const g = toGray8(fb)
    expect(g[15]).toBe(255)
    expect(fromGray8(fb.width, fb.height, g).equals(fb)).toBe(true)
    for (let l = 0; l < 16; l++) expect(quantize(l * 17)).toBe(l)
  })

  it('8-bit PNG decodes back to the same levels', () => {
    const fb = ramp(9, 4)
    const { width, height, depth, type, raw } = decodePng(encodePng(fb))
    expect([width, height, depth, type]).toEqual([9, 4, 8, 0])
    const back = new Framebuffer(9, 4)
    for (let y = 0; y < 4; y++) for (let x = 0; x < 9; x++) back.data[y * 9 + x] = raw[y * 10 + 1 + x] / 17
    expect(back.equals(fb)).toBe(true)
  })

  it('4-bit PNG decodes back to the same levels', () => {
    const fb = ramp(9, 4)
    const { depth, raw } = decodePng(encodeTile(fb, 'png4'))
    expect(depth).toBe(4)
    const stride = 5
    const back = new Framebuffer(9, 4)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 9; x++) {
        const b = raw[y * (stride + 1) + 1 + (x >> 1)]
        back.data[y * 9 + x] = x & 1 ? b & 15 : b >> 4
      }
    expect(back.equals(fb)).toBe(true)
  })

  it('preview PNG is RGBA green, level 0 optionally transparent', () => {
    const fb = Framebuffer.from(2, 1, new Uint8Array([0, 15]))
    const { type, raw } = decodePng(encodePreviewPng(fb, { transparent: true }))
    expect(type).toBe(6)
    expect([...raw.subarray(1, 9)]).toEqual([0, 0, 0, 0, 0, 255, 0, 255])
  })

  it('encodeTile formats have the documented sizes', () => {
    const fb = new Framebuffer(288, 144)
    expect(encodeTile(fb, 'gray8').length).toBe(288 * 144)
    expect(encodeTile(fb, 'gray4').length).toBe(288 * 72)
    expect(encodeTile(fb).subarray(0, 4)).toEqual(new Uint8Array([137, 80, 78, 71]))
  })

  it('RGBA quantises by luma; bayer dither is deterministic and bounded', () => {
    const rgba = new Uint8Array([255, 255, 255, 255, 255, 0, 0, 255, 0, 0, 0, 0, 128, 128, 128, 255])
    expect([...fromRGBA(4, 1, rgba).data]).toEqual([15, 4, 0, 8])
    const grey = new Uint8Array(16).fill(120)
    const d = fromGray8(4, 4, grey, { dither: 'bayer4' })
    expect(new Set(d.data)).toEqual(new Set([7, 8]))
  })
})

describe('primitives (golden buffers)', () => {
  const g = (rows: string[]) => rows.join('\n')

  it('line: 1 px Bresenham and 2 px brush', () => {
    const fb = new Framebuffer(6, 4)
    line(fb, 0, 0, 5, 3, 15)
    expect(fb.toAscii()).toBe(g(['F.....', '.FF...', '...FF.', '.....F']))
    const t = new Framebuffer(6, 3)
    line(t, 0, 0, 4, 0, 9, { width: 2 })
    // Even-width brushes are anchored top-left of the path pixel.
    expect(t.toAscii()).toBe(g(['999999', '999999', '......']))
  })

  it('dash patterns carry across polyline joints', () => {
    const fb = new Framebuffer(12, 3)
    polyline(fb, [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 11, y: 0 }], 15, { dash: [2, 2] })
    line(fb, 0, 2, 11, 2, 7, { dash: 'dotted' })
    expect(fb.toAscii()).toBe(g(['FF..FF..FF..', '............', '77...77...77']))
  })

  it('strokeRect / roundRect', () => {
    const fb = new Framebuffer(7, 5)
    strokeRect(fb, 0, 0, 7, 5, 15, 1)
    expect(fb.toAscii()).toBe(g(['FFFFFFF', 'F.....F', 'F.....F', 'F.....F', 'FFFFFFF']))
    const r = new Framebuffer(8, 6)
    roundRect(r, 0, 0, 8, 6, 2, { fill: 5, stroke: 15 })
    expect(r.toAscii()).toBe(g(['.FFFFFF.', 'F555555F', 'F555555F', 'F555555F', 'F555555F', '.FFFFFF.']))
  })

  it('circle outline and disc', () => {
    const fb = new Framebuffer(9, 9)
    strokeCircle(fb, 4.5, 4.5, 3.5, 15, 1)
    expect(fb.toAscii()).toBe(
      g(['.........', '..FFFFF..', '.F.....F.', '.F.....F.', '.F.....F.', '.F.....F.', '.F.....F.', '..FFFFF..', '.........']),
    )
    const d = new Framebuffer(7, 7)
    fillCircle(d, 3.5, 3.5, 3, 9)
    expect(d.toAscii()).toBe(g(['..999..', '.99999.', '9999999', '9999999', '9999999', '.99999.', '..999..']))
  })

  it('sector and arc sweep clockwise from 12 o’clock', () => {
    const fb = new Framebuffer(8, 8)
    fillSector(fb, 4, 4, 0, 4, 0, 90, 15)
    expect(fb.toAscii()).toBe(g(['....FF..', '....FFF.', '....FFFF', '....FFFF', '........', '........', '........', '........']))
    const a = new Framebuffer(8, 8)
    strokeArc(a, 4, 4, 3, 270, 450, 15, 1)
    expect(a.toAscii()).toBe(g(['........', '..FFFF..', '.F....F.', '.F....F.', '........', '........', '........', '........']))
  })

  it('polygon fill and pattern paints', () => {
    const fb = new Framebuffer(7, 4)
    fillPolygon(fb, [{ x: 0, y: 0 }, { x: 7, y: 0 }, { x: 3.5, y: 4 }], 15)
    expect(fb.toAscii()).toBe(g(['FFFFFFF', '.FFFFF.', '..FFF..', '...F...']))
    const p = new Framebuffer(8, 4)
    fillRectPaint(p, 0, 0, 8, 4, { pattern: 'hatch', level: 15 })
    expect(p.toAscii()).toBe(g(['FF...FF.', 'F...FF..', '...FF...', '..FF...F']))
    const c = new Framebuffer(8, 4)
    fillRectPaint(c, 0, 0, 8, 4, { pattern: 'checker', level: 9, bg: 2 })
    expect(c.toAscii()).toBe(g(['99229922', '99229922', '22992299', '22992299']))
  })

  it('markers are distinct shapes', () => {
    const shapes = ['dot', 'square', 'triangle', 'diamond', 'cross', 'ring', 'plus'] as const
    const seen = new Set<string>()
    for (const s of shapes) {
      const fb = new Framebuffer(11, 11)
      drawMarker(fb, s, 5, 5, 7, 15)
      const a = fb.toAscii()
      expect(a).toMatch(/F/)
      seen.add(a)
    }
    expect(seen.size).toBe(shapes.length)
  })
})

describe('text', () => {
  it('measures monospaced advance without trailing spacing', () => {
    expect(textWidth('', font5x7)).toBe(0)
    expect(textWidth('AB', font5x7)).toBe(11)
    expect(textWidth('AB', font5x7, 2)).toBe(22)
    expect(textWidth('AB', font8x12)).toBe(15)
    expect(textWidth('AB', font16x24)).toBe(30)
  })

  it('draws a glyph exactly', () => {
    const fb = new Framebuffer(5, 7)
    drawText(fb, 'A', 0, 0, { font: font5x7 })
    expect(fb.toAscii()).toBe(['.FFF.', 'F...F', 'F...F', 'FFFFF', 'F...F', 'F...F', 'F...F'].join('\n'))
  })

  it('aligns centre and right', () => {
    const fb = new Framebuffer(20, 7)
    const w = drawText(fb, 'I', 10, 0, { align: 'center' })
    expect(w).toBe(5)
    expect(fb.get(9, 0)).toBe(15)
    const r = new Framebuffer(20, 7)
    drawText(r, 'I', 20, 0, { align: 'right' })
    expect(r.get(18, 0)).toBe(15)
  })

  it('ellipsizes and wraps', () => {
    expect(ellipsize('HELLO WORLD', 40, font5x7)).toBe('HELLO…')
    expect(textWidth(ellipsize('HELLO WORLD', 40, font5x7), font5x7)).toBeLessThanOrEqual(40)
    expect(wrapText('the quick brown fox', 60, font5x7)).toEqual(['the quick', 'brown fox'])
    expect(wrapText('ABCDEFGHIJKLMN', 30, font5x7)).toEqual(['ABCDE', 'FGHIJ', 'KLMN'])
    expect(wrapText('a\nb', 100, font5x7)).toEqual(['a', 'b'])
  })

  it('text box respects maxLines with an ellipsis', () => {
    const fb = new Framebuffer(60, 40)
    const lines = drawTextBox(fb, { x: 0, y: 0, w: 60, h: 40 }, 'one two three four five six seven eight', { wrap: true, maxLines: 2 })
    expect(lines.length).toBe(2)
    expect(lines[1].endsWith('…')).toBe(true)
  })

  it('fitText picks the largest candidate that fits', () => {
    const cands = [{ font: font16x24 }, { font: font8x12 }, { font: font5x7 }]
    expect(fitText('42', { w: 100, h: 30 }, cands).font).toBe(font16x24)
    expect(fitText('A LONG LABEL', { w: 100, h: 30 }, cands).font).toBe(font8x12)
    expect(fitText('A MUCH LONGER LABEL HERE', { w: 60, h: 8 }, cands).lines[0].endsWith('…')).toBe(true)
  })

  it('7-segment digits have a fixed width', () => {
    expect(measureSevenSeg('1', { height: 20 })).toBe(measureSevenSeg('8', { height: 20 }))
    const fb = new Framebuffer(80, 30)
    const w = drawSevenSeg(fb, '12.5', 0, 0, { height: 24 })
    expect(w).toBe(measureSevenSeg('12.5', { height: 24 }))
    expect(fb.data.some((v) => v > 0)).toBe(true)
  })
})

describe('layout helpers and tiles', () => {
  it('splitColumns covers the rect exactly', () => {
    const cols = splitColumns({ x: 0, y: 0, w: 100, h: 10 }, [1, 1, 1], 5)
    expect(cols[0].x).toBe(0)
    expect(cols[2].x + cols[2].w).toBe(100)
    expect(cols.map((c) => c.w).reduce((a, b) => a + b) + 10).toBe(100)
  })

  it('gridTiles splits 576×288 into four 288×144 tiles', () => {
    expect(gridTiles(576, 288)).toEqual([
      { x: 0, y: 0, w: 288, h: 144 },
      { x: 288, y: 0, w: 288, h: 144 },
      { x: 0, y: 144, w: 288, h: 144 },
      { x: 288, y: 144, w: 288, h: 144 },
    ])
    expect(gridTiles(432, 288).every((t) => t.w <= 288 && t.h <= 144)).toBe(true)
  })

  it('TiledCanvas reports only changed tiles', () => {
    const tc = new TiledCanvas(576, 288)
    expect(tc.changed()).toEqual([0, 1, 2, 3])
    tc.tiles.forEach((_, i) => tc.markSent(i))
    expect(tc.changed()).toEqual([])
    tc.fb.set(300, 200, 15)
    expect(tc.changed()).toEqual([3])
    expect(tc.tilesIn({ x: 280, y: 0, w: 20, h: 10 })).toEqual([0, 1])
    tc.invalidate()
    expect(tc.changed().length).toBe(4)
    expect(() => new TiledCanvas(600, 100, [{ x: 0, y: 0, w: 300, h: 100 }])).toThrow(/exceeds/)
  })
})
