// convertir(): de una imagen decodificada a regiones de color en mm (plan §3, pasos 1 a 9).
// TS puro: sin DOM, sin React. Corre igual en un worker, en Node o en un servidor.

import { cuantizar } from './cuantizar.ts'
import { trazar } from './contornos.ts'
import * as D from './defaults.ts'
import { limpiar } from './limpiar.ts'
import {
  cajaDeMascara,
  erosionar,
  mascaraPorAlfa,
  mascaraPorFloodFill,
  tieneAlfaUtil,
} from './mascara.ts'
import { mediana } from './prefiltro.ts'
import { reescalar, tamanoConTope } from './reescalar.ts'
import {
  FONDO,
  SIN_ASIGNAR,
  type ColorPaleta,
  type EtapaPipeline,
  type ImagenRGBA,
  type Recorte,
  type RegionTrazada,
} from './tipos.ts'

export type Preset = 'logo' | 'foto'

export type ParamsPipeline = {
  ladoMayorMm: number
  mmPorPixel: number
  ladoMaxPxPrevia: number
  umbralAlfa: number
  toleranciaFloodFill: number
  erosionAntiHalo: number
  radioPrefiltro: number
  colores: number
  muestraKmeans: number
  iteracionesKmeans: number
  corteKmeans: number
  fusionDeltaE2000: number
  areaMinimaIslaMm2: number
  anchoMinimoDetalleMm: number
  toleranciaRdpMm: number
  maxVerticesPorRegion: number
  semilla: number
  /**
   * Caja del dibujo en pixeles de la fuente. Si no se pasa, se detecta.
   * La calibracion de resolucion la fija para comparar resoluciones sobre el mismo encuadre.
   */
  caja?: Recorte
}

export function paramsPorDefecto(preset: Preset = 'logo'): ParamsPipeline {
  return {
    ladoMayorMm: D.LADO_MAYOR_MM,
    mmPorPixel: D.MM_POR_PIXEL,
    ladoMaxPxPrevia: D.LADO_MAX_PX_PREVIA,
    umbralAlfa: D.UMBRAL_ALFA,
    toleranciaFloodFill: D.TOLERANCIA_FLOOD_FILL,
    erosionAntiHalo: D.EROSION_ANTI_HALO,
    radioPrefiltro: D.RADIO_PREFILTRO[preset],
    colores: D.COLORES,
    muestraKmeans: D.MUESTRA_KMEANS,
    iteracionesKmeans: D.ITERACIONES_KMEANS,
    corteKmeans: D.CORTE_KMEANS,
    fusionDeltaE2000: D.FUSION_DELTA_E2000,
    areaMinimaIslaMm2: D.AREA_MINIMA_ISLA_MM2[preset],
    anchoMinimoDetalleMm: D.ANCHO_MINIMO_DETALLE_MM,
    toleranciaRdpMm: D.TOLERANCIA_RDP_MM,
    maxVerticesPorRegion: D.MAX_VERTICES_POR_REGION,
    semilla: D.SEMILLA_KMEANS,
  }
}

export type ResultadoConversion = {
  regiones: RegionTrazada[]
  paleta: ColorPaleta[]
  diagnostico: {
    tiemposMs: Record<EtapaPipeline, number>
    fuenteMascara: 'alfa' | 'floodFill'
    /** Encuadre usado, en pixeles de la fuente (la caja del dibujo mas un margen). */
    recorte: Recorte
    caja: Recorte
    ancho: number
    alto: number
    mmPorPixel: number
    /** Mapa de etiquetas final a resolucion de trabajo (FONDO = 255). */
    etiquetas: Uint8Array
    vertices: number
  }
}

/** Margen alrededor del dibujo: el flood fill del recorte necesita fondo en el borde. */
const MARGEN_RELATIVO = 0.03

export function convertir(fuente: ImagenRGBA, p: ParamsPipeline): ResultadoConversion {
  const tiemposMs = {} as Record<EtapaPipeline, number>
  const medir = <T>(etapa: EtapaPipeline, fn: () => T): T => {
    const t0 = performance.now()
    const r = fn()
    tiemposMs[etapa] = performance.now() - t0
    return r
  }

  // 1 · Previa con tope de tamaño, para encontrar el dibujo rapido
  const todo: Recorte = { x: 0, y: 0, ancho: fuente.ancho, alto: fuente.alto }
  const tamPrevia = tamanoConTope(fuente.ancho, fuente.alto, p.ladoMaxPxPrevia)
  const previa = medir('previa', () => reescalar(fuente, todo, tamPrevia.ancho, tamPrevia.alto))
  const usarAlfa = tieneAlfaUtil(previa, p.umbralAlfa)
  const mascaraDe = (img: ImagenRGBA) =>
    usarAlfa ? mascaraPorAlfa(img, p.umbralAlfa) : mascaraPorFloodFill(img, p.toleranciaFloodFill)

  // 2 · Donde esta el dibujo
  const caja =
    p.caja ??
    medir('mascaraPrevia', () => {
      const encontrada = cajaDeMascara(mascaraDe(previa), previa.ancho, previa.alto)
      if (!encontrada) throw new Error('No se encontró el dibujo: toda la imagen parece fondo.')
      const ex = fuente.ancho / previa.ancho
      const ey = fuente.alto / previa.alto
      return {
        x: encontrada.x * ex,
        y: encontrada.y * ey,
        ancho: encontrada.ancho * ex,
        alto: encontrada.alto * ey,
      }
    })

  // El lado mayor del dibujo mide ladoMayorMm: de ahi sale la escala
  const mmFuente = p.ladoMayorMm / Math.max(caja.ancho, caja.alto)
  const margen = Math.max(caja.ancho, caja.alto) * MARGEN_RELATIVO
  const x0 = Math.max(0, caja.x - margen)
  const y0 = Math.max(0, caja.y - margen)
  const recorte: Recorte = {
    x: x0,
    y: y0,
    ancho: Math.min(fuente.ancho, caja.x + caja.ancho + margen) - x0,
    alto: Math.min(fuente.alto, caja.y + caja.alto + margen) - y0,
  }
  const ancho = Math.max(1, Math.round((recorte.ancho * mmFuente) / p.mmPorPixel))
  const alto = Math.max(1, Math.round((recorte.alto * mmFuente) / p.mmPorPixel))
  const mmPorPixel = (recorte.ancho * mmFuente) / ancho

  const trabajo = medir('reescalar', () => reescalar(fuente, recorte, ancho, alto))

  // 2 y 3 · Mascara a resolucion de trabajo. La erosion anti-halo se usa SOLO para estimar los
  // colores: si achicara la geometria, todo llavero saldria 0,2 mm mas chico alrededor
  // (medido en F0.8: el anillo de logo-01 perdia justo perimetro × 1 px de area).
  const mascara = medir('mascara', () => mascaraDe(trabajo))
  const interior = erosionar(mascara, ancho, alto, p.erosionAntiHalo)

  // 4 · Mediana
  const filtrada = medir('prefiltro', () => mediana(trabajo, interior, p.radioPrefiltro))

  // 5 · k-means++ en OKLab
  const { paleta, etiquetas: crudas } = medir('cuantizar', () =>
    cuantizar(filtrada, interior, {
      colores: p.colores,
      muestra: p.muestraKmeans,
      iteraciones: p.iteracionesKmeans,
      corte: p.corteKmeans,
      fusionDeltaE2000: p.fusionDeltaE2000,
      semilla: p.semilla,
    }),
  )

  // El borde que saco la erosion vuelve como "sin asignar": la limpieza le da el color del
  // interior mas cercano, sin crear un color nuevo con el antialias
  for (let i = 0; i < mascara.length; i++)
    if (mascara[i] === 1 && crudas[i] === FONDO) crudas[i] = SIN_ASIGNAR

  // 7 · Limpieza (el paso 6, mapeo a filamentos, es de F1)
  const etiquetas = medir('limpiar', () =>
    limpiar(crudas, ancho, alto, paleta.length, {
      mmPorPixel,
      anchoMinimoDetalleMm: p.anchoMinimoDetalleMm,
      areaMinimaIslaMm2: p.areaMinimaIslaMm2,
    }),
  )

  // 8 y 9 · Contornos y simplificacion
  const regiones = medir('contornos', () =>
    trazar(etiquetas, ancho, alto, paleta, {
      mmPorPixel,
      toleranciaRdpMm: p.toleranciaRdpMm,
      maxVerticesPorRegion: p.maxVerticesPorRegion,
    }),
  )

  return {
    regiones,
    paleta,
    diagnostico: {
      tiemposMs,
      fuenteMascara: usarAlfa ? 'alfa' : 'floodFill',
      recorte,
      caja,
      ancho,
      alto,
      mmPorPixel,
      etiquetas,
      vertices: regiones.reduce((t, r) => t + r.contornos.reduce((s, a) => s + a.length, 0), 0),
    },
  }
}

export { FONDO }
export type { ColorPaleta, ImagenRGBA, Recorte, RegionTrazada }
