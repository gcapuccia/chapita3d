import { beforeAll, describe, expect, test } from 'vitest'
import {
  cargarManifold,
  estadisticasManifold,
  withScope,
  type CrossSection,
  type ManifoldToplevel,
} from '../src/geometria/manifold.ts'

let m: ManifoldToplevel

// isDeleted() y clone() vienen del ClassHandle de embind: existen en runtime, pero los
// tipos de manifold-3d no los declaran.
type Handle = { isDeleted(): boolean; clone(): Handle }
const borrado = (o: object | undefined) => (o as Handle | undefined)?.isDeleted() ?? false

beforeAll(async () => {
  m = await cargarManifold()
})

describe('withScope', () => {
  test('borra todo lo creado adentro al salir', () => {
    const creados: CrossSection[] = []
    withScope(({ CrossSection }) => {
      const a = CrossSection.square([10, 10])
      const b = a.offset(1, 'Round')
      creados.push(a, b)
      expect(borrado(a)).toBe(false)
    })
    expect(creados.every(borrado)).toBe(true)
    expect(estadisticasManifold().vivos).toBe(0)
  })

  test('borra lo que devuelven estaticos, metodos de instancia, constructores, arrays y clone', () => {
    const visibles: object[] = []
    withScope(({ CrossSection, Manifold }) => {
      const cuadrado = CrossSection.square([4, 4]) // estatico
      const movido = cuadrado.translate([10, 0]) // de instancia
      const construido = new CrossSection([
        [0, 0],
        [1, 0],
        [0, 1],
      ]) // constructor
      const union = CrossSection.union([cuadrado, movido])
      const partes = union.decompose() // array
      const cubo = Manifold.cube([1, 1, 1])
      const copia = (cubo as unknown as Handle).clone() // clone del ClassHandle

      expect(construido.area()).toBeCloseTo(0.5)
      expect(partes).toHaveLength(2)
      visibles.push(cuadrado, movido, construido, union, ...partes, cubo, copia)
      expect(visibles.some(borrado)).toBe(false)
    })
    expect(visibles).toHaveLength(8)
    expect(visibles.every(borrado)).toBe(true)
    expect(estadisticasManifold().vivos).toBe(0)
  })

  test('crear un objeto fuera de un scope lanza, sin dejar el objeto vivo', () => {
    expect(() => m.CrossSection.square([1, 1])).toThrow(/fuera de withScope/)
    expect(estadisticasManifold().vivos).toBe(0)
  })

  test('lo que se devuelve escapa al scope padre y muere con el', () => {
    let deAdentro: CrossSection | undefined
    withScope(({ CrossSection }) => {
      deAdentro = withScope(() => CrossSection.circle(5).offset(1))
      expect(borrado(deAdentro)).toBe(false)
      expect(deAdentro.area()).toBeGreaterThan(0)
    })
    expect(borrado(deAdentro)).toBe(true)
    expect(estadisticasManifold().vivos).toBe(0)
  })

  test('los datos planos salen del scope mas externo sin problema', () => {
    const area = withScope(({ CrossSection }) => CrossSection.square([3, 3]).area())
    expect(area).toBeCloseTo(9)
  })

  test('devolver geometria desde el scope mas externo lanza y no fuga', () => {
    expect(() => withScope(({ CrossSection }) => CrossSection.square([1, 1]))).toThrow(
      /withScope\(\) más externo/,
    )
    expect(estadisticasManifold().vivos).toBe(0)
  })

  test('si la funcion lanza, igual libera todo', () => {
    let atrapado: CrossSection | undefined
    expect(() =>
      withScope(({ CrossSection }) => {
        atrapado = CrossSection.square([2, 2])
        throw new Error('falla a mitad de camino')
      }),
    ).toThrow('falla a mitad de camino')
    expect(borrado(atrapado)).toBe(true)
    expect(estadisticasManifold().vivos).toBe(0)
  })

  test('no admite funciones async', () => {
    expect(() =>
      withScope(async ({ CrossSection }) => {
        CrossSection.square([1, 1])
      }),
    ).toThrow(/async/)
    expect(estadisticasManifold().vivos).toBe(0)
  })

  test('un delete manual adentro del scope no rompe la limpieza', () => {
    withScope(({ CrossSection }) => {
      CrossSection.square([1, 1]).delete()
    })
    expect(estadisticasManifold().vivos).toBe(0)
  })
})
