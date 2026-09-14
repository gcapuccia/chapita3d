import { describe, expect, test } from 'vitest'
import { oklabARgb, rgbAOklab } from '../src/pipeline/color.ts'
import { trazar } from '../src/pipeline/contornos.ts'
import { convertir, convertirAutomatico, paramsPorDefecto } from '../src/pipeline/index.ts'
import { mascaraPorFloodFill } from '../src/pipeline/mascara.ts'
import { apertura } from '../src/pipeline/morfologia.ts'
import { FONDO, type Oklab } from '../src/pipeline/tipos.ts'
import { ESCENAS, renderizar } from './banco/escenas.ts'
import { areaRegionMm2, evaluar } from './banco/evaluar.ts'

describe('color', () => {
  test.each([
    [0, 0, 0],
    [255, 255, 255],
    [214, 40, 40],
    [30, 79, 216],
    [245, 197, 24],
  ])('sRGB → OKLab → sRGB vuelve al mismo color (%i, %i, %i)', (r, g, b) => {
    const lab = new Float32Array(3)
    rgbAOklab(r, g, b, lab, 0)
    const vuelta = oklabARgb([lab[0]!, lab[1]!, lab[2]!] as Oklab)
    vuelta.forEach((c, i) => expect(Math.abs(c - [r, g, b][i]!)).toBeLessThanOrEqual(1))
  })
})

describe('contornos', () => {
  test('d3-contour ya da coordenadas de borde de pixel: NO hay que restar medio pixel', () => {
    // Bloque de 4 × 3 pixeles en x = 4..7, y = 3..5, sobre una grilla de 12 × 12
    const ancho = 12
    const alto = 12
    const etiquetas = new Uint8Array(ancho * alto).fill(FONDO)
    for (let y = 3; y <= 5; y++) for (let x = 4; x <= 7; x++) etiquetas[y * ancho + x] = 0
    const [region] = trazar(
      etiquetas,
      ancho,
      alto,
      [{ hex: '#000000', oklab: [0, 0, 0], pixeles: 12 }],
      {
        mmPorPixel: 1,
        toleranciaRdpMm: 0,
        maxVerticesPorRegion: 1000,
      },
    )
    const puntos = region!.contornos.flat()
    const xs = puntos.map((p) => p[0])
    const ys = puntos.map((p) => p[1])
    // En borde de pixel el bloque es x ∈ [4, 8]; con y hacia arriba, y ∈ [12 − 6, 12 − 3]
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([4, 8])
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([6, 9])
    // 12 px² menos las 4 esquinas que corta marching squares (0,125 cada una)
    expect(areaRegionMm2(region!.contornos)).toBeCloseTo(11.5, 5)
  })
})

describe('limpieza', () => {
  test('la apertura borra lo angosto, conserva lo grueso y redondea sus esquinas con el radio', () => {
    const ancho = 40
    const alto = 40
    const mascara = new Uint8Array(ancho * alto)
    for (let y = 5; y < 35; y++) mascara[y * ancho + 5] = mascara[y * ancho + 6] = 1 // linea de 2 px
    for (let y = 10; y < 30; y++) for (let x = 15; x < 35; x++) mascara[y * ancho + x] = 1 // cuadrado de 20 px
    const abierta = apertura(mascara, ancho, alto, 2)
    const en = (x: number, y: number) => abierta[y * ancho + x]
    let linea = 0
    let cuadrado = 0
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        if (!en(x, y)) continue
        if (x < 10) linea++
        else cuadrado++
      }
    }
    expect(linea).toBe(0)
    // Un disco no entra en una esquina a 90°: se pierden unos pocos pixeles por esquina y nada mas.
    // En el llavero eso es radio 0,4 mm en las esquinas vivas, que una boquilla de 0,4 no imprime igual.
    expect(cuadrado).toBeGreaterThan(400 * 0.96)
    expect(en(15, 10)).toBe(0) // esquina
    expect([en(24, 10), en(15, 19), en(34, 19), en(24, 29)]).toEqual([1, 1, 1, 1]) // centro de cada lado
  })
})

describe('mascara', () => {
  test('el flood fill no se come un dibujo que toca el borde de la imagen', () => {
    const ancho = 50
    const alto = 50
    const pixeles = new Uint8ClampedArray(ancho * alto * 4).fill(255)
    // Rectangulo rojo pegado al borde izquierdo
    for (let y = 10; y < 40; y++) {
      for (let x = 0; x < 20; x++) pixeles.set([200, 30, 30, 255], (y * ancho + x) * 4)
    }
    const mascara = mascaraPorFloodFill({ ancho, alto, pixeles }, 0.1)
    expect(mascara.reduce((s, v) => s + v, 0)).toBe(30 * 20)
  })
})

describe('banco sintetico (a la resolucion por defecto)', () => {
  const correr = (id: string) => {
    const escena = ESCENAS.find((e) => e.id === id)!
    const verdad = renderizar(escena)
    const p = paramsPorDefecto('dibujo')
    return evaluar(escena, verdad, convertir(verdad.imagen, p), p.ladoMayorMm)
  }

  test.each([
    'logo-03-formas-crema',
    'dibujo-01-carita-sombreada',
    'dibujo-02-gato-fondo-celeste',
    'sticker-01-borde-blanco-sombra',
  ])(
    '%s sale bien a la primera',
    (id) => {
      const ev = correr(id)
      expect(ev.motivos).toEqual([])
    },
    30_000,
  )

  test('las lineas mas finas que el minimo imprimible se borran sin romper el resto', () => {
    const ev = correr('dibujo-05-lineas-finas')
    expect(ev.motivos).toEqual([])
    expect(ev.coloresObtenidos).toBe(2) // los rayos blancos no aparecen como tercer color
  }, 30_000)

  test('regresion F0.8: la erosion anti-halo no achica la geometria', () => {
    // Antes de la correccion, el anillo negro que toca el borde perdia perimetro × 1 px (7,8 %)
    const ev = correr('logo-01-sello-transparente')
    const anillo = ev.colores.find((c) => c.esperado.startsWith('#1'))!
    expect(anillo.errorArea).toBeLessThan(0.03)
    expect(ev.exito).toBe(true)
  }, 30_000)
})

describe('casos feos y preset automatico', () => {
  const verdadDe = (id: string) => {
    const escena = ESCENAS.find((e) => e.id === id)!
    return { escena, verdad: renderizar(escena) }
  }

  test('un logo limpio no dispara ningun caso feo', () => {
    const { verdad } = verdadDe('logo-03-formas-crema')
    expect(convertir(verdad.imagen, paramsPorDefecto('dibujo')).diagnostico.casos).toEqual([])
  }, 30_000)

  test('fondo del mismo color que el sujeto: se detecta y el preset Foto lo rescata solo', () => {
    const { escena, verdad } = verdadDe('horrible-02-fondo-igual')
    const conDibujo = convertir(verdad.imagen, paramsPorDefecto('dibujo'))
    expect(conDibujo.diagnostico.casos.map((c) => c.codigo)).toContain('dibujo-no-encontrado')

    const auto = convertirAutomatico(verdad.imagen)
    expect(auto.preset).toBe('foto')
    expect(evaluar(escena, verdad, auto, paramsPorDefecto('foto').ladoMayorMm).motivos).toEqual([])
  }, 60_000)
})
