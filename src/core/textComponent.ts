/**
 * Text components: the firmware-text counterpart of `defineComponent`. A text
 * component is a pure function of props to a string, shown in a firmware text
 * container instead of drawn on an image tile. On G2 glasses a text update took
 * ~60 ms vs ~260 ms for an image send (STATUS.md), so fast-changing readouts
 * (spinner, progress, slider values, status lines) are much cheaper as text.
 *
 * The trade-off: the firmware font only (no grey levels, no shapes), and the
 * font is proportional, so characters don't line up in columns.
 *
 * Show them with `g2.textArea(container)`: inline among other lines of an
 * existing text container, or alone in a container of their own.
 */
export interface TextComponent<P> {
  readonly name: string
  render(props: P): string
}

export function defineTextComponent<P>(name: string, render: (props: P) => string): TextComponent<P> {
  return { name, render }
}
