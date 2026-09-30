/**
 * 16×24 display font: the body font doubled with Scale2x, so diagonals stay
 * smooth. 14×24 glyphs, advance 16, line height 28. Built on first use.
 */
import { scale2xFont } from './font.js'
import { font8x12 } from './font8x12.js'

const CHARS = ` !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_\`abcdefghijklmnopqrstuvwxyz{|}~°…·`

export const font16x24 = scale2xFont(font8x12, '16x24', CHARS)
