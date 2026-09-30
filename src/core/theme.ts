/**
 * Named grey levels and the theme. 16 levels are not 16 colours: on a green
 * see-through display perhaps 4–6 are reliably distinct, so components ask for
 * a named level and the theme maps it to 0–15. Retune per device after
 * testing on real glasses.
 */
import type { BitmapFont } from './fonts/font.js'
import { font5x7 } from './fonts/font5x7.js'
import { font8x12 } from './fonts/font8x12.js'
import { font16x24 } from './fonts/display.js'

/**
 * Default named levels, tuned to the display response:
 *   - evenhub-simulator 0.9.5 (measured): brightness ≈ min(1, L/9)^0.45, so
 *     levels 9–15 all look the same; faint..full here read 51/70/84/96/100 %.
 *   - G2 glasses (checked by eye with examples/hub-calibrate): same shape;
 *     brightness levels off around 8–10, level 1 is visible, and these six
 *     levels are distinct.
 * Retune with `createTheme({ levels })`.
 */
/** Off: black, which is see-through on the glasses. */
export const OFF = 0
/** Faint: tracks, unlit segments, disabled. */
export const FAINT = 2
/** Dim: secondary marks, axes, far neighbours. */
export const DIM = 4
/** Mid: secondary data, inactive controls. */
export const MID = 6
/** Bright: primary data and text. */
export const BRIGHT = 8
/** Full: focus, highlights, headline numbers. */
export const FULL = 15

/**
 * Measured on evenhub-simulator 0.9.5: displayed alpha (0–255) per gray4 level.
 * The host's own 8-bit → gray4 conversion is linear (round(v / 17)).
 */
export const SIMULATOR_CURVE: readonly number[] = [0, 96, 131, 157, 179, 197, 214, 230, 244, 255, 255, 255, 255, 255, 255, 255]

export type LevelName = 'off' | 'faint' | 'dim' | 'mid' | 'bright' | 'full'
export type Level = number | LevelName

export interface ThemeFonts {
  /** Tiny labels, axis ticks (5×7). */
  small: BitmapFont
  /** Body text, values (8×12). */
  body: BitmapFont
  /** Headlines, big numbers (16×24). */
  display: BitmapFont
}

export interface Theme {
  levels: Record<LevelName, number>
  /** Default stroke width for data marks. ≥ 2 recommended. */
  stroke: number
  /** Default inner padding. */
  padding: number
  /** Default corner radius. */
  radius: number
  fonts: ThemeFonts
  /** Scale applied to `fonts.small` for labels (1 or 2). */
  smallScale: number
}

export const defaultTheme: Theme = {
  levels: { off: OFF, faint: FAINT, dim: DIM, mid: MID, bright: BRIGHT, full: FULL },
  stroke: 2,
  padding: 6,
  radius: 4,
  fonts: { small: font5x7, body: font8x12, display: font16x24 },
  smallScale: 1,
}

/** Evenly spaced levels for a display that renders gray4 linearly. On G2 its top three levels look the same. */
export const linearTheme: Theme = {
  ...defaultTheme,
  levels: { off: 0, faint: 4, dim: 7, mid: 10, bright: 13, full: 15 },
}

export interface ThemeOverrides {
  levels?: Partial<Record<LevelName, number>>
  stroke?: number
  padding?: number
  radius?: number
  fonts?: Partial<ThemeFonts>
  smallScale?: number
}

export function createTheme(over: ThemeOverrides = {}, base: Theme = defaultTheme): Theme {
  return {
    ...base,
    ...over,
    levels: { ...base.levels, ...over.levels },
    fonts: { ...base.fonts, ...over.fonts },
  } as Theme
}

/** Resolve a named or numeric level through the theme. */
export function lv(theme: Theme, l: Level): number {
  return typeof l === 'number' ? l : theme.levels[l]
}
