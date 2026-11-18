// El cortante de galletitas: un filo que sigue la silueta del dibujo, con un reborde para apoyar la
// mano, y un marcador opcional que entra adentro y deja los detalles hundidos en la masa.
//
// Se imprime con el reborde sobre la cama y el filo para arriba: la punta, que es lo mas fino, sale
// ultima y sin soportes. El marcador, con el dibujo para arriba. Para usarlos se dan vuelta, asi que
// los dos van ESPEJADOS en X: la galletita sale al derecho (un texto se lee bien).
//
// La galletita no tiene agujeros: un filo suelto adentro no tendria de donde agarrarse. Por eso la
// forma es la silueta con margen y rellena, y los detalles los pone el marcador.

import type {
  CrossSection,
  Manifold,
  ManifoldToplevel,
  SimplePolygon,
} from '../geometria/manifold.ts'

/** Que deja marcado el marcador. */
export type Marcado = 'lineas' | 'colores' | 'no'

export type ParamsCortante = {
  /** Lado mayor de la galletita, en mm. */
  largo: number
  /** Alto total del cortante, con el reborde, en mm. */
  alto: number
  /** Aire entre el dibujo y el filo, en mm. Tambien suaviza la silueta. */
  margen: number
  /** Grosor del filo en la base, en mm. En la punta se afina hasta PUNTA_MM. */
  grosor: number
  /** Cuanto sale el reborde para afuera del filo, en mm. */
  anchoReborde: number
  /** lineas: el borde de cada color. colores: los colores elegidos, enteros. no: sin marcador. */
  marcado: Marcado
  /** Los colores que marcan, si marcado === 'colores'. */
  colores: string[]
  /** Grosor de las lineas del marcado 'lineas', en mm. */
  grosorLinea: number
  /** Cuanto sobresale el dibujo del marcador, en mm. */
  relieve: number
  /** Aire entre el marcador y el filo, por lado, en mm. */
  holgura: number
}

export const CORTANTE_POR_DEFECTO: ParamsCortante = {
  largo: 80,
  alto: 15,
  margen: 3,
  grosor: 1.2,
  anchoReborde: 4,
  marcado: 'lineas',
  colores: [],
  grosorLinea: 1.2,
  relieve: 2,
  holgura: 0.6,
}

/** Las alturas que se ofrecen: masa fina, normal y gruesa. */
export const ALTOS = [12, 15, 20] as const

/** Grosor del filo en la punta. Dos lineas de una boquilla de 0,4 mm, mas o menos. */
export const PUNTA_MM = 0.6
/** Cuanto mide el afinado del filo, desde la punta. */
export const BISEL_MM = 3
/** El afinado se arma en escalones; con 6 de medio milimetro el slicer lo ve como rampa. */
const PASOS_BISEL = 6
export const ESPESOR_REBORDE_MM = 2
export const ESPESOR_MARCADOR_MM = 2.4
/** Lo que el dibujo del marcador se aleja de su borde, para no rozar el filo. */
const BORDE_MARCADOR_MM = 1
/** Menos que esto, la masa no lo toma. */
export const LINEA_MINIMA_MM = 1
/** Entrantes de la silueta mas angostos que 2 × esto se rellenan: la masa no entra ahi. */
const RADIO_CIERRE_MM = 1.5
/** Lo que queda entre las dos piezas en la vista. */
const SEPARACION_VISTA_MM = 10

export type RegionCortante = { hex: string; contornos: SimplePolygon[] }

export type AvisoCortante =
  | { codigo: 'partes-unidas' }
  | { codigo: 'detalle-fino'; valor: number }
  | { codigo: 'marcador-vacio' }

export type Cortante = {
  cortante: Manifold
  /** null si no se pidio, o si no quedo nada para marcar. */
  marcador: Manifold | null
  /** Cuanto correr el marcador en X para verlo al lado del cortante. */
  alLado: number
  /** Medidas del cortante: ancho, alto y altura, en mm. */
  medidas: [number, number, number]
  /** Lo que mide la galletita. */
  galletitaMm: [number, number]
  /** La galletita como sale, al derecho: la forma y lo que queda hundido. Para dibujarla. */
  galletita: { forma: SimplePolygon[]; marcas: SimplePolygon[] }
  avisos: AvisoCortante[]
}

const areaConSigno = (p: SimplePolygon) => {
  let a = 0
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i]!
    const [x1, y1] = p[(i + 1) % p.length]!
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

/** Solo los contornos de afuera: la seccion sin agujeros. */
function rellenar(m: ManifoldToplevel, s: CrossSection): CrossSection {
  const exteriores = s.toPolygons().filter((p) => areaConSigno(p) > 0)
  return m.CrossSection.ofPolygons(exteriores, 'NonZero')
}

/**
 * Une las partes sueltas con puentes donde quedan mas cerca, sin tocar el resto de la silueta:
 * el cierre se aplica solo en la zona que esta cerca de DOS partes distintas. Asi una galletita de
 * dos manchas queda en una sola, pero el hueco entre las orejas de un gato no se rellena.
 */
function unirPartes(m: ManifoldToplevel, forma: CrossSection): CrossSection {
  let actual = forma
  for (let r = 2; r <= 40; r *= 1.5) {
    const partes = actual.decompose()
    if (partes.length <= 1) return actual
    const cerca: CrossSection[] = []
    const crecidas = partes.map((p) => p.offset(r, 'Round'))
    for (let i = 0; i < crecidas.length; i++)
      for (let j = i + 1; j < crecidas.length; j++) cerca.push(crecidas[i]!.intersect(crecidas[j]!))
    const cerrada = actual.offset(r, 'Round').offset(-r, 'Round')
    const puentes = cerrada.intersect(m.CrossSection.union(cerca))
    actual = rellenar(m, m.CrossSection.union([actual, puentes]))
  }
  // Partes muy lejos (no deberia pasar en un dibujo de una sola pieza): la cascara convexa
  return actual.decompose().length <= 1 ? actual : m.CrossSection.union([actual, actual.hull()])
}

/** El anillo de afuera de la forma, de un grosor dado. */
const anillo = (forma: CrossSection, grosor: number) =>
  forma.offset(grosor, 'Round').subtract(forma)

/**
 * Arma el cortante y el marcador. Llamar dentro de withScope().
 * @param regiones el dibujo en mm, con y hacia arriba: un grupo de contornos por color (par-impar).
 */
export function cortante(
  m: ManifoldToplevel,
  regiones: readonly RegionCortante[],
  p: ParamsCortante,
): Cortante {
  const avisos: AvisoCortante[] = []
  const crudas = regiones.map((r) => ({
    hex: r.hex,
    seccion: m.CrossSection.ofPolygons(r.contornos, 'EvenOdd'),
  }))
  const toda = m.CrossSection.union(crudas.map((c) => c.seccion))
  if (toda.isEmpty()) throw new Error('sin-dibujo')

  // Escala: la galletita (el dibujo mas su margen) mide `largo` de lado mayor. Espejado en X.
  const caja = toda.bounds()
  const lado = Math.max(caja.max[0] - caja.min[0], caja.max[1] - caja.min[1])
  const escala = Math.max(p.largo - 2 * p.margen, 5) / lado
  const cx = (caja.min[0] + caja.max[0]) / 2
  const cy = (caja.min[1] + caja.max[1]) / 2
  const llevar = (s: CrossSection) => s.translate([-cx, -cy]).scale([-escala, escala])
  const colores = crudas.map((c) => ({ hex: c.hex, seccion: llevar(c.seccion) }))
  const tinta = llevar(toda)

  // La forma de la galletita: el dibujo con margen, sin agujeros y sin entrantes donde la masa no entra
  const r = RADIO_CIERRE_MM
  let forma = rellenar(m, tinta.offset(p.margen, 'Round'))
  forma = rellenar(m, forma.offset(r, 'Round').offset(-r, 'Round'))
  if (forma.decompose().length > 1) {
    forma = unirPartes(m, forma)
    avisos.push({ codigo: 'partes-unidas' })
  }

  // El filo: recto hasta el bisel, y despues se afina en escalones hasta la punta
  const recto = p.alto - BISEL_MM
  const paso = BISEL_MM / PASOS_BISEL
  const filo = [anillo(forma, p.grosor).extrude(recto)]
  for (let i = 0; i < PASOS_BISEL; i++) {
    const grosor = p.grosor - ((p.grosor - PUNTA_MM) * (i + 1)) / PASOS_BISEL
    filo.push(
      anillo(forma, grosor)
        .extrude(paso)
        .translate([0, 0, recto + i * paso]),
    )
  }
  const reborde = anillo(forma, p.grosor + p.anchoReborde).extrude(ESPESOR_REBORDE_MM)
  const solidoCortante = m.Manifold.union([reborde, ...filo])

  // El marcador: la forma achicada por la holgura, con el dibujo en relieve arriba
  let marcador: Manifold | null = null
  let marcas: CrossSection | null = null
  if (p.marcado !== 'no') {
    const placa = forma.offset(-p.holgura, 'Round')
    const zona = placa.offset(-BORDE_MARCADOR_MM, 'Round')
    let dibujo: CrossSection
    if (p.marcado === 'lineas') {
      const w = p.grosorLinea / 2
      dibujo = m.CrossSection.union(
        colores.map((c) => c.seccion.offset(w, 'Round').subtract(c.seccion.offset(-w, 'Round'))),
      )
    } else {
      const elegidos = colores.filter((c) => p.colores.includes(c.hex)).map((c) => c.seccion)
      dibujo = elegidos.length ? m.CrossSection.union(elegidos) : m.CrossSection.square([0, 0])
    }
    dibujo = dibujo.intersect(zona)

    if (dibujo.area() < 1) {
      avisos.push({ codigo: 'marcador-vacio' })
    } else {
      marcas = dibujo
      marcador = m.Manifold.union([
        placa.extrude(ESPESOR_MARCADOR_MM),
        dibujo.extrude(p.relieve).translate([0, 0, ESPESOR_MARCADOR_MM]),
      ])
      const rf = LINEA_MINIMA_MM / 2
      const grueso = dibujo.offset(-rf, 'Round').offset(rf, 'Round').area()
      const fino = 1 - grueso / dibujo.area()
      if (fino > 0.02) avisos.push({ codigo: 'detalle-fino', valor: fino })
    }
  }

  const cajaCortante = solidoCortante.boundingBox()
  const cajaForma = forma.bounds()
  const alLado = marcador
    ? cajaCortante.max[0] + SEPARACION_VISTA_MM - marcador.boundingBox().min[0]
    : 0

  // La galletita al derecho: se deshace el espejado
  const alDerecho = (s: CrossSection | null) =>
    s ? s.toPolygons().map((anillo) => anillo.map(([x, y]) => [-x, y] as [number, number])) : []

  return {
    cortante: solidoCortante,
    marcador,
    alLado,
    medidas: [
      cajaCortante.max[0] - cajaCortante.min[0],
      cajaCortante.max[1] - cajaCortante.min[1],
      cajaCortante.max[2] - cajaCortante.min[2],
    ],
    galletitaMm: [cajaForma.max[0] - cajaForma.min[0], cajaForma.max[1] - cajaForma.min[1]],
    galletita: { forma: alDerecho(forma), marcas: alDerecho(marcas) },
    avisos,
  }
}

// ------------------------------------------------------------------ el marcado por defecto

/** Luminancia aproximada de un "#RRGGBB", de 0 (negro) a 1 (blanco). */
function luz(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}

const perimetro = (contornos: readonly SimplePolygon[]) =>
  contornos.reduce(
    (t, c) =>
      t +
      c.reduce((s, [x, y], i) => {
        const [x1, y1] = c[(i + 1) % c.length]!
        return s + Math.hypot(x1 - x, y1 - y)
      }, 0),
    0,
  )

/**
 * Que conviene marcar, mirando el dibujo. Un dibujo de lineas (un trazo oscuro y finito, como
 * los de colorear) marca esas lineas tal cual; con el borde de cada color saldrian dobles. Todo lo
 * demas marca el borde de cada color, como un dibujo para colorear.
 * @param areaMm2 el area de cada region, en el mismo orden.
 */
export function marcadoPorDefecto(
  regiones: readonly RegionCortante[],
  areaMm2: readonly number[],
): Pick<ParamsCortante, 'marcado' | 'colores'> {
  if (!regiones.length) return { marcado: 'lineas', colores: [] }
  let oscura = 0
  regiones.forEach((r, i) => {
    if (luz(r.hex) < luz(regiones[oscura]!.hex)) oscura = i
  })
  const r = regiones[oscura]!
  // Ancho medio de un trazo: 2 × area / perimetro. Se compara con el tamaño del dibujo
  const ancho = (2 * areaMm2[oscura]!) / Math.max(perimetro(r.contornos), 1e-6)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const g of regiones)
    for (const c of g.contornos)
      for (const [x, y] of c) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
  const lado = Math.max(x1 - x0, y1 - y0)
  const esLinea = luz(r.hex) < 0.35 && ancho < lado * 0.05
  return esLinea ? { marcado: 'colores', colores: [r.hex] } : { marcado: 'lineas', colores: [] }
}
