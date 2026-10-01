/**
 * Gallery samples: every component with sample data. Shared by the gallery
 * script (PNG contact sheet) and the smoke/snapshot tests.
 */
import type { Component, Size, TextComponent } from '../../src/core/index.js'
import * as C from '../../src/charts/index.js'
import * as W from '../../src/widgets/index.js'

export interface Sample {
  id: string
  title: string
  group: 'charts' | 'controls' | 'text & chrome' | 'data faces' | 'game' | 'legend'
  priority: 'P0' | 'P1' | 'P2'
  component: Component<any>
  props: unknown
  size?: Size
  note?: string
}

const s = <P,>(id: string, title: string, group: Sample['group'], priority: Sample['priority'], component: Component<P>, props: P, size?: Size, note?: string): Sample => ({
  id,
  title,
  group,
  priority,
  component,
  props,
  size,
  note,
})

const week = [
  { label: 'M', value: 6200 },
  { label: 'T', value: 8400 },
  { label: 'W', value: 4100 },
  { label: 'T', value: 9900 },
  { label: 'F', value: 7300 },
  { label: 'S', value: 12100 },
  { label: 'S', value: 3000 },
]
const revenue = [12, 15, 14, 18, 22, 19, 25, 28, 26, 31, 29, 34]
const lastYear = [10, 11, 13, 12, 14, 16, 15, 17, 19, 18, 20, 22]
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const SAMPLES: Sample[] = [
  // ── charts P0 ──
  s('bar-vertical', 'Bar chart', 'charts', 'P0', C.BarChart, { title: 'Steps / day', data: week, highlight: 5, peak: true, format: 'compact' }),
  s('bar-negative', 'Bar chart: negatives', 'charts', 'P0', C.BarChart, { title: 'Net flow', data: [3, -2, 5, -4, 1, 6], categories: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'] }),
  s('bar-horizontal', 'Bar chart: horizontal', 'charts', 'P0', C.BarChart, {
    title: 'Languages',
    orientation: 'horizontal',
    data: [
      { label: 'TypeScript', value: 48 },
      { label: 'Rust', value: 21 },
      { label: 'Go', value: 14 },
      { label: 'Python', value: 9 },
    ],
    highlight: 0,
    format: { suffix: '%' },
  }),
  s('bar-dense', 'Bar chart: 24 bars, sparse labels', 'charts', 'P0', C.BarChart, {
    title: 'Load by hour',
    data: Array.from({ length: 24 }, (_, i) => Math.round(50 + 40 * Math.sin(i / 3))),
    categories: Array.from({ length: 24 }, (_, i) => String(i)),
    fill: 'hatch',
    highlight: 14,
  }),
  s('line-two-series', 'Line chart: 2 series', 'charts', 'P0', C.LineChart, {
    title: 'Revenue',
    series: [
      { name: 'This year', values: revenue },
      { name: 'Last year', values: lastYear },
    ],
    xLabels: months,
    annotateMinMax: true,
    area: 'dots',
    format: { suffix: 'k' },
  }),
  s('line-single', 'Line chart: long series', 'charts', 'P0', C.LineChart, {
    title: 'Heart rate',
    series: Array.from({ length: 40 }, (_, i) => 70 + Math.round(15 * Math.sin(i / 5) + (i % 7))),
    xLabels: Array.from({ length: 40 }, (_, i) => (i === 0 ? '6am' : i === 39 ? 'now' : '')),
  }),
  s('line-three', 'Line chart: 3 series + gaps', 'charts', 'P0', C.LineChart, {
    series: [
      { values: [5, 7, 6, 9, 8, 11, 10] },
      { values: [3, 4, null, 6, 7, 6, 8] },
      { values: [1, 2, 2, 3, 5, 4, 6] },
    ],
    labels: 'normal',
    xLabels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  }),
  s('sparkline', 'Sparkline', 'charts', 'P0', C.Sparkline, { values: revenue, band: [15, 25] }, { w: 128, h: 28 }),
  s('sparkline-small', 'Sparkline: 16 px', 'charts', 'P0', C.Sparkline, { values: lastYear, extremes: true }, { w: 96, h: 16 }),
  s('kpi', 'KPI / big number', 'charts', 'P0', C.Kpi, { label: 'Active users', value: 12840, format: 'compact', delta: 0.042, deltaFormat: 'percent', footnote: 'vs last week', spark: revenue }),
  s('kpi-segment', 'KPI: 7-segment', 'charts', 'P0', C.Kpi, { label: 'Temp', value: '21.5', unit: '°C', delta: -1.2, style: 'segment' }, { w: 144, h: 144 }),
  s('kpi-plain', 'KPI: bad delta', 'charts', 'P0', C.Kpi, { label: 'Latency', value: 182, unit: 'ms', delta: 34, good: 'down', align: 'center' }, { w: 288, h: 96 }),
  s('gauge', 'Gauge: semicircle', 'charts', 'P0', C.Gauge, { value: 63, label: 'Battery', unit: '%', thresholds: [20, 50] }),
  s('gauge-dial', 'Gauge: 270° dial', 'charts', 'P0', C.Gauge, { value: 72, label: 'CPU', unit: '%', thresholds: [80] }, { w: 144, h: 144 }),
  s('gauge-needle', 'Gauge: needle', 'charts', 'P0', C.Gauge, { value: 30, style: 'needle', label: 'Speed', max: 50 }, { w: 144, h: 144 }),
  s('chart-empty', 'Chart state: empty', 'charts', 'P0', C.BarChart, { title: 'Sales', data: [], message: 'No sales yet' }),
  s('chart-error', 'Chart state: error', 'charts', 'P0', C.LineChart, { title: 'Weather', series: [], state: 'error', message: 'Offline: showing nothing' }),

  // ── charts P1 ──
  s('bars-grouped', 'Grouped bars', 'charts', 'P1', C.MultiBarChart, {
    title: 'Sleep vs goal',
    series: [
      { name: 'Sleep', values: [6.5, 7.2, 5.9, 8.1, 7.0] },
      { name: 'Goal', values: [8, 8, 8, 8, 8] },
    ],
    categories: ['M', 'T', 'W', 'T', 'F'],
    valueLabels: false,
  }),
  s('bars-stacked', 'Stacked bars', 'charts', 'P1', C.MultiBarChart, {
    title: 'Time by app (h)',
    mode: 'stacked',
    series: [
      { name: 'Work', values: [5, 6, 4, 7, 5, 1, 0] },
      { name: 'Chat', values: [1, 2, 1, 1, 2, 1, 1] },
      { name: 'Media', values: [1, 1, 2, 1, 2, 4, 3] },
    ],
    categories: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  }),
  s('donut', 'Donut', 'charts', 'P1', C.PieChart, {
    slices: [
      { label: 'Rent', value: 1200 },
      { label: 'Food', value: 450 },
      { label: 'Travel', value: 220 },
      { label: 'Other', value: 330 },
    ],
  }),
  s('pie-outside', 'Pie: outside labels', 'charts', 'P1', C.PieChart, {
    slices: [
      { label: 'Yes', value: 62 },
      { label: 'No', value: 28 },
      { label: '?', value: 10 },
    ],
    donut: 0,
    labelMode: 'outside',
  }),
  s('rings', 'Progress rings', 'charts', 'P1', C.ProgressRings, {
    rings: [
      { label: 'Move', value: 420, max: 500 },
      { label: 'Exercise', value: 0.8 },
      { label: 'Stand', value: 0.5 },
    ],
  }),
  s('heatmap', 'Heatmap 7×24', 'charts', 'P1', C.Heatmap, {
    title: 'Commits by hour',
    values: Array.from({ length: 7 }, (_, r) => Array.from({ length: 24 }, (_, c) => (c < 7 ? 0 : Math.round(((Math.sin(c / 3 + r) + 1) * 5 * (r < 5 ? 1 : 0.3)))))),
    rowLabels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    colLabels: Array.from({ length: 24 }, (_, i) => String(i)),
    encoding: 'both',
    highlight: [2, 15],
  }),
  s('calendar-heatmap', 'Calendar heatmap', 'charts', 'P1', C.CalendarHeatmap, {
    title: 'Workouts',
    days: Array.from({ length: 140 }, (_, i) => ((i * 37) % 11 > 6 ? ((i * 13) % 5) + 1 : 0)),
    end: new Date(2026, 8, 29),
  }),
  s('funnel', 'Funnel', 'charts', 'P1', C.Funnel, {
    stages: [
      { label: 'Visits', value: 12000 },
      { label: 'Sign-ups', value: 3100 },
      { label: 'Trials', value: 1400 },
      { label: 'Paid', value: 420 },
    ],
    format: 'compact',
  }),
  s('bullet', 'Bullet chart', 'charts', 'P1', C.BulletChart, { label: 'Revenue', value: 270, target: 250, ranges: [150, 225, 300], format: { suffix: 'k' } }, { w: 288, h: 36 }),
  s('timeline', 'Event timeline', 'charts', 'P1', C.Timeline, {
    start: 8,
    end: 18,
    now: 13.5,
    events: [
      { at: 9, end: 10.5, label: 'Standup', lane: 0 },
      { at: 11, end: 12, label: 'Review', lane: 1 },
      { at: 14, end: 16, label: 'Focus', lane: 0 },
      { at: 12.5, label: 'Lunch', lane: 1, marker: 'dot' },
    ],
    ticks: [[8, '8:00'], [12, '12:00'], [18, '18:00']],
  }),
  s('legend-series', 'Legend: series encodings', 'legend', 'P1', C.Legend, {
    items: [
      { label: 'Solid / dot', dash: 'solid', marker: 'dot' },
      { label: 'Dashed / square', dash: 'dashed', marker: 'square' },
      { label: 'Dotted / triangle', dash: 'dotted', marker: 'triangle' },
      { label: 'Hatch fill', paint: { pattern: 'hatch', level: 15 } },
      { label: 'Dots fill', paint: { pattern: 'dots', level: 15 } },
      { label: 'Cross-hatch fill', paint: { pattern: 'crossHatch', level: 15 } },
    ],
  }),
  s('legend-marks', 'Legend: cell marks (key page)', 'legend', 'P1', C.Legend, {
    items: [
      { label: 'Right spot', mark: 'filled', glyph: 'A' },
      { label: 'Wrong spot', mark: 'ring', glyph: 'B' },
      { label: 'Not in word', mark: 'strike', glyph: 'C' },
    ],
    large: true,
    valign: 'middle',
  }),

  // ── controls P0 ──
  s('carousel-letters', 'Carousel: letters', 'controls', 'P0', W.Carousel, { items: ['DEL', 'ENTER', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'], index: 5 }),
  s('carousel-words', 'Carousel: words, no wrap', 'controls', 'P0', W.Carousel, { items: ['Coffee', 'Tea', 'Water', 'Juice', 'Soda'], index: 1, wrap: false }),
  s('carousel-icons', 'Carousel: icons', 'controls', 'P0', W.Carousel, { items: [{ icon: 'home' }, { icon: 'music' }, { icon: 'clock' }, { icon: 'gear' }, { icon: 'mail' }, { icon: 'search' }], index: 2 }),
  s('carousel-vertical', 'Carousel: vertical', 'controls', 'P0', W.Carousel, { items: ['5 min', '10 min', '15 min', '25 min', '45 min'], index: 3, orientation: 'vertical', wrap: false }, { w: 144, h: 144 }),
  s('button', 'Button: icon + label, focused', 'controls', 'P0', W.Button, { label: 'Refresh', icon: 'refresh', state: 'focused' }, { w: 120, h: 36 }),
  s('button-states', 'Button row: states', 'controls', 'P0', W.ButtonRow, {
    buttons: [{ label: 'Normal' }, { label: 'Focus' }, { label: 'Press' }, { label: 'On', active: true }, { label: 'Off', disabled: true }],
    focus: 1,
    pressed: 2,
  }, { w: 288, h: 44 }),
  s('button-row-icons', 'Button row: icons + pill', 'controls', 'P0', W.ButtonRow, {
    buttons: [{ icon: 'play', label: 'Play' }, { icon: 'pause' }, { icon: 'refresh', label: 'Again' }],
    focus: 0,
    variant: 'pill',
  }, { w: 288, h: 44 }),
  s('toggle-on', 'Toggle: on, focused', 'controls', 'P0', W.Toggle, { on: true, label: 'Wi-Fi', focused: true }),
  s('toggle-off', 'Toggle: off', 'controls', 'P0', W.Toggle, { on: false, label: 'Alerts' }),

  // ── text & chrome P0 ──
  s('progress', 'Progress bar', 'text & chrome', 'P0', W.ProgressBar, { value: 0.62, label: 'Download' }),
  s('progress-segmented', 'Progress: segmented', 'text & chrome', 'P0', W.ProgressBar, { value: 7, max: 10, segments: 10, label: 'Reps', valueText: '7/10' }),
  s('big-text', 'Big text: auto-fit', 'text & chrome', 'P0', W.BigText, { text: 'Turn left in 200 m' }),
  s('big-text-short', 'Big text: short', 'text & chrome', 'P0', W.BigText, { text: 'GO!' }, { w: 144, h: 96 }),

  // ── controls P1 ──
  s('segmented', 'Segmented control', 'controls', 'P1', W.SegmentedControl, { options: ['Day', 'Week', 'Month'], selected: 1, focused: true }),
  s('slider', 'Slider', 'controls', 'P1', W.Slider, { label: 'Brightness', value: 60, step: 10, focused: true }),
  s('slider-editing', 'Slider: edit mode', 'controls', 'P1', W.Slider, { label: 'Volume', value: 35, step: 5, editing: true }),
  s('slider-vertical', 'Slider: vertical', 'controls', 'P1', W.Slider, { label: 'Temp', value: 21, min: 16, max: 28, orientation: 'vertical', format: (v: number) => `${v}°` }, { w: 72, h: 144 }),
  s('roller-pin', 'Number roller: PIN', 'controls', 'P1', W.Roller, { columns: W.digitColumns('4071'), focus: 2, editing: true, label: 'Enter PIN' }, { w: 288, h: 120 }),
  s('time-picker', 'Time picker', 'controls', 'P1', W.TimePicker, { hours: 7, minutes: 30, focus: 1, label: 'Alarm', minuteStep: 5 }),
  s('date-picker', 'Date picker', 'controls', 'P1', W.DatePicker, { year: 2026, month: 9, day: 29, focus: 0, editing: true }),
  s('checklist', 'Checklist', 'controls', 'P1', W.Checklist, {
    items: [
      { label: 'Milk', done: true },
      { label: 'Eggs', done: true },
      { label: 'Coffee beans' },
      { label: 'Bread' },
      { label: 'Tomatoes' },
      { label: 'Olive oil' },
      { label: 'Basil' },
    ],
    focus: 2,
  }),
  s('status-keyboard', 'Status keyboard', 'controls', 'P1', W.StatusKeyboard, {
    marks: { A: 'filled', R: 'filled', E: 'ring', S: 'strike', T: 'strike', O: 'ring', L: 'strike', I: 'strike' },
    focus: 'N',
  }),
  s('grid-keyboard', 'ABC grid keyboard', 'controls', 'P1', W.GridKeyboard, { row: 1, col: 3, text: 'HELLO WOR' }),
  s('grid-keyboard-rows', 'T9 keyboard: row focus', 'controls', 'P1', W.GridKeyboard, { rows: W.T9_ROWS, row: 2, col: -1 }),
  s('keyboard', 'Keyboard: QWERTY, choosing a row', 'controls', 'P1', W.Keyboard, { layout: W.keyboardLayout(), group: 1 }),
  s('keyboard-key', 'Keyboard: key focus, shift once', 'controls', 'P1', W.Keyboard, { layout: W.keyboardLayout(), group: 0, key: 4, shift: 'once' }),
  s('keyboard-symbols', 'Keyboard: symbols layer', 'controls', 'P1', W.Keyboard, { layout: W.keyboardLayout(), view: 1, group: 3, key: 1 }),
  s('keyboard-abc-columns', 'Keyboard: ABC by columns, caps lock', 'controls', 'P1', W.Keyboard, {
    layout: W.keyboardLayout({ letters: 'abc', scan: 'columns', punctuation: '.,', actions: ['caps', 'symbols', 'space', 'delete', 'submit'], labels: { submit: 'Send' } }),
    group: 2,
    shift: 'lock',
  }),
  s('keyboard-side', 'Keyboard: symbols beside, two tiles', 'controls', 'P1', W.Keyboard, { layout: W.keyboardLayout({ panels: 'side' }), group: 2, key: 3 }, { w: 576, h: 144 }),
  s('keyboard-stack', 'Keyboard: symbols below, digits row', 'controls', 'P1', W.Keyboard, { layout: W.keyboardLayout({ panels: 'stack', digits: 'row', actions: ['shift', 'space', 'delete', 'cancel', 'submit'] }), group: 5, text: 'Hello, world' }, { w: 288, h: 288 }),

  // ── text & chrome P1 ──
  s('toast-info', 'Toast: info', 'text & chrome', 'P1', W.Toast, { text: 'Synced 3 new items', remaining: 0.6 }),
  s('toast-success', 'Toast: success', 'text & chrome', 'P1', W.Toast, { text: 'Saved', kind: 'success' }),
  s('toast-warning', 'Toast: warning', 'text & chrome', 'P1', W.Toast, { text: 'Battery low: 15%', kind: 'warning' }),
  s('toast-error', 'Toast: error', 'text & chrome', 'P1', W.Toast, { text: 'Upload failed. Retrying…', kind: 'error' }),
  s('modal', 'Modal / confirm', 'text & chrome', 'P1', W.Modal, { title: 'Delete note?', body: 'This removes it from all devices. It cannot be undone.', buttons: ['Cancel', 'Delete'], focus: 0, icon: 'trash' }),
  s('tabs', 'Tabs', 'text & chrome', 'P1', W.Tabs, { tabs: ['Today', 'Week', 'Month', 'Year'], active: 1 }),
  s('tabs-boxed', 'Tabs: boxed', 'text & chrome', 'P1', W.Tabs, { tabs: ['Map', 'List'], active: 0, variant: 'boxed' }, { w: 144, h: 24 }),
  s('dots', 'Pagination dots', 'text & chrome', 'P1', W.PaginationDots, { count: 5, active: 2 }),
  s('scroll', 'Scroll indicator', 'text & chrome', 'P1', W.ScrollIndicator, { total: 40, visible: 8, offset: 12 }, { w: 6, h: 144 }),
  s('status-bar', 'Status bar', 'text & chrome', 'P1', W.StatusBar, { time: '09:41', battery: 0.72, signal: 3, slots: [{ icon: 'bell', text: '2' }, { icon: 'music' }], title: 'Home' }),
  s('hud-brackets', 'HUD frame: brackets', 'text & chrome', 'P1', W.HudFrame, { title: 'Target', style: 'brackets' }),
  s('hud-notched', 'HUD frame: notched + bar title', 'text & chrome', 'P1', W.HudFrame, { title: 'System', style: 'notched', titleStyle: 'bar' }),
  s('ticker', 'Ticker (one frame)', 'text & chrome', 'P1', W.Ticker, { text: 'AAPL 232.1 +1.2%   MSFT 511.9 -0.4%   NVDA 184.2 +2.9%', offset: 40 }, undefined, 'Each frame is one image send (~350 ms on glasses).'),

  // ── data faces P1 ──
  s('clock', 'Analog clock', 'data faces', 'P1', W.AnalogClock, { hours: 10, minutes: 8, seconds: 36 }),
  s('clock-numbers', 'Analog clock: numbers', 'data faces', 'P1', W.AnalogClock, { hours: 3, minutes: 45, ticks: 'numbers', label: 'Tokyo' }),
  s('timer-ring', 'Timer ring (pomodoro)', 'data faces', 'P1', W.TimerRing, { remaining: 17 * 60 + 42, total: 25 * 60, label: 'Focus' }),
  s('compass', 'Compass strip', 'data faces', 'P1', W.CompassStrip, { heading: 62, markers: [{ bearing: 95 }, { bearing: 250 }] }),
  s('turn-right', 'Turn arrow: right', 'data faces', 'P1', W.TurnArrow, { direction: 'right', distance: '200 m', street: 'Main Street' }),
  s('turn-slight-left', 'Turn arrow: slight left', 'data faces', 'P1', W.TurnArrow, { direction: 'slightLeft', distance: '1.2 km', street: 'A7 north' }),
  s('turn-uturn', 'Turn arrow: U-turn', 'data faces', 'P1', W.TurnArrow, { direction: 'uturn', distance: '50 m' }),

  // ── game P1 ──
  s('board-wordle', 'Grid board: word game', 'game', 'P1', W.GridBoard, {
    cells: [
      [{ glyph: 'C', mark: 'strike' }, { glyph: 'R', mark: 'ring' }, { glyph: 'A', mark: 'filled' }, { glyph: 'N', mark: 'strike' }, { glyph: 'E', mark: 'ring' }],
      [{ glyph: 'B', mark: 'strike' }, { glyph: 'E', mark: 'filled' }, { glyph: 'A', mark: 'filled' }, { glyph: 'R', mark: 'filled' }, { glyph: 'D', mark: 'strike' }],
      [{ glyph: 'S', mark: 'focus' }, { glyph: 'P' }, null, null, null],
      [null, null, null, null, null],
    ],
  }),
  s('board-ttt', 'Grid board: tic-tac-toe', 'game', 'P1', W.GridBoard, {
    cells: [
      [{ glyph: 'X' }, { glyph: 'O' }, null],
      [null, { glyph: 'X' }, null],
      [{ glyph: 'O' }, null, null],
    ],
    focus: [2, 2],
  }),
  s('board-2048', 'Grid board: 2048', 'game', 'P1', W.GridBoard, {
    cells: [
      [{ glyph: '2' }, null, { glyph: '4' }, null],
      [{ glyph: '8', mark: 'ring' }, { glyph: '16', mark: 'ring' }, null, null],
      [{ glyph: '128', mark: 'filled' }, { glyph: '32', mark: 'ring' }, { glyph: '4' }, null],
      [{ glyph: '512', mark: 'filled' }, { glyph: '64', mark: 'ring' }, { glyph: '2' }, { glyph: '2' }],
    ],
    gap: 3,
  }),
  s('score-hud', 'Score HUD', 'game', 'P1', W.ScoreHud, { score: 1280, best: 4096, streak: 3, lives: { current: 2, max: 3 } }),
  s('score-hud-stack', 'Score HUD: stacked', 'game', 'P1', W.ScoreHud, { score: 42, best: 97, lives: { current: 3, max: 5 }, layout: 'stack' }, { w: 144, h: 96 }),

  // ── P2 ──
  s('waffle', 'Waffle chart', 'charts', 'P2', C.WaffleChart, { parts: [{ label: 'Done', value: 62 }, { label: 'Doing', value: 23 }, { label: 'Todo', value: 15 }] }),
  s('scatter', 'Scatter + trend', 'charts', 'P2', C.ScatterChart, {
    title: 'Sleep vs steps',
    series: [
      { points: [[4, 5.5], [6, 6.2], [7, 6.8], [9, 7.1], [10, 7.6], [12, 7.4], [13, 8.1], [8, 6.1], [5, 6.4]] },
      { points: [[3, 7.5], [5, 7.2], [6, 6.8], [9, 6.0], [11, 5.9]] },
    ],
    trend: true,
    xLabel: 'k steps',
  }),
  s('histogram', 'Histogram', 'charts', 'P2', C.Histogram, { title: 'Commute (min)', values: [22, 25, 31, 28, 24, 35, 41, 27, 26, 29, 33, 30, 23, 38, 45, 27, 29, 31, 26, 28], mark: 33 }),
  s('boxplot', 'Box plot', 'charts', 'P2', C.BoxPlot, { title: 'Response (ms)', boxes: [C.boxStats([120, 140, 150, 160, 180, 210, 260], 'API'), C.boxStats([60, 70, 75, 80, 95, 130], 'CDN'), C.boxStats([200, 260, 300, 340, 420, 600], 'DB')] }),
  s('candles', 'Candlestick', 'charts', 'P2', C.CandlestickChart, {
    title: 'ACME',
    candles: [
      { open: 10, high: 12, low: 9, close: 11.5, label: 'Mon' },
      { open: 11.5, high: 13, low: 11, close: 12.4 },
      { open: 12.4, high: 12.8, low: 10.5, close: 10.9 },
      { open: 10.9, high: 11.6, low: 10.2, close: 11.2 },
      { open: 11.2, high: 14, low: 11, close: 13.6, label: 'Fri' },
    ],
  }),
  s('table', 'Table', 'text & chrome', 'P2', W.Table, {
    columns: [{ label: 'Stop', weight: 2 }, { label: 'Line' }, { label: 'Min', align: 'right' }],
    rows: [['Central Station', 'U2', 3], ['Market Square', '14', 7], ['Harbour', 'S1', 12], ['Old Town Hall', '4', 15], ['University', 'U2', 21], ['Airport', 'S8', 34]],
    focus: 1,
    font: 'body',
  }),
  s('card', 'Card', 'text & chrome', 'P2', W.Card, { title: 'Heart rate', value: '72', icon: 'heart', footnote: 'resting', focused: true }),
  s('badges', 'Badges', 'text & chrome', 'P2', W.Badge, { text: 'LIVE', variant: 'solid', icon: 'record' }),
  s('spinner', 'Spinner (1 of 4 frames)', 'text & chrome', 'P2', W.Spinner, { frame: 1, label: 'Syncing' }, undefined, 'Each frame is one send; advance slowly.'),
  s('weather', 'Weather glyph', 'data faces', 'P2', W.WeatherGlyph, { condition: 'partly', temp: '18°', label: 'Berlin', hiLo: 'H 21°  L 12°' }),
  s('weather-rain', 'Weather glyph: rain', 'data faces', 'P2', W.WeatherGlyph, { condition: 'rain', temp: '9°' }, { w: 144, h: 72 }),
  s('rating', 'Rating stars', 'controls', 'P2', W.Rating, { value: 3.5, focused: true }),
  s('dice', 'Dice', 'game', 'P2', W.Dice, { values: [3, 6, 1, 5, 2], held: [false, true, false, true, false], focus: 2 }),
  s('health', 'Health bar', 'game', 'P2', W.HealthBar, { value: 64, max: 100, icon: 'heart' }),
]

/** Text components: strings for firmware text containers (no image send). Shown as text in the gallery. */
export interface TextSample {
  id: string
  title: string
  component: TextComponent<any>
  props: unknown
  note?: string
}

const ts = <P,>(id: string, title: string, component: TextComponent<P>, props: P, note?: string): TextSample => ({ id, title, component, props, note })

export const TEXT_SAMPLES: TextSample[] = [
  ts('text-spinner', 'Text spinner: arrows', W.TextSpinner, { frame: 1, label: 'Syncing' }, 'Frames ↑ ↗ → ↘ ↓ ↙ ← ↖; one text update per frame.'),
  ts('text-spinner-triangle', 'Text spinner: triangle', W.TextSpinner, { frame: 1, style: 'triangle', label: 'Loading' }),
  ts('text-spinner-ascii', 'Text spinner: ASCII', W.TextSpinner, { frame: 1, glyphs: 'ascii', label: 'Syncing' }),
  ts('text-progress', 'Text progress bar', W.TextProgress, { value: 0.4, label: 'Download' }),
  ts('text-progress-blocks', 'Text progress: blocks, eighth-cell precision', W.TextProgress, { value: 0.43, blocks: true, width: 12 }),
  ts('text-progress-count', 'Text progress: count', W.TextProgress, { value: 7, max: 10, width: 10, valueText: '7/10', label: 'Reps' }),
  ts('text-progress-ascii', 'Text progress: ASCII', W.TextProgress, { value: 0.4, label: 'Download', glyphs: 'ascii' }),
  ts('text-slider', 'Text slider', W.TextSlider, { label: 'Brightness', value: 60 }),
  ts('text-slider-focused', 'Text slider: focused', W.TextSlider, { label: 'Volume', value: 35, focused: true }),
  ts('text-slider-knob', 'Text slider: edit mode, knob style, one cell per step', W.TextSlider, { label: 'Volume', value: 40, step: 10, editing: true, editStyle: 'knob' }, 'editStyle: knob keeps the line still while editing.'),
  ts('text-slider-editing', 'Text slider: edit mode', W.TextSlider, { label: 'Temp', value: 21, min: 16, max: 28, editing: true, format: (v: number) => `${v}°C` }),
  ts('text-menu', 'Text menu', W.TextMenu, { items: ['Resume', 'New game', 'Settings', 'Quit'], focus: 1 }, 'The "fake buttons" pattern: a menu with no image.'),
  ts('text-menu-checks', 'Text menu: checks, 3 of 6 visible', W.TextMenu, { items: ['Milk', 'Eggs', 'Bread', 'Coffee', 'Basil', 'Tomatoes'], focus: 3, checked: [true, true, false, false, true, false], visible: 3 }),
  ts('text-toggle', 'Text toggle: on, focused', W.TextToggle, { on: true, label: 'Wi-Fi', focused: true }),
  ts('text-toggle-off', 'Text toggle: off', W.TextToggle, { on: false, label: 'Alerts' }),
  ts('text-hold', 'Text hold-to-confirm: idle', W.TextHold, { progress: 0, label: 'Hold to delete' }, 'Drive it from HoldToConfirm; ~10 updates/s as text vs ~2 as an image.'),
  ts('text-hold-holding', 'Text hold-to-confirm: holding', W.TextHold, { progress: 0.55, label: 'Hold to delete' }),
  ts('text-hold-done', 'Text hold-to-confirm: done', W.TextHold, { progress: 1, done: true, doneLabel: 'Deleted' }),
  ts('text-hold-ascii', 'Text hold-to-confirm: ASCII', W.TextHold, { progress: 0.55, label: 'Hold to delete', glyphs: 'ascii' }),
  ts('text-toast', 'Text toast: warning', W.TextToast, { message: 'Battery low', kind: 'warning' }, 'Kinds by shape: ▶ info, ● success, ▲ warning, ■ error.'),
  ts('text-toast-detail', 'Text toast: error with detail', W.TextToast, { message: 'Sync failed', kind: 'error', detail: 'Tap to retry' }),
  ts('text-toast-ascii', 'Text toast: ASCII', W.TextToast, { message: 'Saved', kind: 'success', glyphs: 'ascii' }),
  ts('text-status', 'Text status line', W.TextStatusLine, { items: ['12:45', { label: 'Steps', value: '8 214' }, { label: 'Bat', value: '82%' }] }),
  ts('text-readout', 'Text readout with delta', W.TextReadout, { label: 'Heart rate', value: 128, unit: 'bpm', delta: 4 }, 'Live values as text; pair with a tile drawn once.'),
  ts('text-readout-focused', 'Text readout: decimals, focused', W.TextReadout, { label: 'Pace', value: 5.25, unit: 'min/km', decimals: 2, delta: -0.1, focused: true }),
  ts('text-ticker', 'Text ticker', W.TextTicker, { text: 'Next: Standup in 5 min, room 4B. Then: design review at 11:00.', offset: 12, width: 32 }, 'A window that moves one character per update.'),
]
