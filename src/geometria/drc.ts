// Las 7 validaciones de imprimibilidad (plan §7.9), en orden.
// error = bloquea la descarga · aviso = se muestra y se puede seguir.
// Devuelven zonas (poligonos en mm) y no solo areas: son las que el preview pinta de naranja.

import * as D from '../pipeline/defaults.ts'
import type { Agujero } from './llavero.ts'
import type { CrossSection, Manifold, ManifoldToplevel } from './manifold.ts'

export type CodigoAviso =
  | 'solido-invalido'
  | 'anillo-fino'
  | 'argolla-suelta'
  | 'color-flotante'
  | 'colores-solapados'
  | 'detalle-fino'
  | 'isla-chica'
  | 'pieza-suelta'
  | 'mas-colores-que-slots'
  | 'altura-redondeada'

export type Aviso = {
  codigo: CodigoAviso
  nivel: 'error' | 'aviso'
  mensaje: string
  zonas?: [number, number][][]
}

const TOLERANCIA_AREA = 0.001 // mm², la misma del invariante de §7.9

/** 1 · Cada solido es manifold y tiene volumen. */
export function drcSolidos(solidos: readonly { nombre: string; solido: Manifold }[]): Aviso[] {
  return solidos
    .filter((s) => s.solido.status() !== 'NoError' || s.solido.volume() <= 0)
    .map((s) => ({
      codigo: 'solido-invalido',
      nivel: 'error',
      mensaje: `La pieza "${s.nombre}" no es un sólido imprimible (${s.solido.status()}).`,
    }))
}

/**
 * 2 · La argolla aguanta. Dos cosas:
 *  a) el anillo alrededor del agujero mide al menos MARGEN_AGUJERO_MINIMO en todas las direcciones;
 *  b) la pestaña esta unida al cuerpo por material de al menos ese ancho.
 * El plan (§7.9) pedia solo (a), pero la pestaña se construye centrada en el agujero, asi que (a)
 * se cumple sola salvo que se toquen los parametros. Donde se rompe un llavero de verdad es en
 * (b): si el agujero se arrastra lejos, la pestaña queda colgando de un hilo o suelta.
 */
export function drcAnillo(
  m: ManifoldToplevel,
  cuerpoRelleno: CrossSection,
  agujero: Agujero | null,
): Aviso[] {
  if (!agujero) return []
  const avisos: Aviso[] = []
  const alrededor = (extra: number) =>
    m.CrossSection.circle(agujero.radio + extra, 96).translate([agujero.cx, agujero.cy])

  const falta = alrededor(D.MARGEN_AGUJERO_MINIMO).subtract(cuerpoRelleno)
  if (falta.area() > TOLERANCIA_AREA) {
    avisos.push({
      codigo: 'anillo-fino',
      nivel: 'error',
      mensaje: `Alrededor del agujero quedan menos de ${D.MARGEN_AGUJERO_MINIMO} mm de material: se va a romper.`,
      zonas: falta.toPolygons(),
    })
  }

  // Una apertura con radio = la mitad del minimo corta todo lo mas angosto que el minimo.
  // Si despues de eso el anillo ya no toca la parte principal, la union es demasiado fina.
  const r = D.MARGEN_AGUJERO_MINIMO / 2
  const abierto = cuerpoRelleno.offset(-r, 'Round').offset(r, 'Round')
  const partes = abierto.decompose()
  const principal = partes.sort((a, b) => b.area() - a.area())[0]
  const anillo = alrededor(D.MARGEN_AGUJERO_MINIMO).subtract(alrededor(0))
  if (!principal || principal.intersect(anillo).area() <= TOLERANCIA_AREA) {
    avisos.push({
      codigo: 'argolla-suelta',
      nivel: 'error',
      mensaje: `La argolla está unida al llavero por menos de ${D.MARGEN_AGUJERO_MINIMO} mm de material o suelta: se va a romper. Acercá el agujero al dibujo.`,
      zonas: alrededor(D.MARGEN_AGUJERO).toPolygons(),
    })
  }
  return avisos
}

/** 3 · Modo apilado: cada franja se apoya entera sobre la de abajo. */
export function drcFlotantes(franjas: readonly CrossSection[], base: CrossSection): Aviso[] {
  return franjas.flatMap((franja, k): Aviso[] => {
    const flotante = franja.subtract(k === 0 ? base : franjas[k - 1]!)
    if (flotante.area() <= TOLERANCIA_AREA) return []
    return [
      {
        codigo: 'color-flotante',
        nivel: 'error',
        mensaje: `El color ${k + 1} queda flotando sin nada abajo en modo un solo extrusor.`,
        zonas: flotante.toPolygons(),
      },
    ]
  })
}

/**
 * 4 · Las regiones de color no se pisan. Se valida en 2D: los solidos se extruyen de regiones
 * disjuntas y la base se construye restandolas, asi que en 3D es disjunto por construccion.
 * Intersecar solidos de a pares costaria mucho mas y el preview tiene 400 ms de presupuesto.
 */
export function drcDisjuntas(
  regiones: readonly { nombre: string; seccion: CrossSection }[],
): Aviso[] {
  const avisos: Aviso[] = []
  for (let i = 0; i < regiones.length; i++) {
    for (let j = i + 1; j < regiones.length; j++) {
      const a = regiones[i]!
      const b = regiones[j]!
      const pisado = a.seccion.intersect(b.seccion)
      if (pisado.area() <= TOLERANCIA_AREA) continue
      avisos.push({
        codigo: 'colores-solapados',
        nivel: 'error',
        mensaje: `${a.nombre} y ${b.nombre} se pisan: el slicer imprimiría las dos encima.`,
        zonas: pisado.toPolygons(),
      })
    }
  }
  return avisos
}

/** 5 · Detalles mas angostos que el ancho minimo. */
export function drcDetalle(
  regiones: readonly { nombre: string; seccion: CrossSection }[],
  anchoMinimo: number,
): Aviso[] {
  const r = anchoMinimo / 2
  return regiones.flatMap((reg): Aviso[] => {
    const area = reg.seccion.area()
    if (area <= 0) return []
    const perdido = reg.seccion.subtract(reg.seccion.offset(-r, 'Round').offset(r, 'Round'))
    const fraccion = perdido.area() / area
    if (fraccion <= D.PERDIDA_DETALLE_AVISO) return []
    return [
      {
        codigo: 'detalle-fino',
        nivel: 'aviso',
        mensaje: `${reg.nombre} tiene partes más finas que ${anchoMinimo} mm (${Math.round(fraccion * 100)} % de su área): pueden salir frágiles o no salir.`,
        zonas: perdido.toPolygons(),
      },
    ]
  })
}

/** 6 · Islas chicas y piezas que quedaron separadas del resto del llavero. */
export function drcIslas(
  regiones: readonly { nombre: string; seccion: CrossSection }[],
  cuerpo: CrossSection,
  areaMinima: number,
): Aviso[] {
  const avisos: Aviso[] = []
  for (const reg of regiones) {
    const chicas = reg.seccion.decompose().filter((parte) => parte.area() < areaMinima)
    if (!chicas.length) continue
    avisos.push({
      codigo: 'isla-chica',
      nivel: 'aviso',
      mensaje: `${reg.nombre} tiene ${chicas.length} parte(s) de menos de ${areaMinima} mm²: pueden no imprimirse.`,
      zonas: chicas.flatMap((parte) => parte.toPolygons()),
    })
  }
  const partes = cuerpo.decompose()
  if (partes.length > 1) {
    const principal = Math.max(...partes.map((p) => p.area()))
    avisos.push({
      codigo: 'pieza-suelta',
      nivel: 'aviso',
      mensaje: `El llavero quedó en ${partes.length} partes separadas: las chicas se van a caer.`,
      zonas: partes.filter((p) => p.area() < principal).flatMap((p) => p.toPolygons()),
    })
  }
  return avisos
}

/** 7 · Mas filamentos que slots. */
export function drcSlots(filamentos: number, slots: number, modo: 'a_ras' | 'apilado'): Aviso[] {
  if (modo === 'apilado') {
    const cambios = filamentos - 1
    if (cambios <= D.MAX_CAMBIOS_APILADO) return []
    return [
      {
        codigo: 'mas-colores-que-slots',
        nivel: 'aviso',
        mensaje: `Son ${cambios} cambios manuales de filamento. Con un solo extrusor conviene bajar a ${D.MAX_CAMBIOS_APILADO + 1} colores.`,
      },
    ]
  }
  if (filamentos <= slots) return []
  return [
    {
      codigo: 'mas-colores-que-slots',
      nivel: 'aviso',
      mensaje: `El diseño usa ${filamentos} colores y la impresora tiene ${slots} slots. Fusioná colores o pasá a modo un solo extrusor.`,
    },
  ]
}
