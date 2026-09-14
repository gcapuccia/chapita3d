// Catalogo de fuentes para el texto del llavero. Todas OFL-1.1 (se pueden usar y distribuir en la
// web, incluso con fines comerciales, con su aviso de licencia: va en LICENSES.txt).
// Subset "latin" de @fontsource: cubre a-z, acentos, ñ y ü.

export type IdFuente = 'redonda' | 'gruesa' | 'manuscrita'

export type Fuente = {
  id: IdFuente
  /** Nombre para mostrar. */
  nombre: string
  familia: string
  /** Ruta dentro de node_modules (la usan los tests y los scripts de Node). */
  archivo: string
}

export const FUENTES: Fuente[] = [
  {
    id: 'redonda',
    nombre: 'Redonda',
    familia: 'Nunito ExtraBold',
    archivo: '@fontsource/nunito/files/nunito-latin-800-normal.woff',
  },
  {
    id: 'gruesa',
    nombre: 'Gruesa',
    familia: 'Lilita One',
    archivo: '@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff',
  },
  {
    id: 'manuscrita',
    nombre: 'Manuscrita',
    familia: 'Pacifico',
    archivo: '@fontsource/pacifico/files/pacifico-latin-400-normal.woff',
  },
]

export const FUENTE_POR_DEFECTO: IdFuente = 'redonda'
