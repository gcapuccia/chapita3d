// Spike 08 · Geometria con los arreglos portados: cada escena real (y el gato) pasa por
// convertirAutomatico → crearDiseno → construir en los dos modos de color. Mide si la pieza sale,
// si las piezas por color son disjuntas y que avisos da la DRC con las lineas engrosadas.
//
// Uso: node spikes/08-arreglos/construir-reales.ts

import { existsSync, readFileSync } from 'node:fs'
import { crearDiseno } from '../../src/diseno/crear.ts'
import { construir } from '../../src/geometria/construir.ts'
import { cargarManifold } from '../../src/geometria/manifold.ts'
import { convertirAutomatico } from '../../src/pipeline/index.ts'
import type { ImagenRGBA } from '../../src/pipeline/tipos.ts'
import { volumenPieza } from '../../tests/utiles.ts'
import { decodificarJpeg, ESCENAS_REALES, renderizarReal } from '../07-casos-reales/escenas.ts'

await cargarManifold()

const casos: { id: string; img: ImagenRGBA }[] = ESCENAS_REALES.map((e) => ({
  id: e.id,
  img: renderizarReal(e).imagen,
}))
const RUTA_GATO = 'C:/Users/guido/Downloads/prueba.jpg'
if (existsSync(RUTA_GATO)) {
  const img = decodificarJpeg(readFileSync(RUTA_GATO))
  if (img) casos.push({ id: 'gato', img })
}

let fallas = 0
for (const { id, img } of casos) {
  const conv = convertirAutomatico(img, { colores: 4 })
  const base = crearDiseno(conv.regiones, {
    nombre: id,
    id,
    ahora: '2026-09-14T12:00:00Z',
    appVersion: 'spike',
  })
  for (const modo of ['a_ras', 'apilado'] as const) {
    const d = { ...base, impresion: { ...base.impresion, modoColor: modo } }
    try {
      const t0 = performance.now()
      const r = construir(d)
      const ms = performance.now() - t0
      const suma = r.piezas.reduce((t, p) => t + volumenPieza(p), 0)
      const entera = volumenPieza(r.entera)
      const disjuntas = Math.abs(suma - entera) / entera < 0.001
      // Sin agujero pasante: el volumen de la pieza entera contra su caja (una placa llena da ~0,6-0,8)
      const [x, y, z] = r.medidas
      const llenado = entera / (x * y * z)
      const errores = r.avisos.filter((a) => a.nivel === 'error').map((a) => a.codigo)
      const avisos = [...new Set(r.avisos.filter((a) => a.nivel === 'aviso').map((a) => a.codigo))]
      const ok = disjuntas && !r.bloqueante
      if (!ok) fallas++
      console.log(
        `${ok ? '✓' : '✗'} ${id.padEnd(30)} ${modo.padEnd(7)} ${ms.toFixed(0).padStart(4)} ms · ${r.filamentos.length} fil · ${r.medidas.map((v) => v.toFixed(1)).join('×')} mm · llenado ${(llenado * 100).toFixed(0)} % · disjuntas ${disjuntas ? 'sí' : 'NO'}${errores.length ? ` · ERRORES ${errores.join(', ')}` : ''}${avisos.length ? ` · avisos ${avisos.join(', ')}` : ''}`,
      )
    } catch (error) {
      fallas++
      console.log(`✗ ${id} ${modo}: ${error instanceof Error ? error.message : error}`)
    }
  }
}
console.log(fallas ? `\n${fallas} con problemas` : '\nTodas construyen')
