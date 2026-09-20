// Figuras "antes y después" de la landing, sacadas del motor de verdad (no dibujadas a mano).
// Cada una compara el mismo dibujo con el arreglo apagado y prendido, con los colores que salen.
//
// Uso: node spikes/09-marca/figuras.ts   →   public/marca/resuelve-1.png y resuelve-2.png

import { writeFileSync } from 'node:fs'
import { hexARgb } from '../../src/pipeline/color.ts'
import { convertir, paramsPorDefecto, type ResultadoConversion } from '../../src/pipeline/index.ts'
import { FONDO, type ImagenRGBA } from '../../src/pipeline/tipos.ts'
import { escribirPng } from '../../tests/banco/png.ts'
import { ESCENAS_REALES, renderizarReal } from '../07-casos-reales/escenas.ts'

// Fondo claro: en las dos figuras hay tinta oscura, y sobre el carbon no se veria
const PAPEL: [number, number, number] = [0xed, 0xef, 0xf2]
const BORDE: [number, number, number] = [0x9a, 0xa1, 0xae]
const LADO = 360
const MARGEN = 18

/** Pinta las etiquetas de una conversion, centradas y a escala, dentro de un panel cuadrado. */
function panel(r: ResultadoConversion): ImagenRGBA {
  const { etiquetas, ancho, alto } = r.diagnostico
  const colores = r.paleta.map((c) => hexARgb(c.hex))
  const util = LADO - 2 * MARGEN
  const escala = Math.min(util / ancho, util / alto)
  const px = new Uint8ClampedArray(LADO * LADO * 4)
  for (let i = 0; i < LADO * LADO; i++) px.set([...PAPEL, 255], i * 4)
  const x0 = Math.round((LADO - ancho * escala) / 2)
  const y0 = Math.round((LADO - alto * escala) / 2)
  for (let y = 0; y < Math.round(alto * escala); y++) {
    for (let x = 0; x < Math.round(ancho * escala); x++) {
      const e = etiquetas[Math.floor(y / escala) * ancho + Math.floor(x / escala)]
      if (e === undefined || e === FONDO) continue
      const c = colores[e]
      if (!c) continue
      const i = (y0 + y) * LADO + x0 + x
      if (i >= 0 && i < LADO * LADO) px.set([...c, 255], i * 4)
    }
  }
  return { ancho: LADO, alto: LADO, pixeles: px }
}

/** Dos paneles pegados, con una linea de separacion. */
function lado_a_lado(a: ImagenRGBA, b: ImagenRGBA): ImagenRGBA {
  const ancho = LADO * 2 + 2
  const px = new Uint8ClampedArray(ancho * LADO * 4)
  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < ancho; x++) {
      const fuente = x < LADO ? a : x > LADO + 1 ? b : null
      const i = (y * ancho + x) * 4
      if (!fuente) {
        px.set([...BORDE, 255], i)
        continue
      }
      const fx = x < LADO ? x : x - LADO - 2
      px.set(fuente.pixeles.subarray((y * LADO + fx) * 4, (y * LADO + fx) * 4 + 4), i)
    }
  }
  return { ancho, alto: LADO, pixeles: px }
}

function escena(id: string): ImagenRGBA {
  const e = ESCENAS_REALES.find((x) => x.id === id)
  if (!e) throw new Error(`No existe la escena ${id}`)
  return renderizarReal(e).imagen
}

// 1 · Las lineas finas: sin engrosar se borran; con el arreglo vuelven al minimo imprimible
const lineal = escena('real-02-lineal-blanco')
const base = { ...paramsPorDefecto('dibujo'), colores: 3 }
writeFileSync(
  'public/marca/resuelve-1.png',
  escribirPng(
    lado_a_lado(
      panel(convertir(lineal, { ...base, grosorMinimoLineasMm: null })),
      panel(convertir(lineal, { ...base, grosorMinimoLineasMm: 0.8 })),
    ),
  ),
)

// 2 · El fondo encerrado en un aro: antes quedaba como dibujo, ahora sale y el interior es base
const aro = escena('real-13-anillo-fondo-color')
writeFileSync(
  'public/marca/resuelve-2.png',
  escribirPng(
    lado_a_lado(
      panel(convertir(aro, { ...base, fondoEncerrado: false })),
      panel(convertir(aro, base)),
    ),
  ),
)

console.log('listo: public/marca/resuelve-1.png y resuelve-2.png')
