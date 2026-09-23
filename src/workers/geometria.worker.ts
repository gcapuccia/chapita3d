// Worker de geometria (plan §5.4): construye el llavero y arma el ZIP.
// Tambien expone las pruebas de F0.6 para correrlas en el navegador y en el celular.

import * as Comlink from 'comlink'
import type { Diseno } from '../diseno/tipos.ts'
import type { IdFuente } from '../datos/fuentes.ts'
import { URL_FUENTE } from '../datos/fuentesUrl.ts'
import { empaquetar } from '../export/paquete.ts'
import { aPiezaExport } from '../geometria/malla.ts'
import { contornosDeTexto } from '../geometria/texto.ts'
import type { SimplePolygon } from '../geometria/manifold.ts'
import { empaquetarSello } from '../export/paqueteSello.ts'
import { sello, type ParamsSello } from '../sellos/placas.ts'
import type { ParamsBisagra } from '../sellos/bisagra.ts'

/** Lo que hace falta para armar un sello: el dibujo (contornos o texto) y las medidas. */
export type PedidoSello = {
  nombre: string
  contornos?: SimplePolygon[]
  texto?: { texto: string; fuente: string }
  params: ParamsSello
  bisagra: ParamsBisagra
}
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

  /**
   * Construye el llavero y, si se pide y no hay errores bloqueantes, arma el ZIP. Todo viaja por
   * transferencia. El preview no pide el ZIP: empaquetar suma ~60 ms que no hacen falta hasta descargar.
   */
  async construirLlavero(diseno: Diseno, fecha: string, conZip = true) {
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
    const paquete = conZip && !resultado.bloqueante ? empaquetar(diseno, resultado, fecha) : null
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
  /** El sello de gofrar: las dos placas con su bisagra, y el ZIP si se pide. */
  async construirSello(pedido: PedidoSello, fecha: string, conZip = true) {
    await cargarManifold()
    let contornos = pedido.contornos
    if (pedido.texto) {
      const { fuente, texto } = pedido.texto
      if (!fuenteRegistrada(fuente)) {
        const url = URL_FUENTE[fuente as IdFuente]
        if (!url) throw new Error(`No existe la fuente "${fuente}".`)
        registrarFuente(fuente, await (await fetch(url)).arrayBuffer())
      }
      contornos = contornosDeTexto(fuente, texto, 40)
    }
    if (!contornos?.length) throw new Error('sin-dibujo')

    const t0 = performance.now()
    const resultado = withScope((m) => {
      const s = sello(m, contornos, pedido.params, pedido.bisagra)
      return {
        entero: aPiezaExport(m.Manifold.union([s.macho, s.hembra]), 'sello', 1),
        macho: aPiezaExport(s.macho, 'macho', 1),
        hembra: aPiezaExport(s.hembra, 'hembra', 2),
        medidas: s.medidas,
        logoMm: s.logoMm,
        avisos: s.avisos,
      }
    })
    const msConstruir = performance.now() - t0
    const paquete = conZip
      ? empaquetarSello(resultado, pedido.nombre, pedido.bisagra.holgura, fecha)
      : null
    const buffers = [resultado.entero, resultado.macho, resultado.hembra].flatMap((p) => [
      p.vertices.buffer,
      p.indices.buffer,
    ])
    if (paquete) buffers.push(paquete.zip.buffer)
    return Comlink.transfer({ resultado, paquete, msConstruir }, buffers as ArrayBuffer[])
  },
}

export type ApiGeometria = typeof api

Comlink.expose(api)
