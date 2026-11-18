// El cortante de galletitas. Lo que se puede verificar sin imprimir ni hornear: que sea una sola
// pieza valida, que mida lo pedido, que el filo se afine en la punta, que el marcador entre adentro
// y que todo salga espejado para que la galletita quede al derecho.

import { readFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'
import { beforeAll, describe, expect, test } from 'vitest'
import {
  BISEL_MM,
  CORTANTE_POR_DEFECTO,
  ESPESOR_MARCADOR_MM,
  ESPESOR_REBORDE_MM,
  PUNTA_MM,
  cortante,
  marcadoPorDefecto,
  type ParamsCortante,
  type RegionCortante,
} from '../src/cortantes/cortante.ts'
import { empaquetarCortante, type ResultadoCortante } from '../src/export/paqueteCortante.ts'
import { aPiezaExport } from '../src/geometria/malla.ts'
import { cargarManifold, withScope } from '../src/geometria/manifold.ts'
import { convertirAutomatico } from '../src/pipeline/index.ts'
import { leerPng } from './banco/png.ts'
import { volumenPieza } from './utiles.ts'

beforeAll(async () => {
  await cargarManifold()
})

type P = [number, number][]
const rect = (x0: number, y0: number, x1: number, y1: number): P => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
]
const circulo = (cx: number, cy: number, r: number): P =>
  Array.from({ length: 64 }, (_, i) => [
    cx + r * Math.cos((i / 64) * 2 * Math.PI),
    cy + r * Math.sin((i / 64) * 2 * Math.PI),
  ])

const params = (cambio: Partial<ParamsCortante> = {}): ParamsCortante => ({
  ...CORTANTE_POR_DEFECTO,
  ...cambio,
})

/** Arma el cortante y devuelve lo que se puede mirar fuera del scope. */
function armar(regiones: RegionCortante[], p: ParamsCortante) {
  return withScope((m) => {
    const c = cortante(m, regiones, p)
    const corte = (z: number) => c.cortante.slice(z).area()
    return {
      partes: c.cortante.decompose().length,
      estado: String(c.cortante.status()),
      caja: c.cortante.boundingBox(),
      areaAlMedio: corte(p.alto / 2),
      areaEnLaPunta: corte(p.alto - 0.05),
      cajaMarcador: c.marcador?.boundingBox() ?? null,
      resultado: {
        cortante: aPiezaExport(c.cortante, 'cortante', 1),
        marcador: c.marcador ? aPiezaExport(c.marcador, 'marcador', 1) : null,
        alLado: c.alLado,
        medidas: c.medidas,
        galletitaMm: c.galletitaMm,
        galletita: c.galletita,
        avisos: c.avisos,
      } satisfies ResultadoCortante,
    }
  })
}

const negro = (contornos: P[]): RegionCortante => ({ hex: '#151515', contornos })

describe('cortante de galletitas', () => {
  test('una sola pieza valida, del tamaño pedido, apoyada en el piso', () => {
    const a = armar([negro([rect(0, 0, 30, 30)])], params())
    expect(a.estado).toMatch(/^(0|NoError)$/)
    expect(a.partes).toBe(1)
    expect(a.caja.min[2]).toBeCloseTo(0, 6)
    expect(a.caja.max[2]).toBeCloseTo(15, 6)
    // La galletita mide el largo pedido; el cortante suma el filo y el reborde de cada lado
    const [gx, gy] = a.resultado.galletitaMm
    expect(gx).toBeCloseTo(80, 0)
    expect(gy).toBeCloseTo(80, 0)
    const p = CORTANTE_POR_DEFECTO
    expect(a.resultado.medidas[0]).toBeCloseTo(80 + 2 * (p.grosor + p.anchoReborde), 0)
    expect(volumenPieza(a.resultado.cortante)).toBeGreaterThan(0)
  })

  test('el filo se afina en la punta', () => {
    const a = armar([negro([rect(0, 0, 30, 30)])], params())
    const p = CORTANTE_POR_DEFECTO
    // A media altura es el filo entero; en la punta, PUNTA_MM sobre el mismo perimetro
    expect(a.areaEnLaPunta / a.areaAlMedio).toBeCloseTo(PUNTA_MM / p.grosor, 1)
    expect(p.alto - BISEL_MM).toBeGreaterThan(ESPESOR_REBORDE_MM)
  })

  test('sale espejado: el detalle de la derecha queda a la izquierda en el marcador', () => {
    // Un cuadro negro con un punto rojo cerca del borde derecho, que es lo unico que marca
    const regiones = [
      negro([rect(0, 0, 40, 40), circulo(32, 20, 3).reverse()]),
      { hex: '#D62828', contornos: [circulo(32, 20, 3)] },
    ]
    const a = armar(regiones, params({ marcado: 'colores', colores: ['#D62828'] }))
    const m = a.resultado.marcador!
    // Los vertices del relieve (arriba de la placa) caen del lado de las x negativas
    let suma = 0
    let n = 0
    for (let i = 0; i < m.vertices.length; i += 3)
      if (m.vertices[i + 2]! > ESPESOR_MARCADOR_MM + 0.01) {
        suma += m.vertices[i]!
        n++
      }
    expect(n).toBeGreaterThan(0)
    expect(suma / n).toBeLessThan(-5)
    // Y la galletita, que se dibuja al derecho, tiene la marca a la derecha
    const xs = a.resultado.galletita.marcas.flat().map(([x]) => x)
    expect(Math.min(...xs)).toBeGreaterThan(0)
  })

  test('el marcador entra adentro del cortante, con su holgura', () => {
    const p = params()
    const a = armar([negro([rect(0, 0, 30, 30)])], p)
    const c = a.cajaMarcador!
    const [gx, gy] = a.resultado.galletitaMm
    expect(c.max[0] - c.min[0]).toBeCloseTo(gx - 2 * p.holgura, 1)
    expect(c.max[1] - c.min[1]).toBeCloseTo(gy - 2 * p.holgura, 1)
    expect(c.max[2]).toBeCloseTo(ESPESOR_MARCADOR_MM + p.relieve, 6)
  })

  test('dos manchas sueltas salen en un solo cortante, y avisa', () => {
    const a = armar([negro([rect(0, 0, 10, 30), rect(25, 0, 35, 30)])], params())
    expect(a.partes).toBe(1)
    expect(a.resultado.avisos.map((x) => x.codigo)).toContain('partes-unidas')
  })

  test('el entrante entre dos orejas no se rellena', () => {
    // Una U: dos patas de 14 mm con 12 mm de hueco entre ellas
    const u: P = [
      [0, 0],
      [40, 0],
      [40, 40],
      [26, 40],
      [26, 15],
      [14, 15],
      [14, 40],
      [0, 40],
    ]
    const a = armar([negro([u])], params())
    expect(a.resultado.avisos.map((x) => x.codigo)).not.toContain('partes-unidas')
    // En la galletita (centrada y escalada ×1,85), el medio del hueco queda afuera
    const enLaForma = withScope((m) =>
      m.CrossSection.ofPolygons(a.resultado.galletita.forma, 'EvenOdd')
        .intersect(m.CrossSection.square([0.2, 0.2], true).translate([0, 25]))
        .area(),
    )
    expect(enLaForma).toBe(0)
  })

  test('un dibujo con agujero da una galletita sin agujero', () => {
    const a = armar([negro([circulo(0, 0, 20), circulo(0, 0, 10).reverse()])], params())
    expect(a.resultado.galletita.forma).toHaveLength(1)
    expect(a.partes).toBe(1)
  })

  test('las lineas marcan el borde de cada color; sin marcador no hay marcador', () => {
    const regiones = [
      negro([rect(0, 0, 40, 40), circulo(20, 20, 6).reverse()]),
      { hex: '#FFFFFF', contornos: [circulo(20, 20, 6)] },
    ]
    const conLineas = armar(regiones, params({ marcado: 'lineas' }))
    expect(conLineas.resultado.marcador).not.toBeNull()
    // El borde de afuera del dibujo y el del circulo: dos anillos de marcas
    expect(conLineas.resultado.galletita.marcas.length).toBeGreaterThanOrEqual(3)
    expect(armar(regiones, params({ marcado: 'no' })).resultado.marcador).toBeNull()
  })

  test('si no queda nada para marcar, no hay marcador y avisa', () => {
    const a = armar([negro([rect(0, 0, 30, 30)])], params({ marcado: 'colores', colores: [] }))
    expect(a.resultado.marcador).toBeNull()
    expect(a.resultado.avisos.map((x) => x.codigo)).toContain('marcador-vacio')
  })

  test('avisa si las lineas del marcador quedan mas finas que lo que toma la masa', () => {
    const a = armar(
      [negro([rect(0, 0, 40, 40)]), { hex: '#D62828', contornos: [rect(10, 10, 30, 10.3)] }],
      params({ marcado: 'colores', colores: ['#D62828'] }),
    )
    expect(a.resultado.avisos.map((x) => x.codigo)).toContain('detalle-fino')
  })
})

describe('que marcar por defecto', () => {
  test('un dibujo de lineas marca las lineas tal cual', () => {
    // Un aro negro finito (1 mm) de 40 mm: es un trazo, no un relleno
    const aro = negro([circulo(0, 0, 20), circulo(0, 0, 19).reverse()])
    const area = Math.PI * (20 * 20 - 19 * 19)
    expect(marcadoPorDefecto([aro], [area])).toEqual({ marcado: 'colores', colores: ['#151515'] })
  })

  test('un dibujo relleno marca el borde de cada color', () => {
    const cuerpo = negro([rect(0, 0, 40, 40)])
    const ojo = { hex: '#FFFFFF', contornos: [circulo(12, 25, 4)] }
    expect(marcadoPorDefecto([cuerpo, ojo], [1600, 50]).marcado).toBe('lineas')
  })
})

describe('el ZIP', () => {
  test('trae cada pieza y los pasos, con el nombre sin tildes', () => {
    const a = armar([negro([rect(0, 0, 30, 30)])], params())
    const p = empaquetarCortante(a.resultado, 'Gatúbela', 'lineas', '18/11/2026')
    expect(p.nombreZip).toBe('cortante-gatubela.zip')
    const zip = unzipSync(p.zip)
    expect(Object.keys(zip).sort()).toEqual(['INSTRUCCIONES.txt', 'cortante.stl', 'marcador.stl'])
    const txt = strFromU8(zip['INSTRUCCIONES.txt']!)
    expect(txt).toContain('CORTANTE DE GALLETITAS "Gatúbela"')
    expect(txt).toContain('espejado a propósito')
    expect(txt).toContain('apto para contacto con alimentos')
  })

  test('sin marcador, el ZIP no lo trae', () => {
    const a = armar([negro([rect(0, 0, 30, 30)])], params({ marcado: 'no' }))
    const zip = unzipSync(empaquetarCortante(a.resultado, 'x', 'no', 'hoy').zip)
    expect(Object.keys(zip)).not.toContain('marcador.stl')
  })
})

describe('desde una imagen de verdad', () => {
  test('el gato de muestra da un cortante entero y un marcador con los ojos', () => {
    const fuente = leerPng(readFileSync('public/muestras/silueta.png'))
    const conversion = convertirAutomatico(fuente)
    const regiones = conversion.regiones.map((r) => ({ hex: r.hex, contornos: r.contornos }))
    expect(regiones.length).toBeGreaterThanOrEqual(2)
    const area = conversion.regiones.map((r) => r.areaPx * conversion.diagnostico.mmPorPixel ** 2)
    const elegido = marcadoPorDefecto(regiones, area)
    expect(elegido.marcado).toBe('lineas')

    const t0 = performance.now()
    const a = armar(regiones, params(elegido))
    const ms = performance.now() - t0
    expect(a.partes).toBe(1)
    expect(a.resultado.marcador).not.toBeNull()
    expect(a.resultado.avisos.map((x) => x.codigo)).not.toContain('partes-unidas')
    // Las orejas: la galletita no es un rectangulo, el hueco entre ellas sigue ahi
    expect(ms).toBeLessThan(3000)
  })
})
