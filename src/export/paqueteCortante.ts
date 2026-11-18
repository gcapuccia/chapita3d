// El ZIP del cortante: cada pieza en su STL y los pasos escritos. Un solo color, como el sello.

import { strToU8, zipSync } from 'fflate'
import type { AvisoCortante, Marcado } from '../cortantes/cortante.ts'
import { escribirStl } from './stl.ts'
import type { PiezaExport } from './tipos.ts'

export type ResultadoCortante = {
  cortante: PiezaExport
  marcador: PiezaExport | null
  /** Cuanto correr el marcador en X para verlo al lado del cortante. */
  alLado: number
  medidas: [number, number, number]
  galletitaMm: [number, number]
  galletita: { forma: [number, number][][]; marcas: [number, number][][] }
  /** El texto lo pone la pantalla. */
  avisos: AvisoCortante[]
}

const mm = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',')

export function instruccionesDelCortante(
  r: ResultadoCortante,
  nombre: string,
  marcado: Marcado,
  fecha: string,
): string {
  const [x, y, z] = r.medidas
  const conMarcador = !!r.marcador
  return [
    `CORTANTE DE GALLETITAS "${nombre}" · Chapita3d`,
    `Generado el ${fecha}`,
    '',
    `Galletita: ${mm(r.galletitaMm[0])} x ${mm(r.galletitaMm[1])} mm`,
    `Cortante: ${mm(x)} x ${mm(y)} x ${mm(z)} mm`,
    conMarcador
      ? `Marcador: ${marcado === 'lineas' ? 'marca las líneas del dibujo' : 'marca los colores elegidos'}`
      : 'Sin marcador',
    '',
    'CÓMO IMPRIMIRLO',
    conMarcador
      ? '1. Abrí cortante.stl y marcador.stl con tu programa. Van apoyados como vienen: el cortante con el reborde abajo y el marcador con el dibujo para arriba.'
      : '1. Abrí cortante.stl con tu programa. Va apoyado como viene, con el reborde abajo.',
    '2. Sin soportes. Altura de capa 0,2 mm.',
    '3. El filo sale solo con perímetros: no hace falta tocar nada. Relleno 15 % para el resto.',
    '',
    'CÓMO USARLO',
    '1. Estirá la masa de 5 a 8 mm de alto.',
    '2. Dá vuelta el cortante: el reborde arriba, para apoyar la mano, y el filo contra la masa. Apretá parejo.',
    ...(conMarcador
      ? [
          '3. Con el cortante todavía puesto, meté el marcador con el dibujo para abajo y apretalo hasta que marque.',
          '4. Sacá el marcador y después el cortante. Si la masa se pega, pasale harina al marcador.',
        ]
      : ['3. Levantalo y empujá la galletita desde arriba con el dedo.']),
    '',
    'El dibujo está espejado a propósito: al darlo vuelta, la galletita sale al derecho.',
    '',
    'CUIDADOS',
    'Imprimilo con un filamento que el fabricante declare apto para contacto con alimentos.',
    'Lavalo a mano con agua tibia y detergente. Nada de lavavajillas ni agua caliente: el PLA se deforma.',
    '',
  ].join('\n')
}

export function empaquetarCortante(
  r: ResultadoCortante,
  nombre: string,
  marcado: Marcado,
  fecha: string,
): { zip: Uint8Array; nombreZip: string; archivos: string[] } {
  const limpio = (nombre || 'cortante')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const archivos: Record<string, Uint8Array> = {
    'cortante.stl': escribirStl(r.cortante),
    ...(r.marcador ? { 'marcador.stl': escribirStl(r.marcador) } : {}),
    'INSTRUCCIONES.txt': strToU8(instruccionesDelCortante(r, nombre, marcado, fecha)),
  }
  return {
    zip: zipSync(archivos, { level: 6 }),
    nombreZip: `cortante-${limpio || 'galletita'}.zip`,
    archivos: Object.keys(archivos),
  }
}
