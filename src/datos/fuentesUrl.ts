// URLs de las fuentes para el navegador (Vite las emite como assets). Separado de fuentes.ts porque
// los imports con ?url solo existen en el bundler: Node y los tests leen los archivos directo.

import gruesa from '@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff?url'
import redonda from '@fontsource/nunito/files/nunito-latin-800-normal.woff?url'
import manuscrita from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url'
import type { IdFuente } from './fuentes.ts'

export const URL_FUENTE: Record<IdFuente, string> = { redonda, gruesa, manuscrita }
