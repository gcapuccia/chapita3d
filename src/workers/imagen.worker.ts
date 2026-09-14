// Worker de imagen (plan §5.4): decodifica el archivo y corre el pipeline.
// La decodificacion vive aca y no en src/pipeline, que no toca APIs del navegador (plan §5.3).

import * as Comlink from 'comlink'
import {
  convertir,
  convertirAutomatico,
  paramsPorDefecto,
  type EtapaPipeline,
  type ImagenRGBA,
} from '../pipeline/index.ts'
import type { NombrePreset } from '../pipeline/presets.ts'

const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024 // plan §7.1: se rechaza antes de decodificar
const LADO_MAXIMO_ORIGINAL = 8000 // plan §7.1

export type OpcionesImagen = {
  preset: NombrePreset | 'auto'
  clustersFondo?: number[]
  /** Cantidad maxima de colores (la solapa Colores). */
  colores?: number
}

export type EtapaImagen = EtapaPipeline | 'decodificado'

/**
 * Los errores viajan con el codigo adelante ("muy-pesada|38000000"): Comlink serializa los errores y
 * pierde las propiedades de las clases propias. La interfaz elige el texto por el codigo (plan §4.7).
 */
export type CodigoErrorImagen = 'muy-pesada' | 'formato'
const errorImagen = (codigo: CodigoErrorImagen, detalle: string) =>
  new Error(`${codigo}|${detalle}`)

// Cambiar la cantidad de colores o el preset reprocesa la misma imagen: no hace falta decodificarla de nuevo
let ultima: { clave: string; fuente: ImagenRGBA } | null = null
const claveDe = (archivo: File | Blob) =>
  archivo instanceof File
    ? `${archivo.name}|${archivo.size}|${archivo.lastModified}`
    : `blob|${archivo.size}`

async function decodificar(archivo: Blob): Promise<ImagenRGBA> {
  const clave = claveDe(archivo)
  if (ultima?.clave === clave) return ultima.fuente
  if (archivo.size > TAMANO_MAXIMO_BYTES) throw errorImagen('muy-pesada', String(archivo.size))
  let bitmap: ImageBitmap
  try {
    // createImageBitmap respeta la orientacion EXIF de las fotos del celular
    bitmap = await createImageBitmap(archivo)
  } catch {
    throw errorImagen('formato', archivo.type)
  }
  const escala = Math.min(1, LADO_MAXIMO_ORIGINAL / Math.max(bitmap.width, bitmap.height))
  const ancho = Math.round(bitmap.width * escala)
  const alto = Math.round(bitmap.height * escala)
  const lienzo = new OffscreenCanvas(ancho, alto)
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw errorImagen('formato', 'sin contexto 2d')
  ctx.drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close()
  const fuente = { ancho, alto, pixeles: ctx.getImageData(0, 0, ancho, alto).data }
  ultima = { clave, fuente }
  return fuente
}

const api = {
  async procesar(archivo: Blob, opciones: OpcionesImagen, alEtapa?: (etapa: EtapaImagen) => void) {
    const t0 = performance.now()
    const fuente = await decodificar(archivo)
    const msDecodificar = performance.now() - t0
    alEtapa?.('decodificado')

    const extra = opciones.colores ? { colores: opciones.colores } : {}
    const r =
      opciones.preset === 'auto'
        ? convertirAutomatico(fuente, extra, alEtapa)
        : {
            ...convertir(
              fuente,
              {
                ...paramsPorDefecto(opciones.preset),
                ...extra,
                clustersFondo: opciones.clustersFondo,
              },
              alEtapa,
            ),
            preset: opciones.preset,
          }
    const resultado = { ...r, fuente: { ancho: fuente.ancho, alto: fuente.alto }, msDecodificar }
    return Comlink.transfer(resultado, [r.diagnostico.etiquetas.buffer])
  },
}

export type ApiImagen = typeof api

Comlink.expose(api)
