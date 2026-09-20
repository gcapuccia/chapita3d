// Landing de Chapita3d (diseño: docs/marca/diseno/Chapita3d.dc.html, turno 1b y 1c).
// Paleta "Modo taller": carbon de fondo, tarjetas grafito, un solo acento lima para lo que se toca.
// La prueba en vivo es la misma dropzone de la app: sin cuenta, sin subir nada a ningun lado.

import { useEffect, useRef, useState } from 'react'
import BloqueCuenta from '../cuenta/BloqueCuenta.tsx'
import Figura from '../marca/Figura.tsx'
import Isotipo, { Marca } from '../marca/Isotipo.tsx'
import {
  abrirProyecto,
  descartarError,
  elegirArchivo,
  useDocumento,
  type ErrorArchivo,
} from '../estado/documento.ts'
import { useCuenta } from '../estado/cuenta.ts'
import { precalentar } from '../estado/motor.ts'
import { es } from '../i18n/es.ts'
import { esLanding as t } from '../i18n/esLanding.ts'
import { ir } from '../ruta.ts'

const MUESTRAS = [
  { archivo: 'logo.png', etiqueta: t.pruebaEnVivo.etiquetas.logo },
  { archivo: 'dibujo.png', etiqueta: t.pruebaEnVivo.etiquetas.dibujo },
  { archivo: 'silueta.png', etiqueta: t.pruebaEnVivo.etiquetas.silueta },
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

const BOTON_LIMA =
  'min-h-13 rounded-2xl bg-lima px-6 text-lg font-extrabold text-carbon transition-colors hover:bg-lima-claro'
const BOTON_BORDE =
  'min-h-12 rounded-2xl border border-borde-fuerte px-6 text-[17px] font-bold text-tiza transition-colors hover:border-tiza'
const BOTON_TIZA =
  'min-h-11 rounded-xl bg-tiza px-5 font-bold text-carbon transition-colors hover:bg-white'
const TITULO_SECCION = 'font-titulo text-[28px] font-normal tracking-[0.01em] sm:text-[38px]'

export default function Inicio() {
  const error = useDocumento((s) => s.error)
  const correo = useCuenta((s) => s.correo)
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

  const alSoltar = (e: React.DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    void recibir(e.dataTransfer.files[0])
  }

  return (
    <div className="min-h-svh bg-carbon text-tiza">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-borde bg-carbon/95 px-4 py-3 backdrop-blur sm:px-8">
        <Marca tam={30} texto="text-[17px] sm:text-[21px]" />
        <nav className="flex items-center gap-3 sm:gap-5">
          <a
            href="#como-funciona"
            className="hidden font-semibold text-tiza-suave hover:text-tiza sm:block"
          >
            {t.barra.comoFunciona}
          </a>
          <a
            href="#preguntas"
            className="hidden font-semibold text-tiza-suave hover:text-tiza sm:block"
          >
            {t.barra.preguntas}
          </a>
          {correo ? (
            <button
              type="button"
              onClick={() => ir('/mis-llaveros')}
              className={`${BOTON_TIZA} text-[15px] sm:text-base`}
            >
              {es.cuenta.misLlaveros}
            </button>
          ) : (
            <>
              <a href="#cuenta" className="min-h-11 content-center font-bold text-tiza">
                {t.barra.entrar}
              </a>
              <a href="#cuenta" className={`${BOTON_TIZA} content-center text-[15px] sm:text-base`}>
                {t.barra.crearCuenta}
              </a>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-[1280px]">
        {/* ------------------------------------------------------------------ hero */}
        <section className="grid items-center gap-8 px-4 pt-8 pb-10 sm:px-8 lg:grid-cols-2 lg:gap-14 lg:pt-16 lg:pb-16">
          <div className="flex flex-col gap-5">
            <h1 className="text-[33px] leading-[1.08] font-black tracking-[-0.03em] text-balance sm:text-[58px] sm:leading-[1.05] sm:tracking-[-0.035em]">
              {t.hero.titulo}
            </h1>
            <p className="max-w-[34ch] text-[17px] leading-[1.45] text-pretty text-tiza-suave sm:text-[21px] sm:leading-[1.5]">
              {t.hero.bajada}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => selector.current?.click()}
                className={BOTON_LIMA}
              >
                {t.hero.principal}
              </button>
              <a href="#cuenta" className={`${BOTON_BORDE} grid place-items-center`}>
                {t.hero.secundario}
              </a>
            </div>
            <p className="text-sm text-tenue">{t.hero.pieDeBotones}</p>
          </div>

          <div className="rounded-3xl border border-borde bg-grafito p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="flex flex-col gap-2.5">
                <span className="text-[11px] font-bold tracking-[0.08em] text-tenue uppercase sm:text-[13px]">
                  {t.hero.antes}
                </span>
                <Figura
                  src="/marca/hero-antes.png"
                  texto="El logo de una tienda, tal como se sube"
                  contain
                  className="h-[150px] w-full sm:h-[280px]"
                />
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-[11px] font-bold tracking-[0.08em] text-lima uppercase sm:text-[13px]">
                  {t.hero.despues}
                </span>
                <Figura
                  src="/marca/hero-despues.png"
                  texto="El mismo logo convertido en llavero"
                  contain
                  className="h-[150px] w-full sm:h-[280px]"
                />
              </div>
            </div>
            <p className="mt-3 px-0.5 text-sm text-tenue">{t.hero.epigrafe}</p>
          </div>
        </section>

        {/* ------------------------------------------------------------------ prueba en vivo */}
        <section className="px-4 pb-14 sm:px-8 lg:pb-18">
          <div className="flex flex-col gap-5 rounded-3xl border border-borde bg-grafito p-5 sm:p-9">
            <div className="flex flex-col gap-1.5">
              <h2 className="font-titulo text-2xl font-normal tracking-[0.01em] sm:text-[32px]">
                {t.pruebaEnVivo.titulo}
              </h2>
              <p className="text-base text-tiza-suave sm:text-lg">{t.pruebaEnVivo.bajada}</p>
            </div>

            {error && (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-amber-100"
              >
                <p>⚠ {textoDeError(error)}</p>
                <button
                  type="button"
                  onClick={descartarError}
                  className="min-h-11 self-end px-3 text-sm underline underline-offset-4"
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
              onDrop={alSoltar}
              onClick={() => selector.current?.click()}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors sm:py-11 ${
                arrastrando ? 'border-lima bg-lima/5' : 'border-borde-fuerte bg-carbon'
              }`}
            >
              <span className="text-[32px] leading-none sm:text-[40px]" aria-hidden>
                ⬆
              </span>
              <p className="hidden text-lg font-bold sm:block">
                {arrastrando ? t.pruebaEnVivo.soltar : t.pruebaEnVivo.arrastrar}
              </p>
              <p className="hidden text-[15px] text-tenue sm:block">{t.pruebaEnVivo.formatos}</p>
              <div className="flex w-full flex-col gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    camara.current?.click()
                  }}
                  className={`${BOTON_TIZA} w-full sm:hidden`}
                >
                  {t.pruebaEnVivo.sacarFoto}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    selector.current?.click()
                  }}
                  className={`min-h-11 w-full rounded-xl border border-borde-fuerte px-5 font-bold text-tiza sm:hidden`}
                >
                  {t.pruebaEnVivo.galeria}
                </button>
                <span className={`${BOTON_TIZA} hidden content-center sm:inline-block`}>
                  {t.pruebaEnVivo.elegir}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-[15px] font-bold text-tiza-suave">
                <span className="hidden sm:inline">{t.pruebaEnVivo.muestras}</span>
                <span className="sm:hidden">{t.pruebaEnVivo.muestrasCorto}</span>
              </span>
              <div className="flex gap-3">
                {MUESTRAS.map((m) => (
                  <button
                    key={m.archivo}
                    type="button"
                    onClick={() => void probarMuestra(m.archivo)}
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-borde bg-grafito p-2 text-[13px] text-tiza-suave transition-colors hover:border-lima sm:flex-none"
                  >
                    <img
                      src={`/muestras/${m.archivo}`}
                      alt=""
                      className="h-[68px] w-full rounded-lg bg-white object-contain sm:size-[76px]"
                    />
                    {m.etiqueta}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

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

        {/* ------------------------------------------------------------------ como funciona */}
        <section
          id="como-funciona"
          className="flex scroll-mt-20 flex-col gap-6 px-4 pb-14 sm:px-8 sm:gap-8 lg:pb-20"
        >
          <h2 className={TITULO_SECCION}>{t.pasos.titulo}</h2>
          <ol className="grid gap-6 lg:grid-cols-3">
            {t.pasos.lista.map((paso, i) => (
              <li key={paso.titulo} className="flex flex-col gap-3.5">
                <Figura
                  src={`/marca/paso-${i + 1}.png`}
                  texto={paso.figura}
                  className="h-[190px] w-full sm:h-[240px]"
                />
                <div className="flex gap-3">
                  <span className="grid size-7 flex-none place-items-center rounded-full bg-lima text-sm font-extrabold text-carbon sm:size-[30px] sm:text-base">
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-[17px] font-extrabold sm:text-[19px]">{paso.titulo}</span>
                    <span className="text-[15px] leading-relaxed text-tiza-suave sm:text-base">
                      {paso.texto}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      {/* ------------------------------------------------------------------ lo que resuelve */}
      <section className="border-y border-borde bg-grafito">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:gap-8 sm:px-8 sm:py-20">
          <h2 className={TITULO_SECCION}>{t.resuelve.titulo}</h2>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {t.resuelve.lista.map((item, i) => (
              <div
                key={item.titulo}
                className="flex flex-col gap-3 rounded-2xl border border-borde bg-carbon p-4 sm:gap-4 sm:p-6"
              >
                <Figura
                  src={`/marca/resuelve-${i + 1}.png`}
                  texto={item.figura}
                  contain
                  className="h-[120px] w-full bg-tiza sm:h-[150px]"
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-[17px] font-extrabold sm:text-xl">{item.titulo}</span>
                  <span className="text-[15px] leading-relaxed text-tiza-suave sm:text-base">
                    {item.texto}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1280px]">
        {/* ------------------------------------------------------------------ compatibilidad y privacidad */}
        <section className="grid items-start gap-8 px-4 py-10 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-10">
          <div className="flex flex-col gap-3.5">
            <span className="text-[13px] font-bold tracking-[0.08em] text-tenue uppercase">
              {t.compatibilidad.titulo}
            </span>
            <div className="flex flex-wrap gap-2.5">
              {t.compatibilidad.lista.map((n) => (
                <span
                  key={n}
                  className="rounded-full border border-borde-fuerte px-4 py-2 text-[15px] font-bold text-tiza-suave sm:text-base"
                >
                  {n}
                </span>
              ))}
            </div>
            <p className="text-[15px] text-tenue">{t.compatibilidad.nota}</p>
          </div>
          <div className="flex gap-4 rounded-2xl border border-borde bg-grafito p-5 sm:gap-[18px] sm:p-6">
            <svg
              viewBox="0 0 24 24"
              className="size-8 flex-none sm:size-[34px]"
              fill="none"
              stroke="#C6F24E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 3l7 3v5.5c0 4.3-2.9 8.1-7 9.5-4.1-1.4-7-5.2-7-9.5V6l7-3z" />
              <path d="M9 12.5l2 2 4-4" />
            </svg>
            <div className="flex flex-col gap-1.5">
              <span className="text-[17px] font-extrabold sm:text-xl">{t.privacidad.titulo}</span>
              <span className="text-[15px] leading-relaxed text-tiza-suave sm:text-base">
                {t.privacidad.texto}
              </span>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ cuenta */}
        <section id="cuenta" className="scroll-mt-20 px-4 pb-12 sm:px-8 sm:pb-20">
          <div className="grid items-center gap-8 rounded-3xl border border-borde bg-grafito p-5 sm:p-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:gap-12">
            <div className="flex flex-col gap-4">
              <h2 className="font-titulo text-2xl font-normal tracking-[0.01em] sm:text-[36px]">
                {t.cuenta.titulo}
              </h2>
              <ul className="flex flex-col gap-2.5">
                {t.cuenta.beneficios.map((b) => (
                  <li key={b} className="flex gap-2.5 text-base text-tiza-suave sm:text-[17px]">
                    <span className="font-extrabold text-lima">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <BloqueCuenta />
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------------ preguntas */}
      <section id="preguntas" className="scroll-mt-20 border-t border-borde bg-grafito">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:gap-8 sm:px-8 sm:py-20">
          <h2 className={TITULO_SECCION}>{t.preguntas.titulo}</h2>
          <dl className="grid gap-6 sm:gap-x-12 lg:grid-cols-2">
            {t.preguntas.lista.map((q, i) => (
              <div
                key={q.p}
                className={`flex flex-col gap-1.5 ${i < t.preguntas.lista.length - 1 ? 'border-b border-borde pb-5' : ''}`}
              >
                <dt className="text-[17px] font-extrabold sm:text-lg">{q.p}</dt>
                <dd className="text-[15px] leading-relaxed text-tiza-suave sm:text-base">{q.r}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="border-t border-borde">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-start justify-between gap-6 px-4 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-2.5">
            <span className="flex items-center gap-2.5">
              <Isotipo tam={28} variante="tiza" caladas />
              <span className="text-lg font-black tracking-[-0.02em]">{t.marca}</span>
            </span>
            <span className="text-[15px] text-tiza-suave">{t.pie.descripcion}</span>
            <span className="text-[15px] text-tenue">{t.pie.lugar}</span>
          </div>
          <div className="flex flex-wrap gap-5">
            {t.pie.enlaces.map((e) => (
              <span key={e} className="text-[15px] font-semibold text-tiza-suave">
                {e}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
