// Un campo numérico de la calculadora: etiqueta, número y su ayuda.
// Acepta coma o punto, no deja pasar negativos y trata el vacío como cero.

import { useId } from 'react'
import { aNumero } from './formulas.ts'

export default function Campo({
  etiqueta,
  valor,
  alCambiar,
  ayuda,
  vacioSiCero = false,
  max,
}: {
  etiqueta: string
  valor: number
  alCambiar: (n: number) => void
  ayuda?: string
  /** Los campos de la pieza arrancan vacíos, no en 0. */
  vacioSiCero?: boolean
  max?: number
}) {
  const id = useId()
  const texto = valor === 0 && vacioSiCero ? '' : String(valor).replace('.', ',')
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-tiza-suave">
        {etiqueta}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={texto}
        onChange={(e) => {
          const n = aNumero(e.target.value)
          alCambiar(max !== undefined ? Math.min(n, max) : n)
        }}
        className="min-h-11 rounded-lg border border-borde-fuerte bg-grafito px-3 text-tiza tabular-nums focus:border-lima focus:outline-none"
      />
      {ayuda && <p className="text-xs leading-relaxed text-tenue">{ayuda}</p>}
    </div>
  )
}
