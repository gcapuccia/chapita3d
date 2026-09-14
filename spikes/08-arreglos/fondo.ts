// Spike 08 · Arreglos 2, 3 y 8: fondo encerrado + degradado, caja sin motas y polaridad de Silueta.
//
// Fondo (causas #6 y #7): el flood fill desde el borde (mascara.ts) sigue siendo la primera pasada.
// La segunda:
//  1. Modelo del fondo: superficie cuadratica en OKLab (1, u, v, u², uv, v² por canal) ajustada por
//     minimos cuadrados recortados a un anillo del borde de la previa + lo que el flood fill ya saco.
//  2. Tolerancia adaptativa: 0,035 + 3σ del residuo del fondo, entre 0,05 y 0,10.
//  3. Todo pixel de dibujo a menos de esa tolerancia del fondo LOCAL es candidato; las componentes
//     de candidatos de area >= areaMinimaMm2 pasan a fondo, esten o no conectadas al borde.
//  4. Guarda "respetar la base": si el color medio de la componente se funde con la base (ΔE2000 < 5),
//     se deja como esta (hoy eso ya sale bien en el llavero y el banco tiene blancos de diseño adentro).
//  Lo que se saca y queda ENCERRADO se devuelve aparte como `relleno` (en la geometria seria la region
//  esBase de la auditoria, ④): si se dejara como fondo, el llavero tendria un agujero pasante.

import { deltaE2000, oklabARgb, rgbAHex, rgbAOklab } from '../../src/pipeline/color.ts'
import type { ImagenRGBA, Oklab, Recorte } from '../../src/pipeline/tipos.ts'
import { componentes, encerrados } from './morfologia2.ts'

export type ModeloFondo = {
  /** 3 × 6 coeficientes (L, a, b) sobre [1, u, v, u², uv, v²], con u, v en 0..1 de la FUENTE. */
  coef: Float64Array
  /** Desvio robusto del residuo (OKLab) de las muestras que quedaron. */
  sigma: number
  /** Fraccion de muestras que quedaron despues de recortar: < 0,5 = el borde es mayormente dibujo. */
  confianza: number
  /** Recorrido de L del modelo sobre la imagen (0 = fondo plano). */
  recorridoL: number
}

const base6 = (u: number, v: number, f: Float64Array) => {
  f[0] = 1
  f[1] = u
  f[2] = v
  f[3] = u * u
  f[4] = u * v
  f[5] = v * v
}

/** Resuelve A x = b (6 × 6) por eliminacion gaussiana con pivoteo parcial. */
function resolver(A: Float64Array, b: Float64Array): Float64Array {
  const n = 6
  const M = new Float64Array(A)
  const x = new Float64Array(b)
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r * n + c]!) > Math.abs(M[piv * n + c]!)) piv = r
    if (piv !== c) {
      for (let k = 0; k < n; k++) {
        const t = M[c * n + k]!
        M[c * n + k] = M[piv * n + k]!
        M[piv * n + k] = t
      }
      const t = x[c]!
      x[c] = x[piv]!
      x[piv] = t
    }
    const d = M[c * n + c]! || 1e-12
    for (let r = c + 1; r < n; r++) {
      const f = M[r * n + c]! / d
      if (!f) continue
      for (let k = c; k < n; k++) M[r * n + k]! -= f * M[c * n + k]!
      x[r]! -= f * x[c]!
    }
  }
  for (let c = n - 1; c >= 0; c--) {
    let s = x[c]!
    for (let k = c + 1; k < n; k++) s -= M[c * n + k]! * x[k]!
    x[c] = s / (M[c * n + c]! || 1e-12)
  }
  return x
}

export function evaluarModelo(m: ModeloFondo, u: number, v: number, destino: Float64Array) {
  const c = m.coef
  for (let k = 0; k < 3; k++) {
    const o = k * 6
    destino[k] =
      c[o]! +
      c[o + 1]! * u +
      c[o + 2]! * v +
      c[o + 3]! * u * u +
      c[o + 4]! * u * v +
      c[o + 5]! * v * v
  }
}

/**
 * @param previa imagen entera reducida
 * @param mascaraPrevia la de la primera pasada (1 = dibujo): lo que ya es fondo suma muestras
 */
export function ajustarModeloFondo(previa: ImagenRGBA, mascaraPrevia: Uint8Array): ModeloFondo {
  const { ancho, alto, pixeles } = previa
  const anilloPx = Math.max(2, Math.round(Math.max(ancho, alto) * 0.01))
  const idx: number[] = []
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++) {
      const enBorde = x < anilloPx || y < anilloPx || x >= ancho - anilloPx || y >= alto - anilloPx
      if (enBorde) idx.push(y * ancho + x)
    }
  // Muestras extra: fondo de la primera pasada, submuestreado a ~20 000
  let fondoPx = 0
  for (let i = 0; i < mascaraPrevia.length; i++) if (!mascaraPrevia[i]) fondoPx++
  const paso = Math.max(1, Math.floor(fondoPx / 20000))
  for (let i = 0, k = 0; i < mascaraPrevia.length; i++)
    if (!mascaraPrevia[i] && k++ % paso === 0) idx.push(i)

  const n = idx.length
  const lab = new Float32Array(n * 3)
  const U = new Float64Array(n)
  const V = new Float64Array(n)
  for (let s = 0; s < n; s++) {
    const i = idx[s]!
    rgbAOklab(pixeles[i * 4]!, pixeles[i * 4 + 1]!, pixeles[i * 4 + 2]!, lab, s * 3)
    U[s] = ((i % ancho) + 0.5) / ancho
    V[s] = (((i / ancho) | 0) + 0.5) / alto
  }
  const usar = new Uint8Array(n).fill(1)
  const f = new Float64Array(6)
  const pred = new Float64Array(3)
  const residuo = new Float64Array(n)
  const modelo: ModeloFondo = { coef: new Float64Array(18), sigma: 0, confianza: 1, recorridoL: 0 }
  for (let it = 0; it < 4; it++) {
    const A = new Float64Array(36)
    const B = [new Float64Array(6), new Float64Array(6), new Float64Array(6)]
    for (let s = 0; s < n; s++) {
      if (!usar[s]) continue
      base6(U[s]!, V[s]!, f)
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) A[r * 6 + c]! += f[r]! * f[c]!
        for (let k = 0; k < 3; k++) B[k]![r]! += f[r]! * lab[s * 3 + k]!
      }
    }
    // Un poco de regularizacion para que un borde corto no dispare los terminos cuadraticos
    for (let r = 1; r < 6; r++) A[r * 6 + r]! += 1e-3
    for (let k = 0; k < 3; k++) modelo.coef.set(resolver(A, B[k]!), k * 6)
    for (let s = 0; s < n; s++) {
      evaluarModelo(modelo, U[s]!, V[s]!, pred)
      residuo[s] = Math.hypot(
        lab[s * 3]! - pred[0]!,
        lab[s * 3 + 1]! - pred[1]!,
        lab[s * 3 + 2]! - pred[2]!,
      )
    }
    const orden = Float64Array.from(residuo).sort()
    const mediana = orden[n >> 1]!
    const corte = Math.max(0.03, mediana * 4)
    let quedan = 0
    for (let s = 0; s < n; s++) {
      usar[s] = residuo[s]! <= corte ? 1 : 0
      quedan += usar[s]!
    }
    modelo.sigma = 1.4826 * mediana
    modelo.confianza = quedan / n
  }
  let lMin = Infinity
  let lMax = -Infinity
  for (let gy = 0; gy <= 8; gy++)
    for (let gx = 0; gx <= 8; gx++) {
      evaluarModelo(modelo, gx / 8, gy / 8, pred)
      lMin = Math.min(lMin, pred[0]!)
      lMax = Math.max(lMax, pred[0]!)
    }
  modelo.recorridoL = lMax - lMin
  return modelo
}

export const toleranciaAdaptativa = (m: ModeloFondo) =>
  Math.min(0.1, Math.max(0.05, 0.035 + 3 * m.sigma))

export type ParamsFondo = {
  areaMinimaMm2: number
  mmPorPixel: number
  respetarBase: boolean
  hexBase: string
}

export type ResultadoFondo = {
  mascara: Uint8Array
  /** Lo que se saco y quedo encerrado por el dibujo: en el llavero va del color de la base. */
  relleno: Uint8Array
  pixelesSacados: number
  pixelesRelleno: number
  tolerancia: number
  componentesSacadas: number
  componentesRespetadas: number
}

/**
 * Segunda pasada sobre una imagen (la previa o la de trabajo) que cubre `recorte` de la fuente.
 * `mmPorPixel` solo se usa para el area minima (en la previa se pasa el equivalente).
 */
export function fondoEncerrado(
  img: ImagenRGBA,
  recorte: Recorte,
  fuente: { ancho: number; alto: number },
  mascara: Uint8Array,
  modelo: ModeloFondo,
  p: ParamsFondo,
): ResultadoFondo {
  const { ancho, alto, pixeles } = img
  const tol = toleranciaAdaptativa(modelo)
  const salida = new Uint8Array(mascara)
  const vacio = {
    mascara: salida,
    relleno: new Uint8Array(mascara.length),
    pixelesSacados: 0,
    pixelesRelleno: 0,
    tolerancia: tol,
    componentesSacadas: 0,
    componentesRespetadas: 0,
  }
  if (modelo.confianza < 0.5) return vacio
  const candidato = new Uint8Array(mascara.length)
  const lab = new Float32Array(3)
  const pred = new Float64Array(3)
  const sx = recorte.ancho / ancho
  const sy = recorte.alto / alto
  for (let y = 0; y < alto; y++) {
    const v = (recorte.y + (y + 0.5) * sy) / fuente.alto
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      if (!mascara[i]) continue
      const u = (recorte.x + (x + 0.5) * sx) / fuente.ancho
      evaluarModelo(modelo, u, v, pred)
      rgbAOklab(pixeles[i * 4]!, pixeles[i * 4 + 1]!, pixeles[i * 4 + 2]!, lab, 0)
      const d = Math.hypot(lab[0]! - pred[0]!, lab[1]! - pred[1]!, lab[2]! - pred[2]!)
      if (d < tol) candidato[i] = 1
    }
  }
  const minimoPx = p.areaMinimaMm2 / (p.mmPorPixel * p.mmPorPixel)
  let sacadas = 0
  let respetadas = 0
  let pixelesSacados = 0
  componentes(
    (i) => candidato[i] === 1,
    ancho,
    alto,
    false,
    (miembros) => {
      if (miembros.length < minimoPx) return
      if (p.respetarBase) {
        const suma = [0, 0, 0]
        for (const i of miembros) {
          rgbAOklab(pixeles[i * 4]!, pixeles[i * 4 + 1]!, pixeles[i * 4 + 2]!, lab, 0)
          suma[0]! += lab[0]!
          suma[1]! += lab[1]!
          suma[2]! += lab[2]!
        }
        const medio = suma.map((s) => s / miembros.length) as Oklab
        if (deltaE2000(rgbAHex(oklabARgb(medio)), p.hexBase) < 5) {
          respetadas++
          return
        }
      }
      sacadas++
      pixelesSacados += miembros.length
      for (const i of miembros) salida[i] = 0
    },
  )
  // Lo sacado que no toca el fondo de afuera queda encerrado: relleno de base
  const enc = encerrados(salida, ancho, alto)
  const relleno = new Uint8Array(mascara.length)
  let pixelesRelleno = 0
  for (let i = 0; i < relleno.length; i++)
    if (enc[i] && mascara[i]) {
      relleno[i] = 1
      pixelesRelleno++
    }
  return {
    mascara: salida,
    relleno,
    pixelesSacados,
    pixelesRelleno,
    tolerancia: tol,
    componentesSacadas: sacadas,
    componentesRespetadas: respetadas,
  }
}

/**
 * Arreglo 3 · Caja del dibujo sin motas: solo cuentan las componentes (8 vecinos) de al menos
 * `fraccion` del area de la mas grande.
 */
export function cajaSinMotas(
  mascara: Uint8Array,
  ancho: number,
  alto: number,
  fraccion = 0.01,
): { caja: Recorte | null; motas: number; componentes: number } {
  const comps: { n: number; x0: number; y0: number; x1: number; y1: number }[] = []
  componentes(
    (i) => mascara[i] === 1,
    ancho,
    alto,
    true,
    (miembros) => {
      let [x0, y0, x1, y1] = [ancho, alto, -1, -1]
      for (const i of miembros) {
        const x = i % ancho
        const y = (i / ancho) | 0
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
      comps.push({ n: miembros.length, x0, y0, x1, y1 })
    },
  )
  if (!comps.length) return { caja: null, motas: 0, componentes: 0 }
  const mayor = Math.max(...comps.map((c) => c.n))
  const quedan = comps.filter((c) => c.n >= mayor * fraccion)
  const x0 = Math.min(...quedan.map((c) => c.x0))
  const y0 = Math.min(...quedan.map((c) => c.y0))
  const x1 = Math.max(...quedan.map((c) => c.x1))
  const y1 = Math.max(...quedan.map((c) => c.y1))
  return {
    caja: { x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 },
    motas: comps.length - quedan.length,
    componentes: comps.length,
  }
}

/**
 * Arreglo 8 · Polaridad para Silueta: si el borde de la imagen es mas oscuro que el promedio, la tinta
 * es clara sobre oscuro y se invierte la imagen antes del umbral de Bradley-Roth (presets.ts:82).
 */
export function tintaClara(img: ImagenRGBA): boolean {
  const { ancho, alto, pixeles } = img
  const g = (i: number) =>
    0.299 * pixeles[i * 4]! + 0.587 * pixeles[i * 4 + 1]! + 0.114 * pixeles[i * 4 + 2]!
  const borde: number[] = []
  for (let x = 0; x < ancho; x++) borde.push(g(x), g((alto - 1) * ancho + x))
  for (let y = 1; y < alto - 1; y++) borde.push(g(y * ancho), g(y * ancho + ancho - 1))
  borde.sort((a, b) => a - b)
  const medianaBorde = borde[borde.length >> 1]!
  let suma = 0
  for (let i = 0; i < ancho * alto; i++) suma += g(i)
  return medianaBorde < suma / (ancho * alto)
}

export function invertir(img: ImagenRGBA): ImagenRGBA {
  const px = new Uint8ClampedArray(img.pixeles)
  for (let o = 0; o < px.length; o += 4) {
    px[o] = 255 - px[o]!
    px[o + 1] = 255 - px[o + 1]!
    px[o + 2] = 255 - px[o + 2]!
  }
  return { ancho: img.ancho, alto: img.alto, pixeles: px }
}
