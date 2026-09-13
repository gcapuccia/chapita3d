/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { licencias } from './scripts/vite-plugin-licencias.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), licencias()],
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
})
