import type { PiezaExport } from '../export/tipos.ts'
import type { Manifold } from './manifold.ts'

/**
 * Copia la malla de un solido de Manifold a datos planos.
 * Llamar dentro de withScope(): el resultado ya no depende del WASM y puede salir.
 */
export function aPiezaExport(solido: Manifold, nombre: string, slot: number): PiezaExport {
  const estado = solido.status()
  if (estado !== 'NoError')
    throw new Error(`La pieza "${nombre}" no es un solido valido: ${estado}`)

  const malla = solido.getMesh()
  const { numProp, vertProperties, triVerts } = malla
  const cantidad = vertProperties.length / numProp
  const vertices = new Float32Array(cantidad * 3)
  // Las 3 primeras propiedades de cada vertice son la posicion; el resto (normales, UV) no se usa
  for (let i = 0; i < cantidad; i++) {
    vertices[i * 3] = vertProperties[i * numProp]!
    vertices[i * 3 + 1] = vertProperties[i * numProp + 1]!
    vertices[i * 3 + 2] = vertProperties[i * numProp + 2]!
  }
  return { nombre, slot, vertices, indices: new Uint32Array(triVerts) }
}
