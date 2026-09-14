// /crear: tres solapas con la vista 3D siempre presente (plan §4, compuerta del layout aprobada en F1).

import { useEffect, useMemo, useState } from 'react'
import FranjaAvisos from '../crear/FranjaAvisos.tsx'
import OverlayProcesando from '../crear/OverlayProcesando.tsx'
import { PanelColores } from '../crear/SolapaColores.tsx'
import { PanelFondo } from '../crear/SolapaFondo.tsx'
import { PanelLlavero } from '../crear/SolapaLlavero.tsx'
import { coloresDePiezas } from '../crear/util.ts'
import Vista3D, { type ModoVista } from '../crear/Vista3D.tsx'
import VistaMascara from '../crear/VistaMascara.tsx'
import { BotonPrimario, BotonSecundario } from '../crear/controles.tsx'
import { useDocumento } from '../estado/documento.ts'
import { es } from '../i18n/es.ts'
import { ir } from '../ruta.ts'

type Solapa = 'fondo' | 'colores' | 'llavero'
const SOLAPAS: Solapa[] = ['fondo', 'colores', 'llavero']

export default function Crear({ hash }: { hash: string }) {
  const { archivo, conversion, diseno, construccion, procesando, construyendo, error } =
    useDocumento()
  const hayImagen = !!conversion
  const solapa: Solapa =
    SOLAPAS.includes(hash as Solapa) && (hayImagen || hash === 'llavero')
      ? (hash as Solapa)
      : hayImagen
        ? 'fondo'
        : 'llavero'
  const [modo, setModo] = useState<ModoVista>('3d')

  // Sin nada que mostrar (se recargo la pagina, o se cancelo): a la landing
  useEffect(() => {
    if (!procesando && !diseno && !error) ir('/')
  }, [procesando, diseno, error])

  const resultado = construccion?.resultado
  const colores = useMemo(() => (resultado ? coloresDePiezas(resultado) : []), [resultado])
  const indice = SOLAPAS.indexOf(solapa)
  const siguiente = () =>
    indice < SOLAPAS.length - 1 ? ir('/crear', SOLAPAS[indice + 1]) : ir('/descargar')

  if (error && !diseno) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          ⚠ {error.codigo === 'sin-dibujo' ? es.errores.sinDibujo : es.errores.trabado}
        </p>
        <BotonPrimario onClick={() => ir('/')}>{es.crear.atras}</BotonPrimario>
      </main>
    )
  }

  const vista3D = resultado && (
    <div className="relative size-full min-h-64">
      <Vista3D piezas={resultado.piezas} colores={colores} modo={modo} />
      {construyendo && (
        <span className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs text-stone-600 shadow-sm">
          {es.crear.actualizando}
        </span>
      )}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-white/90 p-1 shadow-sm">
        {(['arriba', '3d', 'capas'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={`min-h-9 rounded-full px-3 text-xs ${modo === m ? 'bg-stone-900 text-white' : 'text-stone-700'}`}
          >
            {es.crear.vistas[m === '3d' ? 'tresD' : m]}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-svh flex-col">
      {procesando && (
        <OverlayProcesando archivo={archivo} hito={procesando.hito} desde={procesando.desde} />
      )}

      <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-4 py-2">
        <button
          type="button"
          onClick={() => ir('/')}
          className="min-h-11 pr-2 font-bold tracking-tight"
        >
          ← {es.marca}
        </button>
        <nav className="flex flex-1 justify-center gap-1" aria-label="Pasos">
          {SOLAPAS.map((s, i) => {
            const bloqueada = !hayImagen && s !== 'llavero'
            return (
              <button
                key={s}
                type="button"
                disabled={bloqueada}
                onClick={() => ir('/crear', s)}
                aria-current={s === solapa ? 'step' : undefined}
                className={`min-h-11 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap sm:px-3 ${
                  s === solapa ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
                } disabled:opacity-30`}
              >
                {es.crear.solapas[s]}
                {hayImagen && i < indice && ' ✓'}
              </button>
            )
          })}
        </nav>
        <BotonPrimario
          className="max-sm:hidden"
          onClick={() => ir('/descargar')}
          disabled={!resultado || resultado.bloqueante}
        >
          {es.crear.descargar}
        </BotonPrimario>
      </header>

      {!hayImagen && diseno && (
        <p className="bg-stone-100 px-4 py-2 text-center text-sm text-stone-600">
          {es.crear.sinImagen}
        </p>
      )}

      <main className="grid flex-1 grid-rows-[minmax(18rem,45vh)_auto] lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1">
        <section className="relative bg-stone-100">
          {solapa === 'fondo' && conversion ? (
            <div className="grid size-full place-items-center p-4">
              <VistaMascara
                conversion={conversion}
                className="max-h-[42vh] max-w-full lg:max-h-[70vh]"
              />
            </div>
          ) : (
            vista3D
          )}
        </section>

        <aside className="flex flex-col gap-6 border-stone-200 bg-stone-50 p-5 pb-28 lg:border-l lg:pb-5">
          {solapa === 'fondo' && resultado && (
            <div className="h-48 overflow-hidden rounded-xl bg-stone-100 max-lg:hidden">
              {vista3D}
            </div>
          )}
          {solapa === 'fondo' && <PanelFondo />}
          {solapa === 'colores' && <PanelColores />}
          {solapa === 'llavero' && <PanelLlavero />}
          <FranjaAvisos
            avisos={resultado?.avisos ?? []}
            casos={conversion?.diagnostico.casos ?? []}
          />
        </aside>
      </main>

      <footer className="fixed inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-stone-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static">
        {indice > 0 && hayImagen ? (
          <BotonSecundario onClick={() => ir('/crear', SOLAPAS[indice - 1])}>
            {es.crear.atras}
          </BotonSecundario>
        ) : (
          <span />
        )}
        <BotonPrimario
          onClick={siguiente}
          disabled={solapa === 'llavero' && (!resultado || resultado.bloqueante)}
        >
          {solapa === 'fondo'
            ? es.fondo.listo
            : solapa === 'colores'
              ? es.colores.listo
              : es.llavero.listo}{' '}
          →
        </BotonPrimario>
      </footer>
    </div>
  )
}
