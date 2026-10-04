import { describe, expect, test } from 'vitest'
import { trazar } from '../src/pipeline/contornos.ts'
import { FONDO, type ColorPaleta } from '../src/pipeline/tipos.ts'
import {
  componenteEn,
  pintarCirculo,
  pintarIndices,
  pintarTrazo,
  pixelesDeTinta,
  type Mapa,
} from '../src/vector/pincel.ts'
import { aSvg } from '../src/vector/svg.ts'

const ANCHO = 60
const ALTO = 40

function mapaVacio(): Mapa {
  return { etiquetas: new Uint8Array(ANCHO * ALTO).fill(FONDO), ancho: ANCHO, alto: ALTO }
}

/** Un rectangulo de un color. */
function rect(m: Mapa, x0: number, y0: number, x1: number, y1: number, valor: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.etiquetas[y * m.ancho + x] = valor
}

const en = (m: Mapa, x: number, y: number) => m.etiquetas[y * m.ancho + x]

const PALETA: ColorPaleta[] = [
  { hex: '#112233', oklab: [0.3, 0, 0], pixeles: 100 },
  { hex: '#AABBCC', oklab: [0.8, 0, 0], pixeles: 50 },
]

describe('pincel', () => {
  test('pinta un circulo y no sale de su radio', () => {
    const m = mapaVacio()
    const cambiados = pintarCirculo(m, 30, 20, 5, 0)
    // El area de un circulo de radio 5 son ~78 pixeles; la grilla da algo parecido
    expect(cambiados).toBeGreaterThan(60)
    expect(cambiados).toBeLessThan(100)
    expect(en(m, 30, 20)).toBe(0)
    expect(en(m, 30, 14)).toBe(FONDO) // a 6 de distancia, afuera
  })

  test('el trazo no sale punteado aunque el puntero salte', () => {
    const m = mapaVacio()
    pintarTrazo(m, 5, 20, 55, 20, 2, 0)
    // Todo el camino tiene que estar pintado, no solo las dos puntas
    for (let x = 6; x <= 54; x++) expect(en(m, x, 20)).toBe(0)
  })

  test('pintar con FONDO es borrar', () => {
    const m = mapaVacio()
    rect(m, 10, 10, 20, 20, 0)
    expect(pixelesDeTinta(m)).toBe(121)
    pintarCirculo(m, 15, 15, 20, FONDO)
    expect(pixelesDeTinta(m)).toBe(0)
  })

  test('no cuenta de nuevo los pixeles que ya estaban del color', () => {
    const m = mapaVacio()
    expect(pintarCirculo(m, 30, 20, 4, 0)).toBeGreaterThan(0)
    expect(pintarCirculo(m, 30, 20, 4, 0)).toBe(0)
  })
})

describe('la mancha que se toca', () => {
  test('una mota pegada en diagonal es una mota, no se lleva el dibujo', () => {
    const m = mapaVacio()
    rect(m, 10, 10, 30, 30, 0) // el dibujo
    rect(m, 31, 31, 33, 33, 0) // la mota, tocando solo por la esquina
    const mota = componenteEn(m, 32, 32)!
    expect(mota.length).toBe(9)

    pintarIndices(m, mota, FONDO)
    expect(pixelesDeTinta(m)).toBe(21 * 21) // el dibujo quedo entero
  })

  test('la mancha es la del color que se toca, no toda la tinta pegada', () => {
    const m = mapaVacio()
    rect(m, 10, 10, 12, 12, 0)
    rect(m, 13, 10, 15, 12, 1) // pegada, de otro color
    // En un logo relleno la tinta entera es una sola mancha: por eso va por color
    expect(componenteEn(m, 11, 11)!.length).toBe(9)
    expect(componenteEn(m, 14, 11)!.length).toBe(9)
  })

  test('un color adentro de otro se agarra solo a el', () => {
    const m = mapaVacio()
    rect(m, 10, 10, 30, 30, 0)
    rect(m, 15, 15, 18, 18, 1) // una hoja adentro del disco
    expect(componenteEn(m, 16, 16)!.length).toBe(16)
    expect(componenteEn(m, 11, 11)!.length).toBe(21 * 21 - 16)
  })

  test('tocar el fondo devuelve el hueco encerrado, no todo el fondo', () => {
    const m = mapaVacio()
    rect(m, 10, 10, 30, 30, 0)
    rect(m, 15, 15, 18, 18, FONDO) // un agujero adentro del dibujo
    const hueco = componenteEn(m, 16, 16)!
    expect(hueco.length).toBe(16)

    pintarIndices(m, hueco, 1)
    expect(en(m, 16, 16)).toBe(1)
  })

  test('afuera del mapa no devuelve nada', () => {
    expect(componenteEn(mapaVacio(), -1, 5)).toBeNull()
    expect(componenteEn(mapaVacio(), 5, ALTO + 2)).toBeNull()
  })
})

describe('de mapa editado a SVG', () => {
  const trazarMapa = (m: Mapa) =>
    trazar(m.etiquetas, m.ancho, m.alto, PALETA, {
      mmPorPixel: 0.1,
      toleranciaRdpMm: 0.05,
      maxVerticesPorRegion: 4000,
    })

  test('borrar la mota deja una sola region', () => {
    const m = mapaVacio()
    rect(m, 10, 10, 30, 30, 0)
    rect(m, 45, 5, 47, 7, 0)
    expect(trazarMapa(m)[0]!.contornos.length).toBe(2) // el dibujo y la mota

    pintarIndices(m, componenteEn(m, 46, 6)!, FONDO)
    const despues = trazarMapa(m)
    expect(despues.length).toBe(1)
    expect(despues[0]!.contornos.length).toBe(1)
  })

  test('el SVG sale con un path por color, con y para abajo', () => {
    const m = mapaVacio()
    rect(m, 10, 10, 30, 30, 0)
    rect(m, 35, 10, 50, 20, 1)
    const svg = aSvg(trazarMapa(m), ANCHO * 0.1, ALTO * 0.1, 'prueba')

    expect(svg).toContain('viewBox="0 0 6 4"')
    expect(svg).toContain('width="6mm"')
    expect(svg).toContain('<title>prueba</title>')
    expect(svg.match(/<path /g)?.length).toBe(2)
    expect(svg).toContain('fill="#112233"')
    expect(svg).toContain('fill-rule="evenodd"')
    // Nada se va del lienzo: todas las coordenadas caen adentro del viewBox
    for (const [, x, y] of svg.matchAll(/([\d.]+) ([\d.]+)/g)) {
      expect(Number(x)).toBeGreaterThanOrEqual(0)
      expect(Number(x)).toBeLessThanOrEqual(6)
      expect(Number(y)).toBeGreaterThanOrEqual(0)
      expect(Number(y)).toBeLessThanOrEqual(4)
    }
  })

  test('un agujero sale como anillo aparte, para que evenodd lo agujeree', () => {
    const m = mapaVacio()
    rect(m, 10, 10, 30, 30, 0)
    rect(m, 16, 16, 24, 24, FONDO)
    const svg = aSvg(trazarMapa(m), ANCHO * 0.1, ALTO * 0.1, 'dona')
    expect(svg.match(/<path /g)?.length).toBe(1)
    expect(svg.match(/M/g)?.length).toBe(2) // contorno de afuera y agujero
  })

  test('sin tinta no hay regiones ni paths', () => {
    const svg = aSvg(trazarMapa(mapaVacio()), 6, 4, 'vacio')
    expect(svg).not.toContain('<path')
  })
})
