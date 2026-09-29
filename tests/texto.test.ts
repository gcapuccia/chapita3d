import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, test } from 'vitest'
import { licenciaPermitida } from '../scripts/reglas-licencias.ts'
import { FUENTES } from '../src/datos/fuentes.ts'
import { crearDiseno } from '../src/diseno/crear.ts'
import { agregarTexto } from '../src/diseno/texto.ts'
import { construir } from '../src/geometria/construir.ts'
import { cargarManifold, withScope } from '../src/geometria/manifold.ts'
import { contornosDeTexto, registrarFuente } from '../src/geometria/texto.ts'
import type { RegionTrazada } from '../src/pipeline/tipos.ts'
import { volumenPieza } from './utiles.ts'

beforeAll(async () => {
  await cargarManifold()
  for (const f of FUENTES) {
    const b = readFileSync(`node_modules/${f.archivo}`)
    registrarFuente(f.id, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
  }
})

function disenoConDibujo() {
  const regiones: RegionTrazada[] = [
    {
      id: 'a',
      hex: '#F5C518',
      prioridad: 1,
      areaPx: 900,
      contornos: [
        [
          [0, 0],
          [40, 0],
          [40, 30],
          [0, 30],
        ],
      ],
    },
  ]
  return crearDiseno(regiones, {
    nombre: 'con texto',
    id: 'texto',
    ahora: '2026-09-13T12:00:00Z',
    appVersion: 'test',
  })
}

describe('contornos de texto', () => {
  test.each(FUENTES.map((f) => f.id))(
    'la fuente %s escribe español con acentos y ñ, centrado',
    (fuente) => {
      const contornos = contornosDeTexto(fuente, 'Mañana Güemes', 8)
      expect(contornos.length).toBeGreaterThan(10)
      const puntos = contornos.flat()
      const xs = puntos.map((p) => p[0])
      const ys = puntos.map((p) => p[1])
      expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(0, 5)
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(0, 5)
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys))
    },
  )

  test.each(FUENTES.map((f) => f.id))(
    'la O de %s conserva su agujero (regla NonZero)',
    (fuente) => {
      const contornos = withScope((m) =>
        m.CrossSection.ofPolygons(contornosDeTexto(fuente, 'O', 20), 'NonZero').numContour(),
      )
      expect(contornos).toBe(2) // el borde de afuera y el agujero
    },
  )
})

describe('texto en varios renglones', () => {
  const caja = (c: [number, number][][]) => {
    const xs = c.flat().map((p) => p[0])
    const ys = c.flat().map((p) => p[1])
    return {
      ancho: Math.max(...xs) - Math.min(...xs),
      alto: Math.max(...ys) - Math.min(...ys),
      cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      cy: (Math.min(...ys) + Math.max(...ys)) / 2,
    }
  }

  test('un salto de linea apila: el bloque queda mas angosto y mas alto', () => {
    const unaLinea = caja(contornosDeTexto('redonda', 'HOLA MUNDO', 10))
    const dos = caja(contornosDeTexto('redonda', 'HOLA\nMUNDO', 10))
    expect(dos.ancho).toBeLessThan(unaLinea.ancho)
    expect(dos.alto).toBeGreaterThan(unaLinea.alto * 1.8)
  })

  test('el bloque entero queda centrado en el origen', () => {
    const c = caja(contornosDeTexto('redonda', 'I\nMMMMM\nI', 10))
    expect(c.cx).toBeCloseTo(0, 5)
    expect(c.cy).toBeCloseTo(0, 5)
  })

  test('cada renglon se centra solo, no se alinea a la izquierda', () => {
    // La I angosta arriba de la M ancha: si se alinearan a la izquierda, la I quedaria en el borde
    const c = contornosDeTexto('redonda', 'I\nMMMMM', 10)
    const arriba = c.filter((a) => a.some(([, y]) => y > 0))
    const xs = arriba.flat().map((p) => p[0])
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(0, 1)
  })

  test('un renglon vacio deja el hueco igual', () => {
    const juntos = caja(contornosDeTexto('redonda', 'A\nB', 10))
    const separados = caja(contornosDeTexto('redonda', 'A\n\nB', 10))
    expect(separados.alto).toBeGreaterThan(juntos.alto * 1.5)
  })

  test('un salto al final no corre nada', () => {
    const sin = contornosDeTexto('redonda', 'A', 10)
    const con = contornosDeTexto('redonda', 'A\n', 10)
    expect(caja(con)).toEqual(caja(sin))
  })
})

describe('texto en el llavero', () => {
  test('se agrega debajo del dibujo, en un color que contrasta, y construye sin errores', () => {
    const d = agregarTexto(disenoConDibujo(), 'Guido')
    const texto = d.piezas.find((p) => p.tipo === 'texto')!
    const tinta = d.filamentos.find((f) => f.id === texto.filamentoId)!
    expect(tinta.nombre).toBe('Negro') // el dibujo es amarillo sobre blanco: no hay oscuro, se agrega

    const r = construir(d)
    expect(r.avisos.filter((a) => a.nivel === 'error')).toEqual([])
    expect(r.avisos.map((a) => a.codigo)).not.toContain('pieza-suelta') // el contorno une texto y dibujo
    expect(r.avisos.map((a) => a.codigo)).not.toContain('texto-ilegible') // el tamaño por defecto no nace con aviso
    expect(r.piezas.map((p) => p.slot)).toContain(tinta.slot)
    const suma = r.piezas.reduce((t, p) => t + volumenPieza(p), 0)
    expect(Math.abs(suma - volumenPieza(r.entera)) / volumenPieza(r.entera)).toBeLessThan(0.001)
  })

  test('manuscrita chica: avisa por trazo fino aunque tenga altura', () => {
    const avisos = construir(
      agregarTexto(disenoConDibujo(), 'Guido', { fuente: 'manuscrita', tamano: 9 }),
    ).avisos
    expect(avisos.find((a) => a.codigo === 'texto-ilegible')?.mensaje).toMatch(/trazos más finos/)
  })

  test('texto muy chico: avisa que sale ilegible', () => {
    const r = construir(agregarTexto(disenoConDibujo(), 'Guido', { tamano: 4 }))
    expect(r.avisos.map((a) => a.codigo)).toContain('texto-ilegible')
  })

  test('el texto no modifica el diseño original', () => {
    const d = disenoConDibujo()
    agregarTexto(d, 'Hola')
    expect(d.piezas.some((p) => p.tipo === 'texto')).toBe(false)
  })
})

describe('licencias de fuentes', () => {
  test('OFL-1.1 se permite solo para paquetes de fuentes', () => {
    expect(licenciaPermitida('OFL-1.1', '@fontsource/nunito')).toBe(true)
    expect(licenciaPermitida('OFL-1.1', 'un-paquete-de-codigo')).toBe(false)
    expect(licenciaPermitida('OFL-1.1')).toBe(false)
  })
})
