// De un archivo SVG a contornos en mm, listos para el motor.
//
// Vive del lado del navegador porque el lector de SVG necesita el DOM: el worker recibe los
// contornos ya sacados, que son numeros y viajan solos.
//
// El SVG tiene la y para abajo y el sello la tiene para arriba, asi que se da vuelta.

import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import type { SimplePolygon } from '../geometria/manifold.ts'

export type ErrorSvg = 'vacio' | 'ilegible'

/** Cuantos puntos por curva. Menos en dibujos con muchos trazos, para no explotar en vertices. */
function resolucion(trazos: number): number {
  if (trazos > 40) return 12
  if (trazos > 20) return 16
  return 24
}

/**
 * Devuelve los contornos del dibujo, con los agujeros como anillos aparte (regla par-impar).
 * Lanza el codigo de error como mensaje: la pantalla elige el texto.
 */
export function contornosDeSvg(texto: string): SimplePolygon[] {
  let paths: ReturnType<typeof SVGLoader.prototype.parse>['paths']
  try {
    paths = new SVGLoader().parse(texto).paths
  } catch {
    throw new Error('ilegible')
  }

  const pintados = paths.filter((p) => {
    const estilo = p.userData?.style as { fill?: string; fillOpacity?: number } | undefined
    if (!estilo) return true
    if (estilo.fill === 'none' || estilo.fill === 'transparent') return false
    return (estilo.fillOpacity ?? 1) > 0
  })

  const puntos = resolucion(pintados.length)
  const contornos: SimplePolygon[] = []
  for (const path of pintados) {
    for (const forma of SVGLoader.createShapes(path)) {
      const { shape, holes } = forma.extractPoints(puntos)
      for (const anillo of [shape, ...holes]) {
        if (anillo.length < 3) continue
        contornos.push(anillo.map((p) => [p.x, -p.y] as [number, number]))
      }
    }
  }
  if (!contornos.length) throw new Error('vacio')
  return contornos
}
