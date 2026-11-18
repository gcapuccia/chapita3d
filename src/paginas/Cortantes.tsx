// La app de cortantes: el cortante y su marcador en 3D a la izquierda, los controles a la derecha,
// con la misma grilla que los sellos. La imagen la convierte un worker y la geometria otro.

import { useEffect, useMemo, useRef, useState } from 'react'
import { BotonPrimario, Deslizador, Grupo, Opciones } from '../crear/controles.tsx'
import { bajarArchivo } from '../crear/util.ts'
import Vista3D from '../crear/Vista3D.tsx'
import { ALTOS, type Marcado } from '../cortantes/cortante.ts'
import {
  armarZipCortante,
  cambiarParams,
  construirCortante,
  descartarError,
  elegirArchivo,
  useCortante,
  usarMuestra,
} from '../estado/cortante.ts'
import { limpiarPara } from '../estado/vector.ts'
import type { PiezaExport } from '../export/tipos.ts'
import { esCortantes as t } from '../i18n/esCortantes.ts'
import Encabezado from '../marco/Encabezado.tsx'
import { ir } from '../ruta.ts'

/** Vista: el cortante en lima y el marcador en gris, como las dos placas del sello. */
const COLORES = ['#B5D36A', '#98A0AD']
const MASA = '#E2B878'
const MARCA = '#A8743A'

const pct = (v: number) => Math.round(v * 100)

/** Una copia de la pieza corrida en X, para ver el marcador al lado del cortante. */
function corrida(p: PiezaExport, dx: number): PiezaExport {
  const vertices = Float32Array.from(p.vertices)
  for (let i = 0; i < vertices.length; i += 3) vertices[i]! += dx
  return { ...p, vertices }
}

/** La galletita vista de arriba, al derecho: la masa y lo que queda hundido. */
function Galletita({
  forma,
  marcas,
}: {
  forma: [number, number][][]
  marcas: [number, number][][]
}) {
  const puntos = forma.flat()
  if (!puntos.length) return null
  const xs = puntos.map((p) => p[0])
  const ys = puntos.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const camino = (anillos: [number, number][][]) =>
    anillos
      .map((a) => `M${a.map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join('L')}Z`)
      .join('')
  const aire = 2
  return (
    <svg
      viewBox={`${x0 - aire} ${-y1 - aire} ${x1 - x0 + 2 * aire} ${y1 - y0 + 2 * aire}`}
      className="h-40 w-full"
      role="img"
      aria-label={t.galletita}
    >
      <path d={camino(forma)} fill={MASA} fillRule="evenodd" />
      <path d={camino(marcas)} fill={MARCA} fillRule="evenodd" />
    </svg>
  )
}

export default function Cortantes() {
  const {
    archivo,
    nombre,
    regiones,
    areas,
    params,
    procesando,
    construccion,
    construyendo,
    error,
  } = useCortante()
  const [avanzado, setAvanzado] = useState(false)
  const [bajando, setBajando] = useState(false)
  const selector = useRef<HTMLInputElement>(null)

  // Al entrar sin dibujo, el gato de muestra: se ve algo sin subir nada
  useEffect(() => {
    const s = useCortante.getState()
    if (!s.regiones.length && !s.procesando) void usarMuestra()
    else if (!s.construccion) construirCortante(0)
  }, [])

  const r = construccion?.resultado
  const piezas = useMemo(
    () => (r ? [r.cortante, ...(r.marcador ? [corrida(r.marcador, r.alLado)] : [])] : []),
    [r],
  )

  const descargar = async () => {
    setBajando(true)
    try {
      const c = await armarZipCortante()
      if (c.paquete) bajarArchivo(c.paquete.zip, c.paquete.nombreZip, 'application/zip')
    } finally {
      setBajando(false)
    }
  }

  const alVector = () => {
    if (archivo && limpiarPara('cortante', archivo)) ir('/vector/crear')
  }

  const colores = regiones.map((g) => g.hex)
  // El color que mas ocupa suele ser el cuerpo: si marcara, hundiria toda la galletita
  const mayor = colores[areas.indexOf(Math.max(...areas))]
  const textoAviso = (a: NonNullable<typeof r>['avisos'][number]) =>
    a.codigo === 'partes-unidas'
      ? t.avisos.partesUnidas
      : a.codigo === 'detalle-fino'
        ? t.avisos.detalleFino(pct(a.valor))
        : t.avisos.marcadorVacio

  return (
    <div className="flex min-h-svh flex-col lg:h-svh lg:min-h-0 lg:overflow-hidden">
      <Encabezado
        appActual="cortantes"
        accion={
          <BotonPrimario onClick={() => void descargar()} disabled={!r || bajando}>
            {bajando ? t.resumen.preparando : t.resumen.boton}
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
          {r ? (
            <div className="relative size-full min-h-64">
              <Vista3D piezas={piezas} colores={COLORES} modo="3d" relieve />
              <span className="absolute top-3 left-3 max-w-[70%] rounded-full border border-borde bg-grafito/95 px-3 py-1 text-xs text-tiza-suave">
                {t.vista.espejado}
              </span>
              {(construyendo || procesando) && (
                <span className="absolute top-3 right-3 rounded-full border border-borde bg-grafito/95 px-3 py-1 text-xs text-tiza-suave">
                  {procesando ? t.subir.procesando : t.vista.actualizando}
                </span>
              )}
            </div>
          ) : (
            <div className="grid size-full place-items-center p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <p className="text-tiza-suave">
                  {procesando || construyendo ? t.subir.procesando : t.subir.arrastrar}
                </p>
                {!procesando && !construyendo && (
                  <BotonPrimario onClick={() => selector.current?.click()}>
                    {t.subir.elegir}
                  </BotonPrimario>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-6 border-borde bg-carbon p-5 pb-28 lg:overflow-y-auto lg:border-l lg:pb-5">
          <div className="flex flex-col gap-1">
            <h1 className="font-titulo text-2xl font-extrabold tracking-tight">{t.titulo}</h1>
            <p className="text-sm leading-relaxed text-tiza-suave">{t.bajada}</p>
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start justify-between gap-3 rounded-lg bg-alerta px-3 py-2 text-sm text-alerta-texto"
            >
              {t.errores[error]}
              <button type="button" onClick={descartarError} className="font-bold">
                ×
              </button>
            </p>
          )}

          {/* ------------------------------------------------------------ el dibujo */}
          <Grupo titulo={t.subir.titulo}>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selector.current?.click()}
                className="min-h-11 min-w-0 flex-1 truncate rounded-lg border border-borde-fuerte px-4 text-sm font-bold text-tiza"
              >
                {nombre ? `${nombre} · ${t.subir.cambiar}` : t.subir.elegir}
              </button>
              {archivo?.name !== 'gato.png' && (
                <button
                  type="button"
                  onClick={() => void usarMuestra()}
                  className="min-h-11 rounded-lg px-3 text-sm text-tiza-suave underline underline-offset-4"
                >
                  {t.subir.muestra}
                </button>
              )}
            </div>
            <p className="text-xs text-tenue">
              {archivo || !nombre ? t.subir.formatos : t.subir.deVector}
            </p>
            {archivo && archivo.name !== 'gato.png' && (
              <button
                type="button"
                onClick={alVector}
                className="min-h-11 self-start text-sm text-tiza-suave underline underline-offset-4"
              >
                {t.subir.limpiar}
              </button>
            )}
          </Grupo>
          <input
            ref={selector}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) elegirArchivo(f)
              e.target.value = ''
            }}
          />

          {/* ------------------------------------------------------------ medidas */}
          <Deslizador
            etiqueta={t.tamano.titulo}
            valor={params.largo}
            min={40}
            max={150}
            paso={1}
            ayuda={t.tamano.ayuda}
            alCambiar={(largo) => cambiarParams({ largo }, 300)}
          />

          <Grupo titulo={t.alto.titulo}>
            <Opciones
              nombre="alto"
              valor={params.alto}
              alCambiar={(alto) => cambiarParams({ alto })}
              opciones={ALTOS.map((a) => ({
                valor: a,
                etiqueta: `${a} mm`,
                detalle: t.alto.detalle[a],
              }))}
            />
          </Grupo>

          {/* ------------------------------------------------------------ marcador */}
          <Grupo titulo={t.marcador.titulo}>
            <Opciones<Marcado>
              nombre="marcado"
              valor={params.marcado}
              alCambiar={(marcado) =>
                cambiarParams({
                  marcado,
                  // Al pasar a colores sin ninguno elegido, arranca con todos menos el que mas ocupa
                  ...(marcado === 'colores' && !params.colores.length
                    ? { colores: colores.filter((c) => c !== mayor) }
                    : {}),
                })
              }
              opciones={(['lineas', 'colores', 'no'] as const).map((v) => ({
                valor: v,
                etiqueta: t.marcador.opciones[v],
              }))}
            />
            <p className="text-xs text-tenue">{t.marcador.ayuda[params.marcado]}</p>
            {params.marcado === 'colores' && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-tiza-suave">{t.marcador.cuales}</p>
                <div className="flex flex-wrap gap-2">
                  {colores.map((hex) => {
                    const marca = params.colores.includes(hex)
                    return (
                      <button
                        key={hex}
                        type="button"
                        aria-pressed={marca}
                        aria-label={hex}
                        onClick={() =>
                          cambiarParams({
                            colores: marca
                              ? params.colores.filter((c) => c !== hex)
                              : [...params.colores, hex],
                          })
                        }
                        className={`grid size-11 place-items-center rounded-lg border-2 ${
                          marca ? 'border-lima' : 'border-borde-fuerte opacity-50'
                        }`}
                      >
                        <span
                          className="size-7 rounded-md border border-black/20"
                          style={{ background: hex }}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
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
                etiqueta={t.avanzado.margen}
                valor={params.margen}
                min={1.5}
                max={8}
                paso={0.5}
                ayuda={t.avanzado.margenAyuda}
                alCambiar={(margen) => cambiarParams({ margen }, 300)}
              />
              <Deslizador
                etiqueta={t.avanzado.grosor}
                valor={params.grosor}
                min={0.8}
                max={2}
                paso={0.1}
                ayuda={t.avanzado.grosorAyuda}
                alCambiar={(grosor) => cambiarParams({ grosor }, 300)}
              />
              <Deslizador
                etiqueta={t.avanzado.reborde}
                valor={params.anchoReborde}
                min={2}
                max={8}
                paso={0.5}
                alCambiar={(anchoReborde) => cambiarParams({ anchoReborde }, 300)}
              />
              {params.marcado === 'lineas' && (
                <Deslizador
                  etiqueta={t.avanzado.linea}
                  valor={params.grosorLinea}
                  min={0.8}
                  max={2.5}
                  paso={0.1}
                  alCambiar={(grosorLinea) => cambiarParams({ grosorLinea }, 300)}
                />
              )}
              {params.marcado !== 'no' && (
                <>
                  <Deslizador
                    etiqueta={t.avanzado.relieve}
                    valor={params.relieve}
                    min={1}
                    max={3}
                    paso={0.2}
                    alCambiar={(relieve) => cambiarParams({ relieve }, 300)}
                  />
                  <Deslizador
                    etiqueta={t.avanzado.holgura}
                    valor={params.holgura}
                    min={0.3}
                    max={1.2}
                    paso={0.1}
                    ayuda={t.avanzado.holguraAyuda}
                    alCambiar={(holgura) => cambiarParams({ holgura }, 300)}
                  />
                </>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------ avisos y resumen */}
          {r && r.avisos.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-tiza-suave">
                {t.avisos.titulo(r.avisos.length)}
              </h2>
              {r.avisos.map((a) => (
                <p key={a.codigo} className="rounded-lg bg-aviso p-3 text-sm text-aviso-texto">
                  🟡 {textoAviso(a)}
                </p>
              ))}
            </section>
          )}

          {r && (
            <section className="flex flex-col gap-3 rounded-xl border border-borde bg-grafito p-3">
              <h2 className="text-xs font-semibold tracking-wide text-tenue uppercase">
                {t.galletita}
              </h2>
              <Galletita forma={r.galletita.forma} marcas={r.galletita.marcas} />
              <div className="flex flex-col gap-1 text-sm text-tiza-suave">
                <span>{t.resumen.galletita(r.galletitaMm[0], r.galletitaMm[1])}</span>
                <span>{t.resumen.cortante(r.medidas[0], r.medidas[1], r.medidas[2])}</span>
                <span className="text-xs text-tenue">{t.resumen.sinSoportes}</span>
              </div>
            </section>
          )}
        </aside>
      </main>

      <footer className="fixed inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-borde bg-grafito px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static">
        <span className="min-w-0 truncate text-sm text-tenue">{nombre}</span>
        <BotonPrimario onClick={() => void descargar()} disabled={!r || bajando}>
          {bajando ? t.resumen.preparando : t.resumen.boton}
        </BotonPrimario>
      </footer>
    </div>
  )
}
