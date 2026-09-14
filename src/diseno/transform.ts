import type { Transform } from './tipos.ts'

/** Lleva contornos locales de una pieza a coordenadas del llavero: escala, rota (grados) y traslada. */
export function aplicarTransform(
  t: Transform,
  contornos: [number, number][][],
): [number, number][][] {
  const c = Math.cos((t.rotZ * Math.PI) / 180)
  const s = Math.sin((t.rotZ * Math.PI) / 180)
  return contornos.map((anillo) =>
    anillo.map(([px, py]) => {
      const ex = px * t.sx
      const ey = py * t.sy
      return [t.x + ex * c - ey * s, t.y + ex * s + ey * c] as [number, number]
    }),
  )
}
