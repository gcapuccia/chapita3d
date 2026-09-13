// Genera las piezas patron de F0.5 en spikes/03-impresion/salida/.
// Correr con:  node spikes/03-impresion/generar.ts

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { escribir3mfBambu } from '../../src/export/3mf/bambu.ts'
import { escribirStl } from '../../src/export/stl.ts'
import type { PiezaExport } from '../../src/export/tipos.ts'
import { cargarManifold, withScope } from '../../src/geometria/manifold.ts'
import {
  ALTURA_CAPA,
  COLORES,
  COLORES_AMS,
  p1ReglaDeDetalle,
  p2LlaveroCompleto,
  p3Apilado,
  type Informe,
} from './piezas.ts'

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), 'salida')
const FECHA = process.env.FECHA ?? new Date().toISOString().slice(0, 10)

await cargarManifold()
rmSync(SALIDA, { recursive: true, force: true })
mkdirSync(join(SALIDA, 'stl'), { recursive: true })

const informes: Informe[] = []
const guardar = (archivo: string, datos: Uint8Array) => {
  writeFileSync(join(SALIDA, archivo), datos)
  console.log(`  ${archivo.padEnd(52)} ${(datos.length / 1024).toFixed(0).padStart(5)} KB`)
}
const guardarStls = (base: string, piezas: PiezaExport[], entera: PiezaExport) => {
  for (const p of piezas) guardar(`stl/${base}_${p.slot}_${p.nombre}.stl`, escribirStl(p))
  guardar(`stl/${base}_pieza-entera.stl`, escribirStl(entera))
}

console.log('Generando piezas patrón (F0.5)…')

for (const [nombre, construir] of [
  ['P1-regla-de-detalle', p1ReglaDeDetalle],
  ['P2-llavero-completo', p2LlaveroCompleto],
] as const) {
  const r = withScope((m) => construir(m))
  guardar(
    `${nombre}.3mf`,
    escribir3mfBambu(r.piezas, { nombre, colores: COLORES_AMS, fecha: FECHA }),
  )
  guardarStls(nombre, r.piezas, r.entera)
  informes.push(r.informe)
}

// P3: dos variantes que solo cambian en QUE capa se escribe el cambio de color.
// La auditoria verifico el formato del XML, pero no si top_z es la ultima capa del color
// anterior o la primera del nuevo. La vista previa del slicer lo resuelve sin imprimir.
const p3 = withScope((m) => p3Apilado(m))
const variantes = [
  { sufijo: 'A-cambio-en-z-de-inicio', desplazamiento: 0 },
  { sufijo: 'B-cambio-en-primera-capa', desplazamiento: ALTURA_CAPA },
]
for (const v of variantes) {
  const cambiosDeCapa = p3.franjas.map((f) => ({ z: f.z + v.desplazamiento, hex: f.hex }))
  guardar(
    `P3-apilado-${v.sufijo}.3mf`,
    escribir3mfBambu(p3.piezas, {
      nombre: `P3-apilado-${v.sufijo}`,
      colores: [COLORES.blanco.hex],
      cambiosDeCapa,
      fecha: FECHA,
    }),
  )
  p3.informe.lineas.push(
    `Variante ${v.sufijo}: cambios en top_z = ${cambiosDeCapa.map((c) => c.z.toFixed(1)).join(' y ')}`,
  )
}
informes.push(p3.informe)

const texto = informes
  .map((i) => [i.nombre, ...i.lineas.map((l) => `  ${l}`)].join('\n'))
  .join('\n\n')
writeFileSync(join(SALIDA, 'INFORME.txt'), `${texto}\n`)
console.log(`\n${texto}`)
