import * as Comlink from 'comlink'
import type { ApiGeometria } from './geometria.worker.ts'
import type { ApiImagen } from './imagen.worker.ts'

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

/** Levanta el worker de imagen. */
export function crearClienteImagen() {
  const worker = new Worker(new URL('./imagen.worker.ts', import.meta.url), {
    type: 'module',
    name: 'imagen',
  })
  return { api: Comlink.wrap<ApiImagen>(worker), terminar: () => worker.terminate() }
}

/**
 * Token de generacion (plan §5.4, regla 2): si el usuario cambia algo mientras corre un calculo,
 * el resultado viejo se descarta al llegar. envolver(p) resuelve solo si nadie pidio otro despues.
 */
export function crearGeneracion() {
  let actual = 0
  return {
    envolver<T>(promesa: Promise<T>): Promise<T | null> {
      const mia = ++actual
      return promesa.then((valor) => (mia === actual ? valor : null))
    },
  }
}
