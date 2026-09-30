// The README quickstart, verbatim apart from the phone-side mirror wiring.
import { layouts } from 'g2-kit/bridge'
import { BarChart, Kpi } from 'g2-kit/charts'
import { start } from '../shared/phone'

const { g2 } = await start() // in an app: const g2 = await connect()

const data = await (await fetch('./stats.json')).json()
const page = layouts.twoTilesWithList({ items: ['Refresh', 'Details', 'Exit'] })
await g2.show(page)
g2.draw('left', BarChart, { title: 'Steps', data: data.days, format: 'compact', highlight: 5 })
g2.draw('right', Kpi, { label: 'Today', value: data.today, delta: data.delta, deltaFormat: 'percent' })
g2.on('select', (e) => {
  const item = page.capture.items![e.index]
  console.log(`[quickstart] selected ${item}`)
  if (item === 'Refresh') g2.draw('right', Kpi, { label: 'Today', value: data.today + 1, delta: data.delta, deltaFormat: 'percent' })
  if (item === 'Exit') void g2.exit()
})
