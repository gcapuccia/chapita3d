// Landing (plan §4.1): una promesa, una dropzone y tres muestras. Los workers arrancan aca.

import { useEffect, useRef, useState } from 'react'
import {
  abrirProyecto,
  descartarError,
  elegirArchivo,
  useDocumento,
  type ErrorArchivo,
} from '../estado/documento.ts'
import { precalentar } from '../estado/motor.ts'
import { es } from '../i18n/es.ts'
import { ir } from '../ruta.ts'

const MUESTRAS = [
  { archivo: 'logo.png', etiqueta: 'Logo' },
  { archivo: 'dibujo.png', etiqueta: 'Dibujo' },
  { archivo: 'silueta.png', etiqueta: 'Silueta' },
]

function textoDeError(e: ErrorArchivo): string {
  switch (e.codigo) {
    case 'heic':
      return es.errores.heic(e.archivo)
    case 'muy-pesada':
      return es.errores.muyPesada(e.archivo, Number(e.detalle ?? 0))
    case 'formato':
      return es.errores.formato(e.archivo)
    case 'proyecto-invalido':
      return es.errores.proyectoInvalido(e.archivo)
    case 'sin-dibujo':
      return es.errores.sinDibujo
    case 'trabado':
      return es.errores.trabado
  }
}

export default function Inicio() {
  const error = useDocumento((s) => s.error)
  const [arrastrando, setArrastrando] = useState(false)
  const selector = useRef<HTMLInputElement>(null)
  const camara = useRef<HTMLInputElement>(null)

  useEffect(() => {
    precalentar()
    void import('./Crear.tsx')
    void import('./Descargar.tsx')
  }, [])

  const recibir = async (archivo: File | undefined) => {
    if (!archivo) return
    if (archivo.name.toLowerCase().endsWith('.json')) {
      if (await abrirProyecto(archivo)) ir('/crear', 'llavero')
      return
    }
    if (elegirArchivo(archivo)) ir('/crear', 'fondo')
  }

  const probarMuestra = async (nombre: string) => {
    const respuesta = await fetch(`/muestras/${nombre}`)
    const blob = await respuesta.blob()
    await recibir(new File([blob], nombre, { type: blob.type || 'image/png' }))
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <span className="text-lg font-bold tracking-tight">{es.marca}</span>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 pt-6 pb-12 sm:pt-12">
        <section className="flex flex-col gap-2">
          <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
            {es.inicio.promesa}
          </h1>
          <p className="text-lg text-stone-600">{es.inicio.promesaDos}</p>
        </section>

        <section className="flex flex-col gap-3">
          {error && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
            >
              <p>⚠ {textoDeError(error)}</p>
              <button
                type="button"
                onClick={descartarError}
                className="self-end rounded-lg px-3 py-2 text-sm underline underline-offset-4"
              >
                {es.errores.entendido}
              </button>
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setArrastrando(true)
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastrando(false)
              void recibir(e.dataTransfer.files[0])
            }}
            onClick={() => selector.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              arrastrando
                ? 'border-amber-500 bg-amber-50'
                : 'border-stone-300 bg-white hover:border-stone-500'
            }`}
          >
            <span className="text-4xl" aria-hidden>
              ⬆
            </span>
            <p className="hidden font-medium sm:block">
              {arrastrando ? es.inicio.soltar : es.inicio.arrastrar}
            </p>
            <p className="hidden text-sm text-stone-500 sm:block">{es.inicio.formatos}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  camara.current?.click()
                }}
                className="min-h-11 rounded-lg bg-stone-900 px-5 font-semibold text-white sm:hidden"
              >
                {es.inicio.sacarFoto}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  selector.current?.click()
                }}
                className="min-h-11 rounded-lg px-5 font-semibold max-sm:border max-sm:border-stone-300 sm:bg-stone-900 sm:text-white"
              >
                <span className="sm:hidden">{es.inicio.galeria}</span>
                <span className="max-sm:hidden">{es.inicio.elegir}</span>
              </button>
            </div>
            <input
              ref={selector}
              type="file"
              accept="image/png,image/jpeg,image/webp,.json"
              className="hidden"
              onChange={(e) => void recibir(e.target.files?.[0])}
            />
            <input
              ref={camara}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => void recibir(e.target.files?.[0])}
            />
          </div>
          <p className="text-sm text-stone-600">
            <span className="max-sm:hidden">{es.inicio.privacidad}</span>
            <span className="sm:hidden">{es.inicio.privacidadCelular}</span>
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-stone-700">{es.inicio.muestras}</h2>
          <div className="flex gap-3">
            {MUESTRAS.map((m) => (
              <button
                key={m.archivo}
                type="button"
                onClick={() => void probarMuestra(m.archivo)}
                className="flex flex-col items-center gap-1 rounded-xl border border-stone-200 bg-white p-2 text-xs text-stone-600 hover:border-stone-500"
              >
                <img
                  src={`/muestras/${m.archivo}`}
                  alt=""
                  className="size-20 object-contain sm:size-24"
                />
                {m.etiqueta}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3 max-sm:hidden">
          <h2 className="text-sm font-semibold text-stone-700">{es.inicio.consejosTitulo}</h2>
          <ul className="grid grid-cols-3 gap-3 text-sm">
            {es.inicio.consejos.map((c) => (
              <li key={c.texto} className="flex items-start gap-2">
                <span className={c.ok ? 'text-green-700' : 'text-red-700'} aria-hidden>
                  {c.ok ? '✓' : '✗'}
                </span>
                {c.texto}
              </li>
            ))}
          </ul>
        </section>

        <p className="text-sm text-stone-500">{es.inicio.propiedad}</p>
      </main>

      <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-stone-200 px-5 py-4 text-sm text-stone-500">
        {es.pie.enlaces.map((e) => (
          <span key={e}>{e}</span>
        ))}
      </footer>
    </div>
  )
}
