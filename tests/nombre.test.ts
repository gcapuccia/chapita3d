import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, test } from 'vitest'
import { FUENTES } from '../src/datos/fuentes.ts'
import { cambiarTextoDeNombre, crearDisenoDeNombre, leerNombre } from '../src/diseno/nombre.ts'
import { construir } from '../src/geometria/construir.ts'
import { cuerpoDelLlavero } from '../src/geometria/llavero.ts'
import { cargarManifold, withScope } from '../src/geometria/manifold.ts'
import { contornosDeTexto, registrarFuente } from '../src/geometria/texto.ts'
import * as D from '../src/pipeline/defaults.ts'
import { volumenPieza } from './utiles.ts'

beforeAll(async () => {
  await cargarManifold()
  for (const f of FUENTES) {
    const b = readFileSync(`node_modules/${f.archivo}`)
    registrarFuente(f.id, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
  }
})

const opciones = { id: 'nombre', ahora: '2026-11-17T12:00:00Z', appVersion: 'test' }

/** Cuantas partes sueltas tiene el cuerpo de un texto, con o sin la franja que une. */
function partes(texto: string, unir: boolean, fuente = 'redonda'): number {
  return withScope((m) => {
    const silueta = m.CrossSection.ofPolygons(
      contornosDeTexto(fuente, texto, D.TAMANO_NOMBRE_MM),
      'NonZero',
    )
    const { cuerpo } = cuerpoDelLlavero(
      m,
      silueta,
      { activo: true, offset: D.OFFSET_CONTORNO_NOMBRE, filamentoId: 'base', unir },
      { tipo: 'sin', posicion: 'auto' },
    )
    return cuerpo.decompose().length
  })
}

describe('llavero de nombre', () => {
  test.each(FUENTES.map((f) => f.id))('"Sofía" con la letra %s sale imprimible', (fuente) => {
    const d = crearDisenoDeNombre('Sofía', { ...opciones, fuente })
    const r = construir(d)
    expect(r.bloqueante, r.avisos.map((a) => a.mensaje).join(' / ')).toBe(false)
    expect(r.filamentos.map((f) => f.id)).toEqual(['base', 'letras'])
    for (const p of r.piezas) expect(volumenPieza(p)).toBeGreaterThan(0)
    // Mas ancho que alto, y de un tamaño de llavero
    expect(r.medidas[0]).toBeGreaterThan(r.medidas[1])
    expect(r.medidas[0]).toBeLessThan(90)
  })

  test('dos palabras quedan en un solo cuerpo gracias a la franja', () => {
    expect(partes('Ana   Paz', false)).toBeGreaterThan(1)
    expect(partes('Ana   Paz', true)).toBe(1)
  })

  test('si las letras ya se tocan, no se agrega la franja', () => {
    expect(partes('Sofía', false)).toBe(1)
    const sinFranja = withScope((m) => {
      const silueta = m.CrossSection.ofPolygons(
        contornosDeTexto('redonda', 'Sofía', D.TAMANO_NOMBRE_MM),
        'NonZero',
      )
      const contorno = { activo: true, offset: D.OFFSET_CONTORNO_NOMBRE, filamentoId: 'base' }
      const argolla = { tipo: 'sin', posicion: 'auto' } as const
      const a = cuerpoDelLlavero(m, silueta, contorno, argolla).cuerpo.area()
      const b = cuerpoDelLlavero(m, silueta, { ...contorno, unir: true }, argolla).cuerpo.area()
      return Math.abs(a - b)
    })
    expect(sinFranja).toBeLessThan(1e-6)
  })

  test('la argolla va a la izquierda, a media altura, y aguanta', () => {
    const r = construir(crearDisenoDeNombre('Tomás', opciones))
    const contornos = contornosDeTexto('redonda', 'Tomás', D.TAMANO_NOMBRE_MM).flat()
    const izquierda = Math.min(...contornos.map((p) => p[0]))
    expect(r.agujero).not.toBeNull()
    expect(r.agujero!.cx).toBeLessThan(izquierda)
    expect(Math.abs(r.agujero!.cy)).toBeLessThan(2)
    expect(r.avisos.filter((a) => ['anillo-fino', 'argolla-suelta'].includes(a.codigo))).toEqual([])
  })

  test('cambiar el texto, la letra o el tamaño no toca el original', () => {
    const d = crearDisenoDeNombre('Sofía', opciones)
    const otro = cambiarTextoDeNombre(d, { texto: 'Lucas', fuente: 'manuscrita', tamano: 18 })
    expect(leerNombre(d)).toEqual({ texto: 'Sofía', fuente: 'redonda', tamano: 14 })
    expect(leerNombre(otro)).toEqual({ texto: 'Lucas', fuente: 'manuscrita', tamano: 18 })
    expect(otro.nombre).toBe('Lucas')
    expect(otro.producto).toBe('nombre')
  })
})
