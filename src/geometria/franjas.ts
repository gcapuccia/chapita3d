// Paso 12 del plan (§3): de regiones 2D a solidos, segun el modo de color.

import type { Filamento } from '../diseno/tipos.ts'
import type { CrossSection, Manifold, ManifoldToplevel } from './manifold.ts'

export type SolidoDeColor = { nombre: string; filamento: Filamento; solido: Manifold }

export type SeccionDeColor = { filamento: Filamento; seccion: CrossSection; prioridad: number }

/**
 * 12a · A ras (AMS / MMU): la cara de arriba queda plana. Los colores son incrustaciones de
 * `alturaColor` y la base es el cuerpo entero menos el hueco de esas incrustaciones.
 * Asi la pestaña y el borde tienen el espesor completo (plan §9.5) y todo es disjunto.
 */
export function franjasAras(
  m: ManifoldToplevel,
  cuerpo: CrossSection,
  base: Filamento,
  colores: readonly SeccionDeColor[],
  espesor: number,
  alturaColor: number,
): SolidoDeColor[] {
  const zColor = espesor - alturaColor
  let solidoBase = cuerpo.extrude(espesor)
  if (colores.length) {
    const hueco = m.CrossSection.union(colores.map((c) => c.seccion))
      .extrude(alturaColor)
      .translate([0, 0, zColor])
    solidoBase = solidoBase.subtract(hueco)
  }
  return [
    { nombre: base.nombre, filamento: base, solido: solidoBase },
    ...colores.map((c) => ({
      nombre: c.filamento.nombre,
      filamento: c.filamento,
      solido: c.seccion.extrude(alturaColor).translate([0, 0, zColor]),
    })),
  ]
}

export type ResultadoApilado = {
  solidos: SolidoDeColor[]
  /** Seccion de cada franja, de abajo hacia arriba (para la DRC #3). */
  franjas: CrossSection[]
  /** z donde empieza cada franja, con el filamento al que hay que cambiar. */
  cambios: { z: number; filamento: Filamento }[]
}

/**
 * 12b · Apilado (un extrusor): una franja Z por color. La franja k incluye el area de TODOS
 * los colores de rango >= k, si no el de arriba queda flotando (plan §3, paso 12b).
 *   franja(k) = union(region(k), ..., region(N))
 *   z(k)      = base + (k - 1) · alturaColor
 * El rango lo da la prioridad: lo de mayor prioridad (los detalles) va arriba.
 */
export function franjasApilado(
  m: ManifoldToplevel,
  cuerpo: CrossSection,
  base: Filamento,
  colores: readonly SeccionDeColor[],
  espesor: number,
  alturaColor: number,
): ResultadoApilado {
  const zBase = espesor - alturaColor
  const porRango = [...colores].sort((a, b) => a.prioridad - b.prioridad)
  const franjas = porRango.map((_, k) =>
    m.CrossSection.union(porRango.slice(k).map((c) => c.seccion)),
  )
  return {
    solidos: [
      { nombre: base.nombre, filamento: base, solido: cuerpo.extrude(zBase) },
      ...franjas.map((franja, k) => ({
        nombre: `Franja ${k + 1}`,
        filamento: base, // un solo extrusor: todo sale del slot 1 y los colores los ponen los M600
        solido: franja.extrude(alturaColor).translate([0, 0, zBase + k * alturaColor]),
      })),
    ],
    franjas,
    cambios: porRango.map((c, k) => ({ z: zBase + k * alturaColor, filamento: c.filamento })),
  }
}
