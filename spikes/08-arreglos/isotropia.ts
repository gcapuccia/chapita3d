// Spike 08 · Isotropia del umbral de "fino" y ancho real de las lineas engrosadas.
//
//   node spikes/08-arreglos/isotropia.ts
//
// A) Mascara binaria a 0,1 mm/px (sin pipeline): barra de ancho w rasterizada con cobertura >= 0,5 a
//    0°, 20°, 45° y dos fases; ancho minimo que sobrevive a la apertura (r = 4 px) con cada criterio.
// B) Pipeline completo como spikes/07-casos-reales/umbral.ts (dibujo a 50 mm, caja de 1000 px): % que
//    sobrevive y ANCHO DE SALIDA en mm, hoy contra engrosar.

import { convertir, paramsPorDefecto } from '../../src/pipeline/index.ts'
import { FONDO } from '../../src/pipeline/tipos.ts'
import {
  renderizarReal,
  salidaEnFuente,
  trazo,
  type EscenaReal,
} from '../07-casos-reales/escenas.ts'
import { aperturaV2, type UmbralFino } from './morfologia2.ts'
import { convertirV2, SIN_ARREGLOS, type Arreglos } from './pipeline2.ts'

const ANGULOS = [0, 20, 45]
const FASES = [0, 0.5]

// ------------------------------------------------------------------ A
console.log('## A · Mascara binaria a 0,1 mm/px, apertura con r = 4 px (0,8 mm)\n')
console.log('Ancho minimo (mm) que sobrevive (> 50 % de la barra):\n')
console.log(
  `| criterio | ${ANGULOS.flatMap((a) => FASES.map((f) => `${a}° f${f}`)).join(' | ')} | rango |`,
)
console.log(`|---|${ANGULOS.flatMap(() => FASES.map(() => '---')).join('|')}|---|`)
const N = 120
for (const u of ['hoy', 'mayorIgual', 'medioPx'] as UmbralFino[]) {
  const celdas: number[] = []
  for (const ang of ANGULOS)
    for (const fase of FASES) {
      let umbral = NaN
      for (let w10 = 40; w10 <= 110; w10 += 2.5) {
        const w = w10 / 10 // px
        const t = (ang * Math.PI) / 180
        const [nx, ny] = [-Math.sin(t), Math.cos(t)]
        const cx = N / 2 + fase
        const cy = N / 2 + fase * 0.7
        const m = new Uint8Array(N * N)
        let dentro = 0
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++) {
            let cob = 0
            for (let sy = 0; sy < 4; sy++)
              for (let sx = 0; sx < 4; sx++) {
                const px = x + (sx + 0.5) / 4 - cx
                const py = y + (sy + 0.5) / 4 - cy
                const along = px * Math.cos(t) + py * Math.sin(t)
                if (Math.abs(px * nx + py * ny) <= w / 2 && Math.abs(along) <= 45) cob++
              }
            if (cob >= 8) {
              m[y * N + x] = 1
              dentro++
            }
          }
        const ab = aperturaV2(m, N, N, 4, u)
        const quedan = ab.reduce((s, v) => s + v, 0)
        if (quedan > dentro * 0.5) {
          umbral = w / 10
          break
        }
      }
      celdas.push(umbral)
    }
  const ok = celdas.filter(Number.isFinite)
  console.log(
    `| ${u} | ${celdas.map((c) => c.toFixed(2)).join(' | ')} | ${(Math.max(...ok) - Math.min(...ok)).toFixed(2)} |`,
  )
}

// ------------------------------------------------------------------ B
const ANCHOS_MM = [0.3, 0.5, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0, 1.2]
const CONFIGS: { nombre: string; a: Arreglos | null }[] = [
  { nombre: 'hoy', a: null },
  {
    nombre: 'engrosar-0.8',
    a: {
      ...SIN_ARREGLOS,
      grosorMinimoLineasMm: 0.8,
      guardaHalo: true,
      interiorConservaTrazos: true,
    },
  },
  {
    nombre: 'engrosar-0.8-medioPx',
    a: {
      ...SIN_ARREGLOS,
      grosorMinimoLineasMm: 0.8,
      guardaHalo: true,
      interiorConservaTrazos: true,
      umbralFino: 'medioPx',
    },
  },
]
console.log('\n## B · Pipeline completo (Dibujo, 50 mm): % que sobrevive / ancho de salida en mm\n')
for (const cfg of CONFIGS) {
  console.log(`### ${cfg.nombre}\n`)
  console.log(
    `| ancho (mm) | ${ANGULOS.flatMap((a) => FASES.map((f) => `${a}° f${f}`)).join(' | ')} |`,
  )
  console.log(`|---|${ANGULOS.flatMap(() => FASES.map(() => '---')).join('|')}|`)
  const tiempos: number[] = []
  for (const mm of ANCHOS_MM) {
    const celdas: string[] = []
    for (const ang of ANGULOS)
      for (const fase of FASES) {
        const w = mm * 20
        const t = (ang * Math.PI) / 180
        const cx = 500 + fase * 10
        const cy = 500 + fase * 7
        const L = 380
        const e: EscenaReal = {
          id: `iso-${mm}-${ang}-${fase}`,
          categoria: 'calibracion',
          descripcion: '',
          aisla: '',
          ancho: 1000,
          alto: 1000,
          fondo: { tipo: 'solido', hex: '#FFFFFF' },
          colores: ['#222222'],
          elementos: [
            {
              id: 'barra',
              descripcion: '',
              hex: '#222222',
              etiqueta: 0,
              anchoPx: w,
              contornos: trazo(
                [
                  [cx - L * Math.cos(t), cy - L * Math.sin(t)],
                  [cx + L * Math.cos(t), cy + L * Math.sin(t)],
                ],
                w,
              ),
            },
            {
              id: 'marco',
              descripcion: '',
              hex: '#222222',
              etiqueta: 0,
              anchoPx: 40,
              contornos: [
                [
                  [0, 0],
                  [40, 0],
                  [40, 40],
                  [0, 40],
                ],
                [
                  [960, 960],
                  [1000, 960],
                  [1000, 1000],
                  [960, 1000],
                ],
              ],
            },
          ],
        }
        const v = renderizarReal(e)
        const t0 = performance.now()
        const d = (
          cfg.a
            ? convertirV2(v.imagen, paramsPorDefecto('dibujo'), cfg.a)
            : convertir(v.imagen, paramsPorDefecto('dibujo'))
        ).diagnostico
        tiempos.push(performance.now() - t0)
        const s = salidaEnFuente(d.etiquetas, d.ancho, d.alto, d.recorte, 1000, 1000)
        let n = 0
        let k = 0
        let area = 0
        for (let y = 0; y < 1000; y++)
          for (let x = 0; x < 1000; x++) {
            const i = y * 1000 + x
            if (v.elementos[i] === 0) {
              n++
              if (s[i] !== FONDO) k++
            }
            if (s[i] === FONDO) continue
            const px = x + 0.5 - cx
            const py = y + 0.5 - cy
            const along = px * Math.cos(t) + py * Math.sin(t)
            const perp = -px * Math.sin(t) + py * Math.cos(t)
            if (Math.abs(along) <= L - 40 && Math.abs(perp) <= 30) area++
          }
        const anchoMm = (area / (2 * (L - 40))) * 0.05
        celdas.push(`${Math.round((100 * k) / n)} % / ${anchoMm.toFixed(2)}`)
      }
    console.log(`| ${String(mm).replace('.', ',')} | ${celdas.join(' | ')} |`)
  }
  tiempos.sort((a, b) => a - b)
  console.log(`\nTiempo mediano por imagen: ${Math.round(tiempos[tiempos.length >> 1]!)} ms\n`)
}
