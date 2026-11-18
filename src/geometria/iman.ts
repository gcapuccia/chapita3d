// Iman de heladera: un hueco en la cara de abajo, donde se pega un iman de disco.
// Queda abierto hacia la cama, asi que no hace falta pausar la impresion: el iman se pega despues.

import * as D from '../pipeline/defaults.ts'
import type { CrossSection, Manifold, ManifoldToplevel } from './manifold.ts'

/** El hueco ya ubicado. `diametro` es el del hueco (el iman mas la holgura). */
export type Iman = { cx: number; cy: number; diametro: number; profundidad: number }

const enCapas = (mm: number, capa: number) =>
  Math.round(Math.ceil(mm / capa - 1e-6) * capa * 1e6) / 1e6

/** El alto del iman mas una capa para el pegamento: asi el iman nunca queda sobresaliendo. */
export function profundidadDelHueco(alto: number, capa: number): number {
  return enCapas(alto + capa, capa)
}

/**
 * Espesor minimo para que entre el iman: el hueco mas el techo. El techo tambien deja libre la
 * capa de color, para que el hueco nunca toque los colores.
 */
export function espesorParaIman(alto: number, capa: number, alturaColor: number): number {
  const techo = Math.max(D.TECHO_IMAN_MM, alturaColor + capa)
  return enCapas(profundidadDelHueco(alto, capa) + techo, capa)
}

/** Centro de masa de una seccion (los agujeros vienen con el giro contrario y restan solos). */
function centroDeMasa(seccion: CrossSection): [number, number] {
  let area = 0
  let x = 0
  let y = 0
  for (const p of seccion.toPolygons()) {
    for (let i = 0; i < p.length; i++) {
      const [x0, y0] = p[i]!
      const [x1, y1] = p[(i + 1) % p.length]!
      const cruz = x0 * y1 - x1 * y0
      area += cruz
      x += (x0 + x1) * cruz
      y += (y0 + y1) * cruz
    }
  }
  return [x / (3 * area), y / (3 * area)]
}

function masCercanoEnSegmento(
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
  [px, py]: [number, number],
): [number, number] {
  const dx = bx - ax
  const dy = by - ay
  const largo = dx * dx + dy * dy
  const t = largo > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / largo)) : 0
  return [ax + t * dx, ay + t * dy]
}

/**
 * Centro del hueco: el centro de masa de la pieza, para que cuelgue derecha de la heladera.
 * Si ahi no entra con PARED_IMAN_MM de material alrededor (una forma de C, un hueco en el medio),
 * va al punto mas cercano donde si entra. null si no entra en ningun lado.
 */
export function ubicarIman(
  m: ManifoldToplevel,
  cuerpo: CrossSection,
  diametroHueco: number,
): [number, number] | null {
  // Donde puede caer el centro: el cuerpo achicado en radio + pared (y un pelito, para no quedar justo)
  const validos = cuerpo.offset(-(diametroHueco / 2 + D.PARED_IMAN_MM + 0.05), 'Round')
  if (validos.isEmpty()) return null

  const centro = centroDeMasa(cuerpo)
  return contiene(m, validos, centro) ? centro : masCercanoEnBorde(validos, centro)
}

/** El punto del borde de una seccion mas cercano a p. */
function masCercanoEnBorde(seccion: CrossSection, p: [number, number]): [number, number] {
  let mejor = p
  let distancia = Infinity
  for (const poligono of seccion.toPolygons()) {
    for (let i = 0; i < poligono.length; i++) {
      const q = masCercanoEnSegmento(poligono[i]!, poligono[(i + 1) % poligono.length]!, p)
      const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2
      if (d < distancia) {
        distancia = d
        mejor = q
      }
    }
  }
  return mejor
}

const contiene = (m: ManifoldToplevel, seccion: CrossSection, p: [number, number]) =>
  seccion.intersect(m.CrossSection.square([0.01, 0.01], true).translate(p)).area() > 0

/**
 * Donde va el iman, y el cuerpo con lugar para el. Si no entra en ningun lado (un nombre de letras
 * finitas, como "Li"), se suma atras un disco de base en el centro de la pieza, con las uniones
 * redondeadas como la pestaña de la argolla. Igual que la franja que une las letras: solo si hace falta.
 * Llamar dentro de withScope().
 */
export function lugarParaIman(
  m: ManifoldToplevel,
  cuerpo: CrossSection,
  diametroHueco: number,
): { cuerpo: CrossSection; centro: [number, number]; ensanchado: boolean } {
  const ubicado = ubicarIman(m, cuerpo, diametroHueco)
  if (ubicado) return { cuerpo, centro: ubicado, ensanchado: false }

  let centro = centroDeMasa(cuerpo)
  if (!contiene(m, cuerpo, centro)) centro = masCercanoEnBorde(cuerpo, centro)
  const radio = diametroHueco / 2 + D.PARED_IMAN_MM
  const unido = m.CrossSection.union([cuerpo, m.CrossSection.circle(radio, 96).translate(centro)])
  const r = D.RADIO_FILLET_PESTANA
  const ventana = m.CrossSection.circle(radio + 2 * r + 1, 96).translate(centro)
  const redondeado = unido.offset(r, 'Round').offset(-r, 'Round').intersect(ventana)
  return { cuerpo: m.CrossSection.union([unido, redondeado]), centro, ensanchado: true }
}

/**
 * El volumen a restar: un cilindro desde la cara de abajo, con chaflan en la boca. Arranca 1 mm
 * por debajo de z = 0 para que la resta corte limpio (sin caras que coincidan).
 * Llamar dentro de withScope().
 */
export function solidoDelHueco(m: ManifoldToplevel, iman: Iman): Manifold {
  const r = iman.diametro / 2
  const c = D.CHAFLAN_IMAN_MM
  const cilindro = m.Manifold.cylinder(iman.profundidad + 1, r, r, 96)
  const boca = m.Manifold.cylinder(c + 1, r + c + 1, r, 96)
  return m.Manifold.union([cilindro, boca]).translate([iman.cx, iman.cy, -1])
}
