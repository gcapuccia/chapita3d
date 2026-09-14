// Spike 08 · Arreglo 4: colores de antialias y de fondo ocupando filamentos (causas #4 y #5).
//
//  a) cuantizarSinTransiciones: k-means se AJUSTA sin los pixeles de transicion (un pixel cuyo color
//     queda sobre el segmento entre dos vecinos opuestos que difieren) y despues se ASIGNAN todos al
//     centroide mas cercano. El centro de una linea fina no es transicion (sus dos vecinos se parecen).
//  b) fusionarIntermedios: un color de la paleta que (1) esta "entre" otros dos colores (o entre uno y
//     el fondo) en OKLab y (2) es fino a escala de impresion es antialias o trazo diluido: sus pixeles
//     pasan al color de la pareja mas parecido.
//  c) slotsUsados: filamentos que pide el diseño con la base blanca aparte (causa #5).

import { rgbAOklab } from '../../src/pipeline/color.ts'
import { cuantizar, type ParamsCuantizar } from '../../src/pipeline/cuantizar.ts'
import {
  FONDO,
  SIN_ASIGNAR,
  type ColorPaleta,
  type ImagenRGBA,
  type Oklab,
} from '../../src/pipeline/tipos.ts'
import { esBase } from './engrosar.ts'
import { aperturaV2 } from './morfologia2.ts'

export function mascaraTransiciones(img: ImagenRGBA, mascara: Uint8Array): Uint8Array {
  const { ancho, alto, pixeles } = img
  const n = ancho * alto
  const lab = new Float32Array(n * 3)
  for (let i = 0; i < n; i++)
    rgbAOklab(pixeles[i * 4]!, pixeles[i * 4 + 1]!, pixeles[i * 4 + 2]!, lab, i * 3)
  const d = (i: number, j: number) =>
    Math.hypot(
      lab[i * 3]! - lab[j * 3]!,
      lab[i * 3 + 1]! - lab[j * 3 + 1]!,
      lab[i * 3 + 2]! - lab[j * 3 + 2]!,
    )
  const salida = new Uint8Array(n)
  const pasos = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const
  for (let y = 1; y < alto - 1; y++)
    for (let x = 1; x < ancho - 1; x++) {
      const i = y * ancho + x
      if (!mascara[i]) continue
      for (const [dx, dy] of pasos) {
        const a = i - dy * ancho - dx
        const b = i + dy * ancho + dx
        const ab = d(a, b)
        if (ab < 0.06) continue
        const ai = d(a, i)
        const ib = d(i, b)
        if (ai + ib <= ab * 1.1 && Math.min(ai, ib) >= ab * 0.15) {
          salida[i] = 1
          break
        }
      }
    }
  return salida
}

export function cuantizarSinTransiciones(
  img: ImagenRGBA,
  interior: Uint8Array,
  transiciones: Uint8Array,
  p: ParamsCuantizar,
) {
  const ajuste = new Uint8Array(interior.length)
  let quedan = 0
  let total = 0
  for (let i = 0; i < ajuste.length; i++) {
    if (!interior[i]) continue
    total++
    if (!transiciones[i]) {
      ajuste[i] = 1
      quedan++
    }
  }
  // Si casi todo es transicion (dibujo de puras lineas finas), se ajusta con todo como hoy
  if (quedan < total * 0.2) return { ...cuantizar(img, interior, p), excluidos: 0 }
  const { paleta } = cuantizar(img, ajuste, p)
  const etiquetas = new Uint8Array(interior.length).fill(FONDO)
  const lab = new Float32Array(3)
  const cuenta = new Array<number>(paleta.length).fill(0)
  for (let i = 0; i < interior.length; i++) {
    if (!interior[i]) continue
    rgbAOklab(img.pixeles[i * 4]!, img.pixeles[i * 4 + 1]!, img.pixeles[i * 4 + 2]!, lab, 0)
    let mejor = 0
    let mejorD = Infinity
    for (let k = 0; k < paleta.length; k++) {
      const o = paleta[k]!.oklab
      const dd = (lab[0]! - o[0]) ** 2 + (lab[1]! - o[1]) ** 2 + (lab[2]! - o[2]) ** 2
      if (dd < mejorD) {
        mejorD = dd
        mejor = k
      }
    }
    etiquetas[i] = mejor
    cuenta[mejor]!++
  }
  return {
    paleta: paleta.map((c, k) => ({ ...c, pixeles: cuenta[k]! })),
    etiquetas,
    excluidos: total - quedan,
  }
}

const dist = (a: Oklab, b: Oklab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function entre(c: Oklab, a: Oklab, b: Oklab): boolean {
  const ab = dist(a, b)
  if (ab < 0.08) return false
  const ac = dist(a, c)
  const cb = dist(c, b)
  return ac + cb <= ab * 1.08 && Math.min(ac, cb) >= ab * 0.1
}

/**
 * Saca de la paleta los colores intermedios: los que quedan "entre" otros dos (o entre uno y el fondo) en
 * OKLab y que son finos a escala de impresion (>= 85 % de sus pixeles desaparece con la apertura de
 * radio `radioFinoPx`). Son antialias o trazos finos diluidos con el fondo. Cada pixel suyo pasa al color
 * de la pareja que mas se le parece (si la pareja es color + fondo, al color): asi un trazo aislado no
 * queda sin asignar y termina como fondo.
 */
export function fusionarIntermedios(
  paleta: ColorPaleta[],
  etiquetas: Uint8Array,
  ancho: number,
  alto: number,
  fondoLab: Oklab | null,
  img: ImagenRGBA,
  radioFinoPx: number,
): { paleta: ColorPaleta[]; etiquetas: Uint8Array; sacados: string[] } {
  let pal = paleta
  let et = new Uint8Array(etiquetas)
  const sacados: string[] = []
  const lab = new Float32Array(3)
  for (let vuelta = 0; vuelta < paleta.length; vuelta++) {
    const total = et.reduce((s, v) => s + (v < SIN_ASIGNAR ? 1 : 0), 0)
    let elegido = -1
    let pareja: [number, number] = [-1, -1]
    for (let c = 0; c < pal.length && elegido < 0; c++) {
      const cc = pal[c]!
      if (cc.pixeles > total * 0.25) continue
      // Candidatos: los otros colores (indice) y el fondo (-2)
      const otros: { k: number; o: Oklab }[] = pal.flatMap((x, k) =>
        k === c ? [] : [{ k, o: x.oklab }],
      )
      if (fondoLab) otros.push({ k: -2, o: fondoLab })
      let par: [number, number] | null = null
      for (let a = 0; a < otros.length && !par; a++)
        for (let b = a + 1; b < otros.length && !par; b++)
          if (entre(cc.oklab, otros[a]!.o, otros[b]!.o)) par = [otros[a]!.k, otros[b]!.k]
      if (!par) continue
      const mascara = new Uint8Array(et.length)
      let propios = 0
      for (let i = 0; i < et.length; i++)
        if (et[i] === c) {
          mascara[i] = 1
          propios++
        }
      const abierta = aperturaV2(mascara, ancho, alto, radioFinoPx, 'hoy')
      let quedan = 0
      for (let i = 0; i < et.length; i++) quedan += abierta[i]!
      // Fino a escala de impresion. (Probado y descartado: "o muy chico, < 3 % del dibujo" se come la
      // nariz rosa de dibujo-02 y la sombra marron de sticker-01 del banco.)
      if (propios && quedan / propios <= 0.15) {
        elegido = c
        pareja = par
      }
    }
    if (elegido < 0) break
    sacados.push(pal[elegido]!.hex)
    const destinos = pareja.filter((k) => k >= 0)
    const nuevo = new Uint8Array(et.length)
    const reindex = (v: number) => (v >= SIN_ASIGNAR ? v : v > elegido ? v - 1 : v)
    for (let i = 0; i < et.length; i++) {
      const v = et[i]!
      if (v !== elegido) {
        nuevo[i] = reindex(v)
        continue
      }
      let destino = destinos[0]!
      if (destinos.length === 2) {
        rgbAOklab(img.pixeles[i * 4]!, img.pixeles[i * 4 + 1]!, img.pixeles[i * 4 + 2]!, lab, 0)
        const o = [lab[0]!, lab[1]!, lab[2]!] as Oklab
        destino =
          dist(o, pal[destinos[0]!]!.oklab) <= dist(o, pal[destinos[1]!]!.oklab)
            ? destinos[0]!
            : destinos[1]!
      }
      nuevo[i] = reindex(destino)
    }
    et = nuevo
    pal = pal.filter((_, k) => k !== elegido)
  }
  return { paleta: pal, etiquetas: et, sacados }
}

/** Filamentos que usa el diseño: la base blanca siempre, mas cada color que no se funde con ella. */
export function slotsUsados(paleta: readonly { hex: string }[], hexBase = '#FFFFFF'): number {
  return 1 + paleta.filter((c) => !esBase(c.hex, hexBase)).length
}
