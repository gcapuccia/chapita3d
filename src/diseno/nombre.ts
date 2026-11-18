// Llavero de nombre: un texto solo, sin imagen. Es un Diseno como cualquier otro (una pieza de
// texto y la base), asi que construir(), la descarga y la cuenta lo tratan igual que a un dibujo.

import { FUENTE_POR_DEFECTO, type IdFuente } from '../datos/fuentes.ts'
import * as D from '../pipeline/defaults.ts'
import { nombreDeColor } from './crear.ts'
import { TRANSFORM_IDENTIDAD, type Diseno } from './tipos.ts'

export type OpcionesNombre = {
  id: string
  /** Fecha ISO, la pone quien llama. */
  ahora: string
  appVersion: string
  fuente?: IdFuente
  tamano?: number
  hexBase?: string
  hexLetras?: string
}

export const ID_LETRAS = 'letras'

export function crearDisenoDeNombre(texto: string, o: OpcionesNombre): Diseno {
  const hexBase = o.hexBase ?? '#FFFFFF'
  const hexLetras = o.hexLetras ?? '#1E4FD8'
  return {
    version: 1,
    id: o.id,
    nombre: texto,
    creadoEn: o.ahora,
    actualizadoEn: o.ahora,
    appVersion: o.appVersion,
    unidades: 'mm',
    producto: 'nombre',
    impresion: {
      alturaCapa: D.ALTURA_CAPA,
      boquilla: 0.4,
      modoColor: 'a_ras',
      slots: 4,
      impresoraId: 'bambu-256',
    },
    cuerpo: { espesor: D.ESPESOR.estandar, alturaColor: D.ALTURA_COLOR },
    contorno: { activo: true, offset: D.OFFSET_CONTORNO_NOMBRE, filamentoId: 'base', unir: true },
    argolla: { tipo: 'comun', posicion: 'izquierda' },
    filamentos: [
      { id: 'base', nombre: nombreDeColor(hexBase), hex: hexBase, slot: 1 },
      { id: ID_LETRAS, nombre: nombreDeColor(hexLetras), hex: hexLetras, slot: 2 },
    ],
    piezas: [
      {
        id: 'texto-1',
        tipo: 'texto',
        nombre: `el texto "${texto}"`,
        filamentoId: ID_LETRAS,
        prioridad: 1,
        transform: { ...TRANSFORM_IDENTIDAD },
        geometria: {
          kind: 'texto',
          texto,
          fuente: o.fuente ?? FUENTE_POR_DEFECTO,
          tamano: o.tamano ?? D.TAMANO_NOMBRE_MM,
          negrita: 0,
        },
        visible: true,
      },
    ],
  }
}

export type CambioDeNombre = { texto?: string; fuente?: IdFuente; tamano?: number }

/** Devuelve el diseño con el texto, la letra o el tamaño cambiados. No modifica el original. */
export function cambiarTextoDeNombre(d: Diseno, c: CambioDeNombre): Diseno {
  return {
    ...d,
    nombre: c.texto ?? d.nombre,
    piezas: d.piezas.map((p) =>
      p.geometria.kind !== 'texto'
        ? p
        : {
            ...p,
            nombre: c.texto ? `el texto "${c.texto}"` : p.nombre,
            geometria: {
              ...p.geometria,
              texto: c.texto ?? p.geometria.texto,
              fuente: c.fuente ?? p.geometria.fuente,
              tamano: c.tamano ?? p.geometria.tamano,
            },
          },
    ),
  }
}

/** Lo que muestra la pantalla de nombres, leido del diseño. */
export function leerNombre(d: Diseno): { texto: string; fuente: IdFuente; tamano: number } {
  const g = d.piezas.find((p) => p.geometria.kind === 'texto')?.geometria
  return g?.kind === 'texto'
    ? { texto: g.texto, fuente: g.fuente as IdFuente, tamano: g.tamano }
    : { texto: d.nombre, fuente: FUENTE_POR_DEFECTO, tamano: D.TAMANO_NOMBRE_MM }
}
