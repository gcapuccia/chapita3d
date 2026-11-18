// Pasar un diseño de argolla a iman de heladera, o al reves. Lo usan los dos editores.

import * as D from '../pipeline/defaults.ts'
import type { Diseno } from './tipos.ts'

/** El iman va sin argolla: atras no hay donde colgarlo. Al volver, se borra la medida. */
export function conIman(d: Diseno, iman: boolean): Diseno {
  if (iman) {
    return {
      ...d,
      argolla: { ...d.argolla, tipo: 'sin' },
      iman: d.iman ?? { ...D.IMAN_POR_DEFECTO },
    }
  }
  return { ...d, iman: undefined } // JSON.stringify no guarda las claves undefined
}
