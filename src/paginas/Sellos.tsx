// La app de sellos: el dibujo a la izquierda en 3D y los controles a la derecha, con la misma
// grilla que los llaveros. La geometria la arma el worker; acá solo se piden los cambios.

import { useEffect, useMemo, useRef, useState } from 'react'
import { BotonPrimario, Grupo, Opciones } from '../crear/controles.tsx'
import { bajarArchivo } from '../crear/util.ts'
import Vista3D from '../crear/Vista3D.tsx'
import { FUENTES, type IdFuente } from '../datos/fuentes.ts'
import {
  armarZipSello,
  cambiarBisagra,
  cambiarParams,
  construirSello,
  nombreDelSello,
  ponerSvg,
  ponerTexto,
  useSello,
} from '../estado/sello.ts'
import { esSellos as t } from '../i18n/esSellos.ts'
import Encabezado from '../marco/Encabezado.tsx'
import { MATERIALES, profundidadDe } from '../sellos/placas.ts'

const pct = (v: number) => Math.round(v * 100)

/** Un deslizador con su número al lado. */
function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso = 0.1,
  unidad = 'mm',
  ayuda,
  alCambiar,
}: {
  etiqueta: string
  valor: number
  min: number
  max: number
  paso?: number
  unidad?: string
  ayuda?: string
  alCambiar: (n: number) => void
}) {
  return (
    <Grupo titulo={etiqueta}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={paso}
          value={valor}
          onChange={(e) => alCambiar(Number(e.target.value))}
          className="h-11 flex-1 accent-lima"
          aria-label={etiqueta}
        />
        <span className="w-20 text-right text-sm font-semibold tabular-nums">
          {String(Math.round(valor * 100) / 100).replace('.', ',')} {unidad}
        </span>
      </div>
      {ayuda && <p className="text-xs leading-relaxed text-tenue">{ayuda}</p>}
    </Grupo>
  )
}

export default function Sellos() {
  const { dibujo, params, bisagra, construccion, construyendo, error } = useSello()
  const [avanzado, setAvanzado] = useState(false)
  const [bajando, setBajando] = useState(false)
  const [borrador, setBorrador] = useState<string | null>(null)
  const archivo = useRef<HTMLInputElement>(null)

  // Al entrar, el primer sello se arma solo
  useEffect(() => {
    if (!useSello.getState().construccion) construirSello(0)
  }, [])

  const r = construccion?.resultado
  const piezas = useMemo(() => (r ? [r.macho, r.hembra] : []), [r])
  const colores = ['#C6F24E', '#F5F6F8']

  const material =
    MATERIALES.find((m) => Math.abs(m.relieve - params.relieve) < 0.001) ?? MATERIALES[0]

  const descargar = async () => {
    setBajando(true)
    const c = await armarZipSello()
    setBajando(false)
    if (c?.paquete) bajarArchivo(c.paquete.zip, c.paquete.nombreZip, 'application/zip')
  }

  const textoActual = borrador ?? (dibujo.tipo === 'texto' ? dibujo.texto : '')
  const fuenteActual = (dibujo.tipo === 'texto' ? dibujo.fuente : FUENTES[0]!.id) as IdFuente

  return (
    <div className="flex min-h-svh flex-col lg:h-svh lg:min-h-0 lg:overflow-hidden">
      <Encabezado
        appActual="sellos"
        accion={
          <BotonPrimario onClick={() => void descargar()} disabled={!r || bajando}>
            {bajando ? t.resumen.preparando : t.resumen.boton}
          </BotonPrimario>
        }
      />

      <main className="grid flex-1 grid-rows-[minmax(18rem,45vh)_auto] lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1">
        <section className="relative bg-lienzo">
          {r && (
            <div className="relative size-full min-h-64">
              <Vista3D piezas={piezas} colores={colores} modo="3d" />
              {construyendo && (
                <span className="absolute top-3 right-3 rounded-full border border-borde bg-grafito/95 px-3 py-1 text-xs text-tiza-suave">
                  {t.vista.actualizando}
                </span>
              )}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-6 border-stone-200 bg-carbon p-5 pb-28 lg:overflow-y-auto lg:border-l lg:border-borde lg:pb-5">
          <div className="flex flex-col gap-1">
            <h1 className="font-titulo text-2xl font-normal">{t.titulo}</h1>
            <p className="text-sm leading-relaxed text-tiza-suave">{t.bajada}</p>
          </div>

          {/* ------------------------------------------------------------ que va en el sello */}
          <Grupo titulo={t.dibujo.titulo}>
            <Opciones
              nombre="dibujo"
              valor={dibujo.tipo}
              alCambiar={(tipo) =>
                tipo === 'texto'
                  ? ponerTexto(textoActual || 'HOLA', fuenteActual)
                  : archivo.current?.click()
              }
              opciones={[
                { valor: 'texto' as const, etiqueta: t.dibujo.texto },
                { valor: 'svg' as const, etiqueta: t.dibujo.archivo },
              ]}
            />

            {dibujo.tipo === 'texto' ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textoActual}
                  maxLength={24}
                  onChange={(e) => {
                    setBorrador(e.target.value)
                    ponerTexto(e.target.value, fuenteActual)
                  }}
                  onBlur={() => setBorrador(null)}
                  aria-label={t.dibujo.escribir}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-borde-fuerte bg-grafito px-3 text-tiza"
                />
                <select
                  value={fuenteActual}
                  onChange={(e) => ponerTexto(textoActual, e.target.value)}
                  aria-label={t.dibujo.fuente}
                  className="min-h-11 rounded-lg border border-borde-fuerte bg-grafito px-2 text-tiza"
                >
                  {FUENTES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => archivo.current?.click()}
                className="min-h-11 rounded-lg border border-borde-fuerte px-4 text-sm font-bold text-tiza"
              >
                {dibujo.nombre} · {t.dibujo.cambiarArchivo}
              </button>
            )}
            <input
              ref={archivo}
              type="file"
              accept="image/svg+xml,.svg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void ponerSvg(f)
              }}
            />
            {dibujo.tipo !== 'svg' && <p className="text-xs text-tenue">{t.dibujo.formatos}</p>}
          </Grupo>

          {/* ------------------------------------------------------------ material */}
          <Grupo titulo={t.material.titulo}>
            <Opciones
              nombre="material"
              valor={material!.id}
              alCambiar={(id) => {
                const mat = MATERIALES.find((m) => m.id === id)!
                cambiarParams({ relieve: mat.relieve, profundidad: profundidadDe(mat.relieve) })
              }}
              opciones={MATERIALES.map((m) => ({
                valor: m.id,
                etiqueta: m.nombre,
                detalle: `${String(m.relieve).replace('.', ',')} mm`,
              }))}
            />
            <p className="text-xs text-tenue">{t.material.ayuda}</p>
          </Grupo>

          {/* ------------------------------------------------------------ medidas */}
          <Grupo titulo={t.medidas.bisagras}>
            <Opciones
              nombre="bisagras"
              valor={params.bisagras}
              alCambiar={(bisagras) => cambiarParams({ bisagras })}
              opciones={[1, 2, 3].map((n) => ({
                valor: n,
                etiqueta: t.medidas.bisagrasDetalle(n),
                detalle: `${Math.round(bisagra.largoY * n)} mm`,
              }))}
            />
          </Grupo>

          <Deslizador
            etiqueta={t.medidas.ancho}
            valor={params.anchoPlaca}
            min={30}
            max={120}
            paso={0.5}
            alCambiar={(anchoPlaca) => cambiarParams({ anchoPlaca })}
          />

          <Deslizador
            etiqueta={t.medidas.escala}
            valor={params.escalaLogo}
            min={0.3}
            max={1}
            paso={0.05}
            unidad="×"
            alCambiar={(escalaLogo) => cambiarParams({ escalaLogo })}
          />

          <Grupo titulo={t.medidas.girar}>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => cambiarParams({ giro: ((params.giro + 1) % 4) as 0 | 1 | 2 | 3 })}
                className="min-h-11 rounded-lg border border-borde-fuerte px-4 text-sm font-bold text-tiza"
              >
                {t.medidas.girar} ({params.giro * 90}°)
              </button>
              <button
                type="button"
                onClick={() => cambiarParams({ invertir: !params.invertir })}
                className="min-h-11 rounded-lg border border-borde-fuerte px-4 text-sm font-bold text-tiza"
              >
                {t.medidas.invertir}
              </button>
            </div>
            <p className="text-xs text-tenue">{t.medidas.invertirAyuda}</p>
          </Grupo>

          {/* ------------------------------------------------------------ ajuste fino */}
          <button
            type="button"
            onClick={() => setAvanzado((v) => !v)}
            className="min-h-11 self-start text-sm text-tiza-suave underline underline-offset-4"
          >
            {avanzado ? t.avanzado.ocultar : t.avanzado.ver}
          </button>

          {avanzado && (
            <div className="flex flex-col gap-6 rounded-xl border border-borde bg-grafito p-3">
              <Deslizador
                etiqueta={t.avanzado.tolerancia}
                valor={params.tolerancia}
                min={0.05}
                max={0.6}
                paso={0.01}
                ayuda={t.avanzado.toleranciaAyuda}
                alCambiar={(tolerancia) => cambiarParams({ tolerancia })}
              />
              <Deslizador
                etiqueta={t.avanzado.holgura}
                valor={bisagra.holgura}
                min={0.15}
                max={0.5}
                paso={0.05}
                ayuda={t.avanzado.holguraAyuda}
                alCambiar={(holgura) => cambiarBisagra({ holgura })}
              />
              <Deslizador
                etiqueta={t.avanzado.espesor}
                valor={params.espesor}
                min={2.5}
                max={6}
                paso={0.5}
                alCambiar={(espesor) => cambiarParams({ espesor })}
              />
              <Deslizador
                etiqueta={t.avanzado.margen}
                valor={params.margen}
                min={1}
                max={12}
                paso={0.5}
                alCambiar={(margen) => cambiarParams({ margen })}
              />
              <Deslizador
                etiqueta={t.avanzado.radio}
                valor={params.radioEsquina}
                min={0}
                max={15}
                paso={0.5}
                alCambiar={(radioEsquina) => cambiarParams({ radioEsquina })}
              />
              <Deslizador
                etiqueta={t.avanzado.corrimiento}
                valor={params.corrimientoLogo}
                min={-10}
                max={15}
                paso={0.5}
                alCambiar={(corrimientoLogo) => cambiarParams({ corrimientoLogo })}
              />
            </div>
          )}

          {/* ------------------------------------------------------------ avisos y resumen */}
          {error && (
            <p role="alert" className="rounded-lg bg-aviso p-3 text-sm text-aviso-texto">
              ⚠{' '}
              {error === 'svg-vacio'
                ? t.avisos.svgVacio
                : error === 'svg-ilegible'
                  ? t.avisos.svgIlegible
                  : t.avisos.trabado}
            </p>
          )}

          {r && r.avisos.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-tiza-suave">
                {t.avisos.titulo(r.avisos.length)}
              </h2>
              {r.avisos.map((a) => (
                <p key={a.codigo} className="rounded-lg bg-aviso p-3 text-sm text-aviso-texto">
                  🟡{' '}
                  {a.codigo === 'detalle-fino'
                    ? t.avisos.detalleFino(pct(a.valor))
                    : t.avisos.logoRecortado(pct(a.valor))}
                </p>
              ))}
            </section>
          )}

          {r && (
            <div className="flex flex-col gap-1 text-sm text-tiza-suave">
              <span>{t.resumen.medidas(r.medidas[0], r.medidas[1], r.medidas[2])}</span>
              <span>{t.resumen.logo(r.logoMm[0], r.logoMm[1])}</span>
              <span className="text-tenue">{t.resumen.sinSoportes}</span>
            </div>
          )}
        </aside>
      </main>

      <footer className="fixed inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-borde bg-grafito px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static">
        <span className="text-sm text-tenue">{nombreDelSello(dibujo)}</span>
        <BotonPrimario onClick={() => void descargar()} disabled={!r || bajando}>
          {bajando
            ? t.resumen.preparando
            : construccion?.paquete
              ? t.resumen.descargar(construccion.paquete.zip.byteLength)
              : t.resumen.boton}
        </BotonPrimario>
      </footer>
    </div>
  )
}
