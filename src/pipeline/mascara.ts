// Paso 2 y 3 del plan (§3): que es fondo y que es dibujo, sin IA.

import { rgbAOklab } from './color.ts'
import type { ImagenRGBA, Recorte } from './tipos.ts'

/** Hay alfa util si al menos el 1 % de los pixeles es transparente. */
export function tieneAlfaUtil(img: ImagenRGBA, umbralAlfa: number): boolean {
  const p = img.pixeles
  let transparentes = 0
  for (let o = 3; o < p.length; o += 4) if (p[o]! < umbralAlfa) transparentes++
  return transparentes >= (img.ancho * img.alto) / 100
}

/** 2a · El canal alfa decide. */
export function mascaraPorAlfa(img: ImagenRGBA, umbralAlfa: number): Uint8Array {
  const mascara = new Uint8Array(img.ancho * img.alto)
  for (let i = 0; i < mascara.length; i++)
    mascara[i] = img.pixeles[i * 4 + 3]! >= umbralAlfa ? 1 : 0
  return mascara
}

/**
 * 2b · Flood fill desde los bordes con distancia OKLab.
 *
 * Semillas: los pixeles del borde parecidos al color dominante del borde (la mediana).
 * Asi, si el dibujo toca el borde de la imagen, esos pixeles no arrancan a comerse el dibujo.
 * Cada pixel se compara con el color de SU semilla, no con el vecino: comparar con el
 * vecino se filtra por los bordes suaves (escaneos, JPG), donde el color cambia de a poco.
 *
 * `tolerancia` en distancia OKLab (el default 10 del plan es ΔOKLab × 100 = 0,10).
 */
export function mascaraPorFloodFill(img: ImagenRGBA, tolerancia: number): Uint8Array {
  const { ancho, alto, pixeles } = img
  const n = ancho * alto
  const lab = new Float32Array(n * 3)
  for (let i = 0; i < n; i++)
    rgbAOklab(pixeles[i * 4]!, pixeles[i * 4 + 1]!, pixeles[i * 4 + 2]!, lab, i * 3)

  const borde: number[] = []
  for (let x = 0; x < ancho; x++) borde.push(x, (alto - 1) * ancho + x)
  for (let y = 1; y < alto - 1; y++) borde.push(y * ancho, y * ancho + ancho - 1)

  const mediana = [0, 1, 2].map((c) => {
    const valores = borde.map((i) => lab[i * 3 + c]!).sort((a, b) => a - b)
    return valores[valores.length >> 1]!
  })
  const t2 = tolerancia * tolerancia
  const distancia2 = (i: number, j: number) => {
    const dL = lab[i * 3]! - lab[j * 3]!
    const da = lab[i * 3 + 1]! - lab[j * 3 + 1]!
    const db = lab[i * 3 + 2]! - lab[j * 3 + 2]!
    return dL * dL + da * da + db * db
  }

  const semillaDe = new Int32Array(n).fill(-1)
  const cola = new Int32Array(n)
  let cabeza = 0
  let fin = 0
  for (const i of borde) {
    if (semillaDe[i] !== -1) continue
    const dL = lab[i * 3]! - mediana[0]!
    const da = lab[i * 3 + 1]! - mediana[1]!
    const db = lab[i * 3 + 2]! - mediana[2]!
    if (dL * dL + da * da + db * db >= t2) continue
    semillaDe[i] = i
    cola[fin++] = i
  }

  while (cabeza < fin) {
    const i = cola[cabeza++]!
    const semilla = semillaDe[i]!
    const x = i % ancho
    const vecinos = [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]
    for (const j of vecinos) {
      if (j < 0 || j >= n || semillaDe[j] !== -1) continue
      if (distancia2(j, semilla) >= t2) continue
      semillaDe[j] = semilla
      cola[fin++] = j
    }
  }

  const mascara = new Uint8Array(n)
  for (let i = 0; i < n; i++) mascara[i] = semillaDe[i] === -1 ? 1 : 0
  return mascara
}

/**
 * 3 · Erosion anti-halo: saca `pasos` pixeles del borde de la mascara.
 * Sin esto, los pixeles de antialias (mezcla de dibujo y fondo) se vuelven un color mas.
 */
export function erosionar(
  mascara: Uint8Array,
  ancho: number,
  alto: number,
  pasos: number,
): Uint8Array {
  let actual = mascara
  for (let paso = 0; paso < pasos; paso++) {
    const siguiente = new Uint8Array(actual.length)
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const i = y * ancho + x
        siguiente[i] =
          actual[i] === 1 &&
          x > 0 &&
          x < ancho - 1 &&
          y > 0 &&
          y < alto - 1 &&
          actual[i - 1] === 1 &&
          actual[i + 1] === 1 &&
          actual[i - ancho] === 1 &&
          actual[i + ancho] === 1
            ? 1
            : 0
      }
    }
    actual = siguiente
  }
  return actual
}

/** Caja que encierra la mascara, o null si esta vacia. */
export function cajaDeMascara(mascara: Uint8Array, ancho: number, alto: number): Recorte | null {
  let x0 = ancho
  let y0 = alto
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (mascara[y * ancho + x] !== 1) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 }
}
