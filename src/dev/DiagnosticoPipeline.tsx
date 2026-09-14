// Pagina de diagnostico de F1.5: /#/dev/pipeline
// De punta a punta sin la interfaz final: imagen → mascara y colores → llavero → ZIP.
// Sirve para probar con imagenes propias y para medir tiempos en otros equipos (celular incluido).

import { useEffect, useMemo, useRef, useState } from 'react'
import { FUENTES, type IdFuente } from '../datos/fuentes.ts'
import { crearDiseno } from '../diseno/crear.ts'
import { agregarTexto } from '../diseno/texto.ts'
import type { Diseno, TipoArgolla } from '../diseno/tipos.ts'
import type { NombrePreset } from '../pipeline/presets.ts'
import { crearClienteGeometria, crearClienteImagen, crearGeneracion } from '../workers/clientes.ts'
import type { ApiGeometria } from '../workers/geometria.worker.ts'
import type { ApiImagen } from '../workers/imagen.worker.ts'

type Conversion = Awaited<ReturnType<ApiImagen['procesar']>>
type Construccion = Awaited<ReturnType<ApiGeometria['construirLlavero']>>

type OpcionesLlavero = {
  modoColor: Diseno['impresion']['modoColor']
  espesor: number
  argolla: TipoArgolla
  texto: string
  fuente: IdFuente
}

const nombreDe = (archivo: File) => archivo.name.replace(/\.[^.]+$/, '') || 'llavero'

const ETAPAS: Record<string, string> = {
  previa: 'Previa',
  mascaraPrevia: 'Buscar dibujo',
  reescalar: 'Reescalar',
  mascara: 'Máscara',
  prefiltro: 'Prefiltro',
  cuantizar: 'Colores',
  limpiar: 'Limpieza',
  contornos: 'Contornos',
}

function Vista({ conversion }: { conversion: Conversion }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = lienzo.current
    const { ancho, alto, etiquetas } = conversion.diagnostico
    if (!c) return
    c.width = ancho
    c.height = alto
    const ctx = c.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(ancho, alto)
    const colores = conversion.paleta.map((p) => {
      const n = Number.parseInt(p.hex.slice(1), 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    })
    for (let i = 0; i < etiquetas.length; i++) {
      const color = colores[etiquetas[i]!]
      if (!color) continue
      img.data.set([color[0]!, color[1]!, color[2]!, 255], i * 4)
    }
    ctx.putImageData(img, 0, 0)
  }, [conversion])
  return (
    <canvas
      ref={lienzo}
      className="h-auto max-h-80 w-full rounded-lg bg-[repeating-conic-gradient(#e7e5e4_0_25%,#fff_0_50%)] bg-[length:16px_16px] object-contain"
    />
  )
}

const Seccion = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2 rounded-lg bg-white p-4 shadow-sm">
    <h2 className="font-semibold">{titulo}</h2>
    {children}
  </section>
)

export default function DiagnosticoPipeline() {
  // Los workers se crean en el efecto y no con useMemo: en desarrollo StrictMode monta, desmonta
  // y vuelve a montar. Con useMemo, la limpieza del primer montaje los terminaba y el segundo se
  // quedaba con clientes muertos, cuyas llamadas nunca responden (medido en F1.5).
  const clientes = useRef<{
    imagen: ReturnType<typeof crearClienteImagen>
    geometria: ReturnType<typeof crearClienteGeometria>
  } | null>(null)
  useEffect(() => {
    const creados = { imagen: crearClienteImagen(), geometria: crearClienteGeometria() }
    clientes.current = creados
    return () => {
      creados.imagen.terminar()
      creados.geometria.terminar()
      clientes.current = null
    }
  }, [])
  const genImagen = useMemo(() => crearGeneracion(), [])
  const genGeometria = useMemo(() => crearGeneracion(), [])

  const [archivo, setArchivo] = useState<File | null>(null)
  const [preset, setPreset] = useState<NombrePreset | 'auto'>('auto')
  const [opciones, setOpciones] = useState<OpcionesLlavero>({
    modoColor: 'a_ras',
    espesor: 3.0,
    argolla: 'comun',
    texto: '',
    fuente: 'redonda',
  })
  const [conversion, setConversion] = useState<Conversion | null>(null)
  const [construccion, setConstruccion] = useState<Construccion | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Los calculos salen de los eventos que los causan, no de efectos: cada cambio dispara lo suyo
  const construirCon = (conv: Conversion, nombre: string, o: OpcionesLlavero) => {
    if (!conv.regiones.length) return setConstruccion(null)
    let diseno = crearDiseno(conv.regiones, {
      nombre,
      id: 'dev',
      ahora: new Date().toISOString(),
      appVersion: 'dev',
      modoColor: o.modoColor,
      espesor: o.espesor,
    })
    diseno.argolla = { tipo: o.argolla, posicion: 'auto' }
    if (o.texto.trim()) diseno = agregarTexto(diseno, o.texto.trim(), { fuente: o.fuente })
    setOcupado('Construyendo el llavero…')
    genGeometria
      .envolver(
        clientes.current!.geometria.api.construirLlavero(
          diseno,
          new Date().toLocaleDateString('es-AR'),
        ),
      )
      .then((r) => r && setConstruccion(r))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setOcupado(null))
  }

  const procesar = (nuevoArchivo: File | null, nuevoPreset: NombrePreset | 'auto') => {
    setArchivo(nuevoArchivo)
    setPreset(nuevoPreset)
    if (!nuevoArchivo) return
    setError(null)
    setOcupado('Procesando la imagen…')
    genImagen
      .envolver(clientes.current!.imagen.api.procesar(nuevoArchivo, { preset: nuevoPreset }))
      .then((r) => {
        if (!r) return
        setConversion(r)
        construirCon(r, nombreDe(nuevoArchivo), opciones)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e))
        setOcupado(null)
      })
  }

  const cambiarOpcion = (cambio: Partial<OpcionesLlavero>) => {
    const nuevas = { ...opciones, ...cambio }
    setOpciones(nuevas)
    if (conversion && archivo) construirCon(conversion, nombreDe(archivo), nuevas)
  }

  const descargar = () => {
    const paquete = construccion?.paquete
    if (!paquete) return
    const url = URL.createObjectURL(
      new Blob([paquete.zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = paquete.nombreZip
    a.click()
    URL.revokeObjectURL(url)
  }

  const d = conversion?.diagnostico
  const r = construccion?.resultado
  const totalPipeline = d ? Object.values(d.tiemposMs).reduce((a, b) => a + b, 0) : 0

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-4 p-4 text-stone-900">
      <header>
        <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
          Diagnóstico · F1.5
        </p>
        <h1 className="text-2xl font-bold">De imagen a llavero</h1>
        <p className="text-sm text-stone-600">
          Sin la interfaz final: para probar imágenes propias y medir tiempos en este dispositivo.
        </p>
      </header>

      <Seccion titulo="Entrada">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => procesar(e.target.files?.[0] ?? null, preset)}
          className="text-sm"
        />
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            Preset
            <select
              value={preset}
              onChange={(e) => procesar(archivo, e.target.value as NombrePreset | 'auto')}
              className="rounded border p-1"
            >
              <option value="auto">Automático</option>
              <option value="dibujo">Dibujo / logo</option>
              <option value="foto">Foto</option>
              <option value="silueta">Silueta</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Modo de color
            <select
              value={opciones.modoColor}
              onChange={(e) =>
                cambiarOpcion({ modoColor: e.target.value as Diseno['impresion']['modoColor'] })
              }
              className="rounded border p-1"
            >
              <option value="a_ras">Varios colores (AMS)</option>
              <option value="apilado">Un solo extrusor</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Espesor
            <select
              value={opciones.espesor}
              onChange={(e) => cambiarOpcion({ espesor: Number(e.target.value) })}
              className="rounded border p-1"
            >
              <option value={1.6}>Delgado · 1,6 mm</option>
              <option value={3.0}>Estándar · 3,0 mm</option>
              <option value={4.0}>Reforzado · 4,0 mm</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Argolla
            <select
              value={opciones.argolla}
              onChange={(e) => cambiarOpcion({ argolla: e.target.value as TipoArgolla })}
              className="rounded border p-1"
            >
              <option value="bola">Cadena de bolitas · Ø3,7</option>
              <option value="comun">Común · Ø4,2</option>
              <option value="gruesa">Gruesa · Ø5,2</option>
              <option value="sin">Sin argolla</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 text-sm">
          <label className="flex flex-col gap-1">
            Texto (opcional)
            <input
              type="text"
              value={opciones.texto}
              maxLength={24}
              placeholder="Ej: Guido"
              onChange={(e) => setOpciones({ ...opciones, texto: e.target.value })}
              onBlur={() => cambiarOpcion({})}
              onKeyDown={(e) => e.key === 'Enter' && cambiarOpcion({})}
              className="rounded border p-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            Fuente
            <select
              value={opciones.fuente}
              onChange={(e) => cambiarOpcion({ fuente: e.target.value as IdFuente })}
              className="rounded border p-1"
            >
              {FUENTES.map((fuente) => (
                <option key={fuente.id} value={fuente.id}>
                  {fuente.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        {ocupado && (
          <p role="status" className="text-sm text-stone-600">
            {ocupado}
          </p>
        )}
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-900">{error}</p>}
      </Seccion>

      {conversion && d && (
        <Seccion titulo="Imagen">
          <Vista conversion={conversion} />
          <p className="text-sm text-stone-600">
            Preset <b>{conversion.preset}</b> · fondo por <b>{d.fuenteMascara}</b> ·{' '}
            {conversion.fuente.ancho} × {conversion.fuente.alto} px → {d.ancho} × {d.alto} px a{' '}
            {d.mmPorPixel.toFixed(3)} mm/px · {conversion.regiones.length} colores · {d.vertices}{' '}
            vértices
          </p>
          <div className="flex flex-wrap gap-2">
            {conversion.regiones.map((reg) => (
              <span
                key={reg.id}
                className="flex items-center gap-1 rounded border px-2 py-1 font-mono text-xs"
              >
                <span className="size-4 rounded border" style={{ background: reg.hex }} /> {reg.hex}
              </span>
            ))}
          </div>
          {d.casos.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {d.casos.map((c) => (
                <li key={c.codigo} className="rounded bg-amber-50 p-2 text-amber-900">
                  🟡 {c.mensaje}
                </li>
              ))}
            </ul>
          )}
          <table className="w-full text-left text-xs">
            <tbody>
              <tr>
                <td className="py-0.5">Decodificar</td>
                <td className="text-right font-mono">{conversion.msDecodificar.toFixed(0)} ms</td>
              </tr>
              {Object.entries(d.tiemposMs).map(([etapa, ms]) => (
                <tr key={etapa}>
                  <td className="py-0.5">{ETAPAS[etapa] ?? etapa}</td>
                  <td className="text-right font-mono">{ms.toFixed(0)} ms</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-0.5">Total del pipeline</td>
                <td className="text-right font-mono">{totalPipeline.toFixed(0)} ms</td>
              </tr>
            </tbody>
          </table>
        </Seccion>
      )}

      {construccion && r && (
        <Seccion titulo="Llavero">
          <p className="text-sm">
            {r.medidas.map((x) => x.toFixed(1)).join(' × ')} mm · ~
            {r.estimacion.gramosPieza.toFixed(1)} g ·{' '}
            {r.modoColor === 'a_ras'
              ? `~${r.estimacion.cambios} cambios, ~${r.estimacion.gramosPurga.toFixed(1)} g de purga`
              : `${r.estimacion.cambios} pausas, ~${r.estimacion.gramosCebado.toFixed(1)} g de cebado`}
          </p>
          <div className="flex flex-wrap gap-2">
            {r.filamentos.map((f, i) => (
              <span
                key={`${f.id}-${i}`}
                className="flex items-center gap-1 rounded border px-2 py-1 text-xs"
              >
                <span className="size-4 rounded border" style={{ background: f.hex }} />
                {r.modoColor === 'a_ras'
                  ? `Slot ${f.slot}`
                  : i === 0
                    ? 'Base'
                    : `Cambio ${i}`} · {f.nombre}
              </span>
            ))}
          </div>
          {r.avisos.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {r.avisos.map((a, i) => (
                <li
                  key={`${a.codigo}-${i}`}
                  className={`rounded p-2 ${a.nivel === 'error' ? 'bg-red-50 text-red-900' : 'bg-amber-50 text-amber-900'}`}
                >
                  {a.nivel === 'error' ? '🔴' : '🟡'} {a.mensaje}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-stone-500">
            Construir {construccion.msConstruir.toFixed(0)} ms · empaquetar{' '}
            {construccion.msEmpaquetar.toFixed(0)} ms
          </p>
          <button
            type="button"
            onClick={descargar}
            disabled={!construccion.paquete}
            className="rounded-lg bg-stone-900 px-4 py-3 font-semibold text-white disabled:opacity-40"
          >
            {construccion.paquete
              ? `Descargar ${construccion.paquete.nombreZip}`
              : 'Hay errores que bloquean la descarga'}
          </button>
        </Seccion>
      )}
    </main>
  )
}
