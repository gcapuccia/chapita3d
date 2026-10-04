// Las herramientas de edicion, sobre el mapa de etiquetas que deja el pipeline: un byte por pixel
// con el indice del color, o FONDO. TS puro, sin DOM: lo mismo corre en los tests.
//
// Por que editar el mapa y no los contornos: el mapa es lo que el pipeline ya resolvio (islas,
// lineas finas, fondo encerrado). Pintando ahi y volviendo a trazar, lo que ves es exactamente lo
// que se va a imprimir, y borrar una mota es borrar pixeles, no adivinar que anillo sobra.

import { FONDO } from '../pipeline/tipos.ts'

export type Mapa = { etiquetas: Uint8Array; ancho: number; alto: number }

export const esTinta = (v: number) => v !== FONDO

/** Pinta un circulo lleno. Devuelve cuantos pixeles cambiaron. */
export function pintarCirculo(
  m: Mapa,
  cx: number,
  cy: number,
  radio: number,
  valor: number,
): number {
  const { etiquetas, ancho, alto } = m
  const r = Math.max(0.5, radio)
  const r2 = r * r
  const x0 = Math.max(0, Math.ceil(cx - r))
  const x1 = Math.min(ancho - 1, Math.floor(cx + r))
  const y0 = Math.max(0, Math.ceil(cy - r))
  const y1 = Math.min(alto - 1, Math.floor(cy + r))
  let cambiados = 0
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      if (dx * dx + dy * dy > r2) continue
      const i = y * ancho + x
      if (etiquetas[i] === valor) continue
      etiquetas[i] = valor
      cambiados++
    }
  }
  return cambiados
}

/**
 * Pinta de un punto al otro. Hace falta porque el puntero salta pixeles cuando se mueve rapido:
 * sin esto el trazo sale punteado.
 */
export function pintarTrazo(
  m: Mapa,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radio: number,
  valor: number,
): number {
  const largo = Math.hypot(x1 - x0, y1 - y0)
  // Un circulo cada medio radio: se superponen y el trazo sale parejo
  const pasos = Math.max(1, Math.ceil(largo / Math.max(0.5, radio / 2)))
  let cambiados = 0
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos
    cambiados += pintarCirculo(m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radio, valor)
  }
  return cambiados
}

/**
 * La mancha conexa que toca (x, y): los pixeles pegados que son del MISMO color (o del mismo
 * fondo). Por color y no "toda la tinta junta", porque en un logo relleno la tinta entera es una
 * sola mancha y la herramienta no serviria para nada: asi, tocar una hoja agarra la hoja.
 *
 * Vecindad de 4, tambien a proposito: una mota pegada en diagonal al dibujo es una mota y se borra
 * sola, no se lleva el dibujo puesto.
 */
export function componenteEn(m: Mapa, x: number, y: number): Uint32Array | null {
  const { etiquetas, ancho, alto } = m
  const px = Math.floor(x)
  const py = Math.floor(y)
  if (px < 0 || py < 0 || px >= ancho || py >= alto) return null
  const inicio = py * ancho + px
  const busco = etiquetas[inicio]!

  const visto = new Uint8Array(ancho * alto)
  const pila = new Int32Array(ancho * alto)
  const salida = new Uint32Array(ancho * alto)
  let tope = 0
  let n = 0
  pila[tope++] = inicio
  visto[inicio] = 1
  while (tope > 0) {
    const i = pila[--tope]!
    salida[n++] = i
    const ix = i % ancho
    const iy = (i - ix) / ancho
    // arriba, abajo, izquierda, derecha
    if (iy > 0) empujar(i - ancho)
    if (iy < alto - 1) empujar(i + ancho)
    if (ix > 0) empujar(i - 1)
    if (ix < ancho - 1) empujar(i + 1)
  }
  return salida.subarray(0, n)

  function empujar(j: number) {
    if (visto[j] || etiquetas[j] !== busco) return
    visto[j] = 1
    pila[tope++] = j
  }
}

/** Pinta los pixeles que se le pasan. Devuelve cuantos cambiaron. */
export function pintarIndices(m: Mapa, indices: Uint32Array, valor: number): number {
  let cambiados = 0
  for (const i of indices) {
    if (m.etiquetas[i] === valor) continue
    m.etiquetas[i] = valor
    cambiados++
  }
  return cambiados
}

/** Cuanta tinta queda, en pixeles. Sirve para avisar que se borro todo. */
export function pixelesDeTinta(m: Mapa): number {
  let n = 0
  for (const v of m.etiquetas) if (esTinta(v)) n++
  return n
}
