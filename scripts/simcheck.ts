/**
 * Drive an example in evenhub-simulator through its automation API, save
 * glasses screenshots and the console log.
 *
 *   npm run sim:check -- hub-dashboard
 *
 * Output: examples/output/sim/<example>-<step>.png and <example>-console.txt.
 * Needs @evenrealities/evenhub-simulator (devDependency) for this platform.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

type Step = { input: 'up' | 'down' | 'click' | 'double_click' | 'long_press' | 'long_press_release' } | { wait: number } | { shot: string }

const S = (name: string): Step => ({ shot: name })
const I = (input: Extract<Step, { input: string }>['input']): Step => ({ input })
const W = (ms: number): Step => ({ wait: ms })

const SCENARIOS: Record<string, { port: number; steps: Step[] }> = {
  'hub-dashboard': {
    port: 5181,
    steps: [W(3000), S('start'), I('down'), W(1200), S('focus-users'), I('down'), W(1000), I('click'), W(2500), S('detail'), I('click'), W(2500), S('back')],
  },
  'hub-picker': {
    port: 5182,
    steps: [
      W(3000), S('carousel'), I('down'), W(600), I('down'), W(600), I('click'), W(800), I('up'), W(600), I('click'), W(1000), S('typed'),
      // To TIME (index 0): step back from 'B'.
      I('up'), W(400), I('up'), W(400), I('up'), W(400), I('up'), W(400), I('up'), W(600), S('on-time-item'), I('click'), W(2500), S('time'),
      I('click'), W(800), I('down'), W(600), I('down'), W(800), S('time-editing'), I('click'), W(800), I('down'), W(600), I('down'), W(600), I('click'), W(2500), S('back-to-carousel'),
      I('down'), W(600), I('click'), W(2500), S('keys'), I('down'), W(800), I('click'), W(800), I('down'), W(600), I('click'), W(1200), S('keys-typed'),
    ],
  },
  'hub-game': {
    port: 5183,
    steps: [W(3000), S('start'), I('click'), W(1500), S('after-move'), I('down'), W(800), S('cursor'), I('click'), W(1500), I('click'), W(1500), I('click'), W(1500), S('later')],
  },
  'hub-calibrate': { port: 5184, steps: [W(3500), S('card')] },
  'hub-ramp': { port: 5185, steps: [W(4000), S('ramp')] },
  'hub-lens': { port: 5187, steps: [W(4000), S('s1'), I('click'), W(1500), S('s2'), I('click'), W(2000), S('s3'), I('click'), W(1500), I('click'), W(3500), S('s5'), I('click'), W(4000), I('click'), W(2500), S('s7'), I('click'), W(5000), S('s8')] },
  // Native list: swipes move the firmware highlight (expect no events), tap reports the index.
  'hub-quickstart': { port: 5186, steps: [W(3500), S('start'), I('down'), W(800), S('list-moved'), I('click'), W(1500), I('up'), W(600), I('click'), W(1500), S('refreshed'), I('down'), W(500), I('down'), W(500), I('down'), W(500), I('down'), W(800), I('click'), W(1500), S('after-exit')] },
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const name = process.argv[2] ?? 'hub-dashboard'
const sc = SCENARIOS[name]
if (!sc) throw new Error(`unknown example ${name}; have ${Object.keys(SCENARIOS).join(', ')}`)
const out = join(root, 'examples', 'output', 'sim')
mkdirSync(out, { recursive: true })
const API = 'http://127.0.0.1:9898/api'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function simBinary(): string {
  const require = createRequire(import.meta.url)
  const pkg = `@evenrealities/sim-${process.platform}-${process.arch}`
  const dir = dirname(require.resolve(`${pkg}/package.json`))
  const exe = join(dir, 'bin', process.platform === 'win32' ? 'evenhub-simulator.exe' : 'evenhub-simulator')
  if (!existsSync(exe)) throw new Error(`simulator binary not found at ${exe}`)
  return exe
}

async function waitFor(url: string, tries = 60): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      /* not up yet */
    }
    await sleep(500)
  }
  throw new Error(`timed out waiting for ${url}`)
}

const procs: ChildProcess[] = []
const kill = () => procs.forEach((p) => p.kill())
process.on('exit', kill)

const vite = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), join('examples', name)], { cwd: root, stdio: 'ignore' })
procs.push(vite)
await waitFor(`http://localhost:${sc.port}/`)
const sim = spawn(simBinary(), [`http://localhost:${sc.port}`, '--automation-port', '9898', '--no-glow'], { cwd: out, stdio: 'ignore' })
procs.push(sim)
await waitFor(`${API}/ping`)

const shots: string[] = []
for (const step of sc.steps) {
  if ('wait' in step) await sleep(step.wait)
  else if ('input' in step) {
    const r = await fetch(`${API}/input`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: step.input }) })
    if (!r.ok) throw new Error(`input ${step.input} failed: ${r.status}`)
  } else {
    const png = new Uint8Array(await (await fetch(`${API}/screenshot/glasses`)).arrayBuffer())
    const file = join(out, `${name}-${step.shot}.png`)
    writeFileSync(file, png)
    shots.push(file)
  }
}
const log = (await (await fetch(`${API}/console`)).json()) as { entries: Array<{ level: string; message: string }> }
const lines = log.entries.filter((e) => !e.message.includes('ShadowTimers')).map((e) => `${e.level}\t${e.message}`)
writeFileSync(join(out, `${name}-console.txt`), lines.join('\n'))
// The simulator's own Tauri IPC sometimes falls back to postMessage at startup; that is not an app error.
const errors = lines.filter((l) => (l.startsWith('error') || l.includes('[uncaught]') || l.includes('[unhandledrejection]')) && !l.includes('http://ipc.localhost/'))
console.log(`${name}: ${shots.length} screenshots, ${lines.length} console lines, ${errors.length} errors → ${out}`)
if (errors.length) console.log(errors.join('\n'))
kill()
process.exit(errors.length ? 1 : 0)
