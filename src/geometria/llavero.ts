// Paso 11 del plan (§3): silueta → contorno → pestaña con fillet → agujero de la argolla.

import * as D from '../pipeline/defaults.ts'
import type { Diseno } from '../diseno/tipos.ts'
import type { CrossSection, ManifoldToplevel } from './manifold.ts'

export type Agujero = { cx: number; cy: number; radio: number }

export type CuerpoDelLlavero = {
  /** Silueta + contorno + pestaña, con el agujero ya restado. */
  cuerpo: CrossSection
  /** Lo mismo sin restar el agujero (para medir el anillo, DRC #2). */
  cuerpoRelleno: CrossSection
  agujero: Agujero | null
}

/**
 * Llamar dentro de withScope().
 * El fillet se aplica SOLO alrededor de la pestaña: un cierre morfologico sobre todo el contorno
 * tambien rellenaria cualquier entrante del dibujo mas angosto que 2r (entre las orejas de un gato).
 */
export function cuerpoDelLlavero(
  m: ManifoldToplevel,
  silueta: CrossSection,
  contorno: Diseno['contorno'],
  argolla: Diseno['argolla'],
): CuerpoDelLlavero {
  const conBorde =
    contorno.activo && contorno.offset > 0 ? silueta.offset(contorno.offset, 'Round') : silueta
  if (argolla.tipo === 'sin') return { cuerpo: conBorde, cuerpoRelleno: conBorde, agujero: null }

  const radio = D.DIAMETRO_AGUJERO[argolla.tipo] / 2
  const radioPestana = radio + D.MARGEN_AGUJERO
  const caja = conBorde.bounds()

  let cx: number
  let cy: number
  if (argolla.posicion === 'auto') {
    // Borde superior, centrado en X; la altura se mide en ESA columna (en un corazon el centro esta hundido)
    cx = (caja.min[0] + caja.max[0]) / 2
    const columna = conBorde.intersect(
      m.CrossSection.square([0.5, caja.max[1] - caja.min[1] + 2]).translate([
        cx - 0.25,
        caja.min[1] - 1,
      ]),
    )
    const arriba = columna.isEmpty() ? caja.max[1] : columna.bounds().max[1]
    cy = arriba + radioPestana - D.SOLAPE_PESTANA
  } else {
    ;[cx, cy] = argolla.posicion
  }

  const pestana = m.CrossSection.circle(radioPestana, 96).translate([cx, cy])
  const unido = m.CrossSection.union([conBorde, pestana])
  const r = D.RADIO_FILLET_PESTANA
  const ventana = m.CrossSection.circle(radioPestana + 2 * r + 1, 96).translate([cx, cy])
  const redondeado = unido.offset(r, 'Round').offset(-r, 'Round').intersect(ventana)
  const cuerpoRelleno = m.CrossSection.union([unido, redondeado])
  const cuerpo = cuerpoRelleno.subtract(m.CrossSection.circle(radio, 96).translate([cx, cy]))

  return { cuerpo, cuerpoRelleno, agujero: { cx, cy, radio } }
}
