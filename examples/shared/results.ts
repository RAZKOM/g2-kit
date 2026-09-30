/**
 * "Copy results" that works on a sideloaded phone page. The page is plain http
 * on the PC's LAN address, so `navigator.clipboard` (secure pages only) is
 * missing there. In order:
 *  1. POST the text to the dev server, which saves it under
 *     examples/output/results/ on the PC (dev server only; see vite.shared.ts);
 *  2. copy it: the clipboard API where it exists, else a selected textarea and
 *     document.execCommand('copy');
 *  3. show it in a text box next to the button, to select by hand if all else fails.
 * The button label says what worked.
 */
export async function shareResults(name: string, text: string, button: HTMLButtonElement): Promise<void> {
  const done: string[] = []
  try {
    const r = await fetch(`/__g2kit/results?name=${encodeURIComponent(name)}`, { method: 'POST', body: text })
    if (r.ok) done.push('saved on PC')
  } catch {
    /* static site or no dev server: skip */
  }
  if (await copy(text)) done.push('copied')
  showText(text, button)
  const label = button.dataset.label ?? (button.dataset.label = button.textContent ?? '')
  button.textContent = done.length ? `${done.join(' + ')} ✓` : 'select the text below ↓'
  setTimeout(() => (button.textContent = label), 3000)
}

async function copy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
  document.body.append(ta)
  ta.select()
  ta.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}

/** A read-only box with the text after the button's row, pre-selected on tap. */
function showText(text: string, button: HTMLButtonElement): void {
  const anchor = button.parentElement ?? button
  let box = anchor.nextElementSibling as HTMLTextAreaElement | null
  if (!box || box.dataset.results === undefined) {
    box = document.createElement('textarea')
    box.dataset.results = ''
    box.readOnly = true
    box.rows = 8
    box.style.cssText = 'display:block;width:100%;max-width:576px;box-sizing:border-box;margin:6px 0;background:#0f140f;color:#bff5bf;border:1px solid #2c3a2c;border-radius:4px;font:12px monospace;padding:6px'
    box.addEventListener('focus', () => box!.select())
    anchor.after(box)
  }
  box.value = text
}
