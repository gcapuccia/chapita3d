// Worker de imagen (plan §5.4): decodifica el archivo y corre el pipeline.
// La decodificacion vive aca y no en src/pipeline, que no toca APIs del navegador (plan §5.3).

import * as Comlink from 'comlink'
import { convertir, convertirAutomatico, paramsPorDefecto } from '../pipeline/index.ts'
import type { NombrePreset } from '../pipeline/presets.ts'

const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024 // plan §7.1: se rechaza antes de decodificar
const LADO_MAXIMO_ORIGINAL = 8000 // plan §7.1

export type OpcionesImagen = { preset: NombrePreset | 'auto'; clustersFondo?: number[] }

const api = {
  async procesar(archivo: Blob, opciones: OpcionesImagen) {
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      throw new Error(
        `La imagen pesa ${(archivo.size / 1024 / 1024).toFixed(0)} MB: el máximo es 25 MB.`,
      )
    }
    const t0 = performance.now()
    // createImageBitmap respeta la orientacion EXIF de las fotos del celular
    const bitmap = await createImageBitmap(archivo)
    const escala = Math.min(1, LADO_MAXIMO_ORIGINAL / Math.max(bitmap.width, bitmap.height))
    const ancho = Math.round(bitmap.width * escala)
    const alto = Math.round(bitmap.height * escala)
    const lienzo = new OffscreenCanvas(ancho, alto)
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('El navegador no permite leer los píxeles de la imagen.')
    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    bitmap.close()
    const fuente = { ancho, alto, pixeles: ctx.getImageData(0, 0, ancho, alto).data }
    const msDecodificar = performance.now() - t0

    const r =
      opciones.preset === 'auto'
        ? convertirAutomatico(fuente)
        : {
            ...convertir(fuente, {
              ...paramsPorDefecto(opciones.preset),
              clustersFondo: opciones.clustersFondo,
            }),
            preset: opciones.preset,
          }
    const resultado = { ...r, fuente: { ancho, alto }, msDecodificar }
    return Comlink.transfer(resultado, [r.diagnostico.etiquetas.buffer])
  },
}

export type ApiImagen = typeof api

Comlink.expose(api)
