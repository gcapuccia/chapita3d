// Genera public/muestras/*.png desde el banco sintetico: material 100 % propio para la landing.
// Uso: node tests/banco/generar-muestras.ts

import { mkdirSync, writeFileSync } from 'node:fs'
import { reescalar } from '../../src/pipeline/reescalar.ts'
import { ESCENAS, renderizar } from './escenas.ts'
import { escribirPng } from './png.ts'

const MUESTRAS = {
  logo: 'logo-01-sello-transparente',
  dibujo: 'dibujo-03-flor',
  silueta: 'dibujo-02-gato-fondo-celeste',
}
const LADO = 600

mkdirSync('public/muestras', { recursive: true })
for (const [nombre, id] of Object.entries(MUESTRAS)) {
  const escena = ESCENAS.find((e) => e.id === id)
  if (!escena) throw new Error(`No existe la escena ${id}`)
  const { imagen } = renderizar(escena)
  const chica = reescalar(
    imagen,
    { x: 0, y: 0, ancho: imagen.ancho, alto: imagen.alto },
    LADO,
    LADO,
  )
  const png = escribirPng(chica)
  writeFileSync(`public/muestras/${nombre}.png`, png)
  console.log(`${nombre}.png ← ${id} (${Math.round(png.length / 1024)} KB)`)
}
