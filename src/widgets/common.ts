import type { BitmapFont } from '../core/fonts/font.js'
import type { Theme } from '../core/theme.js'

export type FontName = 'small' | 'body' | 'display'

export interface FontRef {
  font: BitmapFont
  scale: number
}

/** Resolve a theme font by name; 'small' uses the theme's smallScale. */
export function themeFont(theme: Theme, name: FontName, scale?: number): FontRef {
  if (name === 'small') return { font: theme.fonts.small, scale: scale ?? theme.smallScale }
  return { font: theme.fonts[name], scale: scale ?? 1 }
}

/** Visual state shared by focusable controls. */
export type ControlState = 'normal' | 'focused' | 'pressed' | 'active' | 'disabled'
