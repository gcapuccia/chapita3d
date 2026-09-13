// Spike F0.8 — pipeline de imagen sin UI, medido contra el banco sintetico.
//
//   node spikes/05-pipeline/correr.ts
//
// 1. Tasa de exito "a la primera" a 0,10 / 0,15 / 0,20 / 0,25 mm/px (criterios en tests/banco/evaluar.ts)
// 2. Calibracion de mmPorPixel: desviacion de contorno contra una referencia a 0,05 mm/px,
//    con el mismo encuadre y SIN simplificar, para medir solo el efecto de la resolucion (plan F0.8 punto 4)
// 3. Tiempos por etapa
// Escribe salida/informe.md, salida/resultados.json y una vista de cada resultado en PNG.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deltaE2000, hexARgb } from '../../src/pipeline/color.ts'
import { MM_POR_PIXEL, TOLERANCIA_RDP_MM } from '../../src/pipeline/defaults.ts'
import { convertir, paramsPorDefecto, type ResultadoConversion } from '../../src/pipeline/index.ts'
import { FONDO, type EtapaPipeline, type ImagenRGBA } from '../../src/pipeline/tipos.ts'
import { ESCENAS, renderizar, type Escena, type Verdad } from '../../tests/banco/escenas.ts'
import { desviacion, evaluar, type Evaluacion } from '../../tests/banco/evaluar.ts'
import { escribirPng } from '../../tests/banco/png.ts'

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), 'salida')
mkdirSync(join(SALIDA, 'vistas'), { recursive: true })

const RESOLUCIONES = [0.1, 0.15, 0.2, 0.25]
const REFERENCIA = 0.05
const soloIds = process.argv.slice(2)
const escenas = soloIds.length ? ESCENAS.filter((e) => soloIds.includes(e.id)) : ESCENAS

/** Pinta el mapa de etiquetas con los colores de la paleta, para mirar el resultado. */
function vista(r: ResultadoConversion): ImagenRGBA {
  const { ancho, alto, etiquetas } = r.diagnostico
  const pixeles = new Uint8ClampedArray(ancho * alto * 4)
  const colores = r.paleta.map((c) => hexARgb(c.hex))
  for (let i = 0; i < etiquetas.length; i++) {
    const e = etiquetas[i]!
    const [cr, cg, cb] = e === FONDO ? [236, 72, 153] : colores[e]!
    pixeles.set([cr, cg, cb, e === FONDO ? 60 : 255], i * 4)
  }
  return { ancho, alto, pixeles }
}

type FilaExito = {
  mmPorPixel: number
  evaluaciones: Evaluacion[]
  tiempos: Record<string, number>[]
}
type FilaDesviacion = {
  id: string
  expectativa: Escena['expectativa']
  porResolucion: Record<string, { maxima: number; p95: number }>
}

const exito: FilaExito[] = RESOLUCIONES.map((mmPorPixel) => ({
  mmPorPixel,
  evaluaciones: [],
  tiempos: [],
}))
const desviaciones: FilaDesviacion[] = []

for (const escena of escenas) {
  const t0 = performance.now()
  const verdad: Verdad = renderizar(escena)
  writeFileSync(join(SALIDA, 'vistas', `${escena.id}.png`), escribirPng(verdad.imagen))
  const lineas = [`${escena.id} (render ${(performance.now() - t0).toFixed(0)} ms)`]

  // 1 y 3 · Pipeline por defecto a cada resolucion
  for (const fila of exito) {
    const p = { ...paramsPorDefecto('logo'), mmPorPixel: fila.mmPorPixel }
    try {
      const r = convertir(verdad.imagen, p)
      const ev = evaluar(escena, verdad, r, p.ladoMayorMm)
      fila.evaluaciones.push(ev)
      fila.tiempos.push(r.diagnostico.tiemposMs)
      if (fila.mmPorPixel === MM_POR_PIXEL) {
        writeFileSync(join(SALIDA, 'vistas', `${escena.id}-resultado.png`), escribirPng(vista(r)))
      }
      lineas.push(
        `  ${fila.mmPorPixel.toFixed(2)} mm/px: ${ev.exito ? 'OK ' : 'MAL'} IoU ${ev.iou.toFixed(3)} · ${ev.coloresObtenidos}/${ev.coloresEsperados} colores ${ev.motivos.join(' | ')}`,
      )
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error)
      fila.evaluaciones.push({
        id: escena.id,
        categoria: escena.categoria,
        expectativa: escena.expectativa,
        iou: 0,
        coloresEsperados: escena.colores.length,
        coloresObtenidos: 0,
        colores: [],
        exito: false,
        motivos: [motivo],
      })
      lineas.push(`  ${fila.mmPorPixel.toFixed(2)} mm/px: ERROR ${motivo}`)
    }
  }

  // 2 · Calibracion: mismo encuadre (la caja de la verdad), sin RDP
  const crudo = (mmPorPixel: number) =>
    convertir(verdad.imagen, {
      ...paramsPorDefecto('logo'),
      mmPorPixel,
      caja: verdad.caja,
      toleranciaRdpMm: 0,
    })
  try {
    const referencia = crudo(REFERENCIA)
    const fila: FilaDesviacion = {
      id: escena.id,
      expectativa: escena.expectativa,
      porResolucion: {},
    }
    for (const mm of RESOLUCIONES) {
      const r = crudo(mm)
      // Emparejar colores con la referencia y quedarse con la peor desviacion
      let peor = { maxima: 0, p95: 0 }
      for (const reg of r.regiones) {
        const par = referencia.regiones
          .map((ref) => ({ ref, dE: deltaE2000(ref.hex, reg.hex) }))
          .sort((a, b) => a.dE - b.dE)[0]
        if (!par || par.dE > 10) continue
        const d = desviacion(reg.contornos, par.ref.contornos)
        peor = { maxima: Math.max(peor.maxima, d.maxima), p95: Math.max(peor.p95, d.p95) }
      }
      fila.porResolucion[mm.toFixed(2)] = peor
    }
    desviaciones.push(fila)
    lineas.push(
      `  desviación máx: ${RESOLUCIONES.map((mm) => `${mm.toFixed(2)}→${fila.porResolucion[mm.toFixed(2)]!.maxima.toFixed(3)}`).join(' ')}`,
    )
  } catch (error) {
    lineas.push(`  calibración: ERROR ${error instanceof Error ? error.message : error}`)
  }
  console.log(lineas.join('\n'))
}

// ------------------------------------------------------------------ informe
const pct = (a: number, b: number) => (b ? `${a}/${b} (${Math.round((a / b) * 100)} %)` : '—')
const etapas: EtapaPipeline[] = [
  'previa',
  'mascaraPrevia',
  'reescalar',
  'mascara',
  'prefiltro',
  'cuantizar',
  'limpiar',
  'contornos',
]

const md: string[] = ['# Resultados F0.8 (generado por spikes/05-pipeline/correr.ts)', '']
md.push('## Tasa de éxito "a la primera" por resolución', '')
md.push(
  '| mm/px | Logos + dibujos | Stickers | Horribles | Todo el banco | Tiempo mediano (ms) |',
  '|---|---|---|---|---|---|',
)
for (const f of exito) {
  const de = (cats: string[]) => f.evaluaciones.filter((e) => cats.includes(e.categoria))
  const ok = (xs: Evaluacion[]) => pct(xs.filter((e) => e.exito).length, xs.length)
  const totales = f.tiempos
    .map((t) => etapas.reduce((s, k) => s + (t[k] ?? 0), 0))
    .sort((a, b) => a - b)
  md.push(
    `| ${f.mmPorPixel.toFixed(2)} | ${ok(de(['logo', 'dibujo']))} | ${ok(de(['sticker']))} | ${ok(de(['horrible']))} | ${ok(f.evaluaciones)} | ${(totales[totales.length >> 1] ?? 0).toFixed(0)} |`,
  )
}

md.push(
  '',
  `## Desviación de contorno contra la referencia a ${REFERENCIA} mm/px (sin RDP, en mm)`,
  '',
)
md.push(
  `Regla del plan: se elige el valor más grueso cuya desviación **máxima** quede por debajo de la tolerancia de RDP (${TOLERANCIA_RDP_MM} mm).`,
  '',
)
md.push(
  `| Imagen | ${RESOLUCIONES.map((r) => `${r.toFixed(2)} máx · p95`).join(' | ')} |`,
  `|---|${RESOLUCIONES.map(() => '---').join('|')}|`,
)
for (const d of desviaciones) {
  md.push(
    `| ${d.id} | ${RESOLUCIONES.map((r) => {
      const v = d.porResolucion[r.toFixed(2)]
      return v ? `${v.maxima.toFixed(3)} · ${v.p95.toFixed(3)}` : '—'
    }).join(' | ')} |`,
  )
}
const peorPorResolucion = RESOLUCIONES.map((r) => {
  const validas = desviaciones
    .filter((d) => d.expectativa === 'deberia-andar')
    .map((d) => d.porResolucion[r.toFixed(2)])
    .filter(Boolean)
  return {
    r,
    maxima: Math.max(...validas.map((v) => v!.maxima)),
    p95: Math.max(...validas.map((v) => v!.p95)),
  }
})
md.push(
  `| **peor (sin debilidades conocidas)** | ${peorPorResolucion.map((p) => `**${p.maxima.toFixed(3)} · ${p.p95.toFixed(3)}**`).join(' | ')} |`,
)

md.push('', `## Tiempos por etapa a ${MM_POR_PIXEL} mm/px (ms, mediana del banco, esta PC)`, '')
const filaElegida = exito.find((f) => f.mmPorPixel === MM_POR_PIXEL)!
md.push(`| ${etapas.join(' | ')} | total |`, `|${etapas.map(() => '---').join('|')}|---|`)
const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1] ?? 0
const medianas = etapas.map((k) => mediana(filaElegida.tiempos.map((t) => t[k] ?? 0)))
md.push(
  `| ${medianas.map((m) => m.toFixed(0)).join(' | ')} | ${medianas.reduce((a, b) => a + b, 0).toFixed(0)} |`,
)

md.push('', `## Detalle a ${MM_POR_PIXEL} mm/px`, '')
for (const ev of filaElegida.evaluaciones) {
  md.push(
    `- **${ev.id}** (${ev.expectativa}): ${ev.exito ? '✅' : '❌'} IoU ${ev.iou.toFixed(3)} · ${ev.coloresObtenidos}/${ev.coloresEsperados} colores${ev.motivos.length ? ` · ${ev.motivos.join(' · ')}` : ''}`,
  )
}

const esperados = Object.fromEntries(
  filaElegida.evaluaciones.map((ev) => [
    ev.id,
    {
      exito: ev.exito,
      iou: Number(ev.iou.toFixed(4)),
      colores: ev.colores.map((col) => ({
        hex: col.obtenido,
        areaMm2: Number(col.areaObtenidaMm2.toFixed(2)),
      })),
      motivos: ev.motivos,
    },
  ]),
)
writeFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../tests/banco/esperados.json'),
  `${JSON.stringify({ mmPorPixel: MM_POR_PIXEL, generado: 'spikes/05-pipeline/correr.ts', imagenes: esperados }, null, 2)}
`,
)
writeFileSync(join(SALIDA, 'informe.md'), `${md.join('\n')}\n`)
writeFileSync(join(SALIDA, 'resultados.json'), JSON.stringify({ exito, desviaciones }, null, 2))
console.log(`\n${md.join('\n')}`)
