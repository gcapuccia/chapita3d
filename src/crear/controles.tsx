// Piezas de formulario compartidas por las solapas. `data-control` marca cada control visible para
// el presupuesto de controles del plan (§7.8).

import type { ReactNode } from 'react'

export function Grupo({
  titulo,
  children,
  avanzado,
}: {
  titulo: string
  children: ReactNode
  avanzado?: boolean
}) {
  return (
    <fieldset data-control={avanzado ? undefined : ''} className="flex flex-col gap-2">
      <legend className="mb-1 text-xs font-semibold tracking-wide text-tenue uppercase">
        {titulo}
      </legend>
      {children}
    </fieldset>
  )
}

export function Opciones<T extends string | number>({
  nombre,
  valor,
  opciones,
  alCambiar,
}: {
  nombre: string
  valor: T
  opciones: { valor: T; etiqueta: ReactNode; detalle?: ReactNode }[]
  alCambiar: (v: T) => void
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {opciones.map((o) => (
        <label
          key={String(o.valor)}
          className={`flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            o.valor === valor
              ? 'border-lima bg-lima text-carbon'
              : 'border-borde-fuerte bg-grafito hover:border-tiza'
          }`}
        >
          <input
            type="radio"
            name={nombre}
            className="sr-only"
            checked={o.valor === valor}
            onChange={() => alCambiar(o.valor)}
          />
          <span>{o.etiqueta}</span>
          {o.detalle && (
            <span className={`text-xs ${o.valor === valor ? 'text-carbon/70' : 'text-tenue'}`}>
              {o.detalle}
            </span>
          )}
        </label>
      ))}
    </div>
  )
}

export function BotonPrimario({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${className} min-h-11 rounded-lg bg-lima px-5 font-semibold text-carbon transition-colors hover:bg-lima-claro disabled:opacity-40`}
    >
      {children}
    </button>
  )
}

export function BotonSecundario({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-lg px-4 text-tiza-suave underline-offset-4 hover:text-tiza hover:underline"
    >
      {children}
    </button>
  )
}
