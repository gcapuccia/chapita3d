// construir(): de un Diseno a piezas exportables, avisos y estimacion (plan §5.3).
// Devuelve datos planos: se puede llamar desde el worker y transferir el resultado.

import type { Diseno, Filamento, Pieza } from '../diseno/tipos.ts'
import type { CambioDeCapa, PiezaExport } from '../export/tipos.ts'
import * as D from '../pipeline/defaults.ts'
import {
  drcAnillo,
  drcDetalle,
  drcDisjuntas,
  drcFlotantes,
  drcIslas,
  drcSlots,
  drcSolidos,
  type Aviso,
} from './drc.ts'
import { estimarApilado, estimarAras, type Estimacion } from './estimar.ts'
import { franjasApilado, franjasAras, type SeccionDeColor, type SolidoDeColor } from './franjas.ts'
import { cuerpoDelLlavero, type Agujero } from './llavero.ts'
import { aPiezaExport } from './malla.ts'
import { withScope, type CrossSection } from './manifold.ts'
import { resolverSolapes, type RegionColor } from './regiones.ts'

export type ResultadoConstruccion = {
  modoColor: Diseno['impresion']['modoColor']
  /** Ordenadas por slot. */
  piezas: PiezaExport[]
  entera: PiezaExport
  avisos: Aviso[]
  /** Hay algun aviso de nivel error: la descarga se bloquea. */
  bloqueante: boolean
  estimacion: Estimacion
  medidas: [number, number, number]
  agujero: Agujero | null
  /** Filamentos en orden de uso: por slot (a ras) o de abajo hacia arriba (apilado). */
  filamentos: Filamento[]
  cambiosDeCapa: CambioDeCapa[]
}

/** Lleva los contornos de una pieza a coordenadas del llavero: escala, rota y traslada. */
function aplicarTransform(pieza: Pieza): [number, number][][] {
  if (pieza.geometria.kind !== 'poligonos') return []
  const { x, y, rotZ, sx, sy } = pieza.transform
  const c = Math.cos((rotZ * Math.PI) / 180)
  const s = Math.sin((rotZ * Math.PI) / 180)
  return pieza.geometria.contornos.map((anillo) =>
    anillo.map(([px, py]) => {
      const ex = px * sx
      const ey = py * sy
      return [x + ex * c - ey * s, y + ex * s + ey * c] as [number, number]
    }),
  )
}

export function construir(d: Diseno): ResultadoConstruccion {
  return withScope((m) => {
    const avisos: Aviso[] = []
    const redondear = (valor: number, que: string) => {
      const capa = d.impresion.alturaCapa
      const r = Math.max(capa, Math.round(valor / capa) * capa)
      if (Math.abs(r - valor) > 1e-6) {
        avisos.push({
          codigo: 'altura-redondeada',
          nivel: 'aviso',
          mensaje: `${que} pasó de ${valor} a ${r.toFixed(2)} mm para caer justo en capas de ${capa} mm.`,
        })
      }
      return r
    }
    const espesor = redondear(d.cuerpo.espesor, 'El espesor')
    const alturaColor = redondear(
      Math.min(d.cuerpo.alturaColor, espesor - d.impresion.alturaCapa),
      'La capa de color',
    )

    const filamentoPorId = new Map(d.filamentos.map((f) => [f.id, f]))
    const base = filamentoPorId.get(d.contorno.filamentoId)
    if (!base)
      throw new Error(`El contorno usa un filamento que no existe: ${d.contorno.filamentoId}`)

    // Cadena de resta por prioridad sobre todas las piezas visibles
    const visibles = d.piezas.filter((p) => p.visible && p.geometria.kind === 'poligonos')
    const regiones: RegionColor[] = visibles.map((p) => ({
      id: p.id,
      prioridad: p.prioridad,
      contornos: aplicarTransform(p),
    }))
    const resueltas = resolverSolapes(m, regiones, D.EPSILON_SOLAPE_XY)
    if (!resueltas.length) throw new Error('El diseño no tiene ninguna región visible.')
    const silueta = m.CrossSection.union(resueltas.map((r) => r.seccion))
    const llavero = cuerpoDelLlavero(m, silueta, d.contorno, d.argolla)
    const agujero = llavero.agujero
      ? m.CrossSection.circle(llavero.agujero.radio, 96).translate([
          llavero.agujero.cx,
          llavero.agujero.cy,
        ])
      : null

    // Agrupar por filamento; lo que usa el filamento de la base se funde con la base
    const porFilamento = new Map<string, { secciones: CrossSection[]; prioridad: number }>()
    resueltas.forEach((r) => {
      const pieza = visibles.find((p) => p.id === r.id)!
      if (pieza.filamentoId === base.id) return
      const grupo = porFilamento.get(pieza.filamentoId) ?? { secciones: [], prioridad: -Infinity }
      grupo.secciones.push(r.seccion)
      grupo.prioridad = Math.max(grupo.prioridad, pieza.prioridad)
      porFilamento.set(pieza.filamentoId, grupo)
    })
    const colores: SeccionDeColor[] = [...porFilamento.entries()]
      .map(([id, g]) => {
        const filamento = filamentoPorId.get(id)
        if (!filamento) throw new Error(`Una pieza usa un filamento que no existe: ${id}`)
        let seccion = m.CrossSection.union(g.secciones)
        if (agujero) seccion = seccion.subtract(agujero)
        return { filamento, seccion, prioridad: g.prioridad }
      })
      .filter((c) => !c.seccion.isEmpty())
      .sort((a, b) => a.filamento.slot - b.filamento.slot)

    const conNombre = colores.map((c) => ({ nombre: c.filamento.nombre, seccion: c.seccion }))
    let solidos: SolidoDeColor[]
    let estimacion: Estimacion
    let cambiosDeCapa: CambioDeCapa[] = []
    let filamentos: Filamento[]

    if (d.impresion.modoColor === 'a_ras') {
      solidos = franjasAras(m, llavero.cuerpo, base, colores, espesor, alturaColor)
      const zonaBaseArriba = colores.length
        ? llavero.cuerpo.subtract(m.CrossSection.union(colores.map((c) => c.seccion)))
        : llavero.cuerpo
      const filamentosArriba = colores.length + (zonaBaseArriba.area() > 0.001 ? 1 : 0)
      const volumen = solidos.reduce((t, s) => t + s.solido.volume(), 0)
      estimacion = estimarAras(
        volumen,
        Math.round(alturaColor / d.impresion.alturaCapa),
        filamentosArriba,
      )
      filamentos = [base, ...colores.map((c) => c.filamento)]
      avisos.push(
        ...drcDisjuntas(conNombre),
        ...drcSlots(filamentos.length, d.impresion.slots, 'a_ras'),
      )
    } else {
      const apilado = franjasApilado(m, llavero.cuerpo, base, colores, espesor, alturaColor)
      solidos = apilado.solidos
      cambiosDeCapa = apilado.cambios.map((c) => ({
        z: c.z + D.DESPLAZAMIENTO_TOP_Z,
        hex: c.filamento.hex,
      }))
      const volumen = solidos.reduce((t, s) => t + s.solido.volume(), 0)
      estimacion = estimarApilado(volumen, apilado.cambios.length)
      filamentos = [base, ...apilado.cambios.map((c) => c.filamento)]
      avisos.push(
        ...drcFlotantes(apilado.franjas, llavero.cuerpo),
        ...drcSlots(filamentos.length, 1, 'apilado'),
      )
    }

    avisos.unshift(...drcSolidos(solidos))
    avisos.push(
      ...drcAnillo(m, llavero.cuerpoRelleno, llavero.agujero),
      ...drcDetalle(conNombre, D.ANCHO_MINIMO_DETALLE_MM),
      ...drcIslas(conNombre, llavero.cuerpo, D.AREA_MINIMA_ISLA_MM2.estandar),
    )

    const entera = m.Manifold.union(solidos.map((s) => s.solido))
    const caja = entera.boundingBox()
    const slotDe = (s: SolidoDeColor) => (d.impresion.modoColor === 'a_ras' ? s.filamento.slot : 1)

    return {
      modoColor: d.impresion.modoColor,
      piezas: solidos
        .map((s) => aPiezaExport(s.solido, s.nombre, slotDe(s)))
        .sort((a, b) => a.slot - b.slot),
      entera: aPiezaExport(entera, 'pieza-entera', 1),
      avisos,
      bloqueante: avisos.some((a) => a.nivel === 'error'),
      estimacion,
      medidas: [caja.max[0] - caja.min[0], caja.max[1] - caja.min[1], caja.max[2] - caja.min[2]],
      agujero: llavero.agujero,
      filamentos,
      cambiosDeCapa,
    }
  })
}
