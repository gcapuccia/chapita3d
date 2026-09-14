// Agregar un texto al diseño: debajo del dibujo, con el filamento mas oscuro (plan §4.5 "+ Agregar texto").

import { FUENTE_POR_DEFECTO, type IdFuente } from '../datos/fuentes.ts'
import * as D from '../pipeline/defaults.ts'
import type { Diseno, Filamento } from './tipos.ts'
import { aplicarTransform } from './transform.ts'

const luminancia = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
}

export type OpcionesTexto = { fuente?: IdFuente; tamano?: number; negrita?: number }

/** Devuelve un diseño nuevo con el texto agregado. No modifica el original. */
export function agregarTexto(d: Diseno, texto: string, o: OpcionesTexto = {}): Diseno {
  const tamano = o.tamano ?? D.TAMANO_TEXTO_MM
  const base = d.filamentos.find((f) => f.id === d.contorno.filamentoId)
  if (!base) throw new Error('El diseño no tiene filamento de base.')

  // Filamento: el mas oscuro que contraste con la base; si no hay ninguno, se agrega negro
  let filamentos = d.filamentos
  let tinta: Filamento | undefined = d.filamentos
    .filter((f) => f.id !== base.id)
    .sort((a, b) => luminancia(a.hex) - luminancia(b.hex))
    .find((f) => Math.abs(luminancia(f.hex) - luminancia(base.hex)) > 100)
  if (!tinta) {
    tinta = {
      id: `color-${d.filamentos.length + 1}`,
      nombre: 'Negro',
      hex: '#1A1A1A',
      slot: Math.max(...d.filamentos.map((f) => f.slot)) + 1,
    }
    filamentos = [...d.filamentos, tinta]
  }

  // Debajo del dibujo y centrado. La altura real de las letras ronda el 70 % del tamaño de fuente,
  // y queda a 1 mm: el contorno de 1,5 mm une el texto con el dibujo.
  const puntos = d.piezas.flatMap((p) =>
    p.geometria.kind === 'poligonos'
      ? aplicarTransform(p.transform, p.geometria.contornos).flat()
      : [],
  )
  const abajo = puntos.length ? Math.min(...puntos.map((p) => p[1])) : 0
  const prioridad = Math.max(0, ...d.piezas.map((p) => p.prioridad)) + 1

  return {
    ...d,
    filamentos,
    piezas: [
      ...d.piezas,
      {
        id: `texto-${d.piezas.filter((p) => p.tipo === 'texto').length + 1}`,
        tipo: 'texto',
        nombre: `el texto "${texto}"`,
        filamentoId: tinta.id,
        prioridad,
        transform: { x: 0, y: abajo - 1 - tamano * 0.35, rotZ: 0, sx: 1, sy: 1 },
        geometria: {
          kind: 'texto',
          texto,
          fuente: o.fuente ?? FUENTE_POR_DEFECTO,
          tamano,
          negrita: o.negrita ?? 0,
        },
        visible: true,
      },
    ],
  }
}
