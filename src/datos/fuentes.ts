// Catalogo de fuentes para el texto del llavero y del sello. Todas OFL-1.1 (se pueden usar y
// distribuir en la web, incluso con fines comerciales, con su aviso de licencia: va en LICENSES.txt).
// Subset "latin" de @fontsource: cubre a-z, acentos, ñ y ü.
//
// El orden es el del menu. Primero las de palo, que son las que mejor gofran y mejor imprimen,
// y al final las de mano, que tienen trazos mas finos y suelen disparar el aviso de detalle.

export type IdFuente =
  'redonda' | 'gruesa' | 'negra' | 'angosta' | 'serifa' | 'bloque' | 'clasica' | 'manuscrita'

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
    id: 'negra',
    nombre: 'Negra',
    familia: 'Archivo Black',
    archivo: '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff',
  },
  {
    id: 'angosta',
    nombre: 'Angosta',
    familia: 'Oswald Bold',
    archivo: '@fontsource/oswald/files/oswald-latin-700-normal.woff',
  },
  {
    id: 'serifa',
    nombre: 'Con serifas',
    familia: 'Alfa Slab One',
    archivo: '@fontsource/alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff',
  },
  {
    id: 'bloque',
    nombre: 'De bloque',
    familia: 'Bungee',
    archivo: '@fontsource/bungee/files/bungee-latin-400-normal.woff',
  },
  {
    id: 'clasica',
    nombre: 'Clásica',
    familia: 'Merriweather Black',
    archivo: '@fontsource/merriweather/files/merriweather-latin-900-normal.woff',
  },
  {
    id: 'manuscrita',
    nombre: 'Manuscrita',
    familia: 'Pacifico',
    archivo: '@fontsource/pacifico/files/pacifico-latin-400-normal.woff',
  },
]

export const FUENTE_POR_DEFECTO: IdFuente = 'redonda'
