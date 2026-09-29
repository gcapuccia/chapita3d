// Tipos minimos de opentype.js 2.0, que no trae los suyos. Solo lo que usa src/geometria/texto.ts.
declare module 'opentype.js' {
  export type ComandoRuta =
    | { type: 'M' | 'L'; x: number; y: number }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: 'Z' }

  export interface Ruta {
    commands: ComandoRuta[]
  }

  export interface Glyph {
    advanceWidth?: number
    getPath(x: number, y: number, tamano: number): Ruta
  }

  export interface Font {
    unitsPerEm: number
    /** Alto sobre la linea de base, en unidades de la fuente. */
    ascender: number
    /** Bajo la linea de base: negativo. */
    descender: number
    charToGlyph(caracter: string): Glyph
    getKerningValue(izquierda: Glyph, derecha: Glyph): number
    getPath(
      texto: string,
      x: number,
      y: number,
      tamano: number,
      opciones?: { kerning?: boolean; features?: { script: string; tags: string[] }[] },
    ): Ruta
  }

  export function parse(datos: ArrayBuffer): Font
  const opentype: { parse: typeof parse }
  export default opentype
}
