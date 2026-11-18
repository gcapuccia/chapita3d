// El cortante que se esta armando. El worker de imagen convierte el dibujo en regiones por color y
// el de geometria arma las piezas; cada cambio reconstruye con espera, y los resultados viejos se
// descartan con generaciones (el mismo patron que los sellos).

import { create } from 'zustand'
import {
  CORTANTE_POR_DEFECTO,
  marcadoPorDefecto,
  type ParamsCortante,
  type RegionCortante,
} from '../cortantes/cortante.ts'
import type { RegionTrazada } from '../pipeline/tipos.ts'
import { crearGeneracion } from '../workers/clientes.ts'
import type { ApiGeometria } from '../workers/geometria.worker.ts'
import { clienteGeometria, clienteImagen } from './motor.ts'

export type ConstruccionCortante = Awaited<ReturnType<ApiGeometria['construirCortante']>>

export type CodigoErrorCortante = 'formato' | 'heic' | 'muy-pesada' | 'sin-dibujo' | 'trabado'

type Estado = {
  /** La imagen subida. null si el dibujo vino del vectorizador o todavia no hay nada. */
  archivo: File | null
  nombre: string
  regiones: RegionCortante[]
  /** El area de cada region, en mm², en el mismo orden. */
  areas: number[]
  params: ParamsCortante
  procesando: boolean
  construccion: ConstruccionCortante | null
  construyendo: boolean
  error: CodigoErrorCortante | null
}

export const useCortante = create<Estado>(() => ({
  archivo: null,
  nombre: '',
  regiones: [],
  areas: [],
  params: CORTANTE_POR_DEFECTO,
  procesando: false,
  construccion: null,
  construyendo: false,
  error: null,
}))

const set = useCortante.setState
const get = useCortante.getState
const genImagen = crearGeneracion()
const genGeometria = crearGeneracion()
let temporizador: ReturnType<typeof setTimeout> | undefined

const FORMATOS = ['image/png', 'image/jpeg', 'image/webp']
const MAXIMO_BYTES = 25 * 1024 * 1024
export const MUESTRA = '/muestras/silueta.png'

const sinExtension = (n: string) => n.replace(/\.[^.]+$/, '') || 'galletita'

function pedido() {
  const { nombre, regiones, params } = get()
  return { nombre, regiones, params }
}

export function construirCortante(demora = 250): void {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    if (!get().regiones.length) return
    set({ construyendo: true })
    genGeometria
      .envolver(
        clienteGeometria().construirCortante(
          pedido(),
          new Date().toLocaleDateString('es-AR'),
          false,
        ),
      )
      .then((c) => {
        if (c) set({ construccion: c, construyendo: false })
      })
      .catch(() => set({ construyendo: false, error: 'trabado' }))
  }, demora)
}

/** Un dibujo nuevo: lo que marca el marcador se elige de nuevo, mirando el dibujo. */
function ponerDibujo(nombre: string, regiones: RegionTrazada[], mmPorPixel: number): void {
  const limpias = regiones.map((r) => ({ hex: r.hex, contornos: r.contornos }))
  const areas = regiones.map((r) => r.areaPx * mmPorPixel ** 2)
  set({
    nombre,
    regiones: limpias,
    areas,
    params: { ...get().params, ...marcadoPorDefecto(limpias, areas) },
    procesando: false,
    construccion: null,
    error: null,
  })
  construirCortante(0)
}

async function procesar(archivo: File): Promise<void> {
  set({ procesando: true, error: null })
  try {
    const conversion = await genImagen.envolver(
      clienteImagen().procesar(archivo, { preset: 'auto' }),
    )
    if (!conversion) return
    if (!conversion.regiones.length) {
      set({ procesando: false, error: 'sin-dibujo' })
      return
    }
    ponerDibujo(sinExtension(archivo.name), conversion.regiones, conversion.diagnostico.mmPorPixel)
  } catch (e) {
    const codigo = String(e instanceof Error ? e.message : e).split('|')[0]
    set({
      procesando: false,
      error: codigo === 'muy-pesada' || codigo === 'formato' ? codigo : 'trabado',
    })
  }
}

/** Valida y procesa un archivo. Devuelve false si no se pudo (el error queda en el estado). */
export function elegirArchivo(archivo: File): boolean {
  if (/\.(heic|heif)$/i.test(archivo.name) || /hei[cf]/i.test(archivo.type)) {
    set({ error: 'heic' })
    return false
  }
  if (archivo.size > MAXIMO_BYTES) {
    set({ error: 'muy-pesada' })
    return false
  }
  if (!FORMATOS.includes(archivo.type)) {
    set({ error: 'formato' })
    return false
  }
  set({ archivo })
  void procesar(archivo)
  return true
}

/** El gato de muestra, para ver algo sin subir nada. */
export async function usarMuestra(): Promise<void> {
  set({ procesando: true, error: null })
  try {
    const blob = await (await fetch(MUESTRA)).blob()
    elegirArchivo(new File([blob], 'gato.png', { type: 'image/png' }))
  } catch {
    set({ procesando: false, error: 'trabado' })
  }
}

/** Entra con el dibujo ya limpio en Vectorizar, sin archivo. */
export function ponerRegiones(nombre: string, regiones: RegionTrazada[], mmPorPixel: number): void {
  genImagen.envolver(Promise.resolve(null)) // descarta una conversion que estuviera en camino
  set({ archivo: null })
  ponerDibujo(nombre, regiones, mmPorPixel)
}

export function cambiarParams(cambio: Partial<ParamsCortante>, demora?: number): void {
  set({ params: { ...get().params, ...cambio } })
  construirCortante(demora)
}

export function descartarError(): void {
  set({ error: null })
}

/** El ZIP se arma recien al descargar. */
export function armarZipCortante(): Promise<ConstruccionCortante> {
  return clienteGeometria().construirCortante(
    pedido(),
    new Date().toLocaleDateString('es-AR'),
    true,
  )
}
