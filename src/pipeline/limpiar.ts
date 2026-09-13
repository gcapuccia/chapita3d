// Paso 7 del plan (§3): limpiar el mapa de etiquetas antes de trazar.
//  a) moda 3×3: saca pixeles sueltos
//  b) apertura por color: lo mas angosto que anchoMinimoDetalle no se puede imprimir
//  c) islas: lo mas chico que areaMinimaIsla se funde con el vecino
//
// El plan lista islas antes que apertura. Se hace al reves porque la apertura puede partir
// una region y dejar islas nuevas: si las islas van primero, esas quedan sin limpiar.

import { apertura } from './morfologia.ts'
import { FONDO, SIN_ASIGNAR } from './tipos.ts'

export type ParamsLimpiar = {
  mmPorPixel: number
  anchoMinimoDetalleMm: number
  areaMinimaIslaMm2: number
}

function moda(etiquetas: Uint8Array, ancho: number, alto: number, colores: number): Uint8Array {
  const salida = new Uint8Array(etiquetas)
  const cuenta = new Uint16Array(colores)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      const propia = etiquetas[i]!
      if (propia === FONDO) continue
      cuenta.fill(0)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= ancho || yy >= alto) continue
          const e = etiquetas[yy * ancho + xx]!
          if (e !== FONDO) cuenta[e]!++
        }
      }
      let mejor = propia
      for (let c = 0; c < colores; c++) if (cuenta[c]! > cuenta[mejor]!) mejor = c
      salida[i] = mejor
    }
  }
  return salida
}

/**
 * Rellena SIN_ASIGNAR con el color asignado mas cercano (BFS desde todos a la vez).
 * Lo que queda sin alcanzar (partes sin ningun pixel asignado cerca) pasa a fondo.
 */
function rellenar(etiquetas: Uint8Array, ancho: number): void {
  const n = etiquetas.length
  const cola = new Int32Array(n)
  let fin = 0
  for (let i = 0; i < n; i++) if (etiquetas[i]! < SIN_ASIGNAR) cola[fin++] = i
  for (let cabeza = 0; cabeza < fin; cabeza++) {
    const i = cola[cabeza]!
    const x = i % ancho
    for (const j of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
      if (j < 0 || j >= n || etiquetas[j] !== SIN_ASIGNAR) continue
      etiquetas[j] = etiquetas[i]!
      cola[fin++] = j
    }
  }
  for (let i = 0; i < n; i++) if (etiquetas[i] === SIN_ASIGNAR) etiquetas[i] = FONDO
}

function islas(etiquetas: Uint8Array, ancho: number, colores: number, minimoPx: number) {
  const n = etiquetas.length
  const componente = new Int32Array(n).fill(-1)
  const cola = new Int32Array(n)
  const vecinosDe = new Float64Array(colores)
  for (let inicio = 0; inicio < n; inicio++) {
    const color = etiquetas[inicio]!
    if (color === FONDO || componente[inicio] !== -1) continue
    let fin = 0
    cola[fin++] = inicio
    componente[inicio] = inicio
    vecinosDe.fill(0)
    for (let cabeza = 0; cabeza < fin; cabeza++) {
      const i = cola[cabeza]!
      const x = i % ancho
      for (const j of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
        if (j < 0 || j >= n) continue
        const e = etiquetas[j]!
        if (e === color) {
          if (componente[j] === -1) {
            componente[j] = inicio
            cola[fin++] = j
          }
        } else if (e !== FONDO) {
          vecinosDe[e]!++
        }
      }
    }
    if (fin >= minimoPx) continue
    // La isla se funde con el color con el que comparte mas borde; si solo toca fondo, es ruido
    let destino = FONDO
    let mejor = 0
    for (let c = 0; c < colores; c++) {
      if (vecinosDe[c]! > mejor) {
        mejor = vecinosDe[c]!
        destino = c
      }
    }
    for (let q = 0; q < fin; q++) etiquetas[cola[q]!] = destino
  }
}

export function limpiar(
  etiquetas: Uint8Array,
  ancho: number,
  alto: number,
  colores: number,
  p: ParamsLimpiar,
): Uint8Array {
  // El borde de antialias llega sin asignar: toma el color del interior mas cercano
  const inicial = new Uint8Array(etiquetas)
  rellenar(inicial, ancho)
  const salida = moda(inicial, ancho, alto, colores)

  const radio = p.anchoMinimoDetalleMm / 2 / p.mmPorPixel
  if (radio >= 0.5) {
    for (let c = 0; c < colores; c++) {
      const mascaraColor = new Uint8Array(salida.length)
      for (let i = 0; i < salida.length; i++) mascaraColor[i] = salida[i] === c ? 1 : 0
      const abierta = apertura(mascaraColor, ancho, alto, radio)
      for (let i = 0; i < salida.length; i++) {
        if (mascaraColor[i] === 1 && abierta[i] === 0) salida[i] = SIN_ASIGNAR
      }
    }
    rellenar(salida, ancho)
  }

  islas(salida, ancho, colores, p.areaMinimaIslaMm2 / (p.mmPorPixel * p.mmPorPixel))
  return salida
}
