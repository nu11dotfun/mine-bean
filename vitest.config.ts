import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['components/**', 'lib/**', 'app/**'],
      exclude: ['**/*.d.ts', 'lib/abis/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // The privacy-pools SDK's ESM build has a node-only `import("fs")`
      // branch that vite cannot resolve under jsdom; tests use the browser
      // path only.
      fs: path.resolve(__dirname, 'test/stubs/fs.ts'),
    },
  },
})
