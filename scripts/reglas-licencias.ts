// Reglas de licencias del proyecto. Unica fuente de verdad para las dos capas:
//  1. scripts/chequear-licencias.ts   -> arbol INSTALADO de dependencias de produccion
//  2. scripts/vite-plugin-licencias.ts -> lo que REALMENTE entra al bundle publicado
//
// Criterio: el codigo que se publica en la web se DISTRIBUYE, asi que una licencia
// copyleft (GPL/AGPL/LGPL) contaminaria el proyecto. Ver docs/research/audit-03 §1.

/** Licencias SPDX permitidas en codigo que se publica. */
export const LICENCIAS_PERMITIDAS = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'BSL-1.0',
  '0BSD',
  'Unlicense',
  'CC0-1.0',
  // Permisiva (OSI). No estaba en la lista del plan: aparecio con pako, dependencia comun de compresion.
  'Zlib',
])

/**
 * Licencias permitidas SOLO para ciertos paquetes. OFL-1.1 es de fuentes: permite usarlas y
 * distribuirlas con el software (con su aviso, que va en LICENSES.txt), pero no se habilita para codigo.
 */
export const LICENCIAS_POR_PAQUETE: Record<string, string[]> = {
  '@fontsource/*': ['OFL-1.1'],
}

/**
 * Paquetes prohibidos por NOMBRE, sin importar lo que declaren.
 * Existe porque el campo SPDX miente o no alcanza: @imgly/background-removal
 * declara "SEE LICENSE IN LICENSE.md" y adentro es AGPL-3.0 (audit-03 §1.4).
 */
export const LISTA_NEGRA: Record<string, string> = {
  '@imgly/*': 'AGPL-3.0, escondida detras de "SEE LICENSE IN" (audit-03 §1.4)',
  potrace: 'GPL-2.0 (doc 01 §1.4)',
  'esm-potrace-wasm': 'GPL-2.0, puerto de potrace (doc 01 §1.4)',
  marchingsquares: 'AGPL-3.0: usar d3-contour, que es ISC (doc 01 §1.4)',
  'openscad-wasm': 'GPL (doc 01 §1.4)',
  heic2any: 'arrastra libheif, LGPL (audit-03)',
  'libheif-js': 'LGPL-3.0 (audit-03)',
  'libheif-web': 'LGPL-3.0 (audit-03)',
}

/**
 * Paquetes con licencia no permitida que estan INSTALADOS pero que se sabe que
 * NO entran al bundle. Cada uno necesita el motivo por escrito. La capa 2 (el
 * plugin de build) rompe si alguno llega a aparecer en el bundle, asi que una
 * excepcion nunca puede colarse en lo que se publica.
 */
export const EXCEPCIONES: Record<string, string> = {
  '@img/sharp-*':
    'binario nativo de libvips (LGPL-3.0) que trae sharp <- ndarray-pixels <- ' +
    '@gltf-transform/functions <- manifold-3d. Solo lo usa la CLI manifold-cad; ' +
    'el WASM que importamos no lo toca.',
}

/** Un patron terminado en "*" es un prefijo ("@imgly/*", "@img/sharp-*"); si no, nombre exacto. */
function coincide(nombre: string, patron: string): boolean {
  return patron.endsWith('*') ? nombre.startsWith(patron.slice(0, -1)) : nombre === patron
}

/** Devuelve el motivo si el paquete esta en la lista negra, o null. */
export function motivoListaNegra(nombre: string): string | null {
  for (const [patron, motivo] of Object.entries(LISTA_NEGRA)) {
    if (coincide(nombre, patron)) return motivo
  }
  return null
}

/** Devuelve el motivo si el paquete tiene una excepcion registrada, o null. */
export function motivoExcepcion(nombre: string): string | null {
  for (const [patron, motivo] of Object.entries(EXCEPCIONES)) {
    if (coincide(nombre, patron)) return motivo
  }
  return null
}

/**
 * Evalua una expresion SPDX con su semantica real:
 *  - "A OR B": se puede elegir, alcanza con que UNA este permitida.
 *  - "A AND B": se aplican las dos, TODAS tienen que estar permitidas.
 * Cualquier cosa que no sea SPDX ("UNKNOWN", "Custom", "SEE LICENSE IN ...") es no.
 */
export function licenciaPermitida(expresion: string | undefined | null, nombre?: string): boolean {
  if (!expresion) return false
  const extra = nombre
    ? (Object.entries(LICENCIAS_POR_PAQUETE).find(([patron]) => coincide(nombre, patron))?.[1] ??
      [])
    : []
  const limpia = expresion.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
  if (/SEE LICENSE IN|UNKNOWN|UNLICENSED|Custom/i.test(limpia)) return false
  return limpia
    .split(/ OR /)
    .some((alternativa) =>
      alternativa
        .split(/ AND /)
        .every((parte) => LICENCIAS_PERMITIDAS.has(parte.trim()) || extra.includes(parte.trim())),
    )
}

/** Normaliza los formatos historicos del campo license de package.json. */
export function licenciaDePackageJson(pkg: {
  license?: unknown
  licenses?: unknown
}): string | undefined {
  const { license, licenses } = pkg
  if (typeof license === 'string') return license
  if (license && typeof license === 'object' && 'type' in license) {
    return String((license as { type: unknown }).type)
  }
  if (Array.isArray(licenses)) {
    return licenses
      .map((l) => (typeof l === 'string' ? l : String((l as { type?: unknown }).type)))
      .join(' OR ')
  }
  return undefined
}
