// Las dos placas del sello: la macho con el logo en relieve y la hembra con el logo ahuecado.
// Cada una se pega a su hoja de la bisagra, asi que salen dos piezas sueltas que ya vienen
// enganchadas (docs/sellomaker-bisagra-replica.md §6).
//
// Diferencia con el documento: alla las placas eran mallas apiladas que el slicer tenia que unir.
// Aca se arma con el mismo motor que los llaveros, asi que sale un solido de verdad y el hueco de
// la hembra se calcula con el offset del motor, que aguanta logos con curvas y agujeros.
//
// Al cerrar el sello, la cara de la hembra se apoya contra la del macho: por eso el logo de la
// hembra va ESPEJADO en X y su hueco es el logo agrandado por la tolerancia. Los agujeros internos
// del logo (el centro de una "O") quedan como islas, porque el offset los achica en vez de agrandarlos.

import type {
  CrossSection,
  Manifold,
  ManifoldToplevel,
  SimplePolygon,
} from '../geometria/manifold.ts'
import { ANCHO_MINIMO_DETALLE_MM } from '../pipeline/defaults.ts'
import { medidasBisagra, mitadesDeBisagra, type ParamsBisagra } from './bisagra.ts'

export type ParamsSello = {
  /** Ancho de cada placa, en mm. */
  anchoPlaca: number
  /** Radio de las esquinas del lado de afuera (el lado de la bisagra queda recto). */
  radioEsquina: number
  /** Cuanto se corre el logo alejandose de la bisagra, en mm. */
  corrimientoLogo: number
  /** Separacion entre la placa y la hoja. Negativo = la placa se monta sobre la hoja. */
  separacion: number
  /** Holgura entre el relieve del macho y el hueco de la hembra, en mm. */
  tolerancia: number
  /** Margen interno para encajar el logo, en mm. */
  margen: number
  /** Escala extra del logo (1 = lo mas grande que entra). */
  escalaLogo: number
  /** Cuantas unidades de bisagra: 1, 2 o 3. */
  bisagras: number
  /** Espesor de la placa, en mm. */
  espesor: number
  /** Cuanto sobresale el logo del macho, en mm. */
  relieve: number
  /** Cuanto se hunde el hueco de la hembra. Siempre un poco mas que el relieve. */
  profundidad: number
  /** Vueltas de 90° del logo. */
  giro: 0 | 1 | 2 | 3
  /** true: el macho va a la derecha. */
  invertir: boolean
}

export const SELLO_POR_DEFECTO: ParamsSello = {
  anchoPlaca: 64.29,
  radioEsquina: 5,
  corrimientoLogo: 4.5,
  separacion: -4,
  tolerancia: 0.22,
  margen: 4,
  escalaLogo: 1,
  bisagras: 1,
  espesor: 4,
  relieve: 0.4,
  profundidad: 0.42,
  giro: 0,
  invertir: false,
}

/** Los materiales del documento: cambian cuanto sobresale el logo (§4). */
export const MATERIALES = [
  { id: 'lata', nombre: 'Latas y aluminio', relieve: 0.4 },
  { id: 'papel', nombre: 'Papel', relieve: 0.5 },
  { id: 'papel300', nombre: 'Papel 300 g (mojado)', relieve: 0.6 },
  { id: 'celofan', nombre: 'Celofán y bolsas', relieve: 1.2 },
] as const

/** La hembra siempre se hunde un poco mas de lo que sobresale el macho. */
export const profundidadDe = (relieve: number) => relieve + 0.02

export type AvisoSello = { codigo: 'detalle-fino' | 'logo-recortado'; valor: number }

export type Sello = {
  /** Las dos piezas sueltas, ya enganchadas por la bisagra. */
  macho: Manifold
  hembra: Manifold
  /** Medidas del conjunto abierto y plano, en mm. */
  medidas: [number, number, number]
  /** Lo que mide el logo ya escalado, para avisar si quedo muy chico. */
  logoMm: [number, number]
  avisos: AvisoSello[]
}

/** Rectangulo con las esquinas redondeadas de un solo lado; el otro queda recto. */
function placaRedondeada(
  m: ManifoldToplevel,
  ancho: number,
  alto: number,
  radio: number,
  ladoRedondeado: 'izquierda' | 'derecha',
): CrossSection {
  const r = Math.max(0, Math.min(radio, ancho / 2, alto / 2))
  const base = m.CrossSection.square([ancho, alto], true)
  if (r === 0) return base
  // Redondear todo y volver a cuadrar el lado de la bisagra
  const redondeado = base.offset(-r, 'Round').offset(r, 'Round')
  const mitadRecta = m.CrossSection.square([ancho / 2, alto], true).translate([
    (ladoRedondeado === 'izquierda' ? 1 : -1) * (ancho / 4),
    0,
  ])
  return m.CrossSection.union([redondeado, base.intersect(mitadRecta)])
}

/** Caja de los contornos del logo, en sus propias unidades. */
function cajaDe(contornos: readonly SimplePolygon[]): {
  ancho: number
  alto: number
  cx: number
  cy: number
} {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const anillo of contornos)
    for (const [x, y] of anillo) {
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  if (!Number.isFinite(x0)) return { ancho: 0, alto: 0, cx: 0, cy: 0 }
  return { ancho: x1 - x0, alto: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
}

/**
 * Arma el sello entero. Llamar dentro de withScope().
 *
 * @param contornos el logo en coordenadas propias, con y hacia arriba. Los agujeros internos van
 *   como anillos aparte: se resuelven con la regla par-impar, igual que en los llaveros.
 */
export function sello(
  m: ManifoldToplevel,
  contornos: readonly SimplePolygon[],
  p: ParamsSello,
  bisagraParams: ParamsBisagra,
): Sello {
  const hojas = { ...bisagraParams, espesorHoja: p.espesor }
  const medidas = medidasBisagra(hojas)
  const altoPlaca = medidas.largoY * p.bisagras
  const lado = p.invertir ? 1 : -1 // por defecto el macho va a la izquierda

  // Logo: se centra, se gira, se escala para entrar con su margen y se corre alejandose del eje
  const caja = cajaDe(contornos)
  const giroPar = p.giro % 2 === 0
  const anchoLogo = giroPar ? caja.ancho : caja.alto
  const altoLogo = giroPar ? caja.alto : caja.ancho
  const disponibleX = Math.max(p.anchoPlaca - 2 * p.margen, 1)
  const disponibleY = Math.max(altoPlaca - 2 * p.margen, 1)
  const escala =
    anchoLogo > 0 && altoLogo > 0
      ? Math.min(disponibleX / anchoLogo, disponibleY / altoLogo) * p.escalaLogo
      : 1

  const logoCentrado = m.CrossSection.ofPolygons(
    contornos.map((anillo) =>
      anillo.map(([x, y]) => [x - caja.cx, y - caja.cy] as [number, number]),
    ),
    'EvenOdd',
  )
    .rotate(p.giro * 90)
    .scale([escala, escala])

  // Centro de cada placa: pegada a la hoja de su lado
  const desdeX = medidas.hojaX + p.separacion
  const centroMacho = lado * (desdeX + p.anchoPlaca / 2)
  const centroHembra = -centroMacho

  const placaMacho = placaRedondeada(
    m,
    p.anchoPlaca,
    altoPlaca,
    p.radioEsquina,
    lado < 0 ? 'izquierda' : 'derecha',
  ).translate([centroMacho, 0])
  const placaHembra = placaRedondeada(
    m,
    p.anchoPlaca,
    altoPlaca,
    p.radioEsquina,
    lado < 0 ? 'derecha' : 'izquierda',
  ).translate([centroHembra, 0])

  // El logo del macho se aleja de la bisagra; el de la hembra va espejado en X, para que al cerrar
  // el sello los dos coincidan
  const logoMacho = logoCentrado.translate([centroMacho + lado * p.corrimientoLogo, 0])
  const logoHembra = logoCentrado
    .scale([-1, 1])
    .translate([centroHembra - lado * p.corrimientoLogo, 0])

  // Macho: placa + logo en relieve, recortado a la placa por si el logo se pasa
  const cuerpoMacho = placaMacho.extrude(p.espesor)
  const logoRecortado = logoMacho.intersect(placaMacho)
  const relieve = logoRecortado.extrude(p.relieve).translate([0, 0, p.espesor])
  const macho = m.Manifold.union([cuerpoMacho, relieve])

  // Hembra: placa con el hueco del logo agrandado por la tolerancia. El offset agranda el contorno
  // y achica los agujeros, asi que las islas del logo salen solas
  const hueco = logoHembra
    .offset(p.tolerancia, 'Round')
    .intersect(placaHembra)
    .extrude(p.profundidad)
    .translate([0, 0, p.espesor - p.profundidad])
  const hembra = placaHembra.extrude(p.espesor).subtract(hueco)

  // Bisagra: cada hoja se une con su placa. Con la separacion negativa, la placa se monta sobre la
  // hoja y quedan pegadas de verdad
  const { izquierda, derecha } = mitadesDeBisagra(m, hojas)
  const repetir = (mitad: Manifold) =>
    p.bisagras <= 1
      ? mitad
      : m.Manifold.union(
          Array.from({ length: p.bisagras }, (_, i) =>
            mitad.translate([0, -altoPlaca / 2 + medidas.largoY / 2 + i * medidas.largoY, 0]),
          ),
        )

  const hojaMacho = repetir(lado < 0 ? izquierda : derecha)
  const hojaHembra = repetir(lado < 0 ? derecha : izquierda)

  // Avisos: lo que no va a salir bien, antes de gastar filamento
  const avisos: AvisoSello[] = []
  const areaLogo = logoMacho.area()
  const areaAdentro = logoRecortado.area()
  if (areaLogo > 0 && areaAdentro < areaLogo * 0.995)
    avisos.push({ codigo: 'logo-recortado', valor: 1 - areaAdentro / areaLogo })
  const rFino = ANCHO_MINIMO_DETALLE_MM / 2
  const grueso = logoRecortado.offset(-rFino, 'Round').offset(rFino, 'Round')
  const fino = areaAdentro > 0 ? 1 - grueso.area() / areaAdentro : 0
  if (fino > 0.02) avisos.push({ codigo: 'detalle-fino', valor: fino })

  return {
    avisos,
    macho: m.Manifold.union([macho, hojaMacho]),
    hembra: m.Manifold.union([hembra, hojaHembra]),
    medidas: [
      2 * (desdeX + p.anchoPlaca) + 2 * Math.max(0, -p.separacion),
      altoPlaca,
      p.espesor + Math.max(p.relieve, medidas.altoZ - p.espesor),
    ],
    logoMm: [anchoLogo * escala, altoLogo * escala],
  }
}
