// Gramos de pieza, de purga (AMS) y de cebado (M600). Plan §9.5.
//
// ⚠️ El numero de cambios es una heuristica: por cada capa con k filamentos se cuentan k cambios.
// Coincide con el ejemplo del plan (§9.8: 3 capas de color × 3 filamentos = 9 cambios), pero el
// slicer ordena los colores para purgar menos. Se calibra contra Bambu Studio con P2 (F0.5).

import * as D from '../pipeline/defaults.ts'

export type Estimacion = {
  gramosPieza: number
  cambios: number
  /** Modo a ras: torre de purga. Modo apilado: 0, no hay torre. */
  gramosPurga: number
  /** Modo apilado: cebado de cada cambio manual. Modo a ras: 0. */
  gramosCebado: number
}

const gramos = (mm3: number) => (mm3 / 1000) * D.DENSIDAD_PLA

export function estimarAras(
  volumenMm3: number,
  capasDeColor: number,
  filamentosEnCapasDeColor: number,
): Estimacion {
  const cambios = filamentosEnCapasDeColor > 1 ? capasDeColor * filamentosEnCapasDeColor : 0
  return {
    gramosPieza: gramos(volumenMm3),
    cambios,
    gramosPurga: gramos(cambios * D.PURGA_MM3_POR_CAMBIO),
    gramosCebado: 0,
  }
}

export function estimarApilado(volumenMm3: number, cambios: number): Estimacion {
  return {
    gramosPieza: gramos(volumenMm3),
    cambios,
    gramosPurga: 0,
    gramosCebado: cambios * D.CEBADO_G_POR_CAMBIO,
  }
}
