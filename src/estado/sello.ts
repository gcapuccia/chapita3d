// El sello que se esta armando. Mismo patron que el documento de los llaveros: cada cambio
// reconstruye con espera, y los resultados viejos se descartan con generaciones.

import { create } from 'zustand'
import { BISAGRA_POR_DEFECTO, type ParamsBisagra } from '../sellos/bisagra.ts'
import { SELLO_POR_DEFECTO, type ParamsSello } from '../sellos/placas.ts'
import { contornosDeSvg } from '../sellos/svg.ts'
import { crearGeneracion } from '../workers/clientes.ts'
import type { ApiGeometria } from '../workers/geometria.worker.ts'
import { clienteGeometria } from './motor.ts'

export type Construccion = Awaited<ReturnType<ApiGeometria['construirSello']>>

export type Dibujo =
  | { tipo: 'texto'; texto: string; fuente: string }
  | { tipo: 'svg'; nombre: string; contornos: [number, number][][] }

export type ErrorSello = 'svg-vacio' | 'svg-ilegible' | 'trabado'

type Estado = {
  dibujo: Dibujo
  params: ParamsSello
  bisagra: ParamsBisagra
  construccion: Construccion | null
  construyendo: boolean
  error: ErrorSello | null
}

export const useSello = create<Estado>(() => ({
  dibujo: { tipo: 'texto', texto: 'HOLA', fuente: 'gruesa' },
  params: SELLO_POR_DEFECTO,
  bisagra: BISAGRA_POR_DEFECTO,
  construccion: null,
  construyendo: false,
  error: null,
}))

const set = useSello.setState
const get = useSello.getState
const gen = crearGeneracion()
let temporizador: ReturnType<typeof setTimeout> | undefined

/** Nombre del archivo que se va a descargar. */
export const nombreDelSello = (d: Dibujo) =>
  d.tipo === 'texto' ? d.texto || 'sello' : d.nombre.replace(/\.svg$/i, '')

export function construirSello(demora = 200, conZip = false): void {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    const { dibujo, params, bisagra } = get()
    set({ construyendo: true, error: null })
    const pedido = {
      nombre: nombreDelSello(dibujo),
      params,
      bisagra,
      ...(dibujo.tipo === 'texto'
        ? { texto: { texto: dibujo.texto, fuente: dibujo.fuente } }
        : { contornos: dibujo.contornos }),
    }
    gen
      .envolver(
        clienteGeometria().construirSello(pedido, new Date().toLocaleDateString('es-AR'), conZip),
      )
      .then((c) => {
        if (!c) return
        set({ construccion: c, construyendo: false })
      })
      .catch(() => set({ construyendo: false, error: 'trabado' }))
  }, demora)
}

export function cambiarParams(cambio: Partial<ParamsSello>, demora?: number): void {
  set({ params: { ...get().params, ...cambio } })
  construirSello(demora)
}

export function cambiarBisagra(cambio: Partial<ParamsBisagra>, demora?: number): void {
  set({ bisagra: { ...get().bisagra, ...cambio } })
  construirSello(demora)
}

export function ponerTexto(texto: string, fuente: string): void {
  set({ dibujo: { tipo: 'texto', texto, fuente } })
  construirSello(350)
}

/** Entra con contornos ya listos (de Vectorizar), sin pasar por un archivo. */
export function ponerContornos(nombre: string, contornos: [number, number][][]): void {
  set({ dibujo: { tipo: 'svg', nombre, contornos }, error: null })
  construirSello(0)
}

/** Lee el SVG en la pantalla (el lector necesita el DOM) y manda solo los contornos al motor. */
export async function ponerSvg(archivo: File): Promise<boolean> {
  try {
    const contornos = contornosDeSvg(await archivo.text())
    set({ dibujo: { tipo: 'svg', nombre: archivo.name, contornos }, error: null })
    construirSello(0)
    return true
  } catch (e) {
    const codigo = String(e instanceof Error ? e.message : e)
    set({ error: codigo === 'vacio' ? 'svg-vacio' : 'svg-ilegible' })
    return false
  }
}

/** El ZIP se arma recien al descargar. */
export async function armarZipSello(): Promise<Construccion | null> {
  const { dibujo, params, bisagra } = get()
  const pedido = {
    nombre: nombreDelSello(dibujo),
    params,
    bisagra,
    ...(dibujo.tipo === 'texto'
      ? { texto: { texto: dibujo.texto, fuente: dibujo.fuente } }
      : { contornos: dibujo.contornos }),
  }
  return clienteGeometria().construirSello(pedido, new Date().toLocaleDateString('es-AR'), true)
}
