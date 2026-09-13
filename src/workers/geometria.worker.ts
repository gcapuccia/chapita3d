// Worker de geometria (plan §5.4). En F0.6 expone solo lo necesario para verificar que
// Manifold carga y rinde en un navegador real, incluido un celular: cargar, construir la
// pieza de prueba N veces y correr la prueba de fugas. En F1.4 se agrega construir(Diseno).

import * as Comlink from 'comlink'
import {
  cargarManifold,
  estadisticasManifold,
  memoriaWasmBytes,
  withScope,
} from '../geometria/manifold.ts'
import {
  cicloDeFugas,
  construirDePrueba,
  regionesDePrueba,
  type PiezaDePrueba,
} from '../geometria/pruebaDeCarga.ts'

const api = {
  async cargar() {
    const t0 = performance.now()
    await cargarManifold()
    return {
      ms: performance.now() - t0,
      memoriaBytes: memoriaWasmBytes(),
      aisladoCrossOrigin: self.crossOriginIsolated,
    }
  },

  construir(repeticiones: number, verticesPorContorno: number) {
    const regiones = regionesDePrueba(verticesPorContorno)
    const tiemposMs: number[] = []
    let piezas: PiezaDePrueba[] = []
    for (let i = 0; i < repeticiones; i++) {
      const t0 = performance.now()
      piezas = withScope((m) => construirDePrueba(m, regiones))
      tiemposMs.push(performance.now() - t0)
    }
    return {
      tiemposMs,
      piezas,
      memoriaBytes: memoriaWasmBytes(),
      objetosVivos: estadisticasManifold().vivos,
    }
  },

  fugas(ciclos: number, verticesPorContorno: number) {
    return cicloDeFugas(ciclos, verticesPorContorno)
  },
}

export type ApiGeometria = typeof api

Comlink.expose(api)
