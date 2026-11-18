import { readFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'
import { beforeAll, describe, expect, test } from 'vitest'
import { crearDiseno } from '../src/diseno/crear.ts'
import { conIman } from '../src/diseno/iman.ts'
import { crearDisenoDeNombre } from '../src/diseno/nombre.ts'
import type { Diseno } from '../src/diseno/tipos.ts'
import { empaquetar } from '../src/export/paquete.ts'
import { construir } from '../src/geometria/construir.ts'
import {
  espesorParaIman,
  lugarParaIman,
  profundidadDelHueco,
  ubicarIman,
} from '../src/geometria/iman.ts'
import { cuerpoDelLlavero } from '../src/geometria/llavero.ts'
import { cargarManifold, withScope } from '../src/geometria/manifold.ts'
import { contornosDeTexto, registrarFuente } from '../src/geometria/texto.ts'
import { FUENTES } from '../src/datos/fuentes.ts'
import * as D from '../src/pipeline/defaults.ts'
import { volumenPieza } from './utiles.ts'

beforeAll(async () => {
  await cargarManifold()
  for (const f of FUENTES) {
    const b = readFileSync(`node_modules/${f.archivo}`)
    registrarFuente(f.id, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
  }
})

const AHORA = '2026-11-18T12:00:00Z'
const circulo = (cx: number, cy: number, r: number): [number, number][] =>
  Array.from({ length: 96 }, (_, i) => [
    cx + r * Math.cos((i / 96) * 2 * Math.PI),
    cy + r * Math.sin((i / 96) * 2 * Math.PI),
  ])

/** Un cuadrado de un color, del lado pedido y centrado (sin borde: el lado es el de la pieza). */
function cuadrado(lado: number): Diseno {
  const d = crearDiseno(
    [
      {
        id: 'a',
        hex: '#F5C518',
        prioridad: 1,
        areaPx: lado * lado,
        contornos: [
          [
            [0, 0],
            [lado, 0],
            [lado, lado],
            [0, lado],
          ],
        ],
      },
    ],
    { nombre: 'cuadrado', id: 'cuadrado', ahora: AHORA, appVersion: 'test' },
  )
  return { ...d, contorno: { ...d.contorno, activo: false } }
}

const volumen = (d: Diseno) => construir(d).piezas.reduce((t, p) => t + volumenPieza(p), 0)

describe('iman de heladera', () => {
  test('el hueco mide el iman mas la holgura, y su volumen es el que falta', () => {
    const d = conIman(cuadrado(30), true)
    const r = construir(d)
    expect(r.bloqueante, r.avisos.map((a) => a.mensaje).join(' / ')).toBe(false)
    expect(r.agujero).toBeNull()
    expect(r.iman).not.toBeNull()
    expect(r.iman!.diametro).toBeCloseTo(10 + D.HOLGURA_IMAN_MM)
    expect(r.iman!.profundidad).toBeCloseTo(2.2)

    // Cilindro + el anillo del chaflan (tronco de cono menos el cilindro que ya se conto)
    const radio = r.iman!.diametro / 2
    const c = D.CHAFLAN_IMAN_MM
    const R = radio + c
    const esperado =
      Math.PI * radio ** 2 * r.iman!.profundidad +
      (Math.PI * c * (R * R + R * radio + radio * radio)) / 3 -
      Math.PI * radio ** 2 * c
    const sinIman = volumen(conIman(d, false))
    expect((sinIman - volumen(d)) / esperado).toBeCloseTo(1, 1)
  })

  test('en un cuadrado el iman va al centro', () => {
    // crearDiseno centra el dibujo en el origen
    const r = construir(conIman(cuadrado(30), true))
    expect(r.iman!.cx).toBeCloseTo(0, 1)
    expect(r.iman!.cy).toBeCloseTo(0, 1)
  })

  test('si el centro cae en un hueco, el iman va al lugar mas cercano donde entra con pared', () => {
    // Un anillo de 40 mm con agujero de 10: el centro de masa esta en el aire
    const [cx, cy] = withScope((m) => {
      const anillo = m.CrossSection.ofPolygons([circulo(0, 0, 20), circulo(0, 0, 5).reverse()])
      return ubicarIman(m, anillo, 10.4)!
    })
    const distancia = Math.hypot(cx, cy)
    expect(distancia).toBeGreaterThanOrEqual(5 + 5.2 + D.PARED_IMAN_MM - 0.01)
    expect(distancia).toBeLessThanOrEqual(20 - 5.2 - D.PARED_IMAN_MM + 0.01)
  })

  test('si el iman no entra, la base se ensancha atras lo justo', () => {
    const r = construir(conIman(cuadrado(11), true))
    expect(r.bloqueante).toBe(false)
    expect(r.iman).not.toBeNull()
    const lado = r.iman!.diametro + 2 * D.PARED_IMAN_MM
    expect(r.medidas[0]).toBeGreaterThanOrEqual(lado - 0.01)
    expect(r.medidas[0]).toBeLessThan(lado + 0.5)
  })

  test('en un nombre de letras finitas el iman entra con un disco atras', () => {
    // "Li" no tiene ningun lugar de 13 mm macizo: sin el disco, el iman no entraria
    const { ensanchado, partes } = withScope((m) => {
      const silueta = m.CrossSection.ofPolygons(
        contornosDeTexto('redonda', 'Li', D.TAMANO_NOMBRE_MM),
        'NonZero',
      )
      const { cuerpo } = cuerpoDelLlavero(
        m,
        silueta,
        { activo: true, offset: D.OFFSET_CONTORNO_NOMBRE, filamentoId: 'base', unir: true },
        { tipo: 'sin', posicion: 'auto' },
      )
      const lugar = lugarParaIman(m, cuerpo, 10 + D.HOLGURA_IMAN_MM)
      return { ensanchado: lugar.ensanchado, partes: lugar.cuerpo.decompose().length }
    })
    expect(ensanchado).toBe(true)
    expect(partes).toBe(1)

    const li = crearDisenoDeNombre('Li', { id: 'li', ahora: AHORA, appVersion: 'test' })
    const r = construir(conIman(li, true))
    expect(r.bloqueante, r.avisos.map((a) => a.mensaje).join(' / ')).toBe(false)
    expect(r.iman).not.toBeNull()
  })

  test('si el espesor no alcanza, lo sube y avisa', () => {
    const delgado = conIman(cuadrado(30), true)
    const r = construir({ ...delgado, cuerpo: { ...delgado.cuerpo, espesor: D.ESPESOR.delgado } })
    expect(r.medidas[2]).toBeCloseTo(D.ESPESOR.estandar)
    expect(r.avisos.find((a) => a.codigo === 'espesor-del-iman')?.nivel).toBe('aviso')
  })

  test('los imanes comunes entran en el espesor estandar o en el reforzado', () => {
    expect(espesorParaIman(2, 0.2, D.ALTURA_COLOR)).toBeCloseTo(D.ESPESOR.estandar)
    expect(espesorParaIman(3, 0.2, D.ALTURA_COLOR)).toBeCloseTo(D.ESPESOR.reforzado)
    const r = construir(conIman(cuadrado(30), true))
    expect(r.medidas[2]).toBeCloseTo(D.ESPESOR.estandar)
    expect(r.avisos.map((a) => a.codigo)).not.toContain('espesor-del-iman')
  })

  test('el hueco nunca llega a la capa de color', () => {
    for (const alto of [1, 2, 3, 5]) {
      const espesor = espesorParaIman(alto, 0.2, D.ALTURA_COLOR)
      expect(espesor - profundidadDelHueco(alto, 0.2)).toBeGreaterThanOrEqual(
        Math.max(D.TECHO_IMAN_MM, D.ALTURA_COLOR + 0.2) - 1e-9,
      )
    }
  })

  test('un nombre con iman sale imprimible, en un solo color o con AMS', () => {
    const nombre = conIman(
      crearDisenoDeNombre('Sofía', { id: 'n', ahora: AHORA, appVersion: 'test' }),
      true,
    )
    for (const modoColor of ['a_ras', 'apilado'] as const) {
      const r = construir({ ...nombre, impresion: { ...nombre.impresion, modoColor } })
      expect(r.bloqueante, r.avisos.map((a) => a.mensaje).join(' / ')).toBe(false)
      expect(r.iman).not.toBeNull()
      for (const p of r.piezas) expect(volumenPieza(p)).toBeGreaterThan(0)
    }
  })

  test('el ZIP se llama iman y las instrucciones dicen como pegarlo', () => {
    const d = conIman(cuadrado(30), true)
    const p = empaquetar(d, construir(d), '18/11/2026')
    expect(p.nombreZip).toBe('iman-cuadrado.zip')
    const txt = strFromU8(unzipSync(p.zip)['INSTRUCCIONES.txt']!)
    expect(txt).toContain('IMÁN "cuadrado"')
    expect(txt).toContain('imán de disco de 10 x 2 mm')
  })

  test('volver a la argolla saca el iman', () => {
    const d = conIman(conIman(cuadrado(30), true), false)
    expect(d.iman).toBeUndefined()
    expect(JSON.stringify(d)).not.toContain('"iman"')
    expect(construir(d).iman).toBeNull()
  })
})
