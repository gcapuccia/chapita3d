// Genera las escenas de casos reales y su verdad en PNG, para mirarlas.
//
//   node spikes/07-casos-reales/generar.ts [id ...]
//
// Escribe salida/escenas/<id>.png (la imagen) y salida/escenas/<id>-verdad.png (color por etiqueta,
// fondo en magenta). Las escenas en si se importan de escenas.ts (ESCENAS_REALES + renderizarReal).

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hexARgb } from '../../src/pipeline/color.ts'
import { FONDO } from '../../src/pipeline/tipos.ts'
import { escribirPng } from '../../tests/banco/png.ts'
import { ESCENAS_REALES, renderizarReal } from './escenas.ts'

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), 'salida', 'escenas')
mkdirSync(SALIDA, { recursive: true })
const ids = process.argv.slice(2)

for (const e of ESCENAS_REALES.filter((x) => !ids.length || ids.includes(x.id))) {
  const t0 = performance.now()
  const v = renderizarReal(e)
  writeFileSync(join(SALIDA, `${e.id}.png`), escribirPng(v.imagen))
  const px = new Uint8ClampedArray(v.etiquetas.length * 4)
  const cols = e.colores.map(hexARgb)
  for (let i = 0; i < v.etiquetas.length; i++) {
    const et = v.etiquetas[i]!
    px.set(et === FONDO ? [236, 72, 153, 255] : [...cols[et]!, 255], i * 4)
  }
  writeFileSync(
    join(SALIDA, `${e.id}-verdad.png`),
    escribirPng({ ancho: e.ancho, alto: e.alto, pixeles: px }),
  )
  console.log(
    `${e.id}: ${(performance.now() - t0).toFixed(0)} ms · caja ${v.caja.ancho}×${v.caja.alto} px · ` +
      e.elementos.map((el, k) => `${el.id}=${v.pixelesPorElemento[k]}`).join(' '),
  )
}
