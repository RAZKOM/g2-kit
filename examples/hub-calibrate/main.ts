/**
 * hub-calibrate: a full-screen test card for tuning the Theme on a device.
 * Row 1: the 16 grey levels. Row 2: the theme's six named levels.
 * Row 3: fill patterns. Row 4: fonts. Swipe down/up to shift the ramp's
 * brightest level (useful for "can I still tell 4 from 7?").
 */
import { Framebuffer, defaultTheme, drawText, fillRectPaint, font16x24, font5x7, font8x12, strokeRect, type FillPattern, defineComponent } from 'g2-kit/core'
import { layouts } from 'g2-kit/bridge'
import { start } from '../shared/phone'

const { g2 } = await start()

const PATTERNS: FillPattern[] = ['solid', 'hatch', 'backHatch', 'crossHatch', 'dots', 'checker', 'vStripes', 'hStripes', 'sparseDots']

const Card = defineComponent<{ note: string }>('CalibrationCard', { w: 576, h: 288 }, (fb: Framebuffer, r, p) => {
  const sw = Math.floor(r.w / 16)
  for (let l = 0; l < 16; l++) {
    fb.fillRect(r.x + l * sw, r.y, sw - 2, 44, l)
    drawText(fb, String(l), r.x + l * sw + (sw - 2) / 2, r.y + 48, { font: font5x7, level: 15, align: 'center' })
  }
  const named = Object.entries(defaultTheme.levels)
  const nw = Math.floor(r.w / named.length)
  named.forEach(([name, level], i) => {
    fb.fillRect(r.x + i * nw, r.y + 62, nw - 4, 30, level)
    strokeRect(fb, r.x + i * nw, r.y + 62, nw - 4, 30, 15, 1)
    drawText(fb, `${name} ${level}`, r.x + i * nw + 2, r.y + 96, { font: font5x7, level: 15 })
  })
  const pw = Math.floor(r.w / PATTERNS.length)
  PATTERNS.forEach((pat, i) => {
    fillRectPaint(fb, r.x + i * pw, r.y + 110, pw - 4, 34, { pattern: pat, level: 15 })
    drawText(fb, pat.slice(0, 9), r.x + i * pw, r.y + 148, { font: font5x7, level: 12 })
  })
  drawText(fb, 'Small 5x7: The quick brown fox 0123456789', r.x, r.y + 164, { font: font5x7, level: 15 })
  drawText(fb, 'Body 8x12: The quick brown fox 0123456789', r.x, r.y + 178, { font: font8x12, level: 15 })
  drawText(fb, 'Dim body at level 7: still readable?', r.x, r.y + 196, { font: font8x12, level: 7 })
  drawText(fb, 'Display 42°', r.x, r.y + 216, { font: font16x24, level: 15 })
  drawText(fb, p.note, r.x + r.w, r.y + 262, { font: font5x7, level: 9, align: 'right' })
})

const page = layouts.fullScreen()
await g2.show(page)
g2.drawSpan(page.span, Card, { note: 'g2-kit calibration card' })
