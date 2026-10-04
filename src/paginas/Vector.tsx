// Vectorizar: de una imagen a formas limpias, con el retoque a mano en el medio.
//
// Es el paso que faltaba antes del llavero: el pipeline saca el fondo y separa colores bien, pero
// siempre deja algo de mas. Aca eso se borra y recien despues se baja el SVG o se sigue en otra app.

import { useEffect, useRef } from 'react'
import { BotonPrimario, BotonSecundario, Grupo, Opciones } from '../crear/controles.tsx'
import { bajarArchivo } from '../crear/util.ts'
import { usarDesdeEditor } from '../estado/documento.ts'
import { ponerContornos } from '../estado/sello.ts'
import {
  cambiarColores,
  cambiarPreset,
  deshacer,
  descartarError,
  elegirArchivo,
  elegirColor,
  elegirHerramienta,
  elegirRadio,
  hayTinta,
  medidasMm,
  ofrecerSeguir,
  rehacer,
  siluetaDeTinta,
  useVector,
  volverAlOriginal,
  type Herramienta,
} from '../estado/vector.ts'
import { es } from '../i18n/es.ts'
import { esVector as t } from '../i18n/esVector.ts'
import Encabezado from '../marco/Encabezado.tsx'
import type { NombrePreset } from '../pipeline/presets.ts'
import { ir } from '../ruta.ts'
import Lienzo from '../vector/Lienzo.tsx'
import { aSvg } from '../vector/svg.ts'

const HERRAMIENTAS: { id: Herramienta; etiqueta: string; ayuda: string }[] = [
  { id: 'mancha', etiqueta: t.herramientas.mancha, ayuda: t.herramientas.manchaAyuda },
  { id: 'borrar', etiqueta: t.herramientas.borrar, ayuda: t.herramientas.borrarAyuda },
  { id: 'pintar', etiqueta: t.herramientas.pintar, ayuda: t.herramientas.pintarAyuda },
]

export default function Vector() {
  const archivo = useRef<HTMLInputElement>(null)
  const {
    archivo: imagen,
    preset,
    colores,
    conversion,
    mapa,
    regiones,
    herramienta,
    radio,
    colorActivo,
    historial,
    futuro,
    procesando,
    ofrecido,
    error,
  } = useVector()

  const nombre = (imagen?.name ?? 'dibujo').replace(/\.[^.]+$/, '') || 'dibujo'
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) rehacer()
      else deshacer()
    }
    addEventListener('keydown', atajo)
    return () => removeEventListener('keydown', atajo)
  }, [])

  const [anchoMm, altoMm] = medidasMm()
  const ayuda = HERRAMIENTAS.find((h) => h.id === herramienta)?.ayuda

  const descargar = () => {
    if (!hayTinta()) return
    const svg = aSvg(regiones, anchoMm, altoMm, nombre)
    bajarArchivo(new TextEncoder().encode(svg), `${nombre}.svg`, 'image/svg+xml')
    ofrecerSeguir(true)
  }

  const alLlavero = () => {
    if (!conversion || !mapa) return
    usarDesdeEditor(
      {
        ...conversion,
        regiones,
        diagnostico: { ...conversion.diagnostico, etiquetas: Uint8Array.from(mapa.etiquetas) },
      },
      regiones,
      nombre,
    )
    ir('/llaveros/crear')
  }

  const alSello = () => {
    const silueta = siluetaDeTinta()
    if (!silueta.length) return
    ponerContornos(
      nombre,
      silueta.flatMap((r) => r.contornos),
    )
    ir('/sellos/crear')
  }

  return (
    <div className="flex min-h-svh flex-col lg:h-svh lg:min-h-0 lg:overflow-hidden">
      <Encabezado
        appActual="vector"
        accion={
          <BotonPrimario onClick={descargar} disabled={!mapa || procesando}>
            {t.salida.descargar}
          </BotonPrimario>
        }
      />

      <main className="grid flex-1 grid-rows-[minmax(18rem,45vh)_auto] lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1">
        <section
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) elegirArchivo(f)
          }}
          className="relative bg-lienzo"
        >
          {mapa ? (
            <Lienzo />
          ) : (
            <div className="grid size-full place-items-center p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <p className="text-tiza-suave">
                  {procesando ? t.subir.procesando : t.subir.arrastrar}
                </p>
                {!procesando && (
                  <BotonPrimario onClick={() => archivo.current?.click()}>
                    {t.subir.elegir}
                  </BotonPrimario>
                )}
              </div>
            </div>
          )}
          {procesando && mapa && (
            <span className="absolute top-3 right-3 rounded-full border border-borde bg-grafito/95 px-3 py-1 text-xs text-tiza-suave">
              {t.subir.procesando}
            </span>
          )}
        </section>

        <aside className="flex flex-col gap-6 border-borde bg-carbon p-5 pb-28 lg:overflow-y-auto lg:border-l lg:pb-5">
          <div className="flex flex-col gap-1">
            <h1 className="font-titulo text-2xl font-normal">{t.titulo}</h1>
            <p className="text-sm leading-relaxed text-tiza-suave">{t.bajada}</p>
          </div>

          {error && (
            <p className="flex items-start justify-between gap-3 rounded-lg bg-alerta px-3 py-2 text-sm text-alerta-texto">
              {t.errores[error.codigo]}
              <button type="button" onClick={descartarError} className="font-bold">
                ×
              </button>
            </p>
          )}

          {/* ------------------------------------------------------------ la imagen */}
          <Grupo titulo={t.subir.titulo}>
            <button
              type="button"
              onClick={() => archivo.current?.click()}
              className="min-h-11 rounded-lg border border-borde-fuerte px-4 text-sm font-bold text-tiza"
            >
              {imagen ? `${imagen.name} · ${t.subir.cambiar}` : t.subir.elegir}
            </button>
            <p className="text-xs text-tenue">{t.subir.formatos}</p>
          </Grupo>
          <input
            ref={archivo}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) elegirArchivo(f)
              e.target.value = ''
            }}
          />

          {mapa && (
            <>
              {/* -------------------------------------------------------- la conversion */}
              <Grupo titulo={t.conversion.titulo}>
                <Opciones<NombrePreset | 'auto'>
                  nombre="preset"
                  valor={preset}
                  alCambiar={cambiarPreset}
                  opciones={(['auto', 'dibujo', 'foto', 'silueta'] as const).map((p) => ({
                    valor: p,
                    etiqueta: es.fondo.presets[p],
                    detalle:
                      p === 'auto' && preset === 'auto' && conversion
                        ? es.fondo.presets[conversion.preset]
                        : undefined,
                  }))}
                />
                <p className="text-xs leading-relaxed text-tenue">{t.conversion.ayuda}</p>
              </Grupo>

              <Grupo titulo={t.conversion.colores}>
                <Opciones
                  nombre="colores"
                  valor={colores}
                  alCambiar={cambiarColores}
                  opciones={[2, 3, 4, 5, 6].map((n) => ({ valor: n, etiqueta: n }))}
                />
              </Grupo>

              {/* -------------------------------------------------------- el retoque */}
              <Grupo titulo={t.herramientas.titulo}>
                <Opciones<Herramienta>
                  nombre="herramienta"
                  valor={herramienta}
                  alCambiar={elegirHerramienta}
                  opciones={HERRAMIENTAS.map((h) => ({ valor: h.id, etiqueta: h.etiqueta }))}
                />
                <p className="text-xs leading-relaxed text-tenue">{ayuda}</p>
              </Grupo>

              {herramienta !== 'mancha' && (
                <Grupo titulo={t.herramientas.grosor}>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={40}
                      step={1}
                      value={radio}
                      onChange={(e) => elegirRadio(Number(e.target.value))}
                      aria-label={t.herramientas.grosor}
                      className="h-11 flex-1 accent-lima"
                    />
                    <span className="w-16 text-right text-sm text-tiza-suave">
                      {(radio * 2 * (conversion?.diagnostico.mmPorPixel ?? 0.1))
                        .toFixed(1)
                        .replace('.', ',')}{' '}
                      mm
                    </span>
                  </div>
                </Grupo>
              )}

              {herramienta !== 'borrar' && (
                <Grupo titulo={t.herramientas.color}>
                  <ul className="flex flex-wrap gap-2">
                    {(conversion?.paleta ?? []).map((c, i) => (
                      <li key={c.hex}>
                        <button
                          type="button"
                          onClick={() => elegirColor(i)}
                          aria-label={c.hex}
                          style={{ backgroundColor: c.hex }}
                          className={`size-11 rounded-lg border-2 transition-colors ${
                            i === colorActivo ? 'border-lima' : 'border-borde-fuerte'
                          }`}
                        />
                      </li>
                    ))}
                  </ul>
                </Grupo>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={deshacer}
                  disabled={!historial.length}
                  className="min-h-11 rounded-lg border border-borde-fuerte px-4 text-sm font-bold text-tiza disabled:opacity-40"
                >
                  {t.herramientas.deshacer}
                </button>
                <button
                  type="button"
                  onClick={rehacer}
                  disabled={!futuro.length}
                  className="min-h-11 rounded-lg border border-borde-fuerte px-4 text-sm font-bold text-tiza disabled:opacity-40"
                >
                  {t.herramientas.rehacer}
                </button>
                <BotonSecundario onClick={volverAlOriginal}>
                  {t.herramientas.original}
                </BotonSecundario>
              </div>
              <p className="text-xs leading-relaxed text-tenue">{t.herramientas.mover}</p>

              {/* -------------------------------------------------------- la salida */}
              <Grupo titulo={t.salida.titulo}>
                <p className="text-sm text-tiza-suave">
                  {t.salida.medidas(anchoMm, altoMm)} · {t.salida.formas(regiones.length)}
                </p>
                {ofrecido ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-borde bg-grafito p-3">
                    <p className="text-sm font-bold">{t.salida.bajado}</p>
                    <p className="text-sm text-tiza-suave">{t.salida.seguir}</p>
                    <div className="flex flex-wrap gap-2">
                      <BotonPrimario onClick={alLlavero}>{t.salida.enLlavero}</BotonPrimario>
                      <button
                        type="button"
                        onClick={alSello}
                        className="min-h-11 rounded-lg border border-borde-fuerte px-4 text-sm font-bold text-tiza"
                      >
                        {t.salida.enSello}
                      </button>
                      <BotonSecundario onClick={() => ofrecerSeguir(false)}>
                        {t.salida.cerrar}
                      </BotonSecundario>
                    </div>
                    <p className="text-xs leading-relaxed text-tenue">{t.salida.enSelloAyuda}</p>
                  </div>
                ) : (
                  <BotonPrimario onClick={descargar} disabled={!regiones.length}>
                    {t.salida.descargar}
                  </BotonPrimario>
                )}
                {!regiones.length && (
                  <p className="text-sm text-alerta-texto">{t.salida.sinDibujo}</p>
                )}
              </Grupo>
            </>
          )}
        </aside>
      </main>
    </div>
  )
}
