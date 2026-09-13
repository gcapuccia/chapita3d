import { beforeAll, describe, expect, test } from 'vitest'
import { cargarManifold, withScope, type SimplePolygon } from '../src/geometria/manifold.ts'
import { construirDePrueba, regionesDePrueba } from '../src/geometria/pruebaDeCarga.ts'
import { resolverSolapes, type RegionColor } from '../src/geometria/regiones.ts'
import { EPSILON_SOLAPE_XY } from '../src/pipeline/defaults.ts'

const TOLERANCIA_MM2 = 0.001 // plan F0.6, item 4

const rect = (x0: number, y0: number, x1: number, y1: number): SimplePolygon => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
]

const circulo = (cx: number, cy: number, r: number, n = 64): SimplePolygon =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as [number, number]
  })

type Medicion = {
  sumaAreas: number
  areaUnion: number
  areaSilueta: number
  contornosUnion: number
}

/** Resuelve y mide adentro de un scope, devolviendo solo numeros. */
function medir(regiones: RegionColor[], epsilon = EPSILON_SOLAPE_XY): Medicion {
  return withScope((m) => {
    const resueltas = resolverSolapes(m, regiones, epsilon)
    const union = m.CrossSection.union(resueltas.map((r) => r.seccion))
    // La silueta se calcula por otro camino: la union de las regiones crecidas, sin restar nada
    const silueta = m.CrossSection.union(
      regiones.map((r) =>
        m.CrossSection.ofPolygons(r.contornos, 'EvenOdd').offset(epsilon, 'Miter'),
      ),
    )
    return {
      sumaAreas: resueltas.reduce((s, r) => s + r.seccion.area(), 0),
      areaUnion: union.area(),
      areaSilueta: silueta.area(),
      contornosUnion: union.numContour(),
    }
  })
}

function esperarSinSolapesNiPerdidas(r: Medicion) {
  // Sin solapes: si dos colores se pisaran, la suma de areas superaria el area de la union
  expect(Math.abs(r.sumaAreas - r.areaUnion)).toBeLessThan(TOLERANCIA_MM2)
  // Sin perdidas: la union de los colores cubre exactamente la silueta
  expect(Math.abs(r.areaUnion - r.areaSilueta)).toBeLessThan(TOLERANCIA_MM2)
}

beforeAll(async () => {
  await cargarManifold()
})

describe('resolverSolapes: la cadena de resta por prioridad', () => {
  test('dos colores que comparten un borde exacto', () => {
    const r = medir([
      { id: 'a', prioridad: 1, contornos: [rect(0, 0, 10, 10)] },
      { id: 'b', prioridad: 2, contornos: [rect(10, 0, 20, 10)] },
    ])
    esperarSinSolapesNiPerdidas(r)
    expect(r.contornosUnion).toBe(1)
  })

  test('cierra el micro-hueco que deja el RDP entre dos colores vecinos', () => {
    // 0,03 mm de hueco: invisible en pantalla, una linea del color de abajo impresa
    const regiones: RegionColor[] = [
      { id: 'a', prioridad: 1, contornos: [rect(0, 0, 10, 10)] },
      { id: 'b', prioridad: 2, contornos: [rect(10.03, 0, 20, 10)] },
    ]
    const conEpsilon = medir(regiones)
    esperarSinSolapesNiPerdidas(conEpsilon)
    expect(conEpsilon.contornosUnion).toBe(1)

    // Y la prueba de que es el epsilon el que lo cierra, no una casualidad:
    expect(medir(regiones, 0).contornosUnion).toBe(2)
  })

  test('borde compartido en zigzag (trazado y simplificado por separado): ni solapes ni huecos', () => {
    // a tiene su borde derecho en zigzag de ±0,02 mm alrededor de x=10; b lo tiene recto
    const zigzag: SimplePolygon = [[0, 0]]
    for (let i = 0; i <= 20; i++) zigzag.push([10 + (i % 2 ? 0.02 : -0.02), i * 0.5])
    zigzag.push([0, 10])
    const r = medir([
      { id: 'a', prioridad: 1, contornos: [zigzag] },
      { id: 'b', prioridad: 2, contornos: [rect(10, 0, 20, 10)] },
    ])
    esperarSinSolapesNiPerdidas(r)
    expect(r.contornosUnion).toBe(1)
  })

  test('un color adentro de otro (el ojo en la cara) le abre un agujero al de menor prioridad', () => {
    const regiones: RegionColor[] = [
      { id: 'cara', prioridad: 1, contornos: [circulo(0, 0, 10)] },
      { id: 'ojo', prioridad: 2, contornos: [circulo(3, 2, 2)] },
    ]
    const r = medir(regiones)
    esperarSinSolapesNiPerdidas(r)
    expect(r.contornosUnion).toBe(1)

    const contornosCara = withScope((m) => {
      const cara = resolverSolapes(m, regiones, EPSILON_SOLAPE_XY).find((x) => x.id === 'cara')
      return cara?.seccion.numContour()
    })
    expect(contornosCara).toBe(2) // el borde de afuera + el agujero del ojo
  })

  test('la prioridad decide quien gana, no el orden de entrada', () => {
    const areas = (prioridadA: number, prioridadB: number) =>
      withScope((m) =>
        Object.fromEntries(
          resolverSolapes(
            m,
            [
              { id: 'a', prioridad: prioridadA, contornos: [rect(0, 0, 10, 10)] },
              { id: 'b', prioridad: prioridadB, contornos: [rect(5, 0, 15, 10)] },
            ],
            0,
          ).map((x) => [x.id, x.seccion.area()]),
        ),
      )
    expect(areas(2, 1)).toEqual({ a: expect.closeTo(100, 3), b: expect.closeTo(50, 3) })
    expect(areas(1, 2)).toEqual({ a: expect.closeTo(50, 3), b: expect.closeTo(100, 3) })
  })

  test('carga representativa: 4 colores solapados, uno con agujero, 600 vertices por contorno', () => {
    esperarSinSolapesNiPerdidas(medir(regionesDePrueba(600)))
  })
})

describe('extrusion de las regiones resueltas', () => {
  test('todas las piezas son solidos validos: status NoError y volumen > 0', () => {
    const piezas = withScope((m) => construirDePrueba(m, regionesDePrueba(600)))
    expect(piezas.length).toBeGreaterThanOrEqual(5) // contorno + 4 colores
    for (const p of piezas) {
      expect(p.estado, p.id).toBe('NoError')
      expect(p.volumen, p.id).toBeGreaterThan(0)
      expect(p.triangulos, p.id).toBeGreaterThan(0)
    }
  })
})
