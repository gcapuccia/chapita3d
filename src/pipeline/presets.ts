// Presets de entrada (plan §7.7) y los dos metodos de mascara que les faltaban al pipeline:
// umbral adaptativo para Silueta y clusters para Foto.

import { cuantizar } from './cuantizar.ts'
import * as D from './defaults.ts'
import type { ImagenRGBA } from './tipos.ts'
import { FONDO } from './tipos.ts'

export type NombrePreset = 'dibujo' | 'foto' | 'silueta'

/**
 * Lo que cambia cada preset. Diferencias con la tabla del plan (§7.7), resueltas con lo medido en F0.8:
 * - N: el plan pone 3 para Dibujo. Se deja en 4 porque con la fusion automatica de colores
 *   (ΔE2000 < 5) N funciona como tope: un logo de 3 colores sigue saliendo con 3, y uno de 4 no pierde uno.
 * - Tolerancia del flood fill: el plan pone 8 para Dibujo; se midio con 10 (logos y dibujos 10/10).
 */
export const PRESETS: Record<
  NombrePreset,
  { colores: number; radioPrefiltro: number; areaMinimaIslaMm2: number }
> = {
  dibujo: {
    colores: D.COLORES,
    radioPrefiltro: D.RADIO_PREFILTRO.logo,
    areaMinimaIslaMm2: D.AREA_MINIMA_ISLA_MM2.logo,
  },
  foto: {
    colores: D.COLORES,
    radioPrefiltro: D.RADIO_PREFILTRO.foto,
    areaMinimaIslaMm2: D.AREA_MINIMA_ISLA_MM2.foto,
  },
  silueta: {
    colores: 2,
    radioPrefiltro: D.RADIO_PREFILTRO.logo,
    areaMinimaIslaMm2: D.AREA_MINIMA_ISLA_MM2.estandar,
  },
}

/*
 * Seleccion automatica del preset: la regla del plan (§7.7, audit-01 §6.5) se descarto.
 * "≥ 85 % de los pixeles en 2 clusters → Silueta" manda ahi a cualquier logo sobre fondo blanco,
 * y en el banco eligio bien 8 de 15 (Silueta fallo en todas). En su lugar convertirAutomatico()
 * (index.ts) arranca con Dibujo y solo pasa a Foto si el diagnostico no encuentra el dibujo:
 * elige el mejor preset disponible en 14 de 15.
 */

/**
 * Silueta · umbral adaptativo de Bradley-Roth con imagen integral: un pixel es tinta si es
 * `t` % mas oscuro que el promedio de su vecindario. Aguanta sombras y papel desparejo.
 */
export function mascaraPorUmbralAdaptativo(
  img: ImagenRGBA,
  ventanaRelativa = 1 / 8,
  t = 0.15,
): Uint8Array {
  const { ancho, alto, pixeles } = img
  const gris = new Float64Array(ancho * alto)
  for (let i = 0; i < gris.length; i++) {
    gris[i] = 0.299 * pixeles[i * 4]! + 0.587 * pixeles[i * 4 + 1]! + 0.114 * pixeles[i * 4 + 2]!
  }
  const integral = new Float64Array((ancho + 1) * (alto + 1))
  for (let y = 0; y < alto; y++) {
    let fila = 0
    for (let x = 0; x < ancho; x++) {
      fila += gris[y * ancho + x]!
      integral[(y + 1) * (ancho + 1) + x + 1] = integral[y * (ancho + 1) + x + 1]! + fila
    }
  }
  const s = Math.max(3, Math.round(Math.max(ancho, alto) * ventanaRelativa)) >> 1
  const mascara = new Uint8Array(ancho * alto)
  for (let y = 0; y < alto; y++) {
    const y0 = Math.max(0, y - s)
    const y1 = Math.min(alto - 1, y + s)
    for (let x = 0; x < ancho; x++) {
      const x0 = Math.max(0, x - s)
      const x1 = Math.min(ancho - 1, x + s)
      const n = (x1 - x0 + 1) * (y1 - y0 + 1)
      const suma =
        integral[(y1 + 1) * (ancho + 1) + x1 + 1]! -
        integral[y0 * (ancho + 1) + x1 + 1]! -
        integral[(y1 + 1) * (ancho + 1) + x0]! +
        integral[y0 * (ancho + 1) + x0]!
      mascara[y * ancho + x] = gris[y * ancho + x]! * n <= suma * (1 - t) ? 1 : 0
    }
  }
  return mascara
}

export type Clusters = { etiquetas: Uint8Array; hex: string[]; tocanElBorde: number[] }

/** Foto · posteriza a `n` clusters (plan §7.2: 6). La interfaz deja tocar cuales son fondo. */
export function clustersDeFondo(img: ImagenRGBA, n = 6): Clusters {
  const todo = new Uint8Array(img.ancho * img.alto).fill(1)
  const r = cuantizar(img, todo, {
    colores: n,
    muestra: D.MUESTRA_KMEANS,
    iteraciones: D.ITERACIONES_KMEANS,
    corte: D.CORTE_KMEANS,
    fusionDeltaE2000: 0,
    semilla: D.SEMILLA_KMEANS,
  })
  // Sugerencia inicial: son fondo los clusters que ocupan mas de la mitad del borde de la imagen
  const enBorde = new Array<number>(r.paleta.length).fill(0)
  let perimetro = 0
  const contar = (i: number) => {
    const e = r.etiquetas[i]!
    if (e !== FONDO) enBorde[e]!++
    perimetro++
  }
  for (let x = 0; x < img.ancho; x++) {
    contar(x)
    contar((img.alto - 1) * img.ancho + x)
  }
  for (let y = 1; y < img.alto - 1; y++) {
    contar(y * img.ancho)
    contar(y * img.ancho + img.ancho - 1)
  }
  const orden = enBorde.map((c, k) => [c, k] as const).sort((a, b) => b[0] - a[0])
  const tocanElBorde: number[] = []
  let acumulado = 0
  for (const [c, k] of orden) {
    if (acumulado >= perimetro / 2) break
    tocanElBorde.push(k)
    acumulado += c
  }
  return { etiquetas: r.etiquetas, hex: r.paleta.map((p) => p.hex), tocanElBorde }
}

export function mascaraPorClusters(c: Clusters, clustersFondo: readonly number[]): Uint8Array {
  const fondo = new Set(clustersFondo)
  return c.etiquetas.map((e) => (fondo.has(e) ? 0 : 1))
}

/** Varianza del laplaciano sobre el gris: baja = imagen borrosa (plan §4.8 caso 2). */
export function varianzaLaplaciano(img: ImagenRGBA): number {
  const { ancho, alto, pixeles } = img
  const g = (x: number, y: number) => {
    const o = (y * ancho + x) * 4
    return 0.299 * pixeles[o]! + 0.587 * pixeles[o + 1]! + 0.114 * pixeles[o + 2]!
  }
  let suma = 0
  let suma2 = 0
  let n = 0
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const l = g(x - 1, y) + g(x + 1, y) + g(x, y - 1) + g(x, y + 1) - 4 * g(x, y)
      suma += l
      suma2 += l * l
      n++
    }
  }
  if (!n) return 0
  const media = suma / n
  return suma2 / n - media * media
}
