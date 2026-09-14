// Spike 08 · Metricas y vistas. Misma definicion que spikes/07-casos-reales/correr.ts (que no exporta
// nada: importarlo corre su main), mas las metricas del modo Lineas y la composicion lado a lado.

import { deltaE2000, hexARgb } from '../../src/pipeline/color.ts'
import { distanciaCuadrada } from '../../src/pipeline/morfologia.ts'
import { FONDO, type ImagenRGBA } from '../../src/pipeline/tipos.ts'
import { salidaEnFuente, type EscenaReal, type VerdadReal } from '../07-casos-reales/escenas.ts'
import { slotsUsados } from './colores.ts'
import { encerrados } from './morfologia2.ts'
import type { ResultadoV2 } from './pipeline2.ts'

const DE_ESPURIO = 15
/**
 * mm. Un pixel de salida a menos de esto del dibujo verdadero no hace "espurio" a su color: sin esto,
 * una linea de 0,4 mm engrosada a 1,5 mm tiene mayoria de pixeles de fondo y su color se descarta entero.
 * Se usa igual para todas las configuraciones (incluida hoy).
 */
export const TOL_MM = 0.6

export type Medida = {
  iou: number
  recall: number
  fp: number
  /** FP a mas de TOL_MM del dibujo verdadero: fondo que quedo como dibujo, sin contar el engrosado. */
  fpLejos: number
  iouColor: number
  colores: number
  slots: number
  piezas: number
  /** mm del lado mayor del dibujo VERDADERO con la escala que uso el pipeline. */
  ladoRealMm: number
  elementos: Record<string, number>
  ms: number
  casos: string[]
}

function piezas(etq: Uint8Array, ancho: number) {
  const visto = new Uint8Array(etq.length)
  const cola = new Int32Array(etq.length)
  let n = 0
  for (let s = 0; s < etq.length; s++) {
    if (visto[s] || etq[s] === FONDO) continue
    let fin = 0
    cola[fin++] = s
    visto[s] = 1
    for (let c = 0; c < fin; c++) {
      const i = cola[c]!
      const x = i % ancho
      for (const j of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
        if (j < 0 || j >= etq.length || visto[j] || etq[j] === FONDO) continue
        visto[j] = 1
        cola[fin++] = j
      }
    }
    n++
  }
  return n
}

export function medir(
  e: EscenaReal | null,
  v: VerdadReal | null,
  img: ImagenRGBA,
  r: ResultadoV2,
  ms: number,
): Medida {
  const d = r.diagnostico
  const salida = salidaEnFuente(d.etiquetas, d.ancho, d.alto, d.recorte, img.ancho, img.alto)
  const mmFuente = d.mmPorPixel * (d.ancho / d.recorte.ancho)
  const base = {
    colores: r.paleta.length,
    slots: slotsUsados(r.paleta),
    piezas: piezas(d.etiquetas, d.ancho),
    ms,
    casos: d.casos.map((c) => c.codigo),
    ladoRealMm: v ? Math.max(v.caja.ancho, v.caja.alto) * mmFuente : NaN,
  }
  if (!e || !v) {
    let inter = 0
    let union = 0
    for (let i = 0; i < salida.length; i++) {
      const o = i * 4
      const ref = Math.max(img.pixeles[o]!, img.pixeles[o + 1]!, img.pixeles[o + 2]!) > 40
      const out = salida[i] !== FONDO
      if (ref && out) inter++
      if (ref || out) union++
    }
    return {
      ...base,
      iou: union ? inter / union : 0,
      recall: NaN,
      fp: NaN,
      fpLejos: NaN,
      iouColor: NaN,
      elementos: {},
    }
  }
  const tolPx = TOL_MM / mmFuente
  const aDibujo = distanciaCuadrada((i) => v.etiquetas[i] !== FONDO, img.ancho, img.alto)
  const cerca = (i: number) => aDibujo[i]! <= tolPx * tolPx
  const deFondo = r.paleta.map(() => 0)
  const total = r.paleta.map(() => 0)
  for (let i = 0; i < salida.length; i++) {
    const out = salida[i]!
    if (out === FONDO) continue
    total[out]!++
    if (v.etiquetas[i] === FONDO && !cerca(i)) deFondo[out]!++
  }
  const aVerdad = r.paleta.map((p, k) => {
    if (total[k]! && deFondo[k]! / total[k]! > 0.5) return -1
    let mejor = -1
    let dMin = Infinity
    v.coloresEfectivos.forEach((hex, kk) => {
      const dd = deltaE2000(p.hex, hex)
      if (dd < dMin) {
        dMin = dd
        mejor = kk
      }
    })
    return dMin <= DE_ESPURIO ? mejor : -1
  })
  let tp = 0
  let fp = 0
  let fn = 0
  let fpLejos = 0
  let tpColor = 0
  const ok = e.elementos.map(() => 0)
  for (let i = 0; i < salida.length; i++) {
    const verdad = v.etiquetas[i]!
    const out = salida[i]!
    const esOut = out !== FONDO
    if (verdad !== FONDO && esOut) {
      tp++
      if (aVerdad[out] === verdad) {
        tpColor++
        ok[v.elementos[i]!]!++
      }
    } else if (esOut) {
      fp++
      if (!cerca(i)) fpLejos++
    } else if (verdad !== FONDO) fn++
  }
  const elementos: Record<string, number> = {}
  e.elementos.forEach((el, k) => {
    if (v.pixelesPorElemento[k]) elementos[el.id] = ok[k]! / v.pixelesPorElemento[k]!
  })
  return {
    ...base,
    iou: tp / (tp + fp + fn || 1),
    recall: tp / (tp + fn || 1),
    fp: fp / (tp + fp || 1),
    fpLejos: fpLejos / (tp + fp || 1),
    iouColor: tpColor / (tp + fp + fn || 1),
    elementos,
  }
}

export type MedidaLineas = {
  siluetaIoU: number
  /** Fraccion de la tinta de salida a mas de (grosor/2 + 0,3 mm) de cualquier tinta verdadera. */
  tintaLejos: number
  /** Por elemento de tinta (color oscuro de la verdad): % de sus pixeles que salio como tinta. */
  elementos: Record<string, number>
  ms: number
}

/** Modo Lineas: etiqueta 0 = tinta, 1 = base rellena. La verdad de "silueta" es la mascara con los huecos rellenos. */
export function medirLineas(
  e: EscenaReal,
  v: VerdadReal,
  img: ImagenRGBA,
  r: ResultadoV2,
  grosorMm: number,
  ms: number,
): MedidaLineas {
  const d = r.diagnostico
  const salida = salidaEnFuente(d.etiquetas, d.ancho, d.alto, d.recorte, img.ancho, img.alto)
  const n = img.ancho * img.alto
  const verdadMascara = new Uint8Array(n)
  for (let i = 0; i < n; i++) verdadMascara[i] = v.etiquetas[i] !== FONDO ? 1 : 0
  const huecos = encerrados(verdadMascara, img.ancho, img.alto)
  let inter = 0
  let union = 0
  for (let i = 0; i < n; i++) {
    const a = verdadMascara[i] || huecos[i]
    const b = salida[i] !== FONDO
    if (a && b) inter++
    if (a || b) union++
  }
  const tintaHex = r.paleta[0]!.hex
  const esTintaVerdad = v.coloresEfectivos.map((hex) => deltaE2000(hex, tintaHex) < 25)
  const verdadTinta = (i: number) => v.etiquetas[i] !== FONDO && esTintaVerdad[v.etiquetas[i]!]!
  const aTinta = distanciaCuadrada(verdadTinta, img.ancho, img.alto)
  const mmFuente = d.mmPorPixel * (d.ancho / d.recorte.ancho)
  const tolPx = (grosorMm / 2 + 0.3) / mmFuente
  let tinta = 0
  let lejos = 0
  const ok = e.elementos.map(() => 0)
  for (let i = 0; i < n; i++) {
    if (salida[i] === 0) {
      tinta++
      if (aTinta[i]! > tolPx * tolPx) lejos++
      if (v.elementos[i] !== 255) ok[v.elementos[i]!]!++
    }
  }
  const elementos: Record<string, number> = {}
  e.elementos.forEach((el, k) => {
    if (v.pixelesPorElemento[k] && esTintaVerdad[el.etiqueta])
      elementos[el.id] = ok[k]! / v.pixelesPorElemento[k]!
  })
  return {
    siluetaIoU: union ? inter / union : 0,
    tintaLejos: tinta ? lejos / tinta : 0,
    elementos,
    ms,
  }
}

// ------------------------------------------------------------------ vistas
/** Colores de la paleta; damero = fondo; base rellena (relleno) = blanco con rayado gris. */
export function vistaEtiquetas(r: ResultadoV2, baseComoRayado = true): ImagenRGBA {
  const { ancho, alto, etiquetas } = r.diagnostico
  const px = new Uint8ClampedArray(ancho * alto * 4)
  const cols = r.paleta.map((c) => hexARgb(c.hex))
  const relleno = r.extra.relleno
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      const e = etiquetas[i]!
      const damero = ((x >> 4) + (y >> 4)) % 2 ? 255 : 225
      let c: number[]
      if (e !== FONDO) {
        c = [...cols[e]!]
        if (baseComoRayado && relleno?.[i] && (x + y) % 8 < 2) c = [200, 200, 200]
      } else if (relleno?.[i]) c = (x + y) % 8 < 2 ? [200, 200, 200] : [255, 255, 255]
      else c = [damero, 160, damero]
      px.set([...c, 255], i * 4)
    }
  return { ancho, alto, pixeles: px }
}

/** Sobre la fuente: verde = bien, rojo = fondo que quedo como dibujo, azul = dibujo perdido. */
export function vistaMascara(img: ImagenRGBA, r: ResultadoV2, v: VerdadReal | null): ImagenRGBA {
  const d = r.diagnostico
  const salida = salidaEnFuente(d.etiquetas, d.ancho, d.alto, d.recorte, img.ancho, img.alto)
  const px = new Uint8ClampedArray(img.pixeles.length)
  for (let i = 0; i < salida.length; i++) {
    const o = i * 4
    const g = 0.3 * img.pixeles[o]! + 0.59 * img.pixeles[o + 1]! + 0.11 * img.pixeles[o + 2]!
    const out = salida[i] !== FONDO
    const verdad = v ? v.etiquetas[i] !== FONDO : out
    let c: number[]
    if (out && verdad)
      c = v
        ? [g * 0.4, 110 + g * 0.55, g * 0.4]
        : [img.pixeles[o]!, img.pixeles[o + 1]!, img.pixeles[o + 2]!]
    else if (out) c = [200 + g * 0.2, 30, 30]
    else if (verdad) c = [30, 60, 230]
    else c = [60 + g * 0.3, 60 + g * 0.3, 60 + g * 0.3]
    px.set([...c, 255], o)
  }
  return { ancho: img.ancho, alto: img.alto, pixeles: px }
}

/** Pega imagenes en fila a la misma altura (vecino mas cercano), con 12 px de separacion. */
export function ladoALado(imgs: ImagenRGBA[], alto: number): ImagenRGBA {
  const escaladas = imgs.map((im) => {
    const ancho = Math.round((im.ancho * alto) / im.alto)
    const px = new Uint8ClampedArray(ancho * alto * 4)
    for (let y = 0; y < alto; y++) {
      const sy = Math.min(im.alto - 1, Math.floor((y * im.alto) / alto))
      for (let x = 0; x < ancho; x++) {
        const sx = Math.min(im.ancho - 1, Math.floor((x * im.ancho) / ancho))
        px.set(
          im.pixeles.subarray((sy * im.ancho + sx) * 4, (sy * im.ancho + sx) * 4 + 4),
          (y * ancho + x) * 4,
        )
      }
    }
    return { ancho, px }
  })
  const sep = 12
  const total = escaladas.reduce((s, e) => s + e.ancho, 0) + sep * (imgs.length - 1)
  const px = new Uint8ClampedArray(total * alto * 4).fill(255)
  let x0 = 0
  for (const e of escaladas) {
    for (let y = 0; y < alto; y++)
      px.set(e.px.subarray(y * e.ancho * 4, (y + 1) * e.ancho * 4), (y * total + x0) * 4)
    x0 += e.ancho + sep
  }
  return { ancho: total, alto, pixeles: px }
}
