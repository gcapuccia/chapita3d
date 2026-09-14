// Spike 08 · Morfologia que le falta al pipeline para ENGROSAR en vez de borrar.
// Todo se apoya en la transformada de distancia exacta de src/pipeline/morfologia.ts.

import { distanciaCuadrada } from '../../src/pipeline/morfologia.ts'

/**
 * Criterio de "entra un disco de radio r" en la erosion, sobre la distancia² de centro de pixel a
 * centro del pixel de afuera mas cercano:
 *  - 'hoy':        d² >  r²          (morfologia.ts:93)
 *  - 'mayorIgual': d² >= r²
 *  - 'medioPx':    d² >= (r + 0,5)²  (conservador: todo lo que podria ser mas fino que 2r cuenta como fino)
 */
export type UmbralFino = 'hoy' | 'mayorIgual' | 'medioPx'

export function erosionCumple(d2: number, radio: number, u: UmbralFino): boolean {
  switch (u) {
    case 'hoy':
      return d2 > radio * radio
    case 'mayorIgual':
      return d2 >= radio * radio
    case 'medioPx':
      return d2 >= (radio + 0.5) * (radio + 0.5)
  }
}

/** Apertura con disco (como src/pipeline/morfologia.ts › apertura) pero con el criterio elegible. */
export function aperturaV2(
  mascara: Uint8Array,
  ancho: number,
  alto: number,
  radio: number,
  u: UmbralFino,
): Uint8Array {
  const aFuera = distanciaCuadrada((i) => mascara[i] === 0, ancho, alto, true)
  const erosionada = new Uint8Array(ancho * alto)
  let alguna = false
  for (let i = 0; i < erosionada.length; i++) {
    if (erosionCumple(aFuera[i]!, radio, u)) {
      erosionada[i] = 1
      alguna = true
    }
  }
  const abierta = new Uint8Array(ancho * alto)
  if (!alguna) return abierta
  // La dilatacion usa el mismo radio efectivo que la erosion
  const rd = u === 'medioPx' ? radio + 0.5 : radio
  const aErosionada = distanciaCuadrada((i) => erosionada[i] === 1, ancho, alto)
  for (let i = 0; i < abierta.length; i++)
    abierta[i] = mascara[i] === 1 && aErosionada[i]! <= rd * rd ? 1 : 0
  return abierta
}

/** Dilatacion con disco de radio `radio` (d² <= r²), en O(pixeles). */
export function dilatar(mascara: Uint8Array, ancho: number, alto: number, radio: number) {
  const d = distanciaCuadrada((i) => mascara[i] === 1, ancho, alto)
  const salida = new Uint8Array(ancho * alto)
  const r2 = radio * radio
  for (let i = 0; i < salida.length; i++) salida[i] = d[i]! <= r2 ? 1 : 0
  return salida
}

/**
 * Esqueleto de Zhang-Suen (1984). Recorre solo los pixeles encendidos: sobre partes finas termina en
 * pocas pasadas (una por pixel de medio ancho).
 */
export function esqueleto(mascara: Uint8Array, ancho: number, alto: number): Uint8Array {
  const m = new Uint8Array(mascara)
  let activos: number[] = []
  for (let i = 0; i < m.length; i++) if (m[i]) activos.push(i)
  const en = (x: number, y: number) =>
    x < 0 || y < 0 || x >= ancho || y >= alto ? 0 : m[y * ancho + x]!
  for (let cambio = true; cambio;) {
    cambio = false
    for (const paso of [0, 1]) {
      const borrar: number[] = []
      for (const i of activos) {
        if (!m[i]) continue
        const x = i % ancho
        const y = (i / ancho) | 0
        const p2 = en(x, y - 1)
        const p3 = en(x + 1, y - 1)
        const p4 = en(x + 1, y)
        const p5 = en(x + 1, y + 1)
        const p6 = en(x, y + 1)
        const p7 = en(x - 1, y + 1)
        const p8 = en(x - 1, y)
        const p9 = en(x - 1, y - 1)
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
        if (b < 2 || b > 6) continue
        const s = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
        let a = 0
        for (let k = 0; k < 8; k++) if (!s[k] && s[k + 1]) a++
        if (a !== 1) continue
        if (paso === 0) {
          if (p2 * p4 * p6 || p4 * p6 * p8) continue
        } else if (p2 * p4 * p8 || p2 * p6 * p8) continue
        borrar.push(i)
      }
      for (const i of borrar) m[i] = 0
      if (borrar.length) cambio = true
    }
    activos = activos.filter((i) => m[i])
  }
  return m
}

/** Componentes conexas (8 u 4 vecinos). Llama `alVisitar` con los indices de cada una. */
export function componentes(
  esParte: (i: number) => boolean,
  ancho: number,
  alto: number,
  ocho: boolean,
  alVisitar: (miembros: Int32Array) => void,
) {
  const n = ancho * alto
  const visto = new Uint8Array(n)
  const cola = new Int32Array(n)
  for (let inicio = 0; inicio < n; inicio++) {
    if (visto[inicio] || !esParte(inicio)) continue
    let fin = 0
    cola[fin++] = inicio
    visto[inicio] = 1
    for (let c = 0; c < fin; c++) {
      const i = cola[c]!
      const x = i % ancho
      const y = (i / ancho) | 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= alto) continue
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          if (!ocho && dx && dy) continue
          const xx = x + dx
          if (xx < 0 || xx >= ancho) continue
          const j = yy * ancho + xx
          if (visto[j] || !esParte(j)) continue
          visto[j] = 1
          cola[fin++] = j
        }
      }
    }
    alVisitar(cola.slice(0, fin))
  }
}

/** Pixeles con valor 0 que NO se alcanzan desde el borde de la imagen pasando por ceros (4 vecinos). */
export function encerrados(mascara: Uint8Array, ancho: number, alto: number): Uint8Array {
  const n = ancho * alto
  const afuera = new Uint8Array(n)
  const cola = new Int32Array(n)
  let fin = 0
  const sembrar = (i: number) => {
    if (mascara[i] === 0 && !afuera[i]) {
      afuera[i] = 1
      cola[fin++] = i
    }
  }
  for (let x = 0; x < ancho; x++) {
    sembrar(x)
    sembrar((alto - 1) * ancho + x)
  }
  for (let y = 0; y < alto; y++) {
    sembrar(y * ancho)
    sembrar(y * ancho + ancho - 1)
  }
  for (let c = 0; c < fin; c++) {
    const i = cola[c]!
    const x = i % ancho
    if (x > 0) sembrar(i - 1)
    if (x < ancho - 1) sembrar(i + 1)
    if (i >= ancho) sembrar(i - ancho)
    if (i + ancho < n) sembrar(i + ancho)
  }
  const salida = new Uint8Array(n)
  for (let i = 0; i < n; i++) salida[i] = mascara[i] === 0 && !afuera[i] ? 1 : 0
  return salida
}
