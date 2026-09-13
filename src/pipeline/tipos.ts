/** Imagen decodificada, RGBA de 8 bits por canal, fila por fila desde arriba. */
export type ImagenRGBA = { ancho: number; alto: number; pixeles: Uint8ClampedArray }

/** Rectangulo en pixeles de la imagen fuente. */
export type Recorte = { x: number; y: number; ancho: number; alto: number }

export type Oklab = [number, number, number]

export type ColorPaleta = { hex: string; oklab: Oklab; pixeles: number }

/** Etiqueta de fondo en los mapas de etiquetas (Uint8Array). */
export const FONDO = 255
/** Etiqueta temporal de "sin asignar" durante la limpieza. */
export const SIN_ASIGNAR = 254

/**
 * Una region de un color, en mm, con y hacia arriba.
 * Es estructuralmente igual a RegionColor de src/geometria/regiones.ts, a proposito:
 * el pipeline no importa nada de geometria (no sabe que es un llavero, plan §6).
 */
export type RegionTrazada = {
  id: string
  hex: string
  /** Mayor numero = gana en la cadena de resta. Se asigna por area: lo mas chico gana. */
  prioridad: number
  contornos: [number, number][][]
  areaPx: number
}

export type EtapaPipeline =
  | 'previa'
  | 'mascaraPrevia'
  | 'reescalar'
  | 'mascara'
  | 'prefiltro'
  | 'cuantizar'
  | 'limpiar'
  | 'contornos'
