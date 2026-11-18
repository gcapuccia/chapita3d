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
  let conBorde =
    contorno.activo && contorno.offset > 0 ? silueta.offset(contorno.offset, 'Round') : silueta
  if (contorno.unir) conBorde = unirPartes(m, silueta, conBorde, contorno.offset)
  if (argolla.tipo === 'sin') return { cuerpo: conBorde, cuerpoRelleno: conBorde, agujero: null }

  const radio = D.DIAMETRO_AGUJERO[argolla.tipo] / 2
  const radioPestana = radio + D.MARGEN_AGUJERO
  const caja = conBorde.bounds()

  let cx: number
  let cy: number
  if (argolla.posicion === 'izquierda') {
    // A media altura; el borde se mide en ESA fila (una "J" o una "T" no llegan al costado)
    cy = (caja.min[1] + caja.max[1]) / 2
    const fila = conBorde.intersect(
      m.CrossSection.square([caja.max[0] - caja.min[0] + 2, 0.5]).translate([
        caja.min[0] - 1,
        cy - 0.25,
      ]),
    )
    const izquierda = fila.isEmpty() ? caja.min[0] : fila.bounds().min[0]
    cx = izquierda - radioPestana + D.SOLAPE_PESTANA
  } else if (argolla.posicion === 'auto') {
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

/**
 * Un nombre con letras separadas (dos palabras, o una fuente con mucho aire) deja el borde en
 * varias partes, y cada una saldria de la impresora suelta. Si pasa, una franja a media altura de
 * punta a punta las une. Si el borde ya es una sola pieza no se toca: se ve mas lindo sin franja.
 */
function unirPartes(
  m: ManifoldToplevel,
  silueta: CrossSection,
  conBorde: CrossSection,
  offset: number,
): CrossSection {
  if (conBorde.decompose().length <= 1) return conBorde
  const caja = silueta.bounds()
  const alto = Math.max(1, (caja.max[1] - caja.min[1]) * D.FRANJA_NOMBRE)
  const franja = m.CrossSection.square([caja.max[0] - caja.min[0], alto])
    .translate([caja.min[0], (caja.min[1] + caja.max[1]) / 2 - alto / 2])
    .offset(Math.max(offset, 0.5), 'Round')
  return m.CrossSection.union([conBorde, franja])
}
