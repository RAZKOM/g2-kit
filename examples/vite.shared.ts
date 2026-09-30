import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin, type UserConfig } from 'vite'

const src = (p: string) => fileURLToPath(new URL(`../src/${p}`, import.meta.url))

/**
 * Dev server only: POST /__g2kit/results?name=<example> saves the body to
 * examples/output/results/<name>-<time>.txt, so results recorded on the phone
 * land on the PC. (A sideloaded page is plain http on a LAN address, where the
 * phone's clipboard API is unavailable.) See examples/shared/results.ts.
 */
function resultsEndpoint(): Plugin {
  const dir = fileURLToPath(new URL('./output/results/', import.meta.url))
  return {
    name: 'g2kit-results',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__g2kit/results', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const name = (new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? 'results').replace(/[^\w-]/g, '')
        let body = ''
        req.setEncoding('utf8')
        req.on('data', (chunk: string) => (body += chunk))
        req.on('end', () => {
          mkdirSync(dir, { recursive: true })
          const file = join(dir, `${name}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.txt`)
          writeFileSync(file, body)
          server.config.logger.info(`results saved → ${file}`)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ file }))
        })
      })
    },
  }
}

/** Examples import 'g2-kit/*' exactly like an app would; here it resolves to the source. */
export function exampleConfig(port: number): UserConfig {
  return defineConfig({
    plugins: [resultsEndpoint()],
    resolve: {
      alias: {
        'g2-kit/core': src('core/index.ts'),
        'g2-kit/bridge': src('bridge/index.ts'),
        'g2-kit/input': src('input/index.ts'),
        'g2-kit/charts': src('charts/index.ts'),
        'g2-kit/widgets': src('widgets/index.ts'),
        'g2-kit/icons': src('icons/index.ts'),
      },
    },
    // connect() loads the SDK with a dynamic import(). Declaring it here makes Vite bundle it when the dev
    // server starts; discovered at runtime instead, the import can fail with "Outdated Optimize Dep" (504)
    // and the page stays on "Connecting…".
    optimizeDeps: { include: ['@evenrealities/even_hub_sdk'] },
    server: { host: true, port, strictPort: true },
    build: { target: 'esnext' },
  })
}
