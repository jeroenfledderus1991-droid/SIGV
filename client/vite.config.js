import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const configDir = dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolve(configDir, '..')
  const env = loadEnv(mode, repoRoot, '')
  const corsOrigin = env.CORS_ORIGIN || 'http://localhost:5173'
  const corsUrl = new URL(corsOrigin)
  const vitePort = Number(env.VITE_PORT || corsUrl.port || 5173)
  const expressPort = Number(env.EXPRESS_PORT || 5010)

  return {
    plugins: [react()],
    server: {
      port: vitePort,
      proxy: {
        "/api": `http://localhost:${expressPort}`,
      },
    },
  }
})
