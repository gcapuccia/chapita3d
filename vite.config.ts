/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { crearChequeoLicencias } from './scripts/vite-plugin-licencias.ts'

// Un solo registro para el build principal y el de los workers (se compilan por separado)
const licencias = crearChequeoLicencias()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), licencias.principal()],
  worker: {
    format: 'es',
    plugins: () => [licencias.worker()],
  },
  optimizeDeps: {
    // manifold-3d ubica su .wasm con new URL(..., import.meta.url): el pre-bundling lo rompe
    exclude: ['manifold-3d'],
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
})
