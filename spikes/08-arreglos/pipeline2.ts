// Spike 08 · convertirV2: la misma orquestacion que src/pipeline/index.ts › convertir, con las etapas
// ORIGINALES importadas de src/ y cada arreglo como un interruptor. Con SIN_ARREGLOS da el mismo
// resultado que convertir() byte a byte (el runner lo verifica antes de medir).
//
// convertir() es una sola funcion: para intercalar etapas hubo que copiar la orquestacion (~80 lineas),
// no las etapas.

import { rgbAOklab, oklabARgb, rgbAHex } from '../../src/pipeline/color.ts'
import { trazar } from '../../src/pipeline/contornos.ts'
import { cuantizar } from '../../src/pipeline/cuantizar.ts'
import { diagnosticar } from '../../src/pipeline/diagnostico.ts'
import {
  cajaDeMascara,
  erosionar,
  mascaraPorAlfa,
  mascaraPorFloodFill,
  tieneAlfaUtil,
} from '../../src/pipeline/mascara.ts'
import type { ParamsPipeline, ResultadoConversion } from '../../src/pipeline/index.ts'
import { paramsPorDefecto } from '../../src/pipeline/index.ts'
import { mediana } from '../../src/pipeline/prefiltro.ts'
import {
  clustersDeFondo,
  mascaraPorClusters,
  mascaraPorUmbralAdaptativo,
  type NombrePreset,
} from '../../src/pipeline/presets.ts'
import { reescalar, tamanoConTope } from '../../src/pipeline/reescalar.ts'
import {
  FONDO,
  SIN_ASIGNAR,
  type ColorPaleta,
  type ImagenRGBA,
  type Oklab,
  type Recorte,
} from '../../src/pipeline/tipos.ts'
import {
  cuantizarSinTransiciones,
  fusionarIntermedios,
  mascaraTransiciones,
  slotsUsados,
} from './colores.ts'
import { esBase, limpiarV2, type InformeLimpieza } from './engrosar.ts'
import {
  ajustarModeloFondo,
  cajaSinMotas,
  fondoEncerrado,
  invertir,
  tintaClara,
  type ModeloFondo,
} from './fondo.ts'
import { componentes, encerrados } from './morfologia2.ts'
import type { UmbralFino } from './morfologia2.ts'

export type Arreglos = {
  /** 1 · null = hoy (borrar). Numero = grosorMinimoLineasMm. */
  grosorMinimoLineasMm: number | null
  /** 1 · un trazo tan fino que la erosion anti-halo lo vacia entero vuelve al interior (si no, pasa a fondo). */
  interiorConservaTrazos: boolean
  /** 1 · guarda anti-halo: no engrosar cintas de antialias (ver engrosar.ts › esHalo). */
  guardaHalo: boolean
  /** 1 · criterio de la erosion (isotropia). */
  umbralFino: UmbralFino
  /** 2 · segunda pasada de fondo con modelo del borde (solo mascara por flood fill). */
  fondoEncerrado: boolean
  /** 2 · no sacar lo que se funde con la base (ΔE2000 < 5). */
  fondoRespetaBase: boolean
  /** 2 · area minima de una zona de fondo encerrado (mm²). */
  fondoAreaMinimaMm2: number
  /** 3 · caja sin motas. */
  cajaSinMotas: boolean
  /** 4a · k-means sin pixeles de transicion. */
  kmeansSinTransiciones: boolean
  /** 4b · fundir colores intermedios con forma de cinta. */
  fusionarIntermedios: boolean
  /** 4c · (causa 5) la base cuenta como uno de los N colores si no aparece en la imagen. */
  baseCuentaComoColor: boolean
  /** 8 · Silueta detecta tinta clara sobre oscuro. */
  polaridadSilueta: boolean
  /** 6 · modo Lineas: silueta rellena como base + tinta engrosada. */
  modoLineas: boolean
}

export const SIN_ARREGLOS: Arreglos = {
  grosorMinimoLineasMm: null,
  interiorConservaTrazos: false,
  guardaHalo: false,
  umbralFino: 'hoy',
  fondoEncerrado: false,
  fondoRespetaBase: true,
  fondoAreaMinimaMm2: 3,
  cajaSinMotas: false,
  kmeansSinTransiciones: false,
  fusionarIntermedios: false,
  baseCuentaComoColor: false,
  polaridadSilueta: false,
  modoLineas: false,
}

export type ExtraV2 = {
  tiemposArreglosMs: Record<string, number>
  totalMs: number
  limpieza: InformeLimpieza
  /** Relleno de base (fondo encerrado) a resolucion de trabajo, o null. */
  relleno: Uint8Array | null
  fondo: {
    modelo: ModeloFondo | null
    tolerancia: number
    sacadoMm2: number
    rellenoMm2: number
    zonasSacadas: number
    zonasRespetadas: number
  }
  caja: { motas: number; componentes: number }
  transicionesExcluidas: number
  intermediosSacados: string[]
  slots: number
  recuantizoPorBase: boolean
  tintaClara: boolean | null
}

export type ResultadoV2 = ResultadoConversion & { extra: ExtraV2 }

const MARGEN_RELATIVO = 0.03

export function convertirV2(fuente: ImagenRGBA, p: ParamsPipeline, a: Arreglos): ResultadoV2 {
  const t00 = performance.now()
  const tiemposMs = {} as ResultadoConversion['diagnostico']['tiemposMs']
  const extraT: Record<string, number> = {}
  const medir = <T>(etapa: keyof typeof tiemposMs, fn: () => T): T => {
    const t0 = performance.now()
    const r = fn()
    tiemposMs[etapa] = (tiemposMs[etapa] ?? 0) + performance.now() - t0
    return r
  }
  const medirExtra = <T>(nombre: string, fn: () => T): T => {
    const t0 = performance.now()
    const r = fn()
    extraT[nombre] = (extraT[nombre] ?? 0) + performance.now() - t0
    return r
  }

  const todo: Recorte = { x: 0, y: 0, ancho: fuente.ancho, alto: fuente.alto }
  const tamPrevia = tamanoConTope(fuente.ancho, fuente.alto, p.ladoMaxPxPrevia)
  const previa = medir('previa', () => reescalar(fuente, todo, tamPrevia.ancho, tamPrevia.alto))
  const usarAlfa = tieneAlfaUtil(previa, p.umbralAlfa)
  const fuenteMascara: ResultadoConversion['diagnostico']['fuenteMascara'] = usarAlfa
    ? 'alfa'
    : p.preset === 'silueta' || a.modoLineas
      ? 'umbral'
      : p.preset === 'foto'
        ? 'clusters'
        : 'floodFill'
  const invertirTinta =
    fuenteMascara === 'umbral' && (a.polaridadSilueta || a.modoLineas) ? tintaClara(previa) : null

  const primeraPasada = (img: ImagenRGBA): Uint8Array => {
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
  const conFondo = a.fondoEncerrado && fuenteMascara === 'floodFill'
  const primeraPrevia = primeraPasada(previa)
  const modelo = conFondo
    ? medirExtra('fondo', () => ajustarModeloFondo(previa, primeraPrevia))
    : null
  const segunda = (img: ImagenRGBA, recorte: Recorte, m: Uint8Array, mmPorPixel: number) =>
    medirExtra('fondo', () =>
      fondoEncerrado(img, recorte, fuente, m, modelo!, {
        areaMinimaMm2: a.fondoAreaMinimaMm2,
        mmPorPixel,
        respetarBase: a.fondoRespetaBase,
        hexBase: '#FFFFFF',
      }),
    )
  // En la previa todavia no hay escala: se supone que el dibujo ocupa la imagen (umbral de area mas chico)
  const mascaraPrevia = modelo
    ? segunda(previa, todo, primeraPrevia, p.ladoMayorMm / Math.max(previa.ancho, previa.alto))
        .mascara
    : primeraPrevia

  const infoCaja = { motas: 0, componentes: 0 }
  const caja =
    p.caja ??
    medir('mascaraPrevia', () => {
      let encontrada: Recorte | null
      if (a.cajaSinMotas) {
        const r = cajaSinMotas(mascaraPrevia, previa.ancho, previa.alto)
        encontrada = r.caja
        infoCaja.motas = r.motas
        infoCaja.componentes = r.componentes
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
  let mascara = medir('mascara', () => primeraPasada(trabajo))
  let relleno: Uint8Array | null = null
  const infoFondo: ExtraV2['fondo'] = {
    modelo,
    tolerancia: 0,
    sacadoMm2: 0,
    rellenoMm2: 0,
    zonasSacadas: 0,
    zonasRespetadas: 0,
  }
  if (modelo) {
    const r = segunda(trabajo, recorte, mascara, mmPorPixel)
    mascara = r.mascara
    relleno = r.relleno
    const mm2 = mmPorPixel * mmPorPixel
    Object.assign(infoFondo, {
      tolerancia: r.tolerancia,
      sacadoMm2: r.pixelesSacados * mm2,
      rellenoMm2: r.pixelesRelleno * mm2,
      zonasSacadas: r.componentesSacadas,
      zonasRespetadas: r.componentesRespetadas,
    })
  }
  const interior = erosionar(mascara, ancho, alto, p.erosionAntiHalo)
  if (a.interiorConservaTrazos)
    medirExtra('trazos', () =>
      componentes(
        (i) => mascara[i] === 1,
        ancho,
        alto,
        true,
        (miembros) => {
          for (const i of miembros) if (interior[i]) return
          for (const i of miembros) interior[i] = 1
        },
      ),
    )

  // ------------------------------------------------------------------ modo Lineas (arreglo 6)
  if (a.modoLineas) {
    const tinta = mascara
    let suma = [0, 0, 0]
    let n = 0
    const lab = new Float32Array(3)
    for (let i = 0; i < tinta.length; i++) {
      if (!interior[i]) continue
      rgbAOklab(
        trabajo.pixeles[i * 4]!,
        trabajo.pixeles[i * 4 + 1]!,
        trabajo.pixeles[i * 4 + 2]!,
        lab,
        0,
      )
      suma = suma.map((s, k) => s + lab[k]!)
      n++
    }
    const oklabTinta = suma.map((s) => s / Math.max(1, n)) as Oklab
    const paletaTinta: ColorPaleta[] = [
      { hex: rgbAHex(oklabARgb(oklabTinta)), oklab: oklabTinta, pixeles: n },
    ]
    const crudas = new Uint8Array(tinta.length).fill(FONDO)
    for (let i = 0; i < tinta.length; i++) if (tinta[i]) crudas[i] = interior[i] ? 0 : SIN_ASIGNAR
    const { etiquetas: soloTinta, informe } = medir('limpiar', () =>
      limpiarV2(crudas, ancho, alto, 1, {
        mmPorPixel,
        anchoMinimoDetalleMm: p.anchoMinimoDetalleMm,
        areaMinimaIslaMm2: p.areaMinimaIslaMm2,
        umbralFino: a.umbralFino,
        grosorMinimoLineasMm: a.grosorMinimoLineasMm ?? 1.0,
        largoMinimoLineaMm: 1.5,
        paleta: paletaTinta,
      }),
    )
    const hayTinta = new Uint8Array(soloTinta.length)
    for (let i = 0; i < hayTinta.length; i++) hayTinta[i] = soloTinta[i] !== FONDO ? 1 : 0
    const adentro = encerrados(hayTinta, ancho, alto)
    const etiquetas = new Uint8Array(soloTinta)
    for (let i = 0; i < etiquetas.length; i++) if (adentro[i]) etiquetas[i] = 1
    const blanco: Oklab = [1, 0, 0]
    const paleta: ColorPaleta[] = [
      ...paletaTinta,
      { hex: '#FFFFFF', oklab: blanco, pixeles: adentro.reduce((s, v) => s + v, 0) },
    ]
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
        fuenteMascara,
        casos: [],
        recorte,
        caja,
        ancho,
        alto,
        mmPorPixel,
        etiquetas,
        vertices: regiones.reduce((t, r) => t + r.contornos.reduce((s, x) => s + x.length, 0), 0),
      },
      extra: {
        tiemposArreglosMs: extraT,
        totalMs: performance.now() - t00,
        limpieza: informe,
        relleno: adentro,
        fondo: infoFondo,
        caja: infoCaja,
        transicionesExcluidas: 0,
        intermediosSacados: [],
        slots: 2,
        recuantizoPorBase: false,
        tintaClara: invertirTinta,
      },
    }
  }

  const filtrada = medir('prefiltro', () => mediana(trabajo, interior, p.radioPrefiltro))
  const transiciones = a.kmeansSinTransiciones
    ? medirExtra('transiciones', () => mascaraTransiciones(filtrada, interior))
    : null
  const cuantizarCon = (colores: number) => {
    const pc = {
      colores,
      muestra: p.muestraKmeans,
      iteraciones: p.iteracionesKmeans,
      corte: p.corteKmeans,
      fusionDeltaE2000: p.fusionDeltaE2000,
      semilla: p.semilla,
    }
    return transiciones
      ? cuantizarSinTransiciones(filtrada, interior, transiciones, pc)
      : { ...cuantizar(filtrada, interior, pc), excluidos: 0 }
  }
  let q = medir('cuantizar', () => cuantizarCon(p.colores))
  let recuantizoPorBase = false
  if (
    a.baseCuentaComoColor &&
    p.colores > 1 &&
    q.paleta.length >= p.colores &&
    !q.paleta.some((c) => esBase(c.hex))
  ) {
    q = medir('cuantizar', () => cuantizarCon(p.colores - 1))
    recuantizoPorBase = true
  }
  let paleta = q.paleta
  let crudas = q.etiquetas
  for (let i = 0; i < mascara.length; i++)
    if (mascara[i] === 1 && crudas[i] === FONDO) crudas[i] = SIN_ASIGNAR

  // Color del fondo alrededor del dibujo: media OKLab de lo que la mascara saco (1 de cada 3 pixeles)
  const fondoLabDe = (): Oklab | null => {
    const s = [0, 0, 0]
    let n = 0
    const lab = new Float32Array(3)
    for (let i = 0; i < mascara.length; i += 3) {
      if (mascara[i]) continue
      rgbAOklab(
        trabajo.pixeles[i * 4]!,
        trabajo.pixeles[i * 4 + 1]!,
        trabajo.pixeles[i * 4 + 2]!,
        lab,
        0,
      )
      s[0]! += lab[0]!
      s[1]! += lab[1]!
      s[2]! += lab[2]!
      n++
    }
    return n ? (s.map((v) => v / n) as Oklab) : null
  }
  const fondoLab = a.fusionarIntermedios || a.guardaHalo ? fondoLabDe() : null

  let intermediosSacados: string[] = []
  if (a.fusionarIntermedios && paleta.length > 1) {
    const r = medirExtra('intermedios', () =>
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
  const guardaHalo = a.guardaHalo
    ? medirExtra('guardaHalo', () => {
        const lab = new Float32Array(ancho * alto * 3)
        for (let i = 0; i < ancho * alto; i++)
          rgbAOklab(
            filtrada.pixeles[i * 4]!,
            filtrada.pixeles[i * 4 + 1]!,
            filtrada.pixeles[i * 4 + 2]!,
            lab,
            i * 3,
          )
        return { lab, fondoLab }
      })
    : undefined

  const { etiquetas, informe } = medir('limpiar', () =>
    limpiarV2(crudas, ancho, alto, paleta.length, {
      mmPorPixel,
      anchoMinimoDetalleMm: p.anchoMinimoDetalleMm,
      areaMinimaIslaMm2: p.areaMinimaIslaMm2,
      umbralFino: a.umbralFino,
      grosorMinimoLineasMm: a.grosorMinimoLineasMm,
      largoMinimoLineaMm: 1.5,
      paleta,
      guardaHalo,
    }),
  )

  // Con fondo encerrado: todo hueco que la limpieza dejo adentro del dibujo tambien es base (si no, seria
  // un agujero pasante en el llavero)
  if (relleno) {
    const hay = new Uint8Array(etiquetas.length)
    for (let i = 0; i < hay.length; i++) hay[i] = etiquetas[i] !== FONDO ? 1 : 0
    const adentro = encerrados(hay, ancho, alto)
    for (let i = 0; i < adentro.length; i++) if (adentro[i]) relleno[i] = 1
  }

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
      vertices: regiones.reduce((t, r) => t + r.contornos.reduce((s, x) => s + x.length, 0), 0),
    },
    extra: {
      tiemposArreglosMs: extraT,
      totalMs: performance.now() - t00,
      limpieza: informe,
      relleno,
      fondo: infoFondo,
      caja: infoCaja,
      transicionesExcluidas: q.excluidos,
      intermediosSacados,
      slots: slotsUsados(paleta),
      recuantizoPorBase,
      tintaClara: invertirTinta,
    },
  }
}

/** Igual que convertirAutomatico (index.ts): Dibujo y, si el diagnostico lo pide, el preset sugerido. */
export function convertirAutomaticoV2(
  fuente: ImagenRGBA,
  base: Partial<ParamsPipeline>,
  a: Arreglos,
): ResultadoV2 & { preset: NombrePreset } {
  const primero = convertirV2(
    fuente,
    { ...paramsPorDefecto('dibujo'), ...base, preset: 'dibujo' },
    a,
  )
  const cambio = primero.diagnostico.casos.find((c) => c.cambiarSolo && c.sugerirPreset)
  if (!cambio?.sugerirPreset) return { ...primero, preset: 'dibujo' }
  const segundo = convertirV2(
    fuente,
    { ...paramsPorDefecto(cambio.sugerirPreset), ...base, preset: cambio.sugerirPreset },
    a,
  )
  segundo.extra.totalMs += primero.extra.totalMs
  return { ...segundo, preset: cambio.sugerirPreset }
}

/**
 * Arreglo 5 · politica automatica: una corrida con los arreglos "seguros" (caja, colores) que ademas
 * mide lineas finas y fondo encerrado; si los detectores saltan, se prenden los arreglos 1 y 2.
 * Devuelve tambien que decidio, para el informe.
 */
export const UMBRALES_AUTO = {
  /** Fraccion del dibujo en lineas finas (antes de limpiar) a partir de la cual se engrosa. */
  fraccionLineas: 0.04,
}

export function convertirConPolitica(
  fuente: ImagenRGBA,
  base: Partial<ParamsPipeline>,
  seguros: Arreglos,
): ResultadoV2 & { preset: NombrePreset; decision: string[] } {
  const t0 = performance.now()
  const primero = convertirAutomaticoV2(fuente, base, {
    ...seguros,
    fondoEncerrado: true,
    grosorMinimoLineasMm: null,
  })
  const decision: string[] = []
  const l = primero.extra.limpieza
  if (l.fraccionLineas >= UMBRALES_AUTO.fraccionLineas)
    decision.push(
      `engrosar (lineas ${(l.fraccionLineas * 100).toFixed(1)} %, ${l.largoLineasMm.toFixed(0)} mm)`,
    )
  if (primero.extra.fondo.zonasSacadas)
    decision.push(`fondo encerrado (${primero.extra.fondo.sacadoMm2.toFixed(0)} mm²)`)
  if (!decision.some((d) => d.startsWith('engrosar')))
    return { ...primero, decision, extra: { ...primero.extra, totalMs: performance.now() - t0 } }
  const segundo = convertirAutomaticoV2(fuente, base, {
    ...seguros,
    fondoEncerrado: true,
    grosorMinimoLineasMm: seguros.grosorMinimoLineasMm ?? 0.8,
  })
  return { ...segundo, decision, extra: { ...segundo.extra, totalMs: performance.now() - t0 } }
}
