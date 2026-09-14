// Paso 7 del plan (§3): limpiar el mapa de etiquetas antes de trazar.
//  a) moda 3×3: saca pixeles sueltos
//  b) apertura por color: lo mas angosto que anchoMinimoDetalle no se puede imprimir. Con
//     grosorMinimoLineasMm, lo fino que es LINEA se engrosa hasta ese grosor en vez de borrarse (F2,
//     spikes/08-arreglos: esqueleto de Zhang-Suen dilatado, pintado por encima de vecinos y fondo)
//  c) islas: lo mas chico que areaMinimaIsla se funde con el vecino
//
// El plan lista islas antes que apertura. Se hace al reves porque la apertura puede partir
// una region y dejar islas nuevas: si las islas van primero, esas quedan sin limpiar.
//
// Ademas mide, sin costo extra, cuanto del dibujo son lineas finas: es el detector de "logo de
// lineas" con el que Automatico decide engrosar.

import { apertura, componentes, dilatar, distanciaCuadrada, esqueleto } from './morfologia.ts'
import { FONDO, SIN_ASIGNAR, type ColorPaleta } from './tipos.ts'

export type ParamsLimpiar = {
  mmPorPixel: number
  anchoMinimoDetalleMm: number
  areaMinimaIslaMm2: number
  /** null = lo fino se borra. Numero = grosor minimo de linea en mm: lo mas fino se engrosa hasta ahi. */
  grosorMinimoLineasMm: number | null
  /** mm. Una linea fina mas corta que esto es ruido (antialias, motas): no se engrosa. */
  largoMinimoLineaMm: number
  /** Para decidir quien gana cuando dos lineas engrosadas se pisan (gana la mas oscura). */
  paleta: readonly ColorPaleta[]
  /**
   * Guarda anti-halo: OKLab por pixel de la imagen de trabajo (3 por pixel) y color del fondo. Con esto,
   * una cinta fina cuyo color real no llega nunca al de su etiqueta, o cuyo color queda entre los de sus
   * dos vecinos, es antialias y no se engrosa. Sin esto se engrosa todo lo fino (medido: 6 regresiones
   * en el banco).
   */
  guardaHalo?: { lab: Float32Array; fondoLab: readonly [number, number, number] | null }
}

export type InformeLimpieza = {
  /** Por color: fraccion de sus pixeles (despues de la moda) que termina con otro color o como fondo. */
  perdidaPorColor: number[]
  /** Pixeles que terminan con otro color o como fondo / pixeles de dibujo. */
  fraccionPerdida: number
  /** Pixeles en partes finas tipo linea / pixeles de dibujo: el detector de "logo de lineas". */
  fraccionLineas: number
  /** Largo total de las lineas finas, en mm (esqueleto). */
  largoLineasMm: number
  /** Pixeles agregados al engrosar. */
  agregados: number
  /** Componentes finas descartadas por la guarda anti-halo. */
  halosDescartados: number
}

function moda(etiquetas: Uint8Array, ancho: number, alto: number, colores: number): Uint8Array {
  const salida = new Uint8Array(etiquetas)
  const cuenta = new Uint16Array(colores)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      const propia = etiquetas[i]!
      if (propia === FONDO) continue
      cuenta.fill(0)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= ancho || yy >= alto) continue
          const e = etiquetas[yy * ancho + xx]!
          if (e !== FONDO) cuenta[e]!++
        }
      }
      let mejor = propia
      for (let c = 0; c < colores; c++) if (cuenta[c]! > cuenta[mejor]!) mejor = c
      salida[i] = mejor
    }
  }
  return salida
}

/**
 * Rellena SIN_ASIGNAR con el color asignado mas cercano (BFS desde todos a la vez).
 * Lo que queda sin alcanzar (partes sin ningun pixel asignado cerca) pasa a fondo.
 */
function rellenar(etiquetas: Uint8Array, ancho: number): void {
  const n = etiquetas.length
  const cola = new Int32Array(n)
  let fin = 0
  for (let i = 0; i < n; i++) if (etiquetas[i]! < SIN_ASIGNAR) cola[fin++] = i
  for (let cabeza = 0; cabeza < fin; cabeza++) {
    const i = cola[cabeza]!
    const x = i % ancho
    for (const j of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
      if (j < 0 || j >= n || etiquetas[j] !== SIN_ASIGNAR) continue
      etiquetas[j] = etiquetas[i]!
      cola[fin++] = j
    }
  }
  for (let i = 0; i < n; i++) if (etiquetas[i] === SIN_ASIGNAR) etiquetas[i] = FONDO
}

function islas(etiquetas: Uint8Array, ancho: number, colores: number, minimoPx: number) {
  const n = etiquetas.length
  const componente = new Int32Array(n).fill(-1)
  const cola = new Int32Array(n)
  const vecinosDe = new Float64Array(colores)
  for (let inicio = 0; inicio < n; inicio++) {
    const color = etiquetas[inicio]!
    if (color === FONDO || componente[inicio] !== -1) continue
    let fin = 0
    cola[fin++] = inicio
    componente[inicio] = inicio
    vecinosDe.fill(0)
    for (let cabeza = 0; cabeza < fin; cabeza++) {
      const i = cola[cabeza]!
      const x = i % ancho
      for (const j of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
        if (j < 0 || j >= n) continue
        const e = etiquetas[j]!
        if (e === color) {
          if (componente[j] === -1) {
            componente[j] = inicio
            cola[fin++] = j
          }
        } else if (e !== FONDO) {
          vecinosDe[e]!++
        }
      }
    }
    if (fin >= minimoPx) continue
    // La isla se funde con el color con el que comparte mas borde; si solo toca fondo, es ruido
    let destino = FONDO
    let mejor = 0
    for (let c = 0; c < colores; c++) {
      if (vecinosDe[c]! > mejor) {
        mejor = vecinosDe[c]!
        destino = c
      }
    }
    for (let q = 0; q < fin; q++) etiquetas[cola[q]!] = destino
  }
}

const luminancia = (c: ColorPaleta) => c.oklab[0]

export function limpiar(
  etiquetas: Uint8Array,
  ancho: number,
  alto: number,
  colores: number,
  p: ParamsLimpiar,
): { etiquetas: Uint8Array; informe: InformeLimpieza } {
  // El borde de antialias llega sin asignar: toma el color del interior mas cercano
  const inicial = new Uint8Array(etiquetas)
  rellenar(inicial, ancho)
  const salida = moda(inicial, ancho, alto, colores)
  const antes = new Uint8Array(salida)

  const informe: InformeLimpieza = {
    perdidaPorColor: new Array<number>(colores).fill(0),
    fraccionPerdida: 0,
    fraccionLineas: 0,
    largoLineasMm: 0,
    agregados: 0,
    halosDescartados: 0,
  }
  let dibujoPx = 0
  for (let i = 0; i < antes.length; i++) if (antes[i] !== FONDO) dibujoPx++

  // Con engrosar, el radio de "fino" sale del grosor pedido (nunca menos que el minimo imprimible)
  const anchoFinoMm = Math.max(p.anchoMinimoDetalleMm, p.grosorMinimoLineasMm ?? 0)
  const radio = anchoFinoMm / 2 / p.mmPorPixel
  const pintar: { color: number; zona: Uint8Array }[] = []
  let lineasPx = 0
  if (radio >= 0.5) {
    for (let c = 0; c < colores; c++) {
      const mascaraColor = new Uint8Array(salida.length)
      let hay = false
      for (let i = 0; i < salida.length; i++)
        if (salida[i] === c) {
          mascaraColor[i] = 1
          hay = true
        }
      if (!hay) continue
      const abierta = apertura(mascaraColor, ancho, alto, radio)
      const fina = new Uint8Array(salida.length)
      let hayFina = false
      for (let i = 0; i < salida.length; i++) {
        if (mascaraColor[i] === 1 && abierta[i] === 0) {
          salida[i] = SIN_ASIGNAR
          fina[i] = 1
          hayFina = true
        }
      }
      if (!hayFina || p.grosorMinimoLineasMm === null) {
        // El detector corre igual (para el diagnostico), aunque no se engrose
        if (hayFina) {
          const l = medirLineas(fina, abierta, ancho, alto, radio, p, c, antes, informe)
          lineasPx += l.px
          informe.largoLineasMm += l.largoMm
        }
        continue
      }
      const lineas = medirLineas(fina, abierta, ancho, alto, radio, p, c, antes, informe)
      lineasPx += lineas.px
      informe.largoLineasMm += lineas.largoMm
      if (!lineas.px) continue
      // Grosor objetivo: el esqueleto dilatado con radio grosor/2 mide ~grosor (2R + 1 px en horizontal)
      // +0,5 px: el esqueleto dilatado mide 2R + 1 px en horizontal pero ~2R en diagonal (medido en
      // spikes/08-arreglos/isotropia.ts: 0,78 mm con 0,8 pedido)
      const R = p.grosorMinimoLineasMm / 2 / p.mmPorPixel + 0.5
      const zona = dilatar(lineas.esqueleto, ancho, alto, R)
      // Nunca achicar: lo fino original de esas lineas tambien queda
      for (let i = 0; i < zona.length; i++) if (lineas.mascara[i]) zona[i] = 1
      pintar.push({ color: c, zona })
    }
    rellenar(salida, ancho)
    // Lo mas claro primero: la linea mas oscura pisa a la clara
    pintar.sort((a, b) => luminancia(p.paleta[b.color]!) - luminancia(p.paleta[a.color]!))
    for (const { color, zona } of pintar) {
      for (let i = 0; i < zona.length; i++) {
        if (!zona[i] || salida[i] === color) continue
        salida[i] = color
        informe.agregados++
      }
    }
  }
  // Perdida: lo que habia despues de la moda contra la salida final (con estos params)
  let perdidos = 0
  const total = new Array<number>(colores).fill(0)
  const perdidosPorColor = new Array<number>(colores).fill(0)
  islas(salida, ancho, colores, p.areaMinimaIslaMm2 / (p.mmPorPixel * p.mmPorPixel))
  for (let i = 0; i < antes.length; i++) {
    const a = antes[i]!
    if (a === FONDO) continue
    total[a]!++
    if (salida[i] !== a) {
      perdidosPorColor[a]!++
      perdidos++
    }
  }
  informe.perdidaPorColor = total.map((t, c) => (t ? perdidosPorColor[c]! / t : 0))
  informe.fraccionPerdida = dibujoPx ? perdidos / dibujoPx : 0
  informe.fraccionLineas = dibujoPx ? lineasPx / dibujoPx : 0
  return { etiquetas: salida, informe }
}

/**
 * De lo fino de un color, lo que es LINEA: pixeles a mas de `radio` de la parte gruesa (asi las esquinas
 * que la apertura le recorta a una forma gruesa no cuentan) y en componentes cuyo esqueleto mide al
 * menos largoMinimoLineaMm.
 */
function medirLineas(
  fina: Uint8Array,
  abierta: Uint8Array,
  ancho: number,
  alto: number,
  radio: number,
  p: ParamsLimpiar,
  color: number,
  antes: Uint8Array,
  informe: InformeLimpieza,
) {
  const aGruesa = distanciaCuadrada((i) => abierta[i] === 1, ancho, alto)
  const lejos = new Uint8Array(fina.length)
  const r2 = radio * radio
  for (let i = 0; i < fina.length; i++) lejos[i] = fina[i] && aGruesa[i]! > r2 ? 1 : 0
  const esq = esqueleto(lejos, ancho, alto)
  const mascara = new Uint8Array(fina.length)
  const esqueletoOk = new Uint8Array(fina.length)
  const largoMinimoPx = p.largoMinimoLineaMm / p.mmPorPixel
  let px = 0
  let largo = 0
  componentes(
    (i) => lejos[i] === 1,
    ancho,
    alto,
    true,
    (miembros) => {
      let s = 0
      for (const i of miembros) if (esq[i]) s++
      // Zhang-Suen borra entera una diagonal de 2 px de ancho (escalera): si el esqueleto se evaporo,
      // el largo sale de la caja de la componente y la semilla es la componente misma
      let sinEsqueleto = false
      if (s < largoMinimoPx) {
        let [x0, y0, x1, y1] = [ancho, alto, -1, -1]
        for (const i of miembros) {
          const x = i % ancho
          const y = (i / ancho) | 0
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
        const diagonal = Math.hypot(x1 - x0 + 1, y1 - y0 + 1)
        if (diagonal < largoMinimoPx) return
        s = Math.round(diagonal)
        sinEsqueleto = true
      }
      if (p.guardaHalo && esHalo(miembros, color, antes, ancho, p)) {
        informe.halosDescartados++
        return
      }
      largo += s
      for (const i of miembros) {
        mascara[i] = 1
        if (esq[i] || sinEsqueleto) esqueletoOk[i] = 1
      }
      px += miembros.length
    },
  )
  return { px, largoMm: largo * p.mmPorPixel, mascara, esqueleto: esqueletoOk }
}

const d3 = (a: ArrayLike<number>, ao: number, b: ArrayLike<number>, bo: number) =>
  Math.hypot(a[ao]! - b[bo]!, a[ao + 1]! - b[bo + 1]!, a[ao + 2]! - b[bo + 2]!)

function esHalo(
  miembros: Int32Array,
  color: number,
  antes: Uint8Array,
  ancho: number,
  p: ParamsLimpiar,
): boolean {
  const { lab, fondoLab } = p.guardaHalo!
  const propio = p.paleta[color]!.oklab
  // 1 · Nucleo: alguna parte de la linea tiene de verdad el color de su etiqueta
  let nucleo = 0
  for (const i of miembros) if (d3(lab, i * 3, propio, 0) < 0.06) nucleo++
  if (nucleo < Math.max(2, miembros.length * 0.1)) return true
  // 2 · Entre vecinos: el color queda en el segmento entre los dos vecinos mas frecuentes
  const cuenta = new Map<number, number>()
  let total = 0
  const n = antes.length
  for (const i of miembros) {
    const x = i % ancho
    for (const j of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
      if (j < 0 || j >= n) continue
      const e = antes[j]!
      if (e === color) continue
      cuenta.set(e, (cuenta.get(e) ?? 0) + 1)
      total++
    }
  }
  const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1])
  if (orden.length < 2 || orden[1]![1] < total * 0.15) return false
  const colorDe = (e: number) => (e >= 254 ? fondoLab : (p.paleta[e]?.oklab ?? null))
  const A = colorDe(orden[0]![0])
  const B = colorDe(orden[1]![0])
  if (!A || !B) return false
  const ab = d3(A, 0, B, 0)
  if (ab < 0.08) return false
  return d3(A, 0, propio, 0) + d3(propio, 0, B, 0) <= ab * 1.12
}
