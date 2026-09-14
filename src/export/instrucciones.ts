// INSTRUCCIONES.txt (plantilla del plan §9.8), adaptado a lo que se entrega hoy:
// el perfil de PrusaSlicer esta pospuesto (§2-bis E3), asi que Prusa usa los STL.

import type { Diseno } from '../diseno/tipos.ts'
import type { ResultadoConstruccion } from '../geometria/construir.ts'
import * as D from '../pipeline/defaults.ts'

const mm = (n: number) => n.toFixed(1)
const g = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toString())

export function escribirInstrucciones(
  d: Diseno,
  r: ResultadoConstruccion,
  archivo3mf: string,
  fecha: string,
): string {
  const l: string[] = []
  l.push(`LLAVERO "${d.nombre}" — generado el ${fecha}`, '')

  l.push('QUÉ ARCHIVO ABRIR')
  l.push(`  Bambu Studio u OrcaSlicer .... ${archivo3mf}`)
  l.push('  PrusaSlicer y otros slicers .. importá los STL de la carpeta stl/')
  l.push('                                 y elegí "cargar como un objeto con varias partes"')
  l.push('  Un solo color o para pintar .. stl/pieza-entera.stl', '')

  if (r.modoColor === 'a_ras') {
    l.push('COLORES (cargalos en estos slots)')
    for (const f of r.filamentos) l.push(`  Slot ${f.slot} .... ${f.nombre.padEnd(10)} ${f.hex}`)
  } else {
    l.push('COLORES (de abajo hacia arriba, un solo extrusor)')
    r.filamentos.forEach((f, i) =>
      l.push(`  ${i === 0 ? 'Empezá con' : `Cambio ${i}  `} .. ${f.nombre.padEnd(10)} ${f.hex}`),
    )
  }
  l.push('')

  l.push('MEDIDAS')
  const agujero = r.agujero ? `  ·  agujero Ø${(r.agujero.radio * 2).toFixed(1)} mm` : ''
  l.push(
    `  ${r.medidas.map(mm).join(' x ')} mm${agujero}  ·  ~${g(r.estimacion.gramosPieza)} g de pieza`,
    '',
  )

  l.push('AJUSTES SUGERIDOS')
  l.push(
    `  Altura de capa ${d.impresion.alturaCapa.toFixed(2)} mm · 3 paredes · 4 capas arriba y abajo`,
  )
  l.push(`  Relleno ${r.medidas[2] <= 3.0001 ? '100%' : '30% o más'}`)
  l.push('  Brim de 5 mm si tiene puntas finas')
  l.push('  PLA para exhibición; PETG o ASA si va a estar al sol o en el auto', '')

  if (r.modoColor === 'a_ras') {
    l.push('PURGA (importante)')
    if (r.estimacion.cambios === 0) {
      l.push('  Es de un solo color: no hay purga.')
    } else {
      l.push('  Cada cambio de color desperdicia filamento en la torre de purga.')
      l.push(
        `  Este modelo tiene ~${r.estimacion.cambios} cambios: ~${g(r.estimacion.gramosPurga)} g de purga para ${g(r.estimacion.gramosPieza)} g de pieza.`,
      )
      l.push('  Imprimí varios llaveros juntos en la misma placa y activá')
      l.push('  "purgar dentro del objeto" o "purgar en el relleno".')
    }
  } else {
    l.push('SI TU IMPRESORA TIENE UN SOLO EXTRUSOR')
    l.push(
      `  Con cambios manuales no hay torre de purga, solo el cebado: ~${g(D.CEBADO_G_POR_CAMBIO)} g por cambio.`,
    )
    r.cambiosDeCapa.forEach((c, i) => {
      const capa = Math.round(c.z / d.impresion.alturaCapa)
      const f = r.filamentos[i + 1]
      l.push(`  Capa ${capa} (Z = ${c.z.toFixed(2)} mm) .... cambiá a ${f?.nombre ?? ''} ${c.hex}`)
    })
    l.push('  El archivo ya trae las pausas. Si tu slicer no las toma, agregalas a mano')
    l.push('  en esas alturas.')
  }
  l.push('')

  l.push('SI BAMBU STUDIO TE PREGUNTA ALGO AL ABRIR')
  l.push('  Elegí cargar solo la geometría: así no te cambia la impresora ni los filamentos.', '')

  const avisos = r.avisos.filter((a) => a.nivel === 'aviso')
  if (avisos.length) {
    l.push('AVISOS')
    for (const a of avisos) l.push(`  - ${a.mensaje}`)
    l.push('')
  }
  return `${l.join('\n')}\n`
}
