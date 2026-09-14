// Evaluacion del pipeline contra la verdad del banco sintetico, con criterios fijados ANTES
// de medir (plan F0.8: "medir, no estimar").

import { deltaE2000 } from '../../src/pipeline/color.ts'
import type { ResultadoConversion } from '../../src/pipeline/index.ts'
import { FONDO } from '../../src/pipeline/tipos.ts'
import { mascaraVerdadEn, type Escena, type Verdad } from './escenas.ts'

/** Criterios de "salio bien a la primera". Cambiarlos despues de ver los numeros es trampa. */
export const CRITERIOS = {
  /** Interseccion sobre union de la mascara contra la verdad. */
  iouMinima: 0.97,
  /** ΔE2000 maximo entre cada color de la verdad y el color que encontro el pipeline. */
  deltaEMaximo: 5,
  /** Error de area por color: vale el mayor de los dos margenes. */
  errorAreaRelativo: 0.05,
  errorAreaAbsolutoMm2: 1.5,
}

export type ColorEvaluado = {
  esperado: string
  obtenido: string | null
  deltaE: number
  areaEsperadaMm2: number
  areaObtenidaMm2: number
  errorArea: number
  ok: boolean
}

export type Evaluacion = {
  id: string
  categoria: Escena['categoria']
  expectativa: Escena['expectativa']
  iou: number
  coloresEsperados: number
  coloresObtenidos: number
  colores: ColorEvaluado[]
  exito: boolean
  motivos: string[]
}

/** Area neta de una region (los agujeros vienen con la orientacion opuesta). */
export function areaRegionMm2(contornos: [number, number][][]): number {
  let total = 0
  for (const anillo of contornos) {
    let a = 0
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      a += anillo[j]![0] * anillo[i]![1] - anillo[i]![0] * anillo[j]![1]
    }
    total += a / 2
  }
  return Math.abs(total)
}

export function evaluar(
  escena: Escena,
  verdad: Verdad,
  r: Pick<ResultadoConversion, 'regiones'> & {
    diagnostico: Pick<
      ResultadoConversion['diagnostico'],
      'recorte' | 'ancho' | 'alto' | 'etiquetas' | 'mmPorPixel'
    >
  },
  ladoMayorMm: number,
): Evaluacion {
  const motivos: string[] = []
  const d = r.diagnostico

  // Mascara
  const esperada = mascaraVerdadEn(escena, d.recorte, d.ancho, d.alto)
  let inter = 0
  let union = 0
  for (let i = 0; i < esperada.length; i++) {
    const a = esperada[i] === 1
    const b = d.etiquetas[i] !== FONDO
    if (a && b) inter++
    if (a || b) union++
  }
  const iou = union ? inter / union : 0
  if (iou < CRITERIOS.iouMinima)
    motivos.push(`máscara IoU ${iou.toFixed(3)} < ${CRITERIOS.iouMinima}`)

  // Colores: emparejamiento goloso por ΔE2000 creciente, uno a uno
  const mmFuente = ladoMayorMm / Math.max(verdad.caja.ancho, verdad.caja.alto)
  const esperados = escena.colores
    .map((_, k) => ({
      k,
      hex: verdad.coloresEfectivos[k]!,
      area: verdad.pixelesPorEtiqueta[k]! * mmFuente ** 2,
    }))
    .filter((c) => c.area > 0)
  const pares = esperados
    .flatMap((e) => r.regiones.map((reg, j) => ({ e, j, dE: deltaE2000(e.hex, reg.hex) })))
    .sort((a, b) => a.dE - b.dE)
  const usadoE = new Set<number>()
  const usadoR = new Set<number>()
  const emparejado = new Map<number, { j: number; dE: number }>()
  for (const par of pares) {
    if (usadoE.has(par.e.k) || usadoR.has(par.j)) continue
    usadoE.add(par.e.k)
    usadoR.add(par.j)
    emparejado.set(par.e.k, { j: par.j, dE: par.dE })
  }

  const colores = esperados.map((e): ColorEvaluado => {
    const m = emparejado.get(e.k)
    const region = m ? r.regiones[m.j]! : null
    const areaObtenida = region ? areaRegionMm2(region.contornos) : 0
    const errorArea = Math.abs(areaObtenida - e.area)
    const margen = Math.max(CRITERIOS.errorAreaRelativo * e.area, CRITERIOS.errorAreaAbsolutoMm2)
    const ok = !!m && m.dE <= CRITERIOS.deltaEMaximo && errorArea <= margen
    if (!m) motivos.push(`falta el color ${e.hex}`)
    else if (m.dE > CRITERIOS.deltaEMaximo)
      motivos.push(`${e.hex} salió como ${region!.hex} (ΔE ${m.dE.toFixed(1)})`)
    else if (errorArea > margen) {
      motivos.push(
        `${e.hex}: área ${areaObtenida.toFixed(1)} mm² contra ${e.area.toFixed(1)} esperada`,
      )
    }
    return {
      esperado: e.hex,
      obtenido: region?.hex ?? null,
      deltaE: m?.dE ?? Infinity,
      areaEsperadaMm2: e.area,
      areaObtenidaMm2: areaObtenida,
      errorArea: e.area ? errorArea / e.area : 0,
      ok,
    }
  })
  if (r.regiones.length > esperados.length) {
    motivos.push(`${r.regiones.length - esperados.length} color(es) de más`)
  }

  return {
    id: escena.id,
    categoria: escena.categoria,
    expectativa: escena.expectativa,
    iou,
    coloresEsperados: esperados.length,
    coloresObtenidos: r.regiones.length,
    colores,
    exito: motivos.length === 0,
    motivos,
  }
}

// ------------------------------------------------------------------ desviacion de contornos
type Segmento = [number, number, number, number]

/** Distancia de cada vertice de A al segmento mas cercano de B, con una grilla espacial. */
function distanciasAB(a: [number, number][][], b: [number, number][][], celda = 0.5): number[] {
  const grilla = new Map<string, Segmento[]>()
  const clave = (x: number, y: number) => `${Math.floor(x / celda)},${Math.floor(y / celda)}`
  for (const anillo of b) {
    for (let i = 0; i < anillo.length; i++) {
      const [x0, y0] = anillo[i]!
      const [x1, y1] = anillo[(i + 1) % anillo.length]!
      const s: Segmento = [x0, y0, x1, y1]
      const pasos = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / celda))
      const vistas = new Set<string>()
      for (let k = 0; k <= pasos; k++) {
        const c = clave(x0 + ((x1 - x0) * k) / pasos, y0 + ((y1 - y0) * k) / pasos)
        if (vistas.has(c)) continue
        vistas.add(c)
        const lista = grilla.get(c) ?? []
        lista.push(s)
        grilla.set(c, lista)
      }
    }
  }
  const distanciaASegmento = (px: number, py: number, [x0, y0, x1, y1]: Segmento) => {
    const lx = x1 - x0
    const ly = y1 - y0
    const l2 = lx * lx + ly * ly
    const t = l2 ? Math.max(0, Math.min(1, ((px - x0) * lx + (py - y0) * ly) / l2)) : 0
    return Math.hypot(px - x0 - t * lx, py - y0 - t * ly)
  }
  const salida: number[] = []
  for (const anillo of a) {
    for (const [px, py] of anillo) {
      const cx = Math.floor(px / celda)
      const cy = Math.floor(py / celda)
      let mejor = Infinity
      // Se abre la busqueda en anillos de celdas hasta que ya no puede aparecer nada mas cerca
      for (let radio = 0; radio < 200; radio++) {
        for (let dx = -radio; dx <= radio; dx++) {
          for (let dy = -radio; dy <= radio; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radio) continue
            for (const s of grilla.get(`${cx + dx},${cy + dy}`) ?? [])
              mejor = Math.min(mejor, distanciaASegmento(px, py, s))
          }
        }
        if (mejor <= radio * celda) break
      }
      salida.push(mejor)
    }
  }
  return salida
}

/** Desviacion simetrica entre dos juegos de contornos: maximo y percentil 95. */
export function desviacion(
  a: [number, number][][],
  b: [number, number][][],
): { maxima: number; p95: number } {
  const todas = [...distanciasAB(a, b), ...distanciasAB(b, a)].sort((x, y) => x - y)
  if (!todas.length) return { maxima: 0, p95: 0 }
  return { maxima: todas[todas.length - 1]!, p95: todas[Math.floor(todas.length * 0.95)]! }
}
