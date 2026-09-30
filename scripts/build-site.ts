/**
 * Builds the demo site (GitHub Pages) into site/:
 *   site/index.html        the component gallery with live-demo links
 *   site/demos/<name>/     each example, runnable in a browser with the mock host
 *
 *   npm run build:site && npx vite preview --outDir site
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const site = join(root, 'site')
rmSync(site, { recursive: true, force: true })
mkdirSync(site, { recursive: true })

const node = process.execPath
const tsx = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js')

execFileSync(node, [tsx, join(root, 'examples', 'gallery', 'render.ts'), site, '--site'], { stdio: 'inherit', cwd: root })

const DEMOS = { quickstart: 'hub-quickstart', dashboard: 'hub-dashboard', picker: 'hub-picker', keyboard: 'hub-keyboard', game: 'hub-game', calibrate: 'hub-calibrate' }
for (const [name, dir] of Object.entries(DEMOS)) {
  execFileSync(node, [vite, 'build', join('examples', dir), '--base', './', '--outDir', join(site, 'demos', name), '--emptyOutDir', '--logLevel', 'warn'], { stdio: 'inherit', cwd: root })
  console.log(`site/demos/${name}`)
}
// GitHub Pages: serve files as-is.
writeFileSync(join(site, '.nojekyll'), '')
console.log('site ready → site/')
