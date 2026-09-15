// convertir(): de una imagen decodificada a regiones de color en mm (plan §3, pasos 1 a 9).
// TS puro: sin DOM, sin React. Corre igual en un worker, en Node o en un servidor.

import { deltaE2000, hexARgb, rgbAOklab } from './color.ts'
import { fusionarIntermedios } from './colores.ts'
import { cuantizar } from './cuantizar.ts'
import { diagnosticar, type CasoFeo } from './diagnostico.ts'
import { trazar } from './contornos.ts'
import * as D from './defaults.ts'
import { ajustarModeloFondo, cajaSinMotas, fondoEncerrado, invertir, tintaClara } from './fondo.ts'
import { limpiar, type InformeLimpieza } from './limpiar.ts'
import {
  cajaDeMascara,
  erosionar,
  mascaraPorAlfa,
  mascaraPorFloodFill,
  tieneAlfaUtil,
} from './mascara.ts'
import { componentes, encerrados } from './morfologia.ts'
import { mediana } from './prefiltro.ts'
import {
  clustersDeFondo,
  mascaraPorClusters,
  mascaraPorUmbralAdaptativo,
  PRESETS,
  type NombrePreset,
} from './presets.ts'
import { reescalar, tamanoConTope } from './reescalar.ts'
import {
  FONDO,
  SIN_ASIGNAR,
  type ColorPaleta,
  type EtapaPipeline,
  type ImagenRGBA,
  type Oklab,
  type Recorte,
  type RegionTrazada,
} from './tipos.ts'

export type ParamsPipeline = {
  preset: NombrePreset
  /** Solo preset Foto: clusters (de 6) que son fondo. Si no se pasa, se sugieren los que tocan el borde. */
  clustersFondo?: number[]
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
  /**
   * Lineas mas finas que lo imprimible: null = se borran; numero = se engrosan hasta ese grosor (mm);
   * 'auto' = se engrosan a GROSOR_LINEAS_MM.porDefecto solo si son una parte del dibujo (logo de lineas).
   */
  grosorMinimoLineasMm: number | null | 'auto'
  /** Grosor elegido a mano para las lineas de un color de la paleta (por hex). Pisa lo de arriba. */
  grosorPorHex?: Record<string, number>
  /** Segunda pasada de fondo (degrade y zonas encerradas por el dibujo). Solo con flood fill. */
  fondoEncerrado: boolean
  fondoAreaMinimaMm2: number
  /** La caja del dibujo ignora las motas sueltas. */
  cajaSinMotas: boolean
  /** Los colores de antialias no ocupan un filamento. */
  fusionarIntermedios: boolean
  /** Silueta detecta tinta clara sobre fondo oscuro. */
  polaridadSilueta: boolean
  /** Color de la base: lo que se funde con ella no se saca, y el fondo encerrado se rellena con el. */
  hexBase: string
  toleranciaRdpMm: number
  maxVerticesPorRegion: number
  semilla: number
  /**
   * Caja del dibujo en pixeles de la fuente. Si no se pasa, se detecta.
   * La calibracion de resolucion la fija para comparar resoluciones sobre el mismo encuadre.
   */
  caja?: Recorte
}

export function paramsPorDefecto(preset: NombrePreset = 'dibujo'): ParamsPipeline {
  const pr = PRESETS[preset]
  return {
    preset,
    ladoMayorMm: D.LADO_MAYOR_MM,
    mmPorPixel: D.MM_POR_PIXEL,
    ladoMaxPxPrevia: D.LADO_MAX_PX_PREVIA,
    umbralAlfa: D.UMBRAL_ALFA,
    toleranciaFloodFill: D.TOLERANCIA_FLOOD_FILL,
    erosionAntiHalo: D.EROSION_ANTI_HALO,
    radioPrefiltro: pr.radioPrefiltro,
    colores: pr.colores,
    muestraKmeans: D.MUESTRA_KMEANS,
    iteracionesKmeans: D.ITERACIONES_KMEANS,
    corteKmeans: D.CORTE_KMEANS,
    fusionDeltaE2000: D.FUSION_DELTA_E2000,
    areaMinimaIslaMm2: pr.areaMinimaIslaMm2,
    anchoMinimoDetalleMm: D.ANCHO_MINIMO_DETALLE_MM,
    grosorMinimoLineasMm: 'auto',
    fondoEncerrado: true,
    fondoAreaMinimaMm2: D.FONDO_AREA_MINIMA_MM2,
    cajaSinMotas: true,
    fusionarIntermedios: true,
    polaridadSilueta: true,
    hexBase: '#FFFFFF',
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
    fuenteMascara: 'alfa' | 'floodFill' | 'umbral' | 'clusters'
    /** Casos feos detectados (plan §4.8). */
    casos: CasoFeo[]
    /** Encuadre usado, en pixeles de la fuente (la caja del dibujo mas un margen). */
    recorte: Recorte
    caja: Recorte
    ancho: number
    alto: number
    mmPorPixel: number
    /** Mapa de etiquetas final a resolucion de trabajo (FONDO = 255). */
    etiquetas: Uint8Array
    vertices: number
    /** Lo que midio la limpieza, con el grosor que se uso al final. */
    limpieza: InformeLimpieza
    /** mm con los que se engrosaron las lineas, o null si se borraron. */
    grosorLineasMm: number | null
    /** Fondo sacado en la segunda pasada y lo que quedo encerrado (va del color de la base). */
    fondo: { zonas: number; sacadoMm2: number; rellenoMm2: number }
    /** Manchas sueltas que no cuentan para el tamaño del dibujo. */
    motas: number
    /** Colores de antialias que se fundieron con sus vecinos. */
    intermediosSacados: string[]
  }
}

/** Margen alrededor del dibujo: el flood fill del recorte necesita fondo en el borde. */
const MARGEN_RELATIVO = 0.03

/**
 * @param alEtapa se llama al empezar cada etapa: la interfaz muestra hitos reales en vez de un
 *   porcentaje inventado (plan §4.2).
 */
export function convertir(
  fuente: ImagenRGBA,
  p: ParamsPipeline,
  alEtapa?: (etapa: EtapaPipeline) => void,
): ResultadoConversion {
  const tiemposMs = {} as Record<EtapaPipeline, number>
  const medir = <T>(etapa: EtapaPipeline, fn: () => T): T => {
    alEtapa?.(etapa)
    const t0 = performance.now()
    const r = fn()
    tiemposMs[etapa] = (tiemposMs[etapa] ?? 0) + performance.now() - t0
    return r
  }

  // 1 · Previa con tope de tamaño, para encontrar el dibujo rapido
  const todo: Recorte = { x: 0, y: 0, ancho: fuente.ancho, alto: fuente.alto }
  const tamPrevia = tamanoConTope(fuente.ancho, fuente.alto, p.ladoMaxPxPrevia)
  const previa = medir('previa', () => reescalar(fuente, todo, tamPrevia.ancho, tamPrevia.alto))
  const usarAlfa = tieneAlfaUtil(previa, p.umbralAlfa)
  const fuenteMascara: ResultadoConversion['diagnostico']['fuenteMascara'] = usarAlfa
    ? 'alfa'
    : p.preset === 'silueta'
      ? 'umbral'
      : p.preset === 'foto'
        ? 'clusters'
        : 'floodFill'
  // Silueta asume tinta oscura sobre fondo claro: con el borde oscuro, se invierte antes del umbral
  const invertirTinta = fuenteMascara === 'umbral' && p.polaridadSilueta && tintaClara(previa)
  const mascaraDe = (img: ImagenRGBA): Uint8Array => {
    switch (fuenteMascara) {
      case 'alfa':
        return mascaraPorAlfa(img, p.umbralAlfa)
      case 'umbral':
        return mascaraPorUmbralAdaptativo(invertirTinta ? invertir(img) : img)
      case 'clusters': {
        const c = clustersDeFondo(img)
        return mascaraPorClusters(c, p.clustersFondo ?? c.tocanElBorde)
      }
      case 'floodFill':
        return mascaraPorFloodFill(img, p.toleranciaFloodFill)
    }
  }

  // Fondo encerrado y degrade: el flood fill desde el borde no entra en un contorno cerrado ni sigue
  // un degrade fuerte. Un modelo del fondo ajustado al borde saca tambien esas zonas.
  const primeraPrevia = mascaraDe(previa)
  const modelo =
    p.fondoEncerrado && fuenteMascara === 'floodFill'
      ? ajustarModeloFondo(previa, primeraPrevia)
      : null
  const segundaPasada = (img: ImagenRGBA, r: Recorte, m: Uint8Array, mm: number) =>
    fondoEncerrado(img, r, fuente, m, modelo!, {
      areaMinimaMm2: p.fondoAreaMinimaMm2,
      mmPorPixel: mm,
      respetarBase: true,
      hexBase: p.hexBase,
    })
  // En la previa todavia no hay escala: se supone que el dibujo ocupa la imagen
  const mascaraPrevia = modelo
    ? segundaPasada(
        previa,
        todo,
        primeraPrevia,
        p.ladoMayorMm / Math.max(previa.ancho, previa.alto),
      ).mascara
    : primeraPrevia

  // 2 · Donde esta el dibujo (sin motas sueltas: si no, un sticker fotografiado sale mas chico)
  let motas = 0
  const caja =
    p.caja ??
    medir('mascaraPrevia', () => {
      let encontrada: Recorte | null
      if (p.cajaSinMotas) {
        const r = cajaSinMotas(mascaraPrevia, previa.ancho, previa.alto)
        encontrada = r.caja
        motas = r.motas
      } else encontrada = cajaDeMascara(mascaraPrevia, previa.ancho, previa.alto)
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
  const mm2 = mmPorPixel * mmPorPixel

  const trabajo = medir('reescalar', () => reescalar(fuente, recorte, ancho, alto))

  // 2 y 3 · Mascara a resolucion de trabajo. La erosion anti-halo se usa SOLO para estimar los
  // colores: si achicara la geometria, todo llavero saldria 0,2 mm mas chico alrededor
  // (medido en F0.8: el anillo de logo-01 perdia justo perimetro × 1 px de area).
  let mascara = medir('mascara', () => mascaraDe(trabajo))
  let relleno: Uint8Array | null = null
  const fondo = { zonas: 0, sacadoMm2: 0, rellenoMm2: 0 }
  if (modelo) {
    const r = medir('mascara', () => segundaPasada(trabajo, recorte, mascara, mmPorPixel))
    mascara = r.mascara
    relleno = r.relleno
    fondo.zonas = r.componentesSacadas
    fondo.sacadoMm2 = r.pixelesSacados * mm2
  }
  const interior = erosionar(mascara, ancho, alto, p.erosionAntiHalo)
  // Un trazo tan fino que la erosion lo vacia entero vuelve al interior: sin interior no tiene color
  // y la limpieza lo mandaria a fondo (medido: recupera la mitad de "TIENDA" en La Ronda)
  componentes(
    (i) => mascara[i] === 1,
    ancho,
    alto,
    true,
    (miembros) => {
      for (const i of miembros) if (interior[i]) return
      for (const i of miembros) interior[i] = 1
    },
  )

  // 4 · Mediana
  const filtrada = medir('prefiltro', () => mediana(trabajo, interior, p.radioPrefiltro))

  // 5 · k-means++ en OKLab
  const cuantizado = medir('cuantizar', () =>
    cuantizar(filtrada, interior, {
      colores: p.colores,
      muestra: p.muestraKmeans,
      iteraciones: p.iteracionesKmeans,
      corte: p.corteKmeans,
      fusionDeltaE2000: p.fusionDeltaE2000,
      semilla: p.semilla,
    }),
  )
  let paleta = cuantizado.paleta
  let crudas = cuantizado.etiquetas

  // El borde que saco la erosion vuelve como "sin asignar": la limpieza le da el color del
  // interior mas cercano, sin crear un color nuevo con el antialias
  for (let i = 0; i < mascara.length; i++)
    if (mascara[i] === 1 && crudas[i] === FONDO) crudas[i] = SIN_ASIGNAR

  // OKLab de la imagen filtrada y color medio del fondo: para fundir intermedios y la guarda anti-halo
  const lab = new Float32Array(ancho * alto * 3)
  for (let i = 0; i < ancho * alto; i++)
    rgbAOklab(
      filtrada.pixeles[i * 4]!,
      filtrada.pixeles[i * 4 + 1]!,
      filtrada.pixeles[i * 4 + 2]!,
      lab,
      i * 3,
    )
  const fondoLab = colorMedioDelFondo(trabajo, mascara)

  let intermediosSacados: string[] = []
  if (p.fusionarIntermedios && paleta.length > 1) {
    const r = medir('cuantizar', () =>
      fusionarIntermedios(
        paleta,
        crudas,
        ancho,
        alto,
        fondoLab,
        filtrada,
        p.anchoMinimoDetalleMm / 2 / mmPorPixel,
      ),
    )
    paleta = r.paleta
    crudas = r.etiquetas
    intermediosSacados = r.sacados
  }

  // 7 · Limpieza (el paso 6, mapeo a filamentos, es de F1). Con 'auto' se limpia borrando lo fino y,
  // si el detector ve un logo de lineas, se repite SOLO la limpieza engrosando.
  const limpiarCon = (grosor: number | null) =>
    medir('limpiar', () =>
      limpiar(crudas, ancho, alto, paleta.length, {
        mmPorPixel,
        anchoMinimoDetalleMm: p.anchoMinimoDetalleMm,
        areaMinimaIslaMm2: p.areaMinimaIslaMm2,
        grosorMinimoLineasMm: grosor,
        grosorPorColorMm: paleta.map((c) => p.grosorPorHex?.[c.hex] ?? null),
        largoMinimoLineaMm: D.LARGO_MINIMO_LINEA_MM,
        paleta,
        guardaHalo: { lab, fondoLab },
      }),
    )
  let grosorLineasMm = p.grosorMinimoLineasMm === 'auto' ? null : p.grosorMinimoLineasMm
  let limpio = limpiarCon(grosorLineasMm)
  if (
    p.grosorMinimoLineasMm === 'auto' &&
    limpio.informe.fraccionLineas >= D.FRACCION_LINEAS_AUTO
  ) {
    grosorLineasMm = D.GROSOR_LINEAS_MM.porDefecto
    limpio = limpiarCon(grosorLineasMm)
  }
  const etiquetas = limpio.etiquetas

  // Lo que se saco como fondo y quedo encerrado por el dibujo (y todo hueco que la limpieza dejo
  // adentro) va del color de la base: si quedara como fondo, el llavero tendria un agujero pasante
  if (relleno) {
    const hay = new Uint8Array(etiquetas.length)
    for (let i = 0; i < hay.length; i++) hay[i] = etiquetas[i] !== FONDO ? 1 : 0
    const adentro = encerrados(hay, ancho, alto)
    const rellenar = (i: number) => adentro[i] === 1 || (relleno[i] === 1 && hay[i] === 0)
    let rellenoPx = 0
    for (let i = 0; i < adentro.length; i++) if (rellenar(i)) rellenoPx++
    if (rellenoPx) {
      let indiceBase = paleta.findIndex((c) => deltaE2000(c.hex, p.hexBase) < p.fusionDeltaE2000)
      if (indiceBase < 0) {
        const o = new Float32Array(3)
        const [r, g, b] = hexARgb(p.hexBase)
        rgbAOklab(r, g, b, o, 0)
        paleta = [...paleta, { hex: p.hexBase, oklab: [o[0]!, o[1]!, o[2]!], pixeles: 0 }]
        indiceBase = paleta.length - 1
      }
      for (let i = 0; i < adentro.length; i++) if (rellenar(i)) etiquetas[i] = indiceBase
      const base = paleta[indiceBase]!
      paleta = paleta.map((c, k) =>
        k === indiceBase ? { ...base, pixeles: base.pixeles + rellenoPx } : c,
      )
      fondo.rellenoMm2 = rellenoPx * mm2
    }
  }

  // 8 y 9 · Contornos y simplificacion
  const regiones = medir('contornos', () =>
    trazar(etiquetas, ancho, alto, paleta, {
      mmPorPixel,
      toleranciaRdpMm: p.toleranciaRdpMm,
      maxVerticesPorRegion: p.maxVerticesPorRegion,
    }),
  )

  const casos = diagnosticar({
    fuente,
    mascaraPrevia,
    porFloodFill: fuenteMascara === 'floodFill',
    trabajo,
    mascara,
    crudas,
    paleta,
    etiquetas,
    mmPorPixel,
  }).filter(
    // Si la segunda pasada saco fondo, el "fondo complejo" ya se resolvio: sugerir Foto lo empeoraria
    (c) => !(c.codigo === 'fondo-complejo' && fondo.zonas > 0),
  )
  if (grosorLineasMm !== null && limpio.informe.agregados > 0)
    casos.push({
      caso: 5,
      codigo: 'lineas-engrosadas',
      mensaje: `Engrosé las líneas más finas a ${String(grosorLineasMm).replace('.', ',')} mm para que se puedan imprimir.`,
    })
  if (fondo.rellenoMm2 >= p.fondoAreaMinimaMm2)
    casos.push({
      caso: 6,
      codigo: 'fondo-rellenado',
      mensaje: 'El fondo que quedaba adentro del dibujo lo rellené con el color de la base.',
    })

  return {
    regiones,
    paleta,
    diagnostico: {
      tiemposMs,
      fuenteMascara,
      casos,
      recorte,
      caja,
      ancho,
      alto,
      mmPorPixel,
      etiquetas,
      vertices: regiones.reduce((t, r) => t + r.contornos.reduce((s, a) => s + a.length, 0), 0),
      limpieza: limpio.informe,
      grosorLineasMm,
      fondo,
      motas,
      intermediosSacados,
    },
  }
}

/** Color medio (OKLab) de lo que la mascara saco, 1 de cada 3 pixeles. null si no hay fondo. */
function colorMedioDelFondo(img: ImagenRGBA, mascara: Uint8Array): Oklab | null {
  const s = [0, 0, 0]
  let n = 0
  const lab = new Float32Array(3)
  for (let i = 0; i < mascara.length; i += 3) {
    if (mascara[i]) continue
    rgbAOklab(img.pixeles[i * 4]!, img.pixeles[i * 4 + 1]!, img.pixeles[i * 4 + 2]!, lab, 0)
    s[0]! += lab[0]!
    s[1]! += lab[1]!
    s[2]! += lab[2]!
    n++
  }
  return n ? [s[0]! / n, s[1]! / n, s[2]! / n] : null
}

/**
 * Convierte con el preset Dibujo y, si el diagnostico pide cambiar solo (el recorte no encontro
 * el dibujo), reintenta con el preset sugerido. Medido en F1.1: 14 de 15 del banco con el mejor
 * preset disponible, contra 8 de 15 de la regla del plan.
 */
export function convertirAutomatico(
  fuente: ImagenRGBA,
  base: Partial<ParamsPipeline> = {},
  alEtapa?: (etapa: EtapaPipeline) => void,
): ResultadoConversion & { preset: NombrePreset } {
  const primero = convertir(
    fuente,
    { ...paramsPorDefecto('dibujo'), ...base, preset: 'dibujo' },
    alEtapa,
  )
  const cambio = primero.diagnostico.casos.find((c) => c.cambiarSolo && c.sugerirPreset)
  if (!cambio?.sugerirPreset) return { ...primero, preset: 'dibujo' }
  const segundo = convertir(
    fuente,
    {
      ...paramsPorDefecto(cambio.sugerirPreset),
      ...base,
      preset: cambio.sugerirPreset,
    },
    alEtapa,
  )
  return { ...segundo, preset: cambio.sugerirPreset }
}

export { FONDO }
export type { ColorPaleta, EtapaPipeline, ImagenRGBA, Recorte, RegionTrazada }
