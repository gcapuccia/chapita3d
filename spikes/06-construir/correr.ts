// Aceptacion de la Fase 1 sobre todo el banco (plan §10, Fase 1):
//  - cada imagen produce piezas validas y disjuntas, en los dos modos de color
//  - compuerta del layout: mediana de recalcular el preview (construir) <= 400 ms
//
//   node spikes/06-construir/correr.ts

import { crearDiseno } from '../../src/diseno/crear.ts'
import { empaquetar } from '../../src/export/paquete.ts'
import { construir } from '../../src/geometria/construir.ts'
import { cargarManifold, estadisticasManifold } from '../../src/geometria/manifold.ts'
import { convertir, paramsPorDefecto } from '../../src/pipeline/index.ts'
import { ESCENAS, renderizar } from '../../tests/banco/escenas.ts'
import { volumenPieza } from '../../tests/utiles.ts'

const COMPUERTA_MS = 400

await cargarManifold()
const tiempos: number[] = []
const filas: string[] = []
let fallas = 0

for (const escena of ESCENAS) {
  const conv = convertir(renderizar(escena).imagen, paramsPorDefecto('dibujo'))
  if (!conv.regiones.length) {
    filas.push(
      `| ${escena.id} | — | — | el pipeline no encontró el dibujo (${escena.expectativa}) |`,
    )
    continue
  }
  const base = crearDiseno(conv.regiones, {
    nombre: escena.id,
    id: escena.id,
    ahora: '2026-09-13T12:00:00Z',
    appVersion: 'spike',
  })

  for (const modo of ['a_ras', 'apilado'] as const) {
    const d = { ...base, impresion: { ...base.impresion, modoColor: modo } }
    try {
      // Tiempo en caliente: se mide la segunda corrida, como cuando el usuario mueve un control
      construir(d)
      const t0 = performance.now()
      const r = construir(d)
      const ms = performance.now() - t0
      tiempos.push(ms)

      const suma = r.piezas.reduce((t, p) => t + volumenPieza(p), 0)
      const disjuntas = Math.abs(suma - volumenPieza(r.entera)) / volumenPieza(r.entera) < 0.001
      const errores = r.avisos.filter((a) => a.nivel === 'error').map((a) => a.codigo)
      const avisos = r.avisos.filter((a) => a.nivel === 'aviso').map((a) => a.codigo)
      if (!r.bloqueante) empaquetar(d, r, '13/09/2026')
      const ok = disjuntas && !r.bloqueante
      if (!ok) fallas++
      filas.push(
        `| ${escena.id} | ${modo} | ${ms.toFixed(0)} ms | ${ok ? '✅' : '❌'} ${r.filamentos.length} filamentos · ${r.medidas.map((x) => x.toFixed(1)).join('×')} mm · disjuntas ${disjuntas ? 'sí' : 'NO'}${errores.length ? ` · errores: ${errores.join(', ')}` : ''}${avisos.length ? ` · avisos: ${[...new Set(avisos)].join(', ')}` : ''} |`,
      )
    } catch (error) {
      fallas++
      filas.push(
        `| ${escena.id} | ${modo} | — | ❌ ${error instanceof Error ? error.message : error} |`,
      )
    }
  }
}

const orden = [...tiempos].sort((a, b) => a - b)
const mediana = orden[orden.length >> 1] ?? 0
console.log('| Imagen | Modo | construir | Resultado |\n|---|---|---|---|')
console.log(filas.join('\n'))
console.log(
  `\nConstrucciones: ${tiempos.length} · fallas: ${fallas} · objetos vivos: ${estadisticasManifold().vivos}`,
)
console.log(
  `Compuerta del layout: mediana ${mediana.toFixed(0)} ms · p90 ${orden[Math.floor(orden.length * 0.9)]?.toFixed(0)} ms · máx ${orden.at(-1)?.toFixed(0)} ms → ${mediana <= COMPUERTA_MS ? `✅ ≤ ${COMPUERTA_MS} ms: se mantienen las tres solapas` : `❌ > ${COMPUERTA_MS} ms: el plan manda pasar al asistente lineal`}`,
)
