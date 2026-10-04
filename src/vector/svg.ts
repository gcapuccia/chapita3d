// Regiones en mm → un SVG que abre en cualquier lado (Illustrator, Inkscape, la app de sellos).
//
// Las regiones vienen con y hacia arriba, como todo lo que sale del pipeline; el SVG usa y hacia
// abajo, asi que se da vuelta aca. Un <path> por color, con fill-rule evenodd para que los
// agujeros (el centro de una O) queden agujereados de verdad.

import type { RegionTrazada } from '../pipeline/tipos.ts'

/** Dos decimales alcanzan: el pipeline trabaja a 0,1 mm por pixel. */
const n2 = (n: number) => (Math.round(n * 100) / 100).toString()

function camino(contornos: readonly [number, number][][], altoMm: number): string {
  return contornos
    .map((anillo) => 'M' + anillo.map(([x, y]) => `${n2(x)} ${n2(altoMm - y)}`).join('L') + 'Z')
    .join('')
}

/**
 * @param anchoMm alto y ancho del lienzo, en mm (el mapa de etiquetas por mmPorPixel).
 * @param titulo va adentro del <title>, para que el archivo se reconozca al abrirlo.
 */
export function aSvg(
  regiones: readonly RegionTrazada[],
  anchoMm: number,
  altoMm: number,
  titulo: string,
): string {
  // De mayor a menor: los detalles chicos pintan ultimos y no quedan tapados
  const orden = [...regiones].sort((a, b) => b.areaPx - a.areaPx)
  const caminos = orden
    .map((r) => `  <path fill="${r.hex}" fill-rule="evenodd" d="${camino(r.contornos, altoMm)}"/>`)
    .join('\n')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n2(anchoMm)}mm" height="${n2(altoMm)}mm" viewBox="0 0 ${n2(anchoMm)} ${n2(altoMm)}">`,
    `  <title>${titulo.replace(/[<&>]/g, '')}</title>`,
    caminos,
    '</svg>',
    '',
  ].join('\n')
}
