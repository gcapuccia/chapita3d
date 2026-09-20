// El documento actual y lo que se deriva de el (plan §6: "la unica capa que sabe que es el documento actual").
//
// Flujo: archivo → worker de imagen (conversion) → crearDiseno → worker de geometria (construccion).
// Cada cambio del diseño reconstruye con debounce; los resultados viejos se descartan con tokens.

import * as Comlink from 'comlink'
import { create } from 'zustand'
import { crearDiseno, nombreDeColor } from '../diseno/crear.ts'
import { agregarTexto } from '../diseno/texto.ts'
import type { Diseno, Filamento } from '../diseno/tipos.ts'
import type { NombrePreset } from '../pipeline/presets.ts'
import { crearGeneracion } from '../workers/clientes.ts'
import type { ApiGeometria } from '../workers/geometria.worker.ts'
import type { ApiImagen, EtapaImagen } from '../workers/imagen.worker.ts'
import { clienteGeometria, clienteImagen, reiniciarImagen } from './motor.ts'

export type Conversion = Awaited<ReturnType<ApiImagen['procesar']>>
export type Construccion = Awaited<ReturnType<ApiGeometria['construirLlavero']>>

/** Los cuatro hitos del overlay (plan §4.2). */
export type Hito = 'leer' | 'fondo' | 'colores' | 'llavero'

export type ErrorArchivo = {
  codigo: 'formato' | 'heic' | 'muy-pesada' | 'trabado' | 'sin-dibujo' | 'proyecto-invalido'
  archivo: string
  detalle?: string
}

type Estado = {
  archivo: File | null
  preset: NombrePreset | 'auto'
  colores: number
  /** Grosor elegido a mano para las lineas de un color (hex de la paleta → mm). */
  grosorPorHex: Record<string, number>
  /** Filamento elegido a mano (color de la imagen, o 'base' → hex del filamento). */
  colorElegido: Record<string, string>
  conversion: Conversion | null
  diseno: Diseno | null
  construccion: Construccion | null
  procesando: { hito: Hito; desde: number } | null
  construyendo: boolean
  error: ErrorArchivo | null
}

export const useDocumento = create<Estado>(() => ({
  archivo: null,
  preset: 'auto',
  colores: 4,
  grosorPorHex: {},
  colorElegido: {},
  conversion: null,
  diseno: null,
  construccion: null,
  procesando: null,
  construyendo: false,
  error: null,
}))

const set = useDocumento.setState
const get = useDocumento.getState
const genImagen = crearGeneracion()
const genGeometria = crearGeneracion()
const FORMATOS = ['image/png', 'image/jpeg', 'image/webp']
const MAXIMO_BYTES = 25 * 1024 * 1024

const HITO_DE_ETAPA: Partial<Record<EtapaImagen, Hito>> = {
  decodificado: 'fondo',
  mascaraPrevia: 'fondo',
  prefiltro: 'colores',
  cuantizar: 'colores',
  limpiar: 'colores',
  contornos: 'colores',
}

// ------------------------------------------------------------------ geometria

let temporizador: ReturnType<typeof setTimeout> | undefined

function reconstruir(demora = 150) {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    const { diseno } = get()
    if (!diseno) return
    set({ construyendo: true })
    genGeometria
      .envolver(clienteGeometria().construirLlavero(diseno, '', false))
      .then((c) => {
        if (!c) return
        set({ construccion: c, construyendo: false })
        if (get().procesando) set({ procesando: null })
      })
      .catch(() =>
        set({
          construyendo: false,
          procesando: null,
          error: { codigo: 'trabado', archivo: get().archivo?.name ?? '' },
        }),
      )
  }, demora)
}

/** Cambia el diseño y reconstruye con debounce (plan §7.6: 150 ms). */
export function cambiarDiseno(cambio: (d: Diseno) => Diseno, demora?: number): void {
  const { diseno } = get()
  if (!diseno) return
  set({ diseno: { ...cambio(diseno), actualizadoEn: new Date().toISOString() } })
  reconstruir(demora)
}

/**
 * Identidad de un filamento entre corridas: el primer color de la imagen que cayo en el. La base
 * tiene clave propia porque puede no venir de la imagen.
 */
export function claveDeFilamento(f: Filamento, esBase: boolean): string {
  return esBase ? 'base' : (f.deLaImagen?.[0] ?? f.hex)
}

/** Vuelve a poner los colores que el usuario eligio a mano, despues de reprocesar la imagen. */
function aplicarColoresElegidos(d: Diseno): Diseno {
  const elegidos = get().colorElegido
  if (!Object.keys(elegidos).length) return d
  return {
    ...d,
    filamentos: d.filamentos.map((f) => {
      const hex = elegidos[claveDeFilamento(f, f.id === d.contorno.filamentoId)]
      return hex ? { ...f, hex, nombre: nombreDeColor(hex), elegido: true } : f
    }),
  }
}

/** Lo que el usuario eligio en Colores y Llavero sobrevive a reprocesar la imagen. */
function conservarOpciones(anterior: Diseno | null, nuevo: Diseno): Diseno {
  if (!anterior) return nuevo
  let d: Diseno = {
    ...nuevo,
    id: anterior.id,
    creadoEn: anterior.creadoEn,
    impresion: {
      ...nuevo.impresion,
      modoColor: anterior.impresion.modoColor,
      slots: anterior.impresion.slots,
    },
    cuerpo: anterior.cuerpo,
    contorno: {
      ...nuevo.contorno,
      activo: anterior.contorno.activo,
      offset: anterior.contorno.offset,
    },
    argolla: anterior.argolla,
  }
  const escala = anterior.piezas.find((p) => p.tipo === 'region')?.transform.sx ?? 1
  d = {
    ...d,
    piezas: d.piezas.map((p) => ({ ...p, transform: { ...p.transform, sx: escala, sy: escala } })),
  }
  for (const t of anterior.piezas.filter((p) => p.tipo === 'texto')) {
    if (t.geometria.kind === 'texto') {
      d = agregarTexto(d, t.geometria.texto, {
        fuente: t.geometria.fuente as 'redonda',
        tamano: t.geometria.tamano,
      })
    }
  }
  return d
}

// ------------------------------------------------------------------ imagen

async function procesar() {
  const { archivo, preset, colores, grosorPorHex, diseno: anterior } = get()
  if (!archivo) return
  set({ procesando: { hito: 'leer', desde: performance.now() }, error: null })
  const alEtapa = Comlink.proxy((etapa: EtapaImagen) => {
    const hito = HITO_DE_ETAPA[etapa]
    const actual = get().procesando
    if (hito && actual && hito !== actual.hito) set({ procesando: { ...actual, hito } })
  })
  try {
    const conversion = await genImagen.envolver(
      clienteImagen().procesar(archivo, { preset, colores, grosorPorHex }, alEtapa),
    )
    if (!conversion) return
    if (!conversion.regiones.length) {
      set({ procesando: null, error: { codigo: 'sin-dibujo', archivo: archivo.name } })
      return
    }
    const nuevo = crearDiseno(conversion.regiones, {
      nombre: archivo.name.replace(/\.[^.]+$/, '') || 'llavero',
      id: anterior?.id ?? crypto.randomUUID(),
      ahora: new Date().toISOString(),
      appVersion: '0.1.0',
    })
    set({
      conversion,
      diseno: aplicarColoresElegidos(conservarOpciones(anterior, nuevo)),
      procesando: { hito: 'llavero', desde: get().procesando?.desde ?? performance.now() },
    })
    reconstruir(0)
  } catch (e) {
    const [codigo, detalle] = String(e instanceof Error ? e.message : e).split('|')
    set({
      procesando: null,
      error: {
        codigo: codigo === 'muy-pesada' || codigo === 'formato' ? codigo : 'trabado',
        archivo: archivo.name,
        detalle,
      },
    })
  }
}

/** Valida y procesa un archivo nuevo. Devuelve false si no se pudo (el error queda en el estado). */
export function elegirArchivo(archivo: File): boolean {
  const nombre = archivo.name
  if (/\.(heic|heif)$/i.test(nombre) || /hei[cf]/i.test(archivo.type)) {
    set({ error: { codigo: 'heic', archivo: nombre } })
    return false
  }
  if (archivo.size > MAXIMO_BYTES) {
    set({ error: { codigo: 'muy-pesada', archivo: nombre, detalle: String(archivo.size) } })
    return false
  }
  if (!FORMATOS.includes(archivo.type)) {
    set({ error: { codigo: 'formato', archivo: nombre } })
    return false
  }
  // Una imagen nueva arranca un diseño nuevo
  set({
    archivo,
    conversion: null,
    diseno: null,
    construccion: null,
    preset: 'auto',
    colores: 4,
    grosorPorHex: {},
    colorElegido: {},
  })
  void procesar()
  return true
}

/** Abre un proyecto.json guardado antes (plan §4.1). Sin la imagen: Fondo y Colores quedan bloqueadas. */
export async function abrirProyecto(archivo: File): Promise<boolean> {
  try {
    const d = JSON.parse(await archivo.text()) as Diseno
    if (d.version !== 1 || !Array.isArray(d.piezas) || !Array.isArray(d.filamentos))
      throw new Error('forma')
    set({
      archivo: null,
      conversion: null,
      construccion: null,
      diseno: d,
      error: null,
      procesando: { hito: 'llavero', desde: performance.now() },
    })
    reconstruir(0)
    return true
  } catch {
    set({ error: { codigo: 'proyecto-invalido', archivo: archivo.name } })
    return false
  }
}

/** Carga un diseño ya armado (de un proyecto.json o de la cuenta) y lo reconstruye. */
export function usarDiseno(d: Diseno): void {
  set({
    archivo: null,
    conversion: null,
    construccion: null,
    diseno: d,
    error: null,
    procesando: { hito: 'llavero', desde: performance.now() },
  })
  reconstruir(0)
}

export function cambiarPreset(preset: NombrePreset | 'auto'): void {
  set({ preset })
  void procesar()
}

export function cambiarColores(colores: number): void {
  set({ colores, grosorPorHex: {} })
  void procesar()
}

/**
 * Grosor de las lineas de un color, en mm (null = automatico). Reprocesa la imagen con espera,
 * asi mover el deslizador no dispara una corrida por paso.
 */
let temporizadorGrosor: ReturnType<typeof setTimeout> | undefined
export function cambiarGrosorDeLineas(hex: string, mm: number | null, demora = 400): void {
  const grosorPorHex = { ...get().grosorPorHex }
  if (mm === null) delete grosorPorHex[hex]
  else grosorPorHex[hex] = mm
  set({ grosorPorHex })
  clearTimeout(temporizadorGrosor)
  temporizadorGrosor = setTimeout(() => void procesar(), demora)
}

/** Cambia el color de un filamento. Es solo del diseño: no hay que reprocesar la imagen. */
export function cambiarColorDeFilamento(id: string, hex: string): void {
  const d = get().diseno
  const f = d?.filamentos.find((x) => x.id === id)
  if (!d || !f) return
  set({
    colorElegido: {
      ...get().colorElegido,
      [claveDeFilamento(f, f.id === d.contorno.filamentoId)]: hex,
    },
  })
  cambiarDiseno((actual) => ({
    ...actual,
    filamentos: actual.filamentos.map((x) =>
      x.id === id ? { ...x, hex, nombre: nombreDeColor(hex), elegido: true } : x,
    ),
  }))
}

/** Cancelar: termina el worker y deja el archivo cargado, no perdido (plan §4.2). */
export function cancelar(): void {
  reiniciarImagen()
  set({ procesando: null })
}

export function descartarError(): void {
  set({ error: null })
}

export function empezarDeNuevo(): void {
  set({
    archivo: null,
    conversion: null,
    diseno: null,
    construccion: null,
    procesando: null,
    error: null,
    preset: 'auto',
    colores: 4,
    grosorPorHex: {},
    colorElegido: {},
  })
}

/** El ZIP se arma recien al descargar. */
export async function armarZip() {
  const { diseno } = get()
  if (!diseno) return null
  return clienteGeometria().construirLlavero(diseno, new Date().toLocaleDateString('es-AR'), true)
}
