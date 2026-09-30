/**
 * hub-game: tic-tac-toe with the game kit. One gesture axis is enough: swipe
 * moves the cursor through empty cells, tap places X, the phone answers with
 * O. Board on one tile, score HUD + status on the other; a swipe redraws only
 * the board tile.
 */
import { PageBuilder } from 'g2-kit/bridge'
import { blankTextSkeleton } from 'g2-kit/input'
import { BigText, GridBoard, ScoreHud, type BoardCell } from 'g2-kit/widgets'
import { defineComponent, cut } from 'g2-kit/core'
import { start } from '../shared/phone'

const { g2 } = await start()

const page = new PageBuilder()
  .text(blankTextSkeleton({ x: 0, y: 0, w: 576, h: 288 }, { id: 10 }))
  .image({ id: 1, name: 'board', x: 0, y: 72, w: 288, h: 144 })
  .image({ id: 2, name: 'side', x: 288, y: 72, w: 288, h: 144 })
  .build<'board' | 'side'>()

type P = 'X' | 'O' | null
let cells: P[] = Array(9).fill(null)
let cursor = 0
let over: string | null = null
const score = { wins: 0, losses: 0, draws: 0, streak: 0 }

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
const winner = (b: P[]) => LINES.find(([a, c, d]) => b[a] && b[a] === b[c] && b[a] === b[d]) ?? null
const empties = (b: P[]) => b.flatMap((v, i) => (v ? [] : [i]))

/** Small minimax: O plays well but not perfectly (random tie-breaks keep it beatable sometimes). */
function bestMove(b: P[]): number {
  const score = (bb: P[], turn: 'X' | 'O', depth: number): number => {
    const w = winner(bb)
    if (w) return bb[w[0]] === 'O' ? 10 - depth : depth - 10
    const e = empties(bb)
    if (!e.length) return 0
    const vals = e.map((i) => {
      const n = [...bb]
      n[i] = turn
      return score(n, turn === 'O' ? 'X' : 'O', depth + 1)
    })
    return turn === 'O' ? Math.max(...vals) : Math.min(...vals)
  }
  const moves = empties(b).map((i) => {
    const n = [...b]
    n[i] = 'O'
    return { i, v: score(n, 'X', 1) + Math.random() * 0.5 }
  })
  if (Math.random() < 0.2) return moves[Math.floor(Math.random() * moves.length)].i
  return moves.sort((a, c) => c.v - a.v)[0].i
}

function drawBoard(): void {
  const line = winner(cells)
  const board: (BoardCell | null)[][] = [0, 1, 2].map((r) =>
    [0, 1, 2].map((c) => {
      const i = r * 3 + c
      const v = cells[i]
      if (!v) return null
      // Winning line: filled cells, so the result reads by shape.
      return { glyph: v, mark: line?.includes(i) ? 'filled' : v === 'O' ? 'ring' : 'outline' }
    }),
  )
  g2.draw('board', GridBoard, { cells: board, focus: over ? undefined : [Math.floor(cursor / 3), cursor % 3], gap: 4 })
}

const Side = defineComponent<{ text: string }>('Side', { w: 288, h: 144 }, (fb, rect, p, theme) => {
  const [hud, rest] = cut(rect, 'top', 40)
  ScoreHud.render(fb, hud, { score: score.wins, streak: score.streak, label: 'WINS' }, theme)
  BigText.render(fb, rest, { text: p.text, fonts: [{ font: 'body', scale: 2 }, { font: 'body' }] }, theme)
})

function drawSide(): void {
  g2.draw('side', Side, { text: over ?? 'Your move (X)' })
}

function moveCursor(d: 1 | -1): void {
  const e = empties(cells)
  if (!e.length) return
  const at = e.indexOf(cursor)
  cursor = e[(at + d + e.length) % e.length] ?? e[0]
  drawBoard()
}

function finish(): boolean {
  const w = winner(cells)
  if (w) {
    const x = cells[w[0]] === 'X'
    over = x ? 'You win! Tap: again' : 'O wins. Tap: again'
    if (x) {
      score.wins++
      score.streak++
    } else {
      score.losses++
      score.streak = 0
    }
  } else if (!empties(cells).length) {
    over = 'Draw. Tap: again'
    score.draws++
  }
  return over !== null
}

function place(): void {
  if (over || cells[cursor]) return
  cells[cursor] = 'X'
  if (!finish()) {
    cells[bestMove(cells)] = 'O'
    finish()
  }
  if (!over) cursor = empties(cells)[0] ?? 0
  drawBoard()
  drawSide()
}

function newGame(): void {
  cells = Array(9).fill(null)
  cursor = 4
  over = null
  drawBoard()
  drawSide()
}

g2.on('next', () => moveCursor(1))
g2.on('prev', () => moveCursor(-1))
g2.on('tap', () => (over ? newGame() : place()))
g2.on('hold', () => newGame())

await g2.show(page)
newGame()
