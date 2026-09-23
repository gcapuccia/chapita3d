// El ZIP del sello: la pieza entera para imprimir, cada mitad por separado y los pasos escritos.
// Mas simple que el de los llaveros: acá no hay colores ni cambios de filamento.

import { zipSync, strToU8 } from 'fflate'
import { escribirStl } from './stl.ts'
import type { PiezaExport } from './tipos.ts'
import type { AvisoSello } from '../sellos/placas.ts'

export type ResultadoSello = {
  entero: PiezaExport
  macho: PiezaExport
  hembra: PiezaExport
  medidas: [number, number, number]
  logoMm: [number, number]
  /** Lo que conviene avisar antes de imprimir. El texto lo pone la pantalla. */
  avisos: AvisoSello[]
}

const mm = (n: number) => n.toFixed(1).replace('.', ',')

export function instruccionesDelSello(r: ResultadoSello, holgura: number, fecha: string): string {
  const [x, y, z] = r.medidas
  return [
    'SELLO PARA GOFRAR · Chapita3d',
    `Generado el ${fecha}`,
    '',
    `Medidas, abierto y plano: ${mm(x)} × ${mm(y)} × ${mm(z)} mm`,
    `Logo: ${mm(r.logoMm[0])} × ${mm(r.logoMm[1])} mm`,
    '',
    'CÓMO IMPRIMIRLO',
    '1. Abrí sello.stl con tu programa. Va apoyado como viene, abierto y plano.',
    '2. Sin soportes. La bisagra ya viene armada y gira sola cuando termina.',
    '3. Altura de capa 0,2 mm y 3 perímetros andan bien. Relleno 15 % o más.',
    '4. Cuando termine, movelo despacio la primera vez para soltar la bisagra.',
    '',
    'CÓMO USARLO',
    'Cerralo como un libro con el papel en el medio y apretá parejo.',
    'Si el papel es grueso, humedecelo apenas antes.',
    '',
    `La bisagra está hecha con ${mm(holgura)} mm de aire entre sus partes.`,
    'Si sale dura, subí ese número; si queda floja, bajalo.',
    '',
  ].join('\n')
}

export function empaquetarSello(
  r: ResultadoSello,
  nombre: string,
  holgura: number,
  fecha: string,
): { zip: Uint8Array; nombreZip: string; archivos: string[] } {
  const limpio = (nombre || 'sello')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const archivos: Record<string, Uint8Array> = {
    'sello.stl': escribirStl(r.entero),
    'partes/macho.stl': escribirStl(r.macho),
    'partes/hembra.stl': escribirStl(r.hembra),
    'INSTRUCCIONES.txt': strToU8(instruccionesDelSello(r, holgura, fecha)),
  }
  return {
    zip: zipSync(archivos, { level: 6 }),
    nombreZip: `sello-${limpio || 'sello'}.zip`,
    archivos: Object.keys(archivos),
  }
}
