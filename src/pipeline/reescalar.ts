// Reescalado de la imagen, en TS puro (el pipeline no toca el DOM, plan §5.3).
// Trabaja con alfa premultiplicado: sin eso, el color del fondo transparente se mezcla con
// los bordes del dibujo y aparece un halo que despues k-means toma como un color mas.

import type { ImagenRGBA, Recorte } from './tipos.ts'

/**
 * Lleva `recorte` de la fuente a ancho × alto pixeles.
 * Achicar: promedio por area (cada pixel destino integra todos los pixeles fuente que cubre).
 * Agrandar: bilineal. El promedio por area es el que no genera aliasing en logos con lineas finas.
 */
export function reescalar(
  fuente: ImagenRGBA,
  recorte: Recorte,
  ancho: number,
  alto: number,
): ImagenRGBA {
  const escalaX = recorte.ancho / ancho
  const escalaY = recorte.alto / alto
  const destino = new Uint8ClampedArray(ancho * alto * 4)
  const f = fuente.pixeles
  const acumulado = new Float64Array(4)

  const muestrear = (sx: number, sy: number, peso: number) => {
    const x = Math.min(fuente.ancho - 1, Math.max(0, sx))
    const y = Math.min(fuente.alto - 1, Math.max(0, sy))
    const o = (y * fuente.ancho + x) * 4
    const a = (f[o + 3]! / 255) * peso
    acumulado[0]! += f[o]! * a
    acumulado[1]! += f[o + 1]! * a
    acumulado[2]! += f[o + 2]! * a
    acumulado[3]! += a
  }

  for (let dy = 0; dy < alto; dy++) {
    for (let dx = 0; dx < ancho; dx++) {
      acumulado.fill(0)
      let pesoTotal = 0
      if (escalaX >= 1 && escalaY >= 1) {
        // Promedio por area, con cobertura fraccional en los bordes de cada pixel destino
        const x0 = recorte.x + dx * escalaX
        const x1 = x0 + escalaX
        const y0 = recorte.y + dy * escalaY
        const y1 = y0 + escalaY
        for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
          const py = Math.min(y1, sy + 1) - Math.max(y0, sy)
          for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
            const peso = (Math.min(x1, sx + 1) - Math.max(x0, sx)) * py
            muestrear(sx, sy, peso)
            pesoTotal += peso
          }
        }
      } else {
        const sx = recorte.x + (dx + 0.5) * escalaX - 0.5
        const sy = recorte.y + (dy + 0.5) * escalaY - 0.5
        const ix = Math.floor(sx)
        const iy = Math.floor(sy)
        const tx = sx - ix
        const ty = sy - iy
        muestrear(ix, iy, (1 - tx) * (1 - ty))
        muestrear(ix + 1, iy, tx * (1 - ty))
        muestrear(ix, iy + 1, (1 - tx) * ty)
        muestrear(ix + 1, iy + 1, tx * ty)
        pesoTotal = 1
      }
      const o = (dy * ancho + dx) * 4
      const alfa = acumulado[3]!
      if (alfa > 0) {
        destino[o] = acumulado[0]! / alfa
        destino[o + 1] = acumulado[1]! / alfa
        destino[o + 2] = acumulado[2]! / alfa
      }
      destino[o + 3] = (alfa / pesoTotal) * 255
    }
  }
  return { ancho, alto, pixeles: destino }
}

/** Tamaño que entra en un lado maximo, conservando la proporcion. */
export function tamanoConTope(ancho: number, alto: number, ladoMax: number) {
  const escala = Math.min(1, ladoMax / Math.max(ancho, alto))
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  }
}
