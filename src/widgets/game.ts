/** Game kit: grid board with per-cell marks, score HUD. */
import { defineComponent } from '../core/component.js'
import { strokeRect } from '../core/draw.js'
import { drawMark, glyphLevelOn, type Mark } from '../core/encodings.js'
import type { Framebuffer } from '../core/framebuffer.js'
import type { Rect } from '../core/geometry.js'
import { drawText, textWidth } from '../core/text.js'
import type { Theme } from '../core/theme.js'
import { ICONS } from '../icons/index.js'
import { themeFont } from './common.js'

export interface BoardCell {
  glyph?: string
  mark?: Mark
  /** Override the glyph level. */
  level?: number
}

export interface GridBoardProps {
  /** cells[row][col]; null = empty outline. */
  cells: ReadonlyArray<ReadonlyArray<BoardCell | null>>
  /** Focused cell [row, col]. */
  focus?: readonly [number, number]
  gap?: number
  /** Square cells centred in the rect (default true). */
  square?: boolean
  /** Thicker lines every N cells (Sudoku: 3). */
  blocks?: number
}

/**
 * N×M board for Wordle, Sudoku, Minesweeper, 2048, tic-tac-toe… Each cell has
 * a mark (filled / ring / strike / outline / dashed / empty) and a glyph.
 */
export function renderGridBoard(fb: Framebuffer, rect: Rect, p: GridBoardProps, theme: Theme): void {
  const lv = theme.levels
  const rows = p.cells.length
  const cols = Math.max(0, ...p.cells.map((r) => r.length))
  if (!rows || !cols) return
  const gap = p.gap ?? 2
  let cw = Math.floor((rect.w - gap * (cols - 1)) / cols)
  let ch = Math.floor((rect.h - gap * (rows - 1)) / rows)
  if (p.square !== false) cw = ch = Math.min(cw, ch)
  const bw = cols * cw + (cols - 1) * gap
  const bh = rows * ch + (rows - 1) * gap
  const x0 = Math.round(rect.x + (rect.w - bw) / 2)
  const y0 = Math.round(rect.y + (rect.h - bh) / 2)
  const glyphH = ch - 6
  const fontName = glyphH >= 24 ? 'display' : glyphH >= 12 ? 'body' : 'small'
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cell = p.cells[r][c] ?? null
      const x = x0 + c * (cw + gap)
      const y = y0 + r * (ch + gap)
      const mark: Mark = cell?.mark ?? 'outline'
      drawMark(fb, { x, y, w: cw, h: ch }, mark, { fg: lv.full, dim: lv.dim })
      if (cell?.glyph) {
        let f = themeFont(theme, fontName)
        if (textWidth(cell.glyph, f.font) > cw - 4) f = themeFont(theme, fontName === 'display' ? 'body' : 'small')
        const level = cell.level ?? glyphLevelOn(mark, lv.full, lv.dim)
        drawText(fb, cell.glyph, x + cw / 2, Math.round(y + (ch - f.font.ascent * f.scale) / 2), { font: f.font, scale: f.scale, level, align: 'center' })
      }
    }
  if (p.blocks && p.blocks > 1) {
    for (let c = p.blocks; c < cols; c += p.blocks) fb.fillRect(x0 + c * (cw + gap) - gap, y0, gap, bh, lv.bright)
    for (let r = p.blocks; r < rows; r += p.blocks) fb.fillRect(x0, y0 + r * (ch + gap) - gap, bw, gap, lv.bright)
  }
  if (p.focus) {
    const [r, c] = p.focus
    strokeRect(fb, x0 + c * (cw + gap) - 2, y0 + r * (ch + gap) - 2, cw + 4, ch + 4, lv.full, 2)
  }
}

export const GridBoard = defineComponent<GridBoardProps>('GridBoard', { w: 144, h: 144 }, renderGridBoard)

export interface ScoreHudProps {
  score: number
  best?: number
  streak?: number
  lives?: { current: number; max: number }
  label?: string
  /** 'row' (one line, default) or 'stack' (score big, extras below). */
  layout?: 'row' | 'stack'
}

/** Score, best, streak, and lives as hearts (filled = left, outline = lost). */
export function renderScoreHud(fb: Framebuffer, rect: Rect, p: ScoreHudProps, theme: Theme): void {
  const lv = theme.levels
  const body = theme.fonts.body
  const small = theme.fonts.small
  const stack = p.layout === 'stack'
  let x = rect.x + 4
  const cy = stack ? rect.y + 4 : Math.round(rect.y + (rect.h - body.glyphH) / 2)
  const scoreFont = stack ? theme.fonts.display : body
  const label = p.label ?? 'SCORE'
  drawText(fb, label, x, stack ? cy : cy + 2, { font: small, level: lv.mid })
  const sx = stack ? x : x + textWidth(label, small) + 4
  const sy = stack ? cy + small.glyphH + 3 : cy
  const scoreText = String(p.score)
  drawText(fb, scoreText, sx, sy, { font: scoreFont, level: lv.full })
  x = stack ? rect.x + 4 : sx + textWidth(scoreText, scoreFont) + 12
  let y = stack ? sy + scoreFont.glyphH + 6 : cy
  const item = (lbl: string, v: string | number) => {
    drawText(fb, lbl, x, y + 2, { font: small, level: lv.mid })
    x += textWidth(lbl, small) + 3
    drawText(fb, String(v), x, y, { font: body, level: lv.bright })
    x += textWidth(String(v), body) + 12
  }
  if (p.best !== undefined) item('BEST', p.best)
  if (p.streak !== undefined) item('STREAK', p.streak)
  if (p.lives) {
    const hs = 12
    if (stack && x + p.lives.max * (hs + 3) > rect.x + rect.w) {
      x = rect.x + 4
      y += body.glyphH + 6
    }
    const hx = stack ? x : rect.x + rect.w - p.lives.max * (hs + 3) - 2
    for (let i = 0; i < p.lives.max; i++) {
      const draw = i < p.lives.current ? ICONS.heart : ICONS.heartOutline
      draw(fb, hx + i * (hs + 3), y, hs, i < p.lives.current ? lv.full : lv.dim)
    }
  }
}

export const ScoreHud = defineComponent<ScoreHudProps>('ScoreHud', { w: 288, h: 24 }, renderScoreHud)
