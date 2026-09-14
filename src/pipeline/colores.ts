// Colores de antialias ocupando filamentos (F2, medido en spikes/08-arreglos, arreglo 4b).
// Un color de la paleta que (1) esta "entre" otros dos colores (o entre uno y el fondo) en OKLab y
// (2) es fino a escala de impresion es antialias o trazo diluido: sus pixeles pasan al color de la
// pareja mas parecido. Medido: 1 o 2 filamentos menos en 7 de 13 escenas, sin perder elementos.

import { rgbAOklab } from './color.ts'
import { apertura } from './morfologia.ts'
import { SIN_ASIGNAR, type ColorPaleta, type ImagenRGBA, type Oklab } from './tipos.ts'

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
      const abierta = apertura(mascara, ancho, alto, radioFinoPx)
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
