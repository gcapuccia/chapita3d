// Las apps de la casa. Sumar una es agregarla aca y crear su carpeta de paginas: el marco
// (marca, conmutador, cuenta) no cambia (diseño, turno 7b).

import { es } from '../i18n/es.ts'
import type { Ruta } from '../ruta.ts'

export type App = {
  id: string
  nombre: string
  /** Sin ruta todavia = se muestra como "pronto". */
  ruta?: Ruta
}

export const APPS: App[] = [
  { id: 'llaveros', nombre: es.marco.llaveros, ruta: '/llaveros/crear' },
  { id: 'nombres', nombre: es.marco.nombres, ruta: '/nombres/crear' },
  { id: 'vector', nombre: es.marco.vector, ruta: '/vector/crear' },
  { id: 'sellos', nombre: es.marco.sellos, ruta: '/sellos/crear' },
  { id: 'cortantes', nombre: es.marco.cortantes, ruta: '/cortantes/crear' },
  { id: 'calculadora', nombre: es.marco.calculadora, ruta: '/calculadora' },
]
