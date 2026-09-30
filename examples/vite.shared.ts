import { fileURLToPath } from 'node:url'
import { defineConfig, type UserConfig } from 'vite'

const src = (p: string) => fileURLToPath(new URL(`../src/${p}`, import.meta.url))

/** Examples import 'g2-kit/*' exactly like an app would; here it resolves to the source. */
export function exampleConfig(port: number): UserConfig {
  return defineConfig({
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
    server: { host: true, port, strictPort: true },
    build: { target: 'esnext' },
  })
}
