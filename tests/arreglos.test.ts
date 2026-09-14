// Arreglos de F2 portados desde spikes/08-arreglos: fondo encerrado, engrosar lineas, caja sin
// motas y polaridad de Silueta. Imagenes chicas dibujadas aca: cada test aisla un arreglo.

import { describe, expect, test } from 'vitest'
import { cajaSinMotas, tintaClara } from '../src/pipeline/fondo.ts'
import { convertir, convertirAutomatico, paramsPorDefecto } from '../src/pipeline/index.ts'
import { encerrados, esqueleto } from '../src/pipeline/morfologia.ts'
import { FONDO, type ImagenRGBA } from '../src/pipeline/tipos.ts'

type RGB = [number, number, number]

function lienzo(ancho: number, alto: number, fondo: RGB): ImagenRGBA {
  const pixeles = new Uint8ClampedArray(ancho * alto * 4)
  for (let i = 0; i < ancho * alto; i++) pixeles.set([...fondo, 255], i * 4)
  return { ancho, alto, pixeles }
}

function pintar(img: ImagenRGBA, color: RGB, dentro: (x: number, y: number) => boolean) {
  for (let y = 0; y < img.alto; y++)
    for (let x = 0; x < img.ancho; x++)
      if (dentro(x + 0.5, y + 0.5)) img.pixeles.set([...color, 255], (y * img.ancho + x) * 4)
}

const CELESTE: RGB = [208, 232, 255]
const NEGRO: RGB = [20, 20, 20]
const BLANCO: RGB = [255, 255, 255]

describe('morfologia nueva', () => {
  test('encerrados: el hueco de un anillo si, lo de afuera no', () => {
    const ancho = 20
    const m = new Uint8Array(ancho * ancho)
    for (let y = 0; y < ancho; y++)
      for (let x = 0; x < ancho; x++) {
        const d = Math.hypot(x - 10, y - 10)
        m[y * ancho + x] = d >= 5 && d <= 7 ? 1 : 0
      }
    const e = encerrados(m, ancho, ancho)
    expect(e[10 * ancho + 10]).toBe(1)
    expect(e[0]).toBe(0)
  })

  test('esqueleto: una barra de 5 px queda en una linea de 1 px', () => {
    const ancho = 30
    const alto = 11
    const m = new Uint8Array(ancho * alto)
    for (let y = 3; y < 8; y++) for (let x = 2; x < 28; x++) m[y * ancho + x] = 1
    const s = esqueleto(m, ancho, alto)
    for (let x = 6; x < 24; x++) {
      let enColumna = 0
      for (let y = 0; y < alto; y++) enColumna += s[y * ancho + x]!
      expect(enColumna).toBe(1)
    }
  })
})

describe('fondo encerrado', () => {
  test('el fondo adentro de un aro cerrado se rellena con la base: sin agujero pasante', () => {
    const img = lienzo(400, 400, CELESTE)
    pintar(img, NEGRO, (x, y) => {
      const d = Math.hypot(x - 200, y - 200)
      return (d >= 150 && d <= 180) || d <= 40
    })
    const r = convertirAutomatico(img, { colores: 3 })
    const { etiquetas, ancho, alto, casos, fondo } = r.diagnostico
    const indiceBase = r.paleta.findIndex((c) => c.hex === '#FFFFFF')
    expect(indiceBase).toBeGreaterThanOrEqual(0)
    // Entre el punto del centro y el aro: base, no fondo ni celeste
    const i = Math.round(alto / 2) * ancho + Math.round(ancho * 0.3)
    expect(etiquetas[i]).toBe(indiceBase)
    expect(r.paleta.some((c) => c.hex.toUpperCase() === '#D0E8FF')).toBe(false)
    expect(fondo.rellenoMm2).toBeGreaterThan(100)
    expect(casos.map((c) => c.codigo)).toContain('fondo-rellenado')
    // Ningun pixel de fondo queda encerrado por el dibujo
    const hay = etiquetas.map((e) => (e === FONDO ? 0 : 1))
    expect(encerrados(hay, ancho, alto).some((v) => v === 1)).toBe(false)
  })

  test('sin la segunda pasada el aro queda con el celeste adentro (como antes de F2)', () => {
    const img = lienzo(400, 400, CELESTE)
    pintar(img, NEGRO, (x, y) => {
      const d = Math.hypot(x - 200, y - 200)
      return d >= 150 && d <= 180
    })
    const r = convertir(img, { ...paramsPorDefecto('dibujo'), colores: 3, fondoEncerrado: false })
    expect(r.diagnostico.fondo.rellenoMm2).toBe(0)
    expect(r.paleta.length).toBe(2)
  })
})

describe('engrosar lineas', () => {
  // Una Z abierta de trazo de 4 px sobre 400 px: a 50 mm, el trazo mide 0,5 mm (menos de 0,8)
  const lineas = () => {
    const img = lienzo(460, 460, BLANCO)
    const cerca = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax
      const dy = by - ay
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
      return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= 2
    }
    pintar(
      img,
      NEGRO,
      (x, y) =>
        cerca(x, y, 30, 30, 430, 30) ||
        cerca(x, y, 430, 30, 30, 430) ||
        cerca(x, y, 30, 430, 430, 430),
    )
    return img
  }

  test('Automatico detecta el logo de lineas y las engrosa al minimo imprimible', () => {
    const r = convertirAutomatico(lineas(), { colores: 2 })
    const { etiquetas, ancho, alto, mmPorPixel, grosorLineasMm, limpieza, casos } = r.diagnostico
    expect(grosorLineasMm).toBe(0.8)
    expect(limpieza.fraccionLineas).toBeGreaterThan(0.5)
    expect(casos.map((c) => c.codigo)).toContain('lineas-engrosadas')
    // La linea de arriba, cortada a mitad de camino: al menos 0,8 mm de ancho
    const x = Math.round(ancho / 2)
    let ancha = 0
    for (let y = 0; y < alto / 3; y++) if (etiquetas[y * ancho + x] !== FONDO) ancha++
    expect(ancha * mmPorPixel).toBeGreaterThanOrEqual(0.8)
  })

  test('con grosor null las lineas finas se borran (comportamiento anterior)', () => {
    const img = lienzo(460, 460, BLANCO)
    // Un cuadrado grueso para que quede dibujo, y la misma Z fina al costado
    pintar(img, NEGRO, (x, y) => x > 300 && x < 440 && y > 300 && y < 440)
    pintar(img, NEGRO, (x, y) => Math.abs(y - 60) <= 2 && x > 20 && x < 280)
    const r = convertir(img, {
      ...paramsPorDefecto('dibujo'),
      colores: 2,
      grosorMinimoLineasMm: null,
    })
    const { etiquetas, ancho, recorte, mmPorPixel } = r.diagnostico
    // Fila de la linea fina en la imagen de trabajo
    const escala = r.diagnostico.ancho / recorte.ancho
    const y = Math.round((60 - recorte.y) * escala)
    let queda = 0
    for (let x = 0; x < Math.round(250 * escala); x++)
      if (etiquetas[y * ancho + x] !== FONDO) queda++
    expect(queda * mmPorPixel).toBeLessThan(1)
  })
})

describe('caja sin motas y polaridad', () => {
  test('una mota lejos no agranda la caja del dibujo', () => {
    const ancho = 100
    const m = new Uint8Array(ancho * ancho)
    for (let y = 40; y < 80; y++) for (let x = 40; x < 80; x++) m[y * ancho + x] = 1
    m[5 * ancho + 5] = 1
    const r = cajaSinMotas(m, ancho, ancho)
    expect(r.caja).toEqual({ x: 40, y: 40, ancho: 40, alto: 40 })
    expect(r.motas).toBe(1)
  })

  test('tinta clara sobre fondo oscuro se detecta; tinta oscura sobre claro no', () => {
    const oscura = lienzo(80, 80, NEGRO)
    pintar(oscura, BLANCO, (x, y) => Math.hypot(x - 40, y - 40) < 25)
    const clara = lienzo(80, 80, BLANCO)
    pintar(clara, NEGRO, (x, y) => Math.hypot(x - 40, y - 40) < 25)
    expect(tintaClara(oscura)).toBe(true)
    expect(tintaClara(clara)).toBe(false)
  })
})
