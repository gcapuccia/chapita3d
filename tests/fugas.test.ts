import { beforeAll, describe, expect, test } from 'vitest'
import {
  cargarManifold,
  estadisticasManifold,
  memoriaWasmBytes,
  withScope,
  type CrossSection,
  type Manifold,
} from '../src/geometria/manifold.ts'
import { cicloDeFugas } from '../src/geometria/pruebaDeCarga.ts'

const MB = 1024 * 1024
const LIMITE_CRECIMIENTO = 5 * MB // plan F0.6, criterio de aceptacion

// El heap del WASM arranca con ~16 MB y una fuga chica se esconde en ese espacio libre
// hasta llenarlo: con 200 vertices, la fuga de ofPolygons de manifold-3d 3.5.3 (una copia
// de cada contorno por llamada) entraba justo debajo del limite. Con 800 vertices esa
// misma fuga supera los 5 MB con holgura, asi que si vuelve, este test la ve.
const VERTICES_POR_CONTORNO = 800

beforeAll(async () => {
  await cargarManifold()
})

describe('fugas de memoria del WASM', () => {
  test('500 ciclos de crear → restar → extruir → getMesh → borrar: el heap crece menos de 5 MB', () => {
    const r = cicloDeFugas(500, VERTICES_POR_CONTORNO)
    console.log(
      `  ${r.ciclos} ciclos en ${r.ms.toFixed(0)} ms · ${r.objetosCreados} objetos · ` +
        `heap ${(r.bytesAntes / MB).toFixed(1)} → ${(r.bytesDespues / MB).toFixed(1)} MB`,
    )
    expect(r.bytesAntes).toBeGreaterThan(0) // la memoria se capturo de verdad
    expect(r.objetosCreados).toBeGreaterThan(500 * 10)
    expect(r.objetosVivos).toBe(0)
    expect(r.crecimientoBytes).toBeLessThanOrEqual(LIMITE_CRECIMIENTO)
  }, 120_000)

  test('la medicion detecta una fuga real (si no, la prueba de arriba no probaria nada)', () => {
    const antes = memoriaWasmBytes()
    let crecimiento = 0
    // Retener objetos en un scope que no se cierra durante el loop equivale a una fuga
    withScope(({ CrossSection }) => {
      const retenidos: Manifold[] = []
      for (let i = 0; i < 150; i++) {
        retenidos.push(
          withScope((): Manifold => {
            const circulo: CrossSection = CrossSection.circle(20, 1024)
            return circulo.extrude(5)
          }),
        )
      }
      crecimiento = memoriaWasmBytes() - antes
      expect(retenidos).toHaveLength(150)
    })
    console.log(`  fuga simulada: el heap crecio ${(crecimiento / MB).toFixed(1)} MB`)
    expect(crecimiento).toBeGreaterThan(LIMITE_CRECIMIENTO)
    expect(estadisticasManifold().vivos).toBe(0) // y al cerrar el scope se libero todo
  }, 120_000)
})
