import { strFromU8, unzipSync } from 'fflate'
import { beforeAll, describe, expect, test } from 'vitest'
import { APLICACION_BAMBU, escribir3mfBambu } from '../src/export/3mf/bambu.ts'
import { escribirStl } from '../src/export/stl.ts'
import type { PiezaExport } from '../src/export/tipos.ts'
import { cargarManifold, withScope } from '../src/geometria/manifold.ts'
import { aPiezaExport } from '../src/geometria/malla.ts'
import { volumenConSigno } from './utiles.ts'

type Referencia = { piezas: PiezaExport[]; volumenes: number[] }
let ref: Referencia

beforeAll(async () => {
  await cargarManifold()
  ref = withScope((m) => {
    const base = m.CrossSection.circle(10, 64).extrude(2.4)
    const encima = m.CrossSection.square([8, 3], true).extrude(0.6).translate([0, 0, 2.4])
    return {
      piezas: [aPiezaExport(base, 'base', 1), aPiezaExport(encima, 'barra', 2)],
      volumenes: [base.volume(), encima.volume()],
    }
  })
})

const opciones = { nombre: 'prueba', colores: ['#FFFFFF', '#1C1C1C', '#C12E1F', '#F4D10B'] }

describe('3MF para Bambu Studio / OrcaSlicer', () => {
  const abrir = () => unzipSync(escribir3mfBambu(ref.piezas, opciones))

  test('tiene los 5 archivos y [Content_Types].xml va primero y sin comprimir', () => {
    const zip = escribir3mfBambu(ref.piezas, opciones)
    expect(Object.keys(unzipSync(zip)).sort()).toEqual([
      '3D/3dmodel.model',
      'Metadata/model_settings.config',
      'Metadata/project_settings.config',
      '[Content_Types].xml',
      '_rels/.rels',
    ])
    const vista = new DataView(zip.buffer, zip.byteOffset)
    expect(vista.getUint32(0, true)).toBe(0x04034b50) // encabezado local de ZIP
    expect(vista.getUint16(8, true)).toBe(0) // metodo 0 = sin comprimir
    const largoNombre = vista.getUint16(26, true)
    expect(strFromU8(zip.subarray(30, 30 + largoNombre))).toBe('[Content_Types].xml')
  })

  test('cumple las reglas verificadas en el codigo de los slicers', () => {
    const modelo = strFromU8(abrir()['3D/3dmodel.model']!)
    expect(modelo).toContain(`<metadata name="Application">${APLICACION_BAMBU}</metadata>`) // regla 1
    expect(modelo).not.toMatch(/basematerials|displaycolor/) // regla 3
    expect(modelo).not.toContain('requiredextensions') // regla 4
    // regla 5: cada objeto se define antes de que un componente lo referencie
    const posicionObjeto = (id: string) => modelo.indexOf(`<object id="${id}"`)
    for (const [, id] of modelo.matchAll(/<component objectid="(\d+)"/g)) {
      expect(posicionObjeto(id!)).toBeGreaterThan(-1)
      expect(posicionObjeto(id!)).toBeLessThan(modelo.indexOf('<components>'))
    }
  })

  test('arrays de filamento paralelos con el largo de los slots, y extrusores en rango', () => {
    const archivos = abrir()
    const cfg = JSON.parse(strFromU8(archivos['Metadata/project_settings.config']!))
    for (const clave of [
      'filament_colour',
      'filament_type',
      'filament_settings_id',
      'filament_diameter',
    ]) {
      expect(cfg[clave], clave).toHaveLength(4)
    }
    const ajustes = strFromU8(archivos['Metadata/model_settings.config']!)
    const extrusores = [...ajustes.matchAll(/<part[\s\S]*?key="extruder" value="(\d+)"/g)].map(
      (x) => Number(x[1]),
    )
    expect(extrusores).toEqual([1, 2])
  })

  test('la malla escrita tiene el mismo volumen que el solido, con las caras hacia afuera', () => {
    const modelo = strFromU8(abrir()['3D/3dmodel.model']!)
    const objetos = [
      ...modelo.matchAll(/<object id="\d+" type="model" name="[^"]*">\s*<mesh>([\s\S]*?)<\/mesh>/g),
    ]
    expect(objetos).toHaveLength(2)
    objetos.forEach(([, malla], i) => {
      const vertices = [...malla!.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)].flatMap(
        (x) => x.slice(1, 4).map(Number),
      )
      const indices = [...malla!.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)].flatMap(
        (x) => x.slice(1, 4).map(Number),
      )
      expect(volumenConSigno(vertices, indices)).toBeCloseTo(ref.volumenes[i]!, 2)
    })
  })

  test('modo apilado: escribe los cambios de color con el formato de Bambu', () => {
    const archivos = unzipSync(
      escribir3mfBambu(
        ref.piezas.map((p) => ({ ...p, slot: 1 })),
        {
          nombre: 'apilado',
          colores: ['#FFFFFF'],
          cambiosDeCapa: [
            { z: 3.0, hex: '#1C1C1C' },
            { z: 2.4, hex: '#F4D10B' },
          ],
        },
      ),
    )
    const xml = strFromU8(archivos['Metadata/custom_gcode_per_layer.xml']!)
    expect(xml).toContain('<plate_info id="1"/>')
    expect(xml).toContain('<mode value="SingleExtruder"/>')
    // ordenados por altura aunque lleguen desordenados; type 0 = ColorChange
    expect(
      [
        ...xml.matchAll(
          /<layer top_z="([^"]+)" type="0" extruder="1" color="([^"]+)" extra="" gcode="M600"\/>/g,
        ),
      ].map((x) => [x[1], x[2]]),
    ).toEqual([
      ['2.4', '#F4D10B'],
      ['3', '#1C1C1C'],
    ])
  })

  test('rompe antes de escribir un archivo que el slicer abriria mal', () => {
    const [base] = ref.piezas
    expect(() => escribir3mfBambu([{ ...base!, slot: 5 }], opciones)).toThrow(/fuera de \[1, 4\]/)
    expect(() => escribir3mfBambu([base!], { ...opciones, colores: ['rojo'] })).toThrow(
      /color invalido/,
    )
    const hundida = { ...base!, vertices: base!.vertices.map((x, i) => (i % 3 === 2 ? x - 1 : x)) }
    expect(() => escribir3mfBambu([hundida], opciones)).toThrow(/atraviesa la cama/)
    expect(() => escribir3mfBambu([], opciones)).toThrow(/no hay piezas/)
  })
})

describe('STL binario', () => {
  test('tamaño correcto y mismo volumen que el solido, con las caras hacia afuera', () => {
    ref.piezas.forEach((pieza, i) => {
      const stl = escribirStl(pieza)
      const vista = new DataView(stl.buffer, stl.byteOffset)
      const triangulos = vista.getUint32(80, true)
      expect(triangulos).toBe(pieza.indices.length / 3)
      expect(stl.length).toBe(84 + triangulos * 50)

      // Reconstruir la malla desde el STL (sin indices compartidos) y medir su volumen
      const vertices: number[] = []
      for (let t = 0; t < triangulos; t++) {
        const o = 84 + t * 50 + 12 // saltear la normal
        for (let k = 0; k < 9; k++) vertices.push(vista.getFloat32(o + k * 4, true))
      }
      const indices = vertices
        .map((_, k) => k)
        .filter((k) => k % 3 === 0)
        .map((k) => k / 3)
      expect(volumenConSigno(vertices, indices)).toBeCloseTo(ref.volumenes[i]!, 1)

      // Y la normal guardada es unitaria
      const n = [0, 1, 2].map((k) => vista.getFloat32(84 + k * 4, true))
      expect(Math.hypot(...n)).toBeCloseTo(1, 4)
    })
  })
})
