import { createHash } from 'node:crypto'
import { strFromU8, unzipSync } from 'fflate'
import { beforeAll, describe, expect, test } from 'vitest'
import { crearDiseno } from '../src/diseno/crear.ts'
import type { Diseno } from '../src/diseno/tipos.ts'
import { empaquetar } from '../src/export/paquete.ts'
import { construir } from '../src/geometria/construir.ts'
import { cuerpoDelLlavero } from '../src/geometria/llavero.ts'
import {
  cargarManifold,
  estadisticasManifold,
  memoriaWasmBytes,
  withScope,
} from '../src/geometria/manifold.ts'
import { convertir, paramsPorDefecto } from '../src/pipeline/index.ts'
import type { RegionTrazada } from '../src/pipeline/tipos.ts'
import { ESCENAS, renderizar } from './banco/escenas.ts'
import { volumenPieza } from './utiles.ts'

const AHORA = '2026-09-13T12:00:00Z'

const disenoDeEscena = (id: string): Diseno => {
  const escena = ESCENAS.find((e) => e.id === id)!
  const conv = convertir(renderizar(escena).imagen, paramsPorDefecto('dibujo'))
  return crearDiseno(conv.regiones, { nombre: id, id, ahora: AHORA, appVersion: 'test' })
}

/** Un diseño chico hecho a mano: cuadrado amarillo con un circulo rojo adentro. */
function disenoSimple(): Diseno {
  const circulo = (cx: number, cy: number, r: number): [number, number][] =>
    Array.from({ length: 48 }, (_, i) => [
      cx + r * Math.cos((i / 48) * 2 * Math.PI),
      cy + r * Math.sin((i / 48) * 2 * Math.PI),
    ])
  const regiones: RegionTrazada[] = [
    {
      id: 'a',
      hex: '#F5C518',
      prioridad: 1,
      areaPx: 900,
      contornos: [
        [
          [0, 0],
          [30, 0],
          [30, 30],
          [0, 30],
        ],
      ],
    },
    { id: 'b', hex: '#D62828', prioridad: 2, areaPx: 100, contornos: [circulo(15, 15, 6)] },
  ]
  return crearDiseno(regiones, { nombre: 'simple', id: 'simple', ahora: AHORA, appVersion: 'test' })
}

let carita: Diseno

beforeAll(async () => {
  await cargarManifold()
  carita = disenoDeEscena('dibujo-01-carita-sombreada')
}, 60_000)

describe('crearDiseno', () => {
  test('la base va en el slot 1 y los colores siguen de claro a oscuro, con nombre legible', () => {
    expect(carita.filamentos.map((f) => [f.slot, f.nombre])).toEqual([
      [1, 'Blanco'],
      [2, 'Amarillo'],
      [3, 'Rojo'],
      [4, 'Negro'],
    ])
  })
})

describe('construir · modo a ras', () => {
  test('sin errores, cara de arriba plana al espesor y colores que no se pisan en 3D', () => {
    const r = construir(carita)
    expect(r.avisos.filter((a) => a.nivel === 'error')).toEqual([])
    expect(r.medidas[2]).toBeCloseTo(3.0, 5)
    expect(r.piezas.map((p) => p.slot)).toEqual([1, 2, 3, 4])
    // Disjuntas: la suma de los volumenes por color es el volumen de la pieza fusionada
    const suma = r.piezas.reduce((t, p) => t + volumenPieza(p), 0)
    expect(Math.abs(suma - volumenPieza(r.entera)) / volumenPieza(r.entera)).toBeLessThan(0.001)
    expect(estadisticasManifold().vivos).toBe(0)
  })

  test('el ZIP trae 3MF, un STL por color, la pieza entera, instrucciones y el proyecto', () => {
    const p = empaquetar(carita, construir(carita), '13/09/2026')
    expect(p.nombreZip).toBe('llavero-dibujo-01-carita-sombreada.zip')
    expect(p.archivos).toEqual([
      'INSTRUCCIONES.txt',
      'llavero-dibujo-01-carita-sombreada_bambu-orca.3mf',
      'proyecto.json',
      'stl/1_blanco.stl',
      'stl/2_amarillo.stl',
      'stl/3_rojo.stl',
      'stl/4_negro.stl',
      'stl/pieza-entera.stl',
    ])
    const archivos = unzipSync(p.zip)
    const instrucciones = strFromU8(archivos['INSTRUCCIONES.txt']!)
    expect(instrucciones).toContain('Slot 2 .... Amarillo')
    expect(JSON.parse(strFromU8(archivos['proyecto.json']!))).toEqual(carita)
  })
})

describe('construir · modo apilado', () => {
  test('todo sale del slot 1, con un cambio por franja y sin colores flotando', () => {
    const d: Diseno = { ...carita, impresion: { ...carita.impresion, modoColor: 'apilado' } }
    const r = construir(d)
    expect(r.avisos.filter((a) => a.nivel === 'error')).toEqual([])
    expect(new Set(r.piezas.map((p) => p.slot))).toEqual(new Set([1]))
    expect(r.cambiosDeCapa.map((c) => Number(c.z.toFixed(2)))).toEqual([2.4, 3.0, 3.6])
    expect(r.estimacion.gramosPurga).toBe(0) // con M600 no hay torre de purga, solo cebado
    expect(r.estimacion.gramosCebado).toBeGreaterThan(0)

    const zip = unzipSync(empaquetar(d, r, '13/09/2026').zip)
    const tresMf = unzipSync(zip['llavero-dibujo-01-carita-sombreada_bambu-orca.3mf']!)
    expect(strFromU8(tresMf['Metadata/custom_gcode_per_layer.xml']!)).toContain('gcode="M600"')
  })
})

describe('validaciones', () => {
  test('argolla arrastrada lejos del dibujo: error y la descarga se bloquea', () => {
    const d = disenoSimple()
    const r0 = construir(d)
    // El cuerpo llega a x = 16,5 (15 del dibujo + 1,5 de borde) y la pestaña mide 5,1 de radio:
    // con el agujero en x = 27, entre la pestaña y el cuerpo quedan ~5 mm de aire
    d.argolla = { tipo: 'comun', posicion: [27, 0] }
    const r = construir(d)
    expect(r0.bloqueante).toBe(false)
    expect(r.avisos.map((a) => a.codigo)).toContain('argolla-suelta')
    expect(r.bloqueante).toBe(true)
    expect(() => empaquetar(d, r, 'hoy')).toThrow(/No se puede descargar/)
  })

  test('un espesor fuera de la grilla de capas se redondea y avisa', () => {
    const d = disenoSimple()
    d.cuerpo.espesor = 3.07
    const r = construir(d)
    expect(r.avisos.map((a) => a.codigo)).toContain('altura-redondeada')
    expect(r.medidas[2]).toBeCloseTo(3.0, 5)
  })

  test('argolla cerca del borde pero bien unida: sin error', () => {
    const d = disenoSimple()
    d.argolla = { tipo: 'comun', posicion: [18, 0] } // la pestaña se mete 3,6 mm en el cuerpo
    expect(construir(d).bloqueante).toBe(false)
  })

  test('sin argolla no hay agujero', () => {
    const d = disenoSimple()
    d.argolla = { tipo: 'sin', posicion: 'auto' }
    expect(construir(d).agujero).toBeNull()
  })

  test('una parte separada del resto se avisa como pieza suelta', () => {
    const d = disenoSimple()
    d.contorno.activo = false
    d.piezas.push({
      ...d.piezas[1]!,
      id: 'lejos',
      transform: { x: 60, y: 0, rotZ: 0, sx: 1, sy: 1 },
    })
    expect(construir(d).avisos.map((a) => a.codigo)).toContain('pieza-suelta')
  })
})

describe('llavero', () => {
  test('el fillet de la pestaña no rellena los entrantes del dibujo', () => {
    const libre = withScope((m) => {
      // Dos "orejas" abajo separadas por 3 mm (menos que 2r = 4 mm) y la pestaña arriba
      const silueta = m.CrossSection.union([
        m.CrossSection.square([20, 30]).translate([-21.5, -30]),
        m.CrossSection.square([20, 30]).translate([1.5, -30]),
        m.CrossSection.square([43, 20]),
      ])
      const { cuerpo } = cuerpoDelLlavero(
        m,
        silueta,
        { activo: false, offset: 0, filamentoId: 'base' },
        { tipo: 'comun', posicion: 'auto' },
      )
      const hueco = m.CrossSection.square([2, 20]).translate([-1, -28])
      return hueco.intersect(cuerpo).area()
    })
    expect(libre).toBeLessThan(0.001)
  })

  test('500 construcciones no hacen crecer el heap mas de un 10 %', () => {
    const d = disenoSimple()
    for (let i = 0; i < 20; i++) construir(d)
    const antes = memoriaWasmBytes()
    for (let i = 0; i < 500; i++) construir(d)
    expect(memoriaWasmBytes()).toBeLessThanOrEqual(antes * 1.1)
    expect(estadisticasManifold().vivos).toBe(0)
  }, 120_000)
})

describe('golden: lo que se exporta no cambia sin querer', () => {
  // Diseño hecho a mano (no sale del pipeline) para que el hash dependa solo de Manifold, que es
  // WASM y da lo mismo en Windows y en Linux. Si un cambio es intencional: pnpm vitest -u y se commitea.
  const huella = (datos: Uint8Array) =>
    createHash('sha256').update(datos).digest('hex').slice(0, 16)

  test.each(['a_ras', 'apilado'] as const)('perfil Bambu/Orca y STL · modo %s', (modo) => {
    const d = disenoSimple()
    d.impresion.modoColor = modo
    const zip = unzipSync(empaquetar(d, construir(d), '13/09/2026').zip)
    const tresMf = unzipSync(zip['llavero-simple_bambu-orca.3mf']!)
    const huellas = {
      ...Object.fromEntries(
        Object.entries(tresMf).map(([nombre, datos]) => [`3mf:${nombre}`, huella(datos)]),
      ),
      ...Object.fromEntries(
        Object.entries(zip)
          .filter(([nombre]) => nombre.endsWith('.stl') || nombre === 'INSTRUCCIONES.txt')
          .map(([nombre, datos]) => [nombre, huella(datos)]),
      ),
    }
    expect(huellas).toMatchSnapshot()
  })
})
