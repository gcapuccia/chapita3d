// Spike 08 · Verifica que lo portado a src/ (convertirAutomatico con los arreglos por defecto) da lo
// mismo que la politica medida en el spike (convertirConPolitica con SEGUROS).
// Resultado al portar (2026-09-14): identico en las 14. Despues src/ sumo +0,5 px al radio del
// engrosado (garantiza el minimo en diagonal): desde ahi las lineas engrosadas difieren a proposito.
// Otra diferencia esperada: src/ pinta el fondo encerrado con el color de la base (el spike lo dejaba
// aparte en `extra.relleno`). Se compara pixel a pixel fuera de ese relleno.
//
// Uso: node spikes/08-arreglos/verificar-port.ts

import { existsSync, readFileSync } from 'node:fs'
import { convertirAutomatico } from '../../src/pipeline/index.ts'
import { FONDO, type ImagenRGBA } from '../../src/pipeline/tipos.ts'
import { decodificarJpeg, ESCENAS_REALES, renderizarReal } from '../07-casos-reales/escenas.ts'
import { convertirConPolitica, SIN_ARREGLOS } from './pipeline2.ts'

const SEGUROS = {
  ...SIN_ARREGLOS,
  cajaSinMotas: true,
  fusionarIntermedios: true,
  guardaHalo: true,
  interiorConservaTrazos: true,
}
const RUTA_GATO = 'C:/Users/guido/Downloads/prueba.jpg'

const casos: { id: string; img: ImagenRGBA }[] = ESCENAS_REALES.map((e) => ({
  id: e.id,
  img: renderizarReal(e).imagen,
}))
if (existsSync(RUTA_GATO)) {
  const img = decodificarJpeg(readFileSync(RUTA_GATO))
  if (img) casos.push({ id: 'gato', img })
}

let fallas = 0
for (const { id, img } of casos) {
  const t0 = performance.now()
  const nuevo = convertirAutomatico(img, { colores: 4 })
  const msNuevo = performance.now() - t0
  const t1 = performance.now()
  const spike = convertirConPolitica(img, { colores: 4 }, SEGUROS)
  const msSpike = performance.now() - t1
  const a = nuevo.diagnostico
  const b = spike.diagnostico
  let distintos = 0
  let rellenoBase = 0
  if (a.ancho !== b.ancho || a.alto !== b.alto) distintos = -1
  else
    for (let i = 0; i < a.etiquetas.length; i++) {
      const hexA = a.etiquetas[i] === FONDO ? null : nuevo.paleta[a.etiquetas[i]!]!.hex
      const hexB = b.etiquetas[i] === FONDO ? null : spike.paleta[b.etiquetas[i]!]!.hex
      if (hexA === hexB) continue
      if (hexB === null && spike.extra.relleno?.[i]) {
        rellenoBase++
        continue
      }
      // Huecos que la limpieza dejo adentro: el spike tambien los sumaba al relleno despues
      if (hexB === null && hexA === '#FFFFFF') {
        rellenoBase++
        continue
      }
      distintos++
    }
  const ok = distintos === 0 && nuevo.preset === spike.preset
  if (!ok) fallas++
  console.log(
    `${ok ? '✓' : '✗'} ${id.padEnd(34)} preset ${nuevo.preset}/${spike.preset} · distintos ${distintos} · relleno base ${rellenoBase} px · grosor ${a.grosorLineasMm ?? '—'} · colores ${nuevo.paleta.length} · ${msNuevo.toFixed(0)} ms (spike ${msSpike.toFixed(0)}) · ${a.casos.map((c) => c.codigo).join(', ')}`,
  )
}
console.log(fallas ? `\n${fallas} distintos` : '\nIgual al spike en todas')
