import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  defineWorkersConfig,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(root, 'migrations'))

  return {
    test: {
      include: ['worker/**/*.test.ts', 'functions/**/*.test.ts'],
      setupFiles: ['./worker/test-setup.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.jsonc' },
          miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
        },
      },
    },
  }
})
