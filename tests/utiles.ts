import type { PiezaExport } from '../src/export/tipos.ts'

/** Volumen con signo por el teorema de la divergencia: > 0 solo si las caras miran hacia afuera. */
export function volumenConSigno(v: ArrayLike<number>, indices: ArrayLike<number>): number {
  let total = 0
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]! * 3
    const b = indices[t + 1]! * 3
    const c = indices[t + 2]! * 3
    total +=
      v[a]! * (v[b + 1]! * v[c + 2]! - v[b + 2]! * v[c + 1]!) -
      v[a + 1]! * (v[b]! * v[c + 2]! - v[b + 2]! * v[c]!) +
      v[a + 2]! * (v[b]! * v[c + 1]! - v[b + 1]! * v[c]!)
  }
  return total / 6
}

export const volumenPieza = (p: PiezaExport) => volumenConSigno(p.vertices, p.indices)
