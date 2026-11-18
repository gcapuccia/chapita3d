// /nombres/crear: el llavero de nombre. Un texto, la letra, dos colores y la argolla. La vista 3D,
// los avisos y la descarga son los mismos del llavero desde imagen: el diseño es un Diseno comun.

import { useEffect, useMemo, useState } from 'react'
import FranjaAvisos from '../crear/FranjaAvisos.tsx'
import { MedidaDelIman } from '../crear/MedidaDelIman.tsx'
import Vista3D from '../crear/Vista3D.tsx'
import { BotonPrimario, Grupo, Opciones } from '../crear/controles.tsx'
import { coloresDePiezas } from '../crear/util.ts'
import { FUENTES } from '../datos/fuentes.ts'
import { URL_FUENTE } from '../datos/fuentesUrl.ts'
import { PALETA } from '../datos/paleta.ts'
import {
  cambiarTextoDeNombre,
  crearDisenoDeNombre,
  ID_LETRAS,
  leerNombre,
  type CambioDeNombre,
} from '../diseno/nombre.ts'
import { conIman } from '../diseno/iman.ts'
import type { Diseno } from '../diseno/tipos.ts'
import {
  cambiarColorDeFilamento,
  cambiarDiseno,
  usarDiseno,
  useDocumento,
} from '../estado/documento.ts'
import { es } from '../i18n/es.ts'
import Encabezado from '../marco/Encabezado.tsx'
import * as D from '../pipeline/defaults.ts'
import { ir } from '../ruta.ts'

const t = es.nombres

/** Mas largo que esto ya no es un llavero comodo (una tarjeta SUBE mide 85 mm). */
const LARGO_MAXIMO_MM = 85

type Argolla = 'izquierda' | 'arriba' | 'iman' | 'sin'

function argollaDe(d: Diseno): Argolla {
  if (d.iman) return 'iman'
  if (d.argolla.tipo === 'sin') return 'sin'
  return d.argolla.posicion === 'auto' ? 'arriba' : 'izquierda'
}

// Cada boton de letra se escribe con su propia fuente. Se cargan una sola vez, al abrir la pagina.
let muestrasCargadas = false
function cargarMuestras() {
  if (muestrasCargadas || typeof FontFace === 'undefined') return
  muestrasCargadas = true
  for (const f of FUENTES) {
    new FontFace(`muestra-${f.id}`, `url(${URL_FUENTE[f.id]})`)
      .load()
      .then((cara) => document.fonts.add(cara))
      .catch(() => {}) // sin la muestra, el boton se ve con la letra de la pagina
  }
}

function Muestrario({ valor, alElegir }: { valor: string; alElegir: (hex: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {PALETA.map((c) => {
        const elegido = c.hex.toUpperCase() === valor.toUpperCase()
        return (
          <button
            key={c.hex}
            type="button"
            title={c.nombre}
            aria-label={c.nombre}
            aria-pressed={elegido}
            onClick={() => alElegir(c.hex)}
            style={{ background: c.hex }}
            className={`aspect-square w-full max-w-9 rounded-full border transition-transform hover:scale-110 ${
              elegido
                ? 'border-lima ring-2 ring-lima ring-offset-2 ring-offset-carbon'
                : 'border-borde-fuerte'
            }`}
          />
        )
      })}
    </div>
  )
}

export default function Nombres() {
  const { diseno, construccion, construyendo, error } = useDocumento()
  const esNombre = diseno?.producto === 'nombre'

  // Se entra sin diseño, o con uno de imagen: arranca un nombre de ejemplo. Al volver de la
  // descarga el diseño ya es un nombre y se respeta.
  useEffect(() => {
    cargarMuestras()
    if (!esNombre) {
      usarDiseno(
        crearDisenoDeNombre(t.ejemplo, {
          id: crypto.randomUUID(),
          ahora: new Date().toISOString(),
          appVersion: '0.1.0',
        }),
      )
    }
  }, [esNombre])

  const actual = diseno && esNombre ? leerNombre(diseno) : null
  const [borrador, setBorrador] = useState<string | null>(null)
  const [atras, setAtras] = useState(false)
  const resultado = construccion?.resultado
  const colores = useMemo(() => (resultado ? coloresDePiezas(resultado) : []), [resultado])

  if (!diseno || !esNombre || !actual) return null

  const cambiar = (c: CambioDeNombre, demora?: number) =>
    cambiarDiseno((d) => cambiarTextoDeNombre(d, c), demora)
  const escribir = (valor: string) => {
    setBorrador(valor)
    if (valor.trim()) cambiar({ texto: valor.trim() }, 300)
  }
  const texto = borrador ?? actual.texto
  const hexDe = (id: string) => diseno.filamentos.find((f) => f.id === id)?.hex ?? '#FFFFFF'
  const listo = !!resultado && !resultado.bloqueante && !construyendo
  const descargar = () => ir('/llaveros/descargar')

  const vista = (
    <div className="relative size-full min-h-64">
      {resultado && (
        <Vista3D
          piezas={resultado.piezas}
          colores={colores}
          modo={diseno.iman && atras ? 'atras' : '3d'}
        />
      )}
      {diseno.iman && (
        <div className="absolute top-3 left-3 flex gap-1 rounded-full bg-grafito/95 p-1 shadow-sm">
          {[false, true].map((a) => (
            <button
              key={String(a)}
              type="button"
              onClick={() => setAtras(a)}
              className={`min-h-9 rounded-full px-3 text-xs ${atras === a ? 'bg-lima text-carbon' : 'text-tiza-suave'}`}
            >
              {a ? es.crear.vistas.atras : es.crear.vistas.adelante}
            </button>
          ))}
        </div>
      )}
      {construyendo && (
        <span className="absolute top-3 right-3 rounded-full bg-grafito/95 px-3 py-1 text-xs text-tiza-suave shadow-sm">
          {es.crear.actualizando}
        </span>
      )}
      {resultado && (
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-grafito/95 px-3 py-1 text-xs text-tiza-suave tabular-nums shadow-sm">
          {t.medidas(resultado.medidas[0], resultado.medidas[1])}
        </span>
      )}
    </div>
  )

  return (
    <div className="flex min-h-svh flex-col lg:h-svh lg:min-h-0 lg:overflow-hidden">
      <Encabezado
        appActual="nombres"
        accion={
          <BotonPrimario className="max-sm:hidden" onClick={descargar} disabled={!listo}>
            {es.crear.descargar}
          </BotonPrimario>
        }
      />

      <main className="grid flex-1 grid-rows-[minmax(16rem,38vh)_auto] lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-1">
        <section className="relative bg-lienzo">{vista}</section>

        <aside className="flex flex-col gap-6 border-borde bg-carbon p-5 pb-28 lg:overflow-y-auto lg:border-l lg:pb-5">
          <div className="flex flex-col gap-1">
            <h1 className="font-titulo text-2xl font-extrabold tracking-tight">{t.titulo}</h1>
            <p className="text-sm text-tiza-suave">{t.bajada}</p>
          </div>

          <Grupo titulo={t.nombre}>
            <input
              type="text"
              value={texto}
              maxLength={20}
              placeholder={t.placeholder}
              onChange={(e) => escribir(e.target.value)}
              onBlur={() => setBorrador(null)}
              aria-label={t.nombre}
              className="min-h-12 rounded-lg border border-borde-fuerte bg-grafito px-3 text-lg"
            />
            {!texto.trim() && <p className="text-xs text-tenue">{t.vacio}</p>}
            {error && <p className="text-sm text-aviso-texto">{es.errores.trabado}</p>}
          </Grupo>

          <Grupo titulo={t.letra}>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {FUENTES.map((f) => {
                const elegida = f.id === actual.fuente
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    onClick={() => cambiar({ fuente: f.id }, 0)}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-lg border px-2 py-1.5 transition-colors ${
                      elegida
                        ? 'border-lima bg-lima text-carbon'
                        : 'border-borde-fuerte bg-grafito hover:border-tiza'
                    }`}
                  >
                    <span
                      className="max-w-full truncate text-lg leading-tight"
                      style={{ fontFamily: `muestra-${f.id}, ui-sans-serif, sans-serif` }}
                    >
                      {actual.texto}
                    </span>
                    <span className={`text-xs ${elegida ? 'text-carbon/70' : 'text-tenue'}`}>
                      {f.nombre}
                    </span>
                  </button>
                )
              })}
            </div>
          </Grupo>

          <Grupo titulo={t.tamano}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={8}
                max={24}
                value={actual.tamano}
                onChange={(e) => cambiar({ tamano: Number(e.target.value) })}
                className="h-11 flex-1 accent-lima"
                aria-label={t.tamano}
              />
              <span className="w-16 text-right text-sm font-semibold tabular-nums">
                {actual.tamano} mm
              </span>
            </div>
            {resultado && !diseno.iman && resultado.medidas[0] > LARGO_MAXIMO_MM && (
              <p className="text-xs text-aviso-texto">{t.largo}</p>
            )}
          </Grupo>

          <Grupo titulo={t.colorLetras}>
            <Muestrario
              valor={hexDe(ID_LETRAS)}
              alElegir={(hex) => cambiarColorDeFilamento(ID_LETRAS, hex)}
            />
          </Grupo>

          <Grupo titulo={t.colorBase}>
            <Muestrario
              valor={hexDe(diseno.contorno.filamentoId)}
              alElegir={(hex) => cambiarColorDeFilamento(diseno.contorno.filamentoId, hex)}
            />
          </Grupo>

          <Grupo titulo={t.argolla}>
            <Opciones<Argolla>
              nombre="argolla"
              valor={argollaDe(diseno)}
              alCambiar={(a) =>
                cambiarDiseno((d) => {
                  if (a === 'iman') return conIman(d, true)
                  const sinIman = conIman(d, false)
                  return {
                    ...sinIman,
                    argolla:
                      a === 'sin'
                        ? { ...d.argolla, tipo: 'sin' }
                        : {
                            tipo: d.argolla.tipo === 'sin' ? 'comun' : d.argolla.tipo,
                            posicion: a === 'arriba' ? 'auto' : 'izquierda',
                          },
                  }
                })
              }
              opciones={(['izquierda', 'arriba', 'iman', 'sin'] as const).map((a) => ({
                valor: a,
                etiqueta: t.argollas[a],
              }))}
            />
            <MedidaDelIman />
          </Grupo>

          <Grupo titulo={es.llavero.espesor}>
            <Opciones
              nombre="espesor"
              valor={diseno.cuerpo.espesor}
              alCambiar={(espesor) =>
                cambiarDiseno((d) => ({ ...d, cuerpo: { ...d.cuerpo, espesor } }))
              }
              opciones={(['delgado', 'estandar', 'reforzado'] as const).map((k) => ({
                valor: D.ESPESOR[k],
                etiqueta: es.llavero.espesores[k],
                detalle: `${String(D.ESPESOR[k]).replace('.', ',')} mm`,
              }))}
            />
          </Grupo>

          <Grupo titulo={es.colores.impresora}>
            <Opciones
              nombre="impresora"
              valor={diseno.impresion.modoColor}
              alCambiar={(m) =>
                cambiarDiseno((d) => ({ ...d, impresion: { ...d.impresion, modoColor: m } }))
              }
              opciones={[
                { valor: 'a_ras' as const, etiqueta: es.colores.variosSlots },
                { valor: 'apilado' as const, etiqueta: es.colores.unSlot },
              ]}
            />
          </Grupo>

          <FranjaAvisos avisos={resultado?.avisos ?? []} casos={[]} />
        </aside>
      </main>

      <footer className="fixed inset-x-0 bottom-0 flex items-center justify-end gap-3 border-t border-borde bg-grafito px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static">
        <BotonPrimario onClick={descargar} disabled={!listo}>
          {diseno.iman ? t.listoIman : t.listo} →
        </BotonPrimario>
      </footer>
    </div>
  )
}
