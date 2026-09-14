// Umbral real de "detalle fino": una barra sola sobre blanco, a varios anchos, angulos y fases de
// subpixel, con el dibujo llevado a 50 mm (caja de 1000 px = 0,05 mm por pixel de la fuente).
//
//   node spikes/07-casos-reales/umbral.ts
//
// Imprime el % de la barra que sobrevive a convertir() con el preset Dibujo por defecto.

import { convertir, paramsPorDefecto } from '../../src/pipeline/index.ts'
import { FONDO } from '../../src/pipeline/tipos.ts'
import { renderizarReal, salidaEnFuente, trazo, type EscenaReal } from './escenas.ts'

const ANCHOS_MM = [0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0]
const ANGULOS = [0, 20, 45]
const FASES = [0, 0.5]

console.log(
  `| ancho (mm) | ${ANGULOS.flatMap((a) => FASES.map((f) => `${a}° fase ${f}`)).join(' | ')} |`,
)
console.log(`|---|${ANGULOS.flatMap(() => FASES.map(() => '---')).join('|')}|`)
for (const mm of ANCHOS_MM) {
  const celdas: string[] = []
  for (const ang of ANGULOS)
    for (const fase of FASES) {
      const w = mm * 20 // px de la fuente
      const t = (ang * Math.PI) / 180
      const cx = 500 + fase * 10
      const cy = 500 + fase * 7
      const L = 380
      const e: EscenaReal = {
        id: `umbral-${mm}-${ang}-${fase}`,
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
          // Dos cuadrados en esquinas opuestas fijan la caja en 1000 px
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
      const d = convertir(v.imagen, paramsPorDefecto('dibujo')).diagnostico
      const s = salidaEnFuente(d.etiquetas, d.ancho, d.alto, d.recorte, 1000, 1000)
      let n = 0
      let k = 0
      for (let i = 0; i < s.length; i++)
        if (v.elementos[i] === 0) {
          n++
          if (s[i] !== FONDO) k++
        }
      celdas.push(`${Math.round((100 * k) / n)} %`)
    }
  console.log(`| ${String(mm).replace('.', ',')} | ${celdas.join(' | ')} |`)
}
