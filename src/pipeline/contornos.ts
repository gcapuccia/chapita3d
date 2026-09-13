// Pasos 8 y 9 del plan (§3): del mapa de etiquetas a poligonos en mm.
//
// ⚠️ Correccion de medio pixel: el plan (§7.5) dice "restar 0,5 px" como gotcha de d3-contour.
// Medido en d3-contour 4.0.2 (F0.8): un bloque que ocupa los pixeles x = 4..7 da un contorno de
// x = 4 a x = 8, con centro en 6,00. O sea que YA sale en coordenadas de borde de pixel (el pixel
// k ocupa [k, k+1]) y restar 0,5 correria todo medio pixel. No se resta. tests/pipeline.test.ts
// lo verifica para que nadie lo "arregle".

import { contours } from 'd3-contour'
import simplify from 'simplify-js'
import type { ColorPaleta, RegionTrazada } from './tipos.ts'

export type ParamsContornos = {
  mmPorPixel: number
  /** 0 = sin simplificar (lo usa la calibracion de resolucion). */
  toleranciaRdpMm: number
  maxVerticesPorRegion: number
}

const PADDING = 1 // plan §7.5: una fila de fondo alrededor, asi los contornos cierran en el borde

function areaAnillo(anillo: [number, number][]): number {
  let a = 0
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    a += anillo[j]![0] * anillo[i]![1] - anillo[i]![0] * anillo[j]![1]
  }
  return a / 2
}

function simplificar(anillos: [number, number][][], tolerancia: number): [number, number][][] {
  if (tolerancia <= 0) return anillos
  return anillos
    .map((anillo) =>
      simplify(
        anillo.map(([x, y]) => ({ x, y })),
        tolerancia,
        true,
      ).map((p) => [p.x, p.y] as [number, number]),
    )
    .filter(
      (anillo) => anillo.length >= 3 && Math.abs(areaAnillo(anillo)) > tolerancia * tolerancia,
    )
}

export function trazar(
  etiquetas: Uint8Array,
  ancho: number,
  alto: number,
  paleta: readonly ColorPaleta[],
  p: ParamsContornos,
): RegionTrazada[] {
  const W = ancho + 2 * PADDING
  const H = alto + 2 * PADDING
  const generador = contours().size([W, H]).smooth(true).thresholds([0.5])
  const s = p.mmPorPixel
  const regiones: RegionTrazada[] = []

  paleta.forEach((color, c) => {
    const grilla = new Float64Array(W * H)
    let areaPx = 0
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        if (etiquetas[y * ancho + x] !== c) continue
        grilla[(y + PADDING) * W + x + PADDING] = 1
        areaPx++
      }
    }
    if (areaPx === 0) return

    // d3-contour solo indexa los valores: un Float64Array sirve igual que un array, sin copiarlo
    const [multipoligono] = generador(grilla as unknown as number[])
    // Pixel → mm, con y hacia arriba (en la imagen y crece hacia abajo)
    let anillos = (multipoligono?.coordinates ?? []).flatMap((poligono) =>
      poligono.map((anillo) =>
        anillo
          .slice(0, -1)
          .map(([x, y]) => [(x! - PADDING) * s, (alto - (y! - PADDING)) * s] as [number, number]),
      ),
    )
    let tolerancia = p.toleranciaRdpMm
    anillos = simplificar(anillos, tolerancia)
    // Corte de seguridad de memoria: si hay demasiados vertices, se simplifica mas
    while (tolerancia > 0 && anillos.reduce((t, a) => t + a.length, 0) > p.maxVerticesPorRegion) {
      tolerancia *= 1.5
      anillos = simplificar(anillos, tolerancia)
    }
    if (anillos.length === 0) return
    regiones.push({
      id: `color-${c + 1}`,
      hex: color.hex,
      prioridad: 0,
      contornos: anillos,
      areaPx,
    })
  })

  // Prioridad por area: lo mas chico gana, asi los detalles no quedan tapados (audit-01 §3.3)
  ;[...regiones].sort((a, b) => b.areaPx - a.areaPx).forEach((r, i) => (r.prioridad = i + 1))
  return regiones
}
