// Carga representativa del paso de geometria, compartida por los tests (Node) y por
// la pagina de diagnostico (navegador y celular): la misma prueba en los dos lados.
//
// No es el llavero real (eso es F1.2): es el mismo TIPO de trabajo con un volumen de
// vertices parecido al que va a devolver el pipeline de imagen.

import { EPSILON_SOLAPE_XY } from '../pipeline/defaults.ts'
import {
  estadisticasManifold,
  memoriaWasmBytes,
  withScope,
  type ManifoldToplevel,
  type SimplePolygon,
} from './manifold.ts'
import { resolverSolapes, type RegionColor } from './regiones.ts'

/** Contorno "de blob" deterministico: un circulo con ondulaciones, como un trazado real. */
function blob(
  cx: number,
  cy: number,
  radio: number,
  ondas: number,
  amplitud: number,
  vertices: number,
): SimplePolygon {
  const puntos: SimplePolygon = []
  for (let i = 0; i < vertices; i++) {
    const t = (i / vertices) * Math.PI * 2
    const r =
      radio * (1 + amplitud * Math.sin(ondas * t) + amplitud * 0.3 * Math.sin(ondas * 3.1 * t))
    puntos.push([cx + r * Math.cos(t), cy + r * Math.sin(t)])
  }
  return puntos
}

/** 4 colores que se solapan entre si, uno con agujero. ~50 mm de ancho. */
export function regionesDePrueba(verticesPorContorno = 600): RegionColor[] {
  const n = verticesPorContorno
  return [
    { id: 'base', prioridad: 1, contornos: [blob(0, 0, 22, 5, 0.08, n)] },
    { id: 'rojo', prioridad: 3, contornos: [blob(-6, 4, 10, 7, 0.15, n)] },
    { id: 'negro', prioridad: 4, contornos: [blob(7, -3, 8, 9, 0.12, n)] },
    {
      id: 'blanco',
      prioridad: 2,
      contornos: [blob(0, -12, 7, 6, 0.1, n), blob(0, -12, 3, 4, 0.1, Math.max(8, n >> 2))],
    },
  ]
}

export type PiezaDePrueba = {
  id: string
  area: number
  volumen: number
  estado: string
  triangulos: number
}

/**
 * Cadena de resta → silueta → borde → extrusion → getMesh.
 * Llamar dentro de withScope(): devuelve solo datos planos.
 */
export function construirDePrueba(
  m: ManifoldToplevel,
  regiones: readonly RegionColor[],
  epsilon = EPSILON_SOLAPE_XY,
): PiezaDePrueba[] {
  const BASE = 2.4
  const COLOR = 0.6
  const BORDE = 2

  const resueltas = resolverSolapes(m, regiones, epsilon)
  const silueta = m.CrossSection.union(resueltas.map((r) => r.seccion))
  const contorno = silueta.offset(BORDE, 'Round')
  const base = contorno.extrude(BASE)

  const piezas: PiezaDePrueba[] = [
    {
      id: 'contorno',
      area: contorno.area(),
      volumen: base.volume(),
      estado: base.status(),
      triangulos: base.getMesh().triVerts.length / 3,
    },
  ]
  for (const r of resueltas) {
    if (r.seccion.isEmpty()) continue
    const solido = r.seccion.extrude(COLOR).translate([0, 0, BASE])
    piezas.push({
      id: r.id,
      area: r.seccion.area(),
      volumen: solido.volume(),
      estado: solido.status(),
      triangulos: solido.getMesh().triVerts.length / 3,
    })
  }
  return piezas
}

export type ResultadoFugas = {
  ciclos: number
  bytesAntes: number
  bytesDespues: number
  crecimientoBytes: number
  objetosCreados: number
  objetosVivos: number
  ms: number
}

/**
 * Prueba de fugas del plan (F0.6): N ciclos de crear → restar → extruir → getMesh → borrar.
 * Antes de medir hace un calentamiento: el allocator del WASM crece al principio y despues
 * se estabiliza, y eso no es una fuga.
 */
export function cicloDeFugas(ciclos: number, verticesPorContorno = 200): ResultadoFugas {
  const regiones = regionesDePrueba(verticesPorContorno)
  for (let i = 0; i < 20; i++) withScope((m) => void construirDePrueba(m, regiones))

  const bytesAntes = memoriaWasmBytes()
  const antes = estadisticasManifold()
  const t0 = performance.now()
  for (let i = 0; i < ciclos; i++) withScope((m) => void construirDePrueba(m, regiones))
  const despues = estadisticasManifold()

  return {
    ciclos,
    bytesAntes,
    bytesDespues: memoriaWasmBytes(),
    crecimientoBytes: memoriaWasmBytes() - bytesAntes,
    objetosCreados: despues.creados - antes.creados,
    objetosVivos: despues.vivos,
    ms: performance.now() - t0,
  }
}
