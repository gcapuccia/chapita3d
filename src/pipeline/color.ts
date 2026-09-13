// Conversion sRGB <-> OKLab. Formulas publicas de Bjorn Ottosson (bottosson.github.io/posts/oklab).
// Escritas a mano en vez de usar culori: culori crea un objeto por pixel y en 250.000 pixeles
// se nota. culori queda para ΔE2000, que se usa solo sobre los N centroides.

import { differenceCiede2000 } from 'culori'
import type { Oklab } from './tipos.ts'

const LINEAL = new Float32Array(256)
for (let i = 0; i < 256; i++) {
  const c = i / 255
  LINEAL[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Escribe L, a, b del pixel (r, g, b en 0..255) en destino[o], destino[o+1], destino[o+2]. */
export function rgbAOklab(r: number, g: number, b: number, destino: Float32Array, o: number): void {
  const lr = LINEAL[r]!
  const lg = LINEAL[g]!
  const lb = LINEAL[b]!
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  destino[o] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  destino[o + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  destino[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
}

const aSrgb = (c: number) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}

export function oklabARgb([L, a, b]: Oklab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    aSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    aSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    aSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

export const rgbAHex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`

export function hexARgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const ciede2000 = differenceCiede2000()

/** ΔE2000 entre dos colores "#RRGGBB". < 1 imperceptible · < 5 "casi el mismo filamento". */
export function deltaE2000(hexA: string, hexB: string): number {
  const [ar, ag, ab] = hexARgb(hexA)
  const [br, bg, bb] = hexARgb(hexB)
  return ciede2000(
    { mode: 'rgb', r: ar / 255, g: ag / 255, b: ab / 255 },
    { mode: 'rgb', r: br / 255, g: bg / 255, b: bb / 255 },
  )
}
