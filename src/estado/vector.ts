// El dibujo que se esta limpiando en Vectorizar. Igual que el documento de los llaveros: el worker
// de imagen hace la conversion, y de ahi en adelante todo pasa sobre el mapa de etiquetas, que vive
// aca y se edita en el lugar.
//
// El mapa es un Uint8Array que se muta: React no se entera, asi que cada cambio sube `version` y la
// pantalla se vuelve a dibujar con eso.

import { create } from 'zustand'
import { trazar } from '../pipeline/contornos.ts'
import * as D from '../pipeline/defaults.ts'
import type { NombrePreset } from '../pipeline/presets.ts'
import { FONDO, type ColorPaleta, type RegionTrazada } from '../pipeline/tipos.ts'
import {
  componenteEn,
  pintarIndices,
  pintarTrazo,
  pixelesDeTinta,
  type Mapa,
} from '../vector/pincel.ts'
import { crearGeneracion } from '../workers/clientes.ts'
import type { ApiImagen } from '../workers/imagen.worker.ts'
import { clienteImagen } from './motor.ts'

export type Conversion = Awaited<ReturnType<ApiImagen['procesar']>>

/** Las tres formas de tocar el dibujo. */
export type Herramienta = 'mancha' | 'borrar' | 'pintar'

export type ErrorVector = { codigo: 'formato' | 'heic' | 'muy-pesada' | 'trabado' | 'sin-dibujo' }

/** Cuantos pasos atras se pueden deshacer. Cada uno es una copia del mapa (~250 KB). */
const MAX_HISTORIAL = 24

type Estado = {
  archivo: File | null
  preset: NombrePreset | 'auto'
  colores: number
  conversion: Conversion | null
  mapa: Mapa | null
  /** Sube con cada cambio del mapa: es lo que mira el lienzo para redibujar. */
  version: number
  regiones: RegionTrazada[]
  herramienta: Herramienta
  /** Radio del pincel, en pixeles del mapa. */
  radio: number
  /** Indice de la paleta con el que pinta el pincel. */
  colorActivo: number
  historial: Uint8Array[]
  futuro: Uint8Array[]
  procesando: boolean
  trazando: boolean
  /** Ya se bajo el SVG: se ofrece seguir en otra app. Vive aca para sobrevivir a irse y volver. */
  ofrecido: boolean
  error: ErrorVector | null
}

export const useVector = create<Estado>(() => ({
  archivo: null,
  preset: 'auto',
  colores: 4,
  conversion: null,
  mapa: null,
  version: 0,
  regiones: [],
  herramienta: 'mancha',
  radio: 6,
  colorActivo: 0,
  historial: [],
  futuro: [],
  procesando: false,
  trazando: false,
  ofrecido: false,
  error: null,
}))

const set = useVector.setState
const get = useVector.getState
const gen = crearGeneracion()
const FORMATOS = ['image/png', 'image/jpeg', 'image/webp']
const MAXIMO_BYTES = 25 * 1024 * 1024

const paramsTrazo = (mmPorPixel: number) => ({
  mmPorPixel,
  toleranciaRdpMm: D.TOLERANCIA_RDP_MM,
  maxVerticesPorRegion: D.MAX_VERTICES_POR_REGION,
})

/** El mapa vuelto regiones, con los mismos parametros con los que se convirtio. */
function retrazar(): void {
  const { mapa, conversion } = get()
  if (!mapa || !conversion) return
  set({
    regiones: trazar(
      mapa.etiquetas,
      mapa.ancho,
      mapa.alto,
      conversion.paleta,
      paramsTrazo(conversion.diagnostico.mmPorPixel),
    ),
  })
}

/** El contorno de toda la tinta junta, de un solo color: es lo que necesita un sello. */
export function siluetaDeTinta(): RegionTrazada[] {
  const { mapa, conversion } = get()
  if (!mapa || !conversion) return []
  const solo = new Uint8Array(mapa.etiquetas.length)
  let pixeles = 0
  for (let i = 0; i < solo.length; i++) {
    const tinta = mapa.etiquetas[i] !== FONDO
    solo[i] = tinta ? 0 : FONDO
    if (tinta) pixeles++
  }
  if (!pixeles) return []
  const unico: ColorPaleta = { hex: '#000000', oklab: [0, 0, 0], pixeles }
  return trazar(
    solo,
    mapa.ancho,
    mapa.alto,
    [unico],
    paramsTrazo(conversion.diagnostico.mmPorPixel),
  )
}

/** El lienzo, en mm. */
export function medidasMm(): [number, number] {
  const { mapa, conversion } = get()
  if (!mapa || !conversion) return [0, 0]
  const s = conversion.diagnostico.mmPorPixel
  return [mapa.ancho * s, mapa.alto * s]
}

// ------------------------------------------------------------------ imagen

async function procesar(): Promise<void> {
  const { archivo, preset, colores } = get()
  if (!archivo) return
  set({ procesando: true, error: null })
  try {
    const conversion = await gen.envolver(clienteImagen().procesar(archivo, { preset, colores }))
    if (!conversion) return
    if (!conversion.regiones.length) {
      set({ procesando: false, error: { codigo: 'sin-dibujo' } })
      return
    }
    const { ancho, alto, etiquetas } = conversion.diagnostico
    set({
      conversion,
      mapa: { etiquetas: Uint8Array.from(etiquetas), ancho, alto },
      regiones: conversion.regiones,
      historial: [],
      futuro: [],
      version: get().version + 1,
      colorActivo: 0,
      procesando: false,
    })
  } catch (e) {
    const codigo = String(e instanceof Error ? e.message : e).split('|')[0]
    set({
      procesando: false,
      error: { codigo: codigo === 'muy-pesada' || codigo === 'formato' ? codigo : 'trabado' },
    })
  }
}

/** Valida y procesa un archivo nuevo. Devuelve false si no se pudo (el error queda en el estado). */
export function elegirArchivo(archivo: File): boolean {
  if (/\.(heic|heif)$/i.test(archivo.name) || /hei[cf]/i.test(archivo.type)) {
    set({ error: { codigo: 'heic' } })
    return false
  }
  if (archivo.size > MAXIMO_BYTES) {
    set({ error: { codigo: 'muy-pesada' } })
    return false
  }
  if (!FORMATOS.includes(archivo.type)) {
    set({ error: { codigo: 'formato' } })
    return false
  }
  set({
    archivo,
    conversion: null,
    mapa: null,
    regiones: [],
    historial: [],
    futuro: [],
    ofrecido: false,
  })
  void procesar()
  return true
}

export function cambiarPreset(preset: NombrePreset | 'auto'): void {
  set({ preset })
  void procesar()
}

export function cambiarColores(colores: number): void {
  set({ colores })
  void procesar()
}

// ------------------------------------------------------------------ edicion

export function elegirHerramienta(herramienta: Herramienta): void {
  set({ herramienta })
}

export function elegirRadio(radio: number): void {
  set({ radio })
}

export function elegirColor(colorActivo: number): void {
  set({ colorActivo, herramienta: 'pintar' })
}

/** Guarda el estado actual antes de tocarlo. Se llama al empezar cada trazo, no en cada pixel. */
function anotar(): void {
  const { mapa, historial } = get()
  if (!mapa) return
  set({
    historial: [...historial.slice(-(MAX_HISTORIAL - 1)), Uint8Array.from(mapa.etiquetas)],
    futuro: [],
  })
}

/** Que valor pinta cada herramienta. */
const valorDe = (h: Herramienta, colorActivo: number) => (h === 'pintar' ? colorActivo : FONDO)

export function empezarTrazo(x: number, y: number): void {
  const { mapa, herramienta, radio, colorActivo } = get()
  if (!mapa) return
  anotar()
  set({ trazando: true })
  pintarTrazo(mapa, x, y, x, y, radio, valorDe(herramienta, colorActivo))
  set({ version: get().version + 1 })
}

export function seguirTrazo(x0: number, y0: number, x1: number, y1: number): void {
  const { mapa, herramienta, radio, colorActivo, trazando } = get()
  if (!mapa || !trazando) return
  pintarTrazo(mapa, x0, y0, x1, y1, radio, valorDe(herramienta, colorActivo))
  set({ version: get().version + 1 })
}

export function terminarTrazo(): void {
  if (!get().trazando) return
  set({ trazando: false })
  retrazar()
}

/** Un clic con la herramienta de manchas: se va la mancha entera, o se rellena el hueco. */
export function tocarMancha(x: number, y: number): void {
  const { mapa, colorActivo } = get()
  if (!mapa) return
  const indices = componenteEn(mapa, x, y)
  if (!indices?.length) return
  // Si toco fondo, lo rellena con el color activo; si toco tinta, la borra
  const valor = mapa.etiquetas[indices[0]!] === FONDO ? colorActivo : FONDO
  anotar()
  pintarIndices(mapa, indices, valor)
  set({ version: get().version + 1 })
  retrazar()
}

export function deshacer(): void {
  const { mapa, historial, futuro } = get()
  const anterior = historial.at(-1)
  if (!mapa || !anterior) return
  set({
    historial: historial.slice(0, -1),
    futuro: [...futuro, Uint8Array.from(mapa.etiquetas)],
  })
  mapa.etiquetas.set(anterior)
  set({ version: get().version + 1 })
  retrazar()
}

export function rehacer(): void {
  const { mapa, historial, futuro } = get()
  const siguiente = futuro.at(-1)
  if (!mapa || !siguiente) return
  set({
    futuro: futuro.slice(0, -1),
    historial: [...historial, Uint8Array.from(mapa.etiquetas)],
  })
  mapa.etiquetas.set(siguiente)
  set({ version: get().version + 1 })
  retrazar()
}

/** Vuelve a como lo dejo la conversion, sin reprocesar la imagen. */
export function volverAlOriginal(): void {
  const { mapa, conversion } = get()
  if (!mapa || !conversion) return
  anotar()
  mapa.etiquetas.set(conversion.diagnostico.etiquetas)
  set({ version: get().version + 1 })
  retrazar()
}

export const hayTinta = (): boolean => {
  const m = get().mapa
  return !!m && pixelesDeTinta(m) > 0
}

export function ofrecerSeguir(ofrecido: boolean): void {
  set({ ofrecido })
}

export function descartarError(): void {
  set({ error: null })
}
