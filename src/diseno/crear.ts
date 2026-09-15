// Del resultado del pipeline a un Diseno listo para construir, con los valores por defecto.

import { deltaE2000 } from '../pipeline/color.ts'
import * as D from '../pipeline/defaults.ts'
import type { RegionTrazada } from '../pipeline/tipos.ts'
import { TRANSFORM_IDENTIDAD, type Diseno, type Filamento, type Pieza } from './tipos.ts'

export type OpcionesDiseno = {
  nombre: string
  id: string
  /** Fecha ISO, la pone quien llama (el pipeline no lee el reloj). */
  ahora: string
  appVersion: string
  modoColor?: Diseno['impresion']['modoColor']
  slots?: number
  espesor?: number
  /** Color del cuerpo (base, contorno y pestaña). */
  hexBase?: string
}

/**
 * Nombres de color para las instrucciones y los avisos. Se elige el mas cercano por ΔE2000.
 * No son filamentos reales: el catalogo de 24 PLA con marca es filamentos.json (plan §9.6, F2.4).
 */
const NOMBRES_DE_COLOR: [string, string][] = [
  ['Blanco', '#FFFFFF'],
  ['Negro', '#1A1A1A'],
  ['Gris', '#808080'],
  ['Gris claro', '#C8C8C8'],
  ['Rojo', '#D62828'],
  ['Bordó', '#7A1F2B'],
  ['Naranja', '#F28C28'],
  ['Amarillo', '#F5C518'],
  ['Beige', '#E3D5B8'],
  ['Verde', '#2E9E5B'],
  ['Verde claro', '#8BC34A'],
  ['Cian', '#27C3D8'],
  ['Azul', '#1E4FD8'],
  ['Azul marino', '#1D3A8A'],
  ['Violeta', '#7B3FB5'],
  ['Rosa', '#EC6FA9'],
  ['Marrón', '#6D4C41'],
]

export function nombreDeColor(hex: string): string {
  return NOMBRES_DE_COLOR.map(([nombre, h]) => ({ nombre, d: deltaE2000(hex, h) })).sort(
    (a, b) => a.d - b.d,
  )[0]!.nombre
}

/** Luminancia aproximada, para ordenar los slots de claro a oscuro (reduce la purga, audit-02 §6.5). */
function luminancia(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
}

export function crearDiseno(regiones: readonly RegionTrazada[], o: OpcionesDiseno): Diseno {
  const hexBase = o.hexBase ?? '#FFFFFF'

  // Centrar el dibujo en el origen
  const puntos = regiones.flatMap((r) => r.contornos.flat())
  const xs = puntos.map((p) => p[0])
  const ys = puntos.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2

  // Filamentos: la base primero; un color de region casi igual a la base (ΔE2000 < 5) usa la base
  const base: Filamento = {
    id: 'base',
    nombre: nombreDeColor(hexBase),
    hex: hexBase,
    slot: 1,
    deLaImagen: [],
  }
  const deColor = new Map<string, Filamento>()
  const filamentoDe = (hex: string): Filamento => {
    const recordar = (f: Filamento) => {
      if (!f.deLaImagen!.includes(hex)) f.deLaImagen!.push(hex)
      return f
    }
    if (deltaE2000(hex, hexBase) < D.FUSION_DELTA_E2000) return recordar(base)
    const existente = [...deColor.values()].find(
      (f) => deltaE2000(f.hex, hex) < D.FUSION_DELTA_E2000,
    )
    if (existente) return recordar(existente)
    const nuevo: Filamento = {
      id: `color-${deColor.size + 1}`,
      nombre: '',
      hex,
      slot: 0,
      deLaImagen: [hex],
    }
    deColor.set(nuevo.id, nuevo)
    return nuevo
  }

  const piezas: Pieza[] = regiones.map((r, i) => ({
    id: `region-${i + 1}`,
    tipo: 'region',
    nombre: `la zona ${i + 1}`,
    filamentoId: filamentoDe(r.hex).id,
    prioridad: r.prioridad,
    transform: { ...TRANSFORM_IDENTIDAD },
    geometria: {
      kind: 'poligonos',
      contornos: r.contornos.map((anillo) =>
        anillo.map(([x, y]) => [x - cx, y - cy] as [number, number]),
      ),
    },
    visible: true,
  }))

  const colores = [...deColor.values()].sort((a, b) => luminancia(b.hex) - luminancia(a.hex))
  // Slots de claro a oscuro y nombres legibles; si dos caen en el mismo nombre, se numeran
  const usados = new Map<string, number>([[base.nombre, 1]])
  colores.forEach((f, i) => {
    f.slot = i + 2
    const nombre = nombreDeColor(f.hex)
    const veces = (usados.get(nombre) ?? 0) + 1
    usados.set(nombre, veces)
    f.nombre = veces > 1 ? `${nombre} ${veces}` : nombre
  })

  return {
    version: 1,
    id: o.id,
    nombre: o.nombre,
    creadoEn: o.ahora,
    actualizadoEn: o.ahora,
    appVersion: o.appVersion,
    unidades: 'mm',
    impresion: {
      alturaCapa: D.ALTURA_CAPA,
      boquilla: 0.4,
      modoColor: o.modoColor ?? 'a_ras',
      slots: o.slots ?? 4,
      impresoraId: 'bambu-256',
    },
    cuerpo: { espesor: o.espesor ?? D.ESPESOR.estandar, alturaColor: D.ALTURA_COLOR },
    contorno: { activo: true, offset: D.OFFSET_CONTORNO, filamentoId: base.id },
    argolla: { tipo: 'comun', posicion: 'auto' },
    filamentos: [base, ...colores],
    piezas,
  }
}
