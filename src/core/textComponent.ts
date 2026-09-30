/**
 * Text components: the firmware-text counterpart of `defineComponent`. A text
 * component is a pure function of props to a string, shown in a firmware text
 * container instead of drawn on an image tile. On G2 glasses a text update took
 * ~60 ms vs ~260 ms for an image send (STATUS.md), so fast-changing readouts
 * (spinner, progress, slider values, status lines) are much cheaper as text.
 *
 * The trade-off: the firmware font only (no grey levels, no sizes), and it is
 * proportional, so characters don't line up in columns (fullwidth Latin does).
 * Box drawing, block elements and geometric shapes (━ ─ █ ▶ ● ○) render, so
 * bars and markers still look drawn; see `unsupportedTextChars`.
 *
 * Show them with `g2.textArea(container)`: inline among other lines of an
 * existing text container, or alone in a container of their own.
 */
/**
 * Characters the G2 firmware font draws (community notes, even-g2-notes docs/display.md): ASCII and Latin-1
 * except ¨ ¯ ´ µ ¸, arrows, box drawing, block elements, geometric shapes, a few symbols, super/subscripts,
 * fractions, and fullwidth Latin (for monospaced columns). No emoji, no other symbol ranges.
 */
const G2_TEXT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x20, 0x7e],
  [0xa0, 0xa7], [0xa9, 0xae], [0xb0, 0xb3], [0xb6, 0xb7], [0xb9, 0xff],
  [0x2020, 0x2020], [0x203b, 0x203b], // † ※
  [0x2070, 0x2070], [0x2074, 0x2079], [0x2080, 0x2089], // superscripts, subscripts
  [0x2122, 0x2122], [0x215b, 0x215b], [0x221e, 0x221e], // ™ ⅛ ∞
  [0x2190, 0x2199], [0x21d2, 0x21d2], [0x21d4, 0x21d4], // arrows
  [0x2500, 0x2503], [0x250c, 0x254b], [0x2550, 0x2550], [0x256d, 0x2573], // box drawing
  [0x2581, 0x258f], [0x2592, 0x2592], [0x2594, 0x2595], // blocks
  [0x25a0, 0x25a1], [0x25a3, 0x25a9], [0x25b2, 0x25b3], [0x25b6, 0x25b7], [0x25bc, 0x25bd], [0x25c0, 0x25c1],
  [0x25c6, 0x25d1], [0x25e2, 0x25e5], [0x25ef, 0x25ef], // geometric shapes
  [0x2605, 0x2606], [0x2609, 0x2609], [0x260e, 0x260f], [0x261c, 0x261c], [0x261e, 0x261e],
  [0x2660, 0x2661], [0x2663, 0x2665], [0x2667, 0x2667], // stars, phones, hands, card suits
  [0x3000, 0x3000], [0xff01, 0xff5e], // ideographic space, fullwidth Latin
]

/** Characters in `text` the G2 firmware font cannot draw (unique, in order). Newlines are fine. */
export function unsupportedTextChars(text: string): string[] {
  const bad = new Set<string>()
  for (const ch of text) {
    if (ch === '\n') continue
    const c = ch.codePointAt(0)!
    if (!G2_TEXT_RANGES.some(([a, b]) => c >= a && c <= b)) bad.add(ch)
  }
  return [...bad]
}

export interface TextComponent<P> {
  readonly name: string
  render(props: P): string
}

export function defineTextComponent<P>(name: string, render: (props: P) => string): TextComponent<P> {
  return { name, render }
}
