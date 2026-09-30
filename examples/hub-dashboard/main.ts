/**
 * hub-dashboard: quad dashboard. Swipe cycles focus between the four tiles
 * (two tile sends: old and new focus), tap drills into the focused chart
 * full-screen (tile spanning across four tiles), tap or hold goes back.
 * The KPI updates every 5 s: one tile send.
 *
 * Both views use the same full-screen layout (its four tiles are the four
 * panels), so switching views only redraws tiles: no page rebuild, no flicker,
 * and no exposure to the one-lens-after-rebuild issue seen on G2 glasses.
 */
import { defineComponent, type Component } from 'g2-kit/core'
import { BarChart, Gauge, Kpi, LineChart } from 'g2-kit/charts'
import { layouts } from 'g2-kit/bridge'
import { FocusRing } from 'g2-kit/input'
import { hudContentRect, renderHudFrame } from 'g2-kit/widgets'
import { start } from '../shared/phone'

const { g2, mirror } = await start()

// ── data ──
let users = 12840
let usersSpark = [11.2, 11.9, 11.4, 12.1, 12.6, 12.2, 12.84]
const steps = [6200, 8400, 4100, 9900, 7300, 12100, 3000].map((value, i) => ({ label: 'MTWTFSS'[i], value }))
const revenue = [12, 15, 14, 18, 22, 19, 25, 28, 26, 31, 29, 34]
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
let cpu = 42

type Chart = { title: string; component: Component<any>; props: () => unknown }
const charts: Chart[] = [
  { title: 'Steps', component: BarChart, props: () => ({ data: steps, highlight: 5, format: 'compact', peak: true }) },
  { title: 'Users', component: Kpi, props: () => ({ value: users, format: 'compact', delta: 0.042, deltaFormat: 'percent', spark: usersSpark }) },
  { title: 'Revenue', component: LineChart, props: () => ({ series: [{ values: revenue }], xLabels: months, format: { suffix: 'k' }, area: 'dots' }) },
  { title: 'CPU', component: Gauge, props: () => ({ value: cpu, unit: '%', thresholds: [80] }) },
]

/** A dashboard panel: HUD frame (brackets when focused) around a chart. */
const Panel = defineComponent<{ chart: Chart; focused: boolean }>('Panel', { w: 288, h: 144 }, (fb, rect, p, theme) => {
  const frame = { title: p.chart.title, style: p.focused ? ('brackets' as const) : ('box' as const), level: p.focused ? theme.levels.full : theme.levels.faint }
  renderHudFrame(fb, rect, frame, theme)
  p.chart.component.render(fb, hudContentRect(rect, frame, theme), p.chart.props(), theme)
})

const page = layouts.fullScreen({ menu: [{ id: 1, name: 'Refresh data' }] })
const keys = ['t0', 't1', 't2', 't3'] as const
let mode: 'dashboard' | 'detail' = 'dashboard'

const ring = new FocusRing(
  keys.map((k, i) => ({ id: k, activate: () => void openDetail(i) })),
  { onChange: () => drawDashboard() },
)

function drawDashboard(): void {
  if (mode !== 'dashboard') return
  keys.forEach((k, i) => g2.draw(k, Panel, { chart: charts[i], focused: ring.index === i }))
}

async function showDashboard(): Promise<void> {
  mode = 'dashboard'
  const how = await g2.show(page) // 'created' the first time, then 'reused'
  mirror.log(`dashboard (${how})`)
  drawDashboard()
}

async function openDetail(i: number): Promise<void> {
  mode = 'detail'
  await g2.show(page) // same layout: redraw only
  const chart = charts[i]
  // One logical 576×288 view spread over four tiles.
  g2.drawSpan(page.span, chart.component, { ...(chart.props() as object), title: `${chart.title}  (tap to go back)`, labels: 'normal' })
  mirror.log(`detail: ${chart.title}`)
}

g2.on('*', (e) => {
  if (mode === 'dashboard') {
    ring.handle(e)
    return
  }
  if (e.type === 'tap' || e.type === 'hold') void showDashboard()
})
g2.on('menu', () => {
  users = Math.round(users * 1.01)
  if (mode === 'dashboard') drawDashboard()
})

await showDashboard()

// Live KPI: changes one tile only.
setInterval(() => {
  users += Math.round((Math.random() - 0.3) * 200)
  usersSpark = [...usersSpark.slice(1), users / 1000]
  cpu = Math.max(5, Math.min(99, cpu + Math.round((Math.random() - 0.5) * 20)))
  if (mode === 'dashboard') {
    g2.draw('t1', Panel, { chart: charts[1], focused: ring.index === 1 })
    g2.draw('t3', Panel, { chart: charts[3], focused: ring.index === 3 })
  }
}, 5000)
