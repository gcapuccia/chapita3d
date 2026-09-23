// La bisagra de los sellos: se imprime armada y gira sin pegamento (print-in-place).
//
// Es propia, generada por codigo: el documento de referencia traia un STL fijo hecho aparte, y
// tenerla parametrica deja ajustar la holgura despues de imprimir una de prueba, que es lo unico
// que no se puede verificar en pantalla.
//
// Como esta armada, mirando a lo largo del eje Y:
//  - un barril partido en nudillos que se alternan: uno va con la hoja izquierda, el siguiente con
//    la derecha, y asi;
//  - entre nudillo y nudillo queda `holgura` de aire, para que no salgan pegados;
//  - cada nudillo lleva un pasador conico de un lado y su hueco del otro: el cono se imprime sin
//    soportes y hace de eje.
//
// El eje va a la altura de la cara del sello (z = espesor de la hoja), asi al cerrar las dos placas
// sus caras se encuentran exactas. Por eso el barril mide 2 × espesor de alto y apoya en z = 0.

import type { Manifold, ManifoldToplevel } from '../geometria/manifold.ts'

export type ParamsBisagra = {
  /** Largo de una unidad de bisagra, en mm. */
  largoY: number
  /** Ancho de cada hoja desde el eje, en mm. */
  anchoHoja: number
  /** Espesor de la hoja = espesor de la placa del sello, en mm. */
  espesorHoja: number
  /** Cuantos nudillos alternados tiene una unidad. Impar = las puntas van con la misma hoja. */
  nudillos: number
  /** Aire entre nudillo y nudillo, y entre pasador y hueco. Lo que hay que calibrar imprimiendo. */
  holgura: number
  /** Radio del pasador conico en su base. */
  radioPasador: number
}

export const BISAGRA_POR_DEFECTO: ParamsBisagra = {
  largoY: 35.5,
  anchoHoja: 11.6,
  espesorHoja: 4,
  nudillos: 5,
  holgura: 0.3,
  radioPasador: 1.6,
}

/** Lado al que va cada nudillo: los pares con la hoja izquierda, los impares con la derecha. */
const esIzquierda = (i: number) => i % 2 === 0

/**
 * Las dos mitades de una unidad, cada una con sus nudillos y su hoja. Separadas a proposito: si se
 * tocaran, la bisagra saldria soldada de la impresora. tests/sellos.test.ts lo verifica.
 * Llamar dentro de withScope().
 */
export function mitadesDeBisagra(
  m: ManifoldToplevel,
  p: ParamsBisagra,
): { izquierda: Manifold; derecha: Manifold } {
  const radio = p.espesorHoja
  const eje = radio
  const largoNudillo = p.largoY / p.nudillos
  const izquierdas: Manifold[] = []
  const derechas: Manifold[] = []

  for (let i = 0; i < p.nudillos; i++) {
    const izquierda = esIzquierda(i)
    const y0 = -p.largoY / 2 + i * largoNudillo
    // Los nudillos de adentro pierden media holgura de cada lado; las puntas solo del lado de adentro
    const desde = y0 + (i === 0 ? 0 : p.holgura / 2)
    const hasta = y0 + largoNudillo - (i === p.nudillos - 1 ? 0 : p.holgura / 2)
    const largo = hasta - desde
    const centroY = (desde + hasta) / 2

    // Nudillo: cilindro acostado sobre el eje Y
    let nudillo = m.Manifold.cylinder(largo, radio, radio, 64, true)
      .rotate([90, 0, 0])
      .translate([0, centroY, eje])

    // Cuello: une el nudillo con su hoja. Va solo a lo largo de ESTE nudillo, y llega hasta donde
    // empieza la hoja entera, que pasa de largo por al lado de los nudillos del otro lado
    const cuello = m.Manifold.cube([radio + p.holgura, largo, p.espesorHoja], true).translate([
      (izquierda ? -1 : 1) * ((radio + p.holgura) / 2),
      centroY,
      p.espesorHoja / 2,
    ])
    nudillo = m.Manifold.union([nudillo, cuello])

    // Pasador conico hacia +Y y su hueco hacia -Y: el cono entra en el nudillo de al lado.
    // El pasador arranca un poco ADENTRO de su nudillo: si naciera justo en la cara, la union los
    // dejaria como dos piezas que solo se tocan (lo vimos: quedaba un cono suelto).
    const SOLAPE = 0.2
    const altoPasador = p.holgura + p.radioPasador
    const pasador = m.Manifold.cylinder(
      altoPasador + SOLAPE,
      p.radioPasador,
      p.radioPasador * 0.45,
      48,
      false,
    )
      .rotate([-90, 0, 0])
      .translate([0, hasta - SOLAPE, eje])
    const hueco = m.Manifold.cylinder(
      altoPasador + p.holgura,
      p.radioPasador + p.holgura,
      p.radioPasador * 0.45 + p.holgura,
      48,
      false,
    )
      .rotate([-90, 0, 0])
      .translate([0, desde - p.holgura / 2, eje])

    if (i < p.nudillos - 1) nudillo = m.Manifold.union([nudillo, pasador])
    if (i > 0) nudillo = nudillo.subtract(hueco)
    ;(izquierda ? izquierdas : derechas).push(nudillo)
  }

  // La hoja va entera de punta a punta: si fuera un pedazo por nudillo, la bisagra saldria en
  // cinco piezas sueltas. Arranca pasando los nudillos del otro lado, con su holgura
  // Se mete 0,05 mm abajo del cuello para que la union quede pegada de verdad y no cara con cara
  const SOLAPE = 0.05
  const desdeX = radio + p.holgura - SOLAPE
  const anchoLibre = p.anchoHoja + radio - desdeX
  const hoja = (izquierda: boolean) =>
    m.Manifold.cube([anchoLibre, p.largoY, p.espesorHoja], true).translate([
      (izquierda ? -1 : 1) * (desdeX + anchoLibre / 2),
      0,
      p.espesorHoja / 2,
    ])

  // Lo que queda abajo del piso se corta: el barril apoya en z = 0
  const piso = m.Manifold.cube([1000, 1000, 1000], true).translate([0, 0, -500])
  return {
    izquierda: m.Manifold.union([...izquierdas, hoja(true)]).subtract(piso),
    derecha: m.Manifold.union([...derechas, hoja(false)]).subtract(piso),
  }
}

/** La unidad entera, lista para pegarle las placas. */
export function bisagra(m: ManifoldToplevel, p: ParamsBisagra): Manifold {
  const { izquierda, derecha } = mitadesDeBisagra(m, p)
  return m.Manifold.union([izquierda, derecha])
}

/** Medidas de una unidad, para acomodar las placas al lado. */
export function medidasBisagra(p: ParamsBisagra) {
  return {
    /** Hasta donde llega la hoja desde el eje. */
    hojaX: p.anchoHoja + p.espesorHoja,
    largoY: p.largoY,
    altoZ: p.espesorHoja * 2,
    /** Altura del eje de giro: la cara del sello. */
    eje: p.espesorHoja,
  }
}

/** Varias unidades apiladas a lo largo de Y (1, 2 o 3). */
export function bisagraRepetida(m: ManifoldToplevel, p: ParamsBisagra, veces: number): Manifold {
  const una = bisagra(m, p)
  if (veces <= 1) return una
  const total = p.largoY * veces
  const copias = Array.from({ length: veces }, (_, i) =>
    una.translate([0, -total / 2 + p.largoY / 2 + i * p.largoY, 0]),
  )
  return m.Manifold.union(copias)
}
