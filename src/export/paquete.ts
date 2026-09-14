// empaquetar(): el ZIP que baja el usuario (plan §9.1 y §2-bis E2).
//
//   llavero-<nombre>.zip
//   ├─ llavero-<nombre>_bambu-orca.3mf
//   ├─ stl/<slot>_<color>.stl        ← un STL por color, mismo sistema de coordenadas
//   ├─ stl/pieza-entera.stl          ← la pieza fusionada, un solo color
//   ├─ INSTRUCCIONES.txt
//   └─ proyecto.json                 ← para volver a abrirlo

import { strToU8, zipSync } from 'fflate'
import type { Diseno } from '../diseno/tipos.ts'
import type { ResultadoConstruccion } from '../geometria/construir.ts'
import { escribir3mfBambu } from './3mf/bambu.ts'
import { escribirInstrucciones } from './instrucciones.ts'
import { escribirStl } from './stl.ts'

/** "Gatito de María!" → "gatito-de-maria" */
export function slug(texto: string): string {
  const limpio = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return limpio.slice(0, 40) || 'llavero'
}

export type Paquete = { nombreZip: string; zip: Uint8Array; archivos: string[] }

export function empaquetar(d: Diseno, r: ResultadoConstruccion, fecha: string): Paquete {
  if (r.bloqueante) {
    const errores = r.avisos.filter((a) => a.nivel === 'error').map((a) => a.mensaje)
    throw new Error(`No se puede descargar: ${errores.join(' ')}`)
  }
  const base = `llavero-${slug(d.nombre)}`
  const archivo3mf = `${base}_bambu-orca.3mf`

  // A ras: un color por slot declarado (los que sobran van en gris, el archivo describe la impresora).
  // Apilado: un solo filamento; los colores los ponen los cambios de capa.
  const colores =
    r.modoColor === 'a_ras'
      ? Array.from(
          { length: Math.max(d.impresion.slots, ...r.filamentos.map((f) => f.slot)) },
          (_, i) => r.filamentos.find((f) => f.slot === i + 1)?.hex ?? '#808080',
        )
      : [r.filamentos[0]!.hex]

  const contenido: Record<string, Uint8Array> = {
    [archivo3mf]: escribir3mfBambu(r.piezas, {
      nombre: d.nombre,
      colores,
      cambiosDeCapa: r.cambiosDeCapa,
      fecha,
    }),
    'stl/pieza-entera.stl': escribirStl(r.entera),
    'INSTRUCCIONES.txt': strToU8(escribirInstrucciones(d, r, archivo3mf, fecha)),
    'proyecto.json': strToU8(JSON.stringify(d, null, 2)),
  }
  r.piezas.forEach((p, i) => {
    contenido[`stl/${r.modoColor === 'a_ras' ? p.slot : i + 1}_${slug(p.nombre)}.stl`] =
      escribirStl(p)
  })

  return {
    nombreZip: `${base}.zip`,
    zip: zipSync(contenido, { level: 6 }),
    archivos: Object.keys(contenido).sort(),
  }
}
