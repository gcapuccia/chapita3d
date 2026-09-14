// El resultado del recorte: el dibujo con sus colores sobre un damero que marca el fondo.

import { useEffect, useRef } from 'react'
import type { Conversion } from '../estado/documento.ts'

export default function VistaMascara({
  conversion,
  className,
}: {
  conversion: Conversion
  className?: string
}) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = lienzo.current
    const { ancho, alto, etiquetas } = conversion.diagnostico
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    c.width = ancho
    c.height = alto
    const img = ctx.createImageData(ancho, alto)
    const colores = conversion.paleta.map((p) => {
      const n = Number.parseInt(p.hex.slice(1), 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
    })
    for (let i = 0; i < etiquetas.length; i++) {
      const color = colores[etiquetas[i]!]
      if (color) img.data.set([color[0], color[1], color[2], 255], i * 4)
    }
    ctx.putImageData(img, 0, 0)
  }, [conversion])
  return (
    <canvas
      ref={lienzo}
      className={`bg-[repeating-conic-gradient(#e7e5e4_0_25%,#fafaf9_0_50%)] bg-[length:20px_20px] object-contain ${className ?? ''}`}
    />
  )
}
