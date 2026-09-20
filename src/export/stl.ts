// STL binario. No guarda color: es geometria pelada (plan §2-bis E2).
// Formato: cabecera de 80 bytes, uint32 con la cantidad de triangulos y, por triangulo,
// normal (3 float32) + 3 vertices (9 float32) + uint16 de atributos. Little endian.

import type { PiezaExport } from './tipos.ts'

const CABECERA = 80
const BYTES_POR_TRIANGULO = 50

export function escribirStl(pieza: PiezaExport): Uint8Array {
  const { vertices: v, indices } = pieza
  const triangulos = indices.length / 3
  const buffer = new ArrayBuffer(CABECERA + 4 + triangulos * BYTES_POR_TRIANGULO)
  const datos = new DataView(buffer)

  const cabecera = new TextEncoder().encode(`Chapita3d ${pieza.nombre}`.slice(0, CABECERA))
  new Uint8Array(buffer, 0, CABECERA).set(cabecera)
  datos.setUint32(CABECERA, triangulos, true)

  let o = CABECERA + 4
  for (let t = 0; t < triangulos; t++) {
    const a = indices[t * 3]! * 3
    const b = indices[t * 3 + 1]! * 3
    const c = indices[t * 3 + 2]! * 3
    const ux = v[b]! - v[a]!
    const uy = v[b + 1]! - v[a + 1]!
    const uz = v[b + 2]! - v[a + 2]!
    const wx = v[c]! - v[a]!
    const wy = v[c + 1]! - v[a + 1]!
    const wz = v[c + 2]! - v[a + 2]!
    const nx = uy * wz - uz * wy
    const ny = uz * wx - ux * wz
    const nz = ux * wy - uy * wx
    const largo = Math.hypot(nx, ny, nz) || 1

    for (const valor of [nx / largo, ny / largo, nz / largo]) {
      datos.setFloat32(o, valor, true)
      o += 4
    }
    for (const indice of [a, b, c]) {
      datos.setFloat32(o, v[indice]!, true)
      datos.setFloat32(o + 4, v[indice + 1]!, true)
      datos.setFloat32(o + 8, v[indice + 2]!, true)
      o += 12
    }
    datos.setUint16(o, 0, true)
    o += 2
  }
  return new Uint8Array(buffer)
}
