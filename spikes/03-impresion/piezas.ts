// Spike F0.5 — las tres piezas patron del plan, modeladas a mano.
//
// Codigo DESCARTABLE de la Fase 0: usa el motor real (withScope, resolverSolapes) y los
// escritores reales (3MF, STL), pero la geometria del llavero esta hecha a mano. La
// version de verdad es src/geometria/llavero.ts y franjas.ts (F1.2).
//
// Cada funcion se llama dentro de withScope() y devuelve solo datos planos.

import type { PiezaExport } from '../../src/export/tipos.ts'
import { aPiezaExport } from '../../src/geometria/malla.ts'
import type {
  CrossSection,
  Manifold,
  ManifoldToplevel,
  SimplePolygon,
} from '../../src/geometria/manifold.ts'
import { resolverSolapes, type RegionColor } from '../../src/geometria/regiones.ts'
import { EPSILON_SOLAPE_XY } from '../../src/pipeline/defaults.ts'

// Valores por defecto del plan §7 (los PROVISORIOS son los que estas piezas calibran)
export const ALTURA_CAPA = 0.2
export const ALTURA_BASE = 2.4 // 12 capas
export const ALTURA_COLOR = 0.6 // 3 capas
export const ALTURA_FRANJA = 0.6
export const OFFSET_CONTORNO = 1.5
export const DIAMETRO_AGUJERO = 4.2
export const MARGEN_AGUJERO = 3.0 // PROVISORIO: lo confirma el tiron de P2
export const RADIO_FILLET_PESTANA = 2.0
const DENSIDAD_PLA = 1.24 // g/cm³

// Slots del AMS. El usuario asigna sus filamentos reales al abrir el 3MF.
export const COLORES = {
  blanco: { slot: 1, hex: '#FFFFFF' },
  negro: { slot: 2, hex: '#1C1C1C' },
  rojo: { slot: 3, hex: '#C12E1F' },
  amarillo: { slot: 4, hex: '#F4D10B' },
} as const
export const COLORES_AMS = Object.values(COLORES).map((c) => c.hex)

export type Informe = { nombre: string; lineas: string[] }
export type ResultadoPieza = { piezas: PiezaExport[]; entera: PiezaExport; informe: Informe }

const circulo = (m: ManifoldToplevel, r: number, x: number, y: number): CrossSection =>
  m.CrossSection.circle(r, 96).translate([x, y])

const rect = (m: ManifoldToplevel, x0: number, y0: number, x1: number, y1: number): CrossSection =>
  m.CrossSection.square([x1 - x0, y1 - y0]).translate([x0, y0])

const aContornos = (s: CrossSection): SimplePolygon[] => s.toPolygons()

const gramos = (solido: Manifold) => (solido.volume() / 1000) * DENSIDAD_PLA

function losa(seccion: CrossSection, z: number, alto: number): Manifold {
  return seccion.extrude(alto).translate([0, 0, z])
}

function cerrar(
  m: ManifoldToplevel,
  nombre: string,
  solidos: { nombre: string; slot: number; solido: Manifold }[],
  lineas: string[],
): ResultadoPieza {
  const entera = m.Manifold.union(solidos.map((s) => s.solido))
  const caja = entera.boundingBox()
  lineas.unshift(
    `Medidas: ${(caja.max[0] - caja.min[0]).toFixed(1)} × ${(caja.max[1] - caja.min[1]).toFixed(1)} × ${(caja.max[2] - caja.min[2]).toFixed(1)} mm`,
    `Material estimado (sin purga): ${gramos(entera).toFixed(2)} g`,
  )
  for (const s of solidos)
    lineas.push(`  ${s.nombre} (slot ${s.slot}): ${gramos(s.solido).toFixed(2)} g`)
  return {
    piezas: solidos.map((s) => aPiezaExport(s.solido, s.nombre, s.slot)),
    entera: aPiezaExport(entera, `${nombre}-entera`, 1),
    informe: { nombre, lineas },
  }
}

// ------------------------------------------------------------------------------------
// P1 · Regla de detalle
// Placa de 60×30. Barras de 0,4 a 2,0 mm para medir el ancho minimo real, y dos zonas de
// color con un borde desalineado a proposito para ver si quedan costuras.
// ------------------------------------------------------------------------------------
export const ANCHOS_BARRAS = [0.4, 0.6, 0.8, 1.0, 1.5, 2.0]

export function p1ReglaDeDetalle(m: ManifoldToplevel): ResultadoPieza {
  const lineas: string[] = []
  const placa = m.CrossSection.square([60, 30], true)

  // Barras: 20 mm de largo, separadas 2 mm, de la mas fina a la mas gruesa (izquierda a derecha).
  // NO pasan por la cadena con epsilon: crecerian 0,1 mm y la regla mediria otra cosa.
  let x = -27
  const barras: CrossSection[] = []
  for (const ancho of ANCHOS_BARRAS) {
    barras.push(rect(m, x, -10, x + ancho, 10))
    lineas.push(
      `  barra de ${ancho.toFixed(1)} mm: x de ${x.toFixed(1)} a ${(x + ancho).toFixed(1)}`,
    )
    x += ancho + 2
  }
  // Un punto arriba de la barra de 0,8 mm: es el umbral provisorio que se esta validando
  const x08 = -27 + 0.4 + 2 + 0.6 + 2 + 0.4
  const marca = circulo(m, 0.75, x08, 12.5)

  // Costura: negro con el borde en zigzag de ±0,03 mm alrededor de x=15, rojo recto a 15,03.
  // Es lo que pasa cuando dos colores se trazan y simplifican por separado.
  const zigzag: SimplePolygon = [
    [3, -10],
    [15, -10],
  ]
  for (let i = 0; i <= 40; i++) zigzag.push([15 + (i % 2 ? 0.03 : -0.03), -10 + i * 0.5])
  zigzag.push([3, 10])
  const regiones: RegionColor[] = [
    { id: 'costura-negro', prioridad: 1, contornos: [zigzag] },
    { id: 'costura-rojo', prioridad: 2, contornos: aContornos(rect(m, 15.03, -10, 27, 10)) },
  ]
  const [rojo, negro] = resolverSolapes(m, regiones, EPSILON_SOLAPE_XY)
  if (!rojo || !negro) throw new Error('P1: la cadena de resta no devolvio las dos zonas')
  lineas.push(
    `Costura: ${m.CrossSection.union([rojo.seccion, negro.seccion]).numContour()} contorno(s) en la union (1 = sin hueco)`,
  )

  const zonaNegra = m.CrossSection.union([...barras, marca, negro.seccion])
  return cerrar(
    m,
    'P1-regla-de-detalle',
    [
      { nombre: 'base', slot: COLORES.blanco.slot, solido: losa(placa, 0, ALTURA_BASE) },
      {
        nombre: 'negro',
        slot: COLORES.negro.slot,
        solido: losa(zonaNegra, ALTURA_BASE, ALTURA_COLOR),
      },
      {
        nombre: 'rojo',
        slot: COLORES.rojo.slot,
        solido: losa(rojo.seccion, ALTURA_BASE, ALTURA_COLOR),
      },
    ],
    lineas,
  )
}

// ------------------------------------------------------------------------------------
// El dibujo de P2 y P3: una carita de 38 mm con ojos, boca, cachetes y una isla de 1 mm²
// ------------------------------------------------------------------------------------
function boca(m: ManifoldToplevel): CrossSection {
  const puntos: SimplePolygon = []
  const n = 48
  const desde = (200 * Math.PI) / 180
  const hasta = (340 * Math.PI) / 180
  for (let i = 0; i <= n; i++) {
    const t = desde + ((hasta - desde) * i) / n
    puntos.push([12 * Math.cos(t), 12 * Math.sin(t)])
  }
  for (let i = n; i >= 0; i--) {
    const t = desde + ((hasta - desde) * i) / n
    puntos.push([9 * Math.cos(t), 9 * Math.sin(t)])
  }
  return m.CrossSection.ofPolygons([puntos])
}

/** La isla mide 1 mm² DESPUES de crecer epsilon, que es lo que se imprime. */
const RADIO_ISLA = Math.sqrt(1 / Math.PI) - EPSILON_SOLAPE_XY

function regionesCarita(m: ManifoldToplevel, conRojo: boolean): RegionColor[] {
  const regiones: RegionColor[] = [
    { id: 'amarillo', prioridad: 1, contornos: aContornos(circulo(m, 19, 0, 0)) },
    {
      id: 'negro',
      prioridad: 3,
      contornos: aContornos(
        m.CrossSection.union([circulo(m, 2.5, -7, 5), circulo(m, 2.5, 7, 5), boca(m)]),
      ),
    },
  ]
  if (conRojo) {
    regiones.push({
      id: 'rojo',
      prioridad: 2,
      contornos: aContornos(
        m.CrossSection.union([
          circulo(m, 3.5, -12, -3),
          circulo(m, 3.5, 12, -3),
          circulo(m, RADIO_ISLA, 0, 13),
        ]),
      ),
    })
  }
  return regiones
}

/** Contorno + pestaña con fillet + agujero de la argolla (plan §7, audit-02 §6). */
function cuerpoDelLlavero(
  m: ManifoldToplevel,
  silueta: CrossSection,
  lineas: string[],
): CrossSection {
  const contorno = silueta.offset(OFFSET_CONTORNO, 'Round')
  const radioAgujero = DIAMETRO_AGUJERO / 2
  const radioPestana = radioAgujero + MARGEN_AGUJERO
  // La pestaña se mete 1 mm en el contorno para quedar unida
  const yCentro = contorno.bounds().max[1] + radioPestana - 1
  const pestana = circulo(m, radioPestana, 0, yCentro)
  // Cierre morfologico: redondea con radio r las esquinas concavas donde la pestaña toca el contorno
  const conFillet = m.CrossSection.union([contorno, pestana])
    .offset(RADIO_FILLET_PESTANA, 'Round')
    .offset(-RADIO_FILLET_PESTANA, 'Round')
  const agujero = circulo(m, radioAgujero, 0, yCentro)
  lineas.push(
    `Argolla: agujero Ø${DIAMETRO_AGUJERO} mm, anillo de ${MARGEN_AGUJERO} mm, fillet r=${RADIO_FILLET_PESTANA} mm`,
  )
  return conFillet.subtract(agujero)
}

// ------------------------------------------------------------------------------------
// P2 · Llavero completo, 4 colores a ras (AMS)
// ------------------------------------------------------------------------------------
export function p2LlaveroCompleto(m: ManifoldToplevel): ResultadoPieza {
  const lineas: string[] = []
  const resueltas = resolverSolapes(m, regionesCarita(m, true), EPSILON_SOLAPE_XY)
  const silueta = m.CrossSection.union(resueltas.map((r) => r.seccion))
  const cuerpo = cuerpoDelLlavero(m, silueta, lineas)

  const isla = resueltas
    .find((r) => r.id === 'rojo')
    ?.seccion.decompose()
    .map((parte) => parte.area())
    .sort((a, b) => a - b)[0]
  lineas.push(`Isla más chica impresa: ${isla?.toFixed(2)} mm² (objetivo 1,00)`)

  const slotDe = (id: string) => COLORES[id as keyof typeof COLORES].slot
  return cerrar(
    m,
    'P2-llavero-completo',
    [
      { nombre: 'base', slot: COLORES.blanco.slot, solido: losa(cuerpo, 0, ALTURA_BASE) },
      ...resueltas.map((r) => ({
        nombre: r.id,
        slot: slotDe(r.id),
        solido: losa(r.seccion, ALTURA_BASE, ALTURA_COLOR),
      })),
    ],
    lineas,
  )
}

// ------------------------------------------------------------------------------------
// P3 · Apilado: el mismo dibujo en franjas Z, 3 colores, un solo extrusor con M600
// ------------------------------------------------------------------------------------
export type ResultadoApilado = ResultadoPieza & {
  /** z donde empieza cada franja de color, con su color. */
  franjas: { z: number; hex: string }[]
}

export function p3Apilado(m: ManifoldToplevel): ResultadoApilado {
  const lineas: string[] = []
  // Rango 1 = amarillo (la cara), rango 2 = negro (ojos y boca), de abajo hacia arriba
  const resueltas = resolverSolapes(m, regionesCarita(m, false), EPSILON_SOLAPE_XY)
  const porRango = ['amarillo', 'negro'].map((id) => {
    const r = resueltas.find((x) => x.id === id)
    if (!r) throw new Error(`P3: falta la region ${id}`)
    return r.seccion
  })
  const silueta = m.CrossSection.union(porRango)
  const cuerpo = cuerpoDelLlavero(m, silueta, lineas)

  // Plan §3, paso 12b: franja(k) = union(region(k), ..., region(N)); z(k) = base + (k-1)·franja
  const franjas = porRango.map((_, k) => m.CrossSection.union(porRango.slice(k)))
  const solidos = [{ nombre: 'base', slot: 1, solido: losa(cuerpo, 0, ALTURA_BASE) }]
  const cambios: { z: number; hex: string }[] = []
  const hex = [COLORES.amarillo.hex, COLORES.negro.hex]

  franjas.forEach((franja, k) => {
    // DRC #3: ningun color puede flotar sin nada abajo
    const debajo = k === 0 ? cuerpo : franjas[k - 1]!
    const flotante = franja.subtract(debajo).area()
    if (flotante > 0.001)
      throw new Error(`P3: la franja ${k + 1} flota ${flotante.toFixed(3)} mm² sin soporte`)
    const z = ALTURA_BASE + k * ALTURA_FRANJA
    solidos.push({ nombre: `franja-${k + 1}`, slot: 1, solido: losa(franja, z, ALTURA_FRANJA) })
    cambios.push({ z, hex: hex[k]! })
    lineas.push(
      `Franja ${k + 1}: z ${z.toFixed(1)} → ${(z + ALTURA_FRANJA).toFixed(1)} mm, color ${hex[k]} (sin partes flotantes)`,
    )
  })

  return { ...cerrar(m, 'P3-apilado', solidos, lineas), franjas: cambios }
}
