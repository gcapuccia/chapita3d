import * as Comlink from 'comlink'
import type { ApiGeometria } from './geometria.worker.ts'

/** Levanta el worker de geometria. Llamar a terminar() cuando ya no se use. */
export function crearClienteGeometria() {
  const worker = new Worker(new URL('./geometria.worker.ts', import.meta.url), {
    type: 'module',
    name: 'geometria',
  })
  return {
    api: Comlink.wrap<ApiGeometria>(worker),
    terminar: () => worker.terminate(),
  }
}
