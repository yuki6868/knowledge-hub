import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const frontendRoot = dirname(fileURLToPath(import.meta.url))

// Vite normally reads .env.local from the current working directory.
// During development/deploy it is easy to start Vite from the repository root,
// so explicitly pin both the app root and env directory to frontend/.
export default defineConfig({
  root: frontendRoot,
  envDir: frontendRoot,
  plugins: [react()],
  build: {
    outDir: resolve(frontendRoot, 'dist'),
    emptyOutDir: true,
  },
})
