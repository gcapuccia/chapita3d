/**
 * Una pieza lista para exportar: una malla cerrada de un solo filamento, en mm.
 * Es datos planos (sin objetos de WASM), asi que puede salir de withScope() y viajar
 * entre workers por transferencia. Fuente: audit-02 §4, paso 0.
 */
export type PiezaExport = {
  nombre: string
  /** Slot del AMS / extrusor, base 1. */
  slot: number
  /** xyz en mm, z >= 0. */
  vertices: Float32Array
  /** Triangulos, orientacion CCW vista desde afuera. */
  indices: Uint32Array
}

/** Un cambio de filamento en una altura, para el modo apilado (un solo extrusor). */
export type CambioDeCapa = {
  /** mm. Altura que se escribe en el XML del slicer. */
  z: number
  /** Color al que se cambia, "#RRGGBB". */
  hex: string
}
