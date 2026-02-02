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
      headers: {
        "Content-Security-Policy":
          "default-src 'self'; base-uri 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' http: https: ws: wss:; frame-ancestors 'self'; object-src 'none'",
      },
      proxy: {
        "/api": `http://localhost:${expressPort}`,
        "^/auto_log": `http://localhost:${expressPort}`,
      },
    },
  }
})
