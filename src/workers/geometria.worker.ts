// Worker de geometria (plan §5.4): construye el llavero y arma el ZIP.
// Tambien expone las pruebas de F0.6 para correrlas en el navegador y en el celular.

import * as Comlink from 'comlink'
import type { Diseno } from '../diseno/tipos.ts'
import type { IdFuente } from '../datos/fuentes.ts'
import { URL_FUENTE } from '../datos/fuentesUrl.ts'
import { empaquetar } from '../export/paquete.ts'
import { construir } from '../geometria/construir.ts'
import { fuenteRegistrada, registrarFuente } from '../geometria/texto.ts'
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

  /** Construye el llavero y, si no hay errores bloqueantes, arma el ZIP. Todo viaja por transferencia. */
  async construirLlavero(diseno: Diseno, fecha: string) {
    await cargarManifold()
    for (const p of diseno.piezas) {
      if (p.geometria.kind !== 'texto' || fuenteRegistrada(p.geometria.fuente)) continue
      const url = URL_FUENTE[p.geometria.fuente as IdFuente]
      if (!url) throw new Error(`No existe la fuente "${p.geometria.fuente}".`)
      registrarFuente(p.geometria.fuente, await (await fetch(url)).arrayBuffer())
    }
    const t0 = performance.now()
    const resultado = construir(diseno)
    const msConstruir = performance.now() - t0
    const t1 = performance.now()
    const paquete = resultado.bloqueante ? null : empaquetar(diseno, resultado, fecha)
    const msEmpaquetar = performance.now() - t1
    const buffers = [...resultado.piezas, resultado.entera].flatMap((p) => [
      p.vertices.buffer,
      p.indices.buffer,
    ])
    if (paquete) buffers.push(paquete.zip.buffer)
    return Comlink.transfer(
      { resultado, paquete, msConstruir, msEmpaquetar },
      buffers as ArrayBuffer[],
    )
  },
}

export type ApiGeometria = typeof api

Comlink.expose(api)
