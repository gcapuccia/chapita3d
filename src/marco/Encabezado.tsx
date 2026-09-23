// El marco que comparten todas las apps de Chapita3d (diseño, turno 7b): la marca a la izquierda,
// el conmutador de apps al lado, lo propio de cada app en el medio y a la derecha.
//
// Cambiar de app no cambia el marco, solo lo del medio. Por eso las direcciones viven abajo de
// /llaveros: sumar la segunda app es agregarla a APPS y una carpeta de paginas.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useCuenta } from '../estado/cuenta.ts'
import { es } from '../i18n/es.ts'
import Isotipo from '../marca/Isotipo.tsx'
import { ir } from '../ruta.ts'
import { APPS } from './apps.ts'

export default function Encabezado({
  appActual = 'llaveros',
  pasos,
  accion,
}: {
  appActual?: string
  /** Los pasos de la app, en el medio. */
  pasos?: ReactNode
  /** El boton principal de la app, a la derecha. */
  accion?: ReactNode
}) {
  const correo = useCuenta((s) => s.correo)
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const afuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', afuera)
    return () => document.removeEventListener('mousedown', afuera)
  }, [abierto])

  const actual = APPS.find((a) => a.id === appActual) ?? APPS[0]!

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-borde bg-grafito px-3 py-2 sm:gap-3 sm:px-4">
      <button
        type="button"
        onClick={() => ir('/')}
        className="flex min-h-11 items-center gap-2 rounded-lg pr-2 font-bold tracking-tight"
      >
        <span aria-hidden className="text-tenue">
          ←
        </span>
        <Isotipo tam={26} />
        <span className="max-sm:hidden">{es.marca}</span>
      </button>

      <span aria-hidden className="h-6 w-px bg-borde max-sm:hidden" />

      <div ref={caja} className="relative">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-bold ${
            abierto ? 'border-lima text-tiza' : 'border-borde text-tiza-suave hover:border-tiza'
          }`}
        >
          {actual.nombre}
          <span aria-hidden className={`text-[11px] ${abierto ? 'text-lima' : 'text-tenue'}`}>
            {abierto ? '▴' : '▾'}
          </span>
        </button>

        {abierto && (
          <ul className="absolute top-full left-0 z-20 mt-1 flex w-64 flex-col gap-0.5 rounded-xl border border-borde bg-grafito p-1.5 shadow-lg">
            {APPS.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={!a.ruta || a.id === appActual}
                  onClick={() => a.ruta && ir(a.ruta)}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] ${
                    a.id === appActual ? 'bg-lima/10 font-bold text-tiza' : 'text-tiza-suave'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`size-2 rounded-full ${a.id === appActual ? 'bg-lima' : 'bg-borde-fuerte'}`}
                  />
                  <span className="flex-1">{a.nombre}</span>
                  {a.id === appActual && (
                    <span className="text-xs text-tenue">{es.marco.acaEstas}</span>
                  )}
                </button>
              </li>
            ))}
            <li className="flex min-h-11 items-center gap-2.5 px-2.5 text-[15px] text-tenue">
              <span aria-hidden className="size-2 rounded-full bg-borde-fuerte" />
              <span className="flex-1">{es.marco.masApps}</span>
              <span className="rounded-full bg-borde px-2 py-0.5 text-[11px] font-bold text-tenue">
                {es.marco.pronto}
              </span>
            </li>
            <li aria-hidden className="my-1 h-px bg-borde" />
            <li>
              <button
                type="button"
                onClick={() => ir(correo ? '/mis-llaveros' : '/')}
                className="flex min-h-11 w-full items-center rounded-lg px-2.5 text-left text-[15px] text-tiza-suave hover:text-tiza"
              >
                {correo ? es.cuenta.misLlaveros : es.cuenta.entrar}
              </button>
            </li>
          </ul>
        )}
      </div>

      {pasos && (
        <nav className="flex flex-1 justify-center gap-1" aria-label={es.marco.pasos}>
          {pasos}
        </nav>
      )}
      {!pasos && <span className="flex-1" />}
      {accion}
    </header>
  )
}
