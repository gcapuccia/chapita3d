// Cadena de resta por prioridad: regiones de color sin solapes y sin costuras.
//
// El problema (audit-01 §3.3): cada color se traza y se simplifica por separado, asi que
// los bordes que comparten dos colores dejan de coincidir. Quedan micro-huecos de
// 0,01–0,05 mm que en pantalla no se ven y en la impresion aparecen como lineas del
// color de abajo, o solapes que el slicer convierte en paredes absurdas.
//
// La solucion:
//  1. Cada region crece ε (cierra los huecos de hasta 2ε con sus vecinas).
//  2. De mayor a menor prioridad, a cada region se le resta todo lo ya ocupado.
// Como la resta la hace el mismo kernel, los bordes compartidos quedan identicos:
// la union de los colores cubre la silueta exacta, sin huecos ni solapes.

import type { CrossSection, FillRule, ManifoldToplevel, SimplePolygon } from './manifold.ts'

export type RegionColor = {
  id: string
  /** Mayor numero = gana: se le resta a las de menor prioridad. A igual prioridad gana la primera. */
  prioridad: number
  /** Contornos en mm. Con EvenOdd, los agujeros no necesitan orientacion. */
  contornos: SimplePolygon[]
}

export type RegionResuelta = {
  id: string
  prioridad: number
  seccion: CrossSection
}

/**
 * Devuelve las regiones sin solapes, ordenadas de mayor a menor prioridad.
 * Tiene que llamarse dentro de withScope(): las secciones pertenecen al scope activo.
 */
export function resolverSolapes(
  m: ManifoldToplevel,
  regiones: readonly RegionColor[],
  epsilon: number,
  reglaRelleno: FillRule = 'EvenOdd',
): RegionResuelta[] {
  const orden = [...regiones].sort((a, b) => b.prioridad - a.prioridad)
  const resueltas: RegionResuelta[] = []
  let ocupado: CrossSection | null = null

  for (const r of orden) {
    const crecida = m.CrossSection.ofPolygons(r.contornos, reglaRelleno).offset(epsilon, 'Miter')
    const seccion: CrossSection = ocupado ? crecida.subtract(ocupado) : crecida
    ocupado = ocupado ? ocupado.add(crecida) : crecida
    resueltas.push({ id: r.id, prioridad: r.prioridad, seccion })
  }
  return resueltas
}
