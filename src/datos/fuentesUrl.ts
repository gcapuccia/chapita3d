// URLs de las fuentes para el navegador (Vite las emite como assets). Separado de fuentes.ts porque
// los imports con ?url solo existen en el bundler: Node y los tests leen los archivos directo.
// Cada .woff se baja recien cuando alguien elige esa fuente, no al abrir la pagina.

import serifa from '@fontsource/alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff?url'
import negra from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff?url'
import bloque from '@fontsource/bungee/files/bungee-latin-400-normal.woff?url'
import clasica from '@fontsource/merriweather/files/merriweather-latin-900-normal.woff?url'
import gruesa from '@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff?url'
import redonda from '@fontsource/nunito/files/nunito-latin-800-normal.woff?url'
import angosta from '@fontsource/oswald/files/oswald-latin-700-normal.woff?url'
import manuscrita from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url'
import type { IdFuente } from './fuentes.ts'

export const URL_FUENTE: Record<IdFuente, string> = {
  redonda,
  gruesa,
  negra,
  angosta,
  serifa,
  bloque,
  clasica,
  manuscrita,
}
