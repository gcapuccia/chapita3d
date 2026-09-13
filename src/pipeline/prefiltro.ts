// Paso 4 del plan (§3): mediana por canal, solo con vecinos que son dibujo.
// Borra el ruido y los artefactos de JPG sin redondear las esquinas como un desenfoque.
// Usar solo vecinos de la mascara evita que el color del fondo se meta en el borde.

import type { ImagenRGBA } from './tipos.ts'

export function mediana(img: ImagenRGBA, mascara: Uint8Array, radio: number): ImagenRGBA {
  if (radio <= 0) return img
  const { ancho, alto, pixeles } = img
  const salida = new Uint8ClampedArray(pixeles)
  const ventana = new Uint8Array((2 * radio + 1) ** 2)

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      if (mascara[i] !== 1) continue
      for (let c = 0; c < 3; c++) {
        let k = 0
        for (let dy = -radio; dy <= radio; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= alto) continue
          for (let dx = -radio; dx <= radio; dx++) {
            const xx = x + dx
            if (xx < 0 || xx >= ancho) continue
            const j = yy * ancho + xx
            if (mascara[j] !== 1) continue
            // insercion ordenada: ventanas de 9 o 25 valores
            const valor = pixeles[j * 4 + c]!
            let p = k++
            while (p > 0 && ventana[p - 1]! > valor) {
              ventana[p] = ventana[p - 1]!
              p--
            }
            ventana[p] = valor
          }
        }
        salida[i * 4 + c] = ventana[k >> 1]!
      }
    }
  }
  return { ancho, alto, pixeles: salida }
}
