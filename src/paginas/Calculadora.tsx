// Calculadora 3D (docs/calculadora-3d-spec.md): costo real de una impresión y precio de venta.
// Las cuentas viven en src/calculadora/formulas.ts y las verifican los tests; acá solo está la
// pantalla. Todo se guarda en el navegador: esta app no habla con ningún servidor.

import { useState } from 'react'
import Campo from '../calculadora/Campo.tsx'
import {
  formatear,
  GASTOS_POR_DEFECTO,
  IMPRESORAS,
  MONEDAS,
  MULTIPLICADORES,
  OTRA_IMPRESORA,
  simboloDe,
} from '../calculadora/datos.ts'
import {
  aNumero,
  calcular,
  type Entradas,
  type GastosFijos,
  type Pieza,
} from '../calculadora/formulas.ts'
import {
  borrarPerfil,
  borrarProducto,
  comoCsv,
  comoJson,
  desdeJson,
  guardarPerfil,
  guardarProducto,
  leerPerfiles,
  leerProductos,
  leerUltimoPerfil,
  recordarUltimoPerfil,
  type Perfil,
  type Producto,
} from '../calculadora/guardado.ts'
import { bajarArchivo } from '../crear/util.ts'
import { esCalculadora as t } from '../i18n/esCalculadora.ts'
import Encabezado from '../marco/Encabezado.tsx'

const PIEZA_VACIA: Pieza = { horas: 0, minutos: 0, gramos: 0, insumos: 0 }

const TARJETA = 'flex flex-col gap-4 rounded-2xl border border-borde bg-grafito p-4 sm:p-5'
const TITULO = 'text-xs font-bold tracking-[0.06em] text-tenue uppercase'
const BOTON =
  'min-h-11 rounded-lg border border-borde-fuerte px-4 text-sm font-bold text-tiza-suave hover:border-tiza'
const BOTON_LIMA =
  'min-h-11 rounded-lg bg-lima px-4 text-sm font-extrabold text-carbon hover:bg-lima-claro'

/** Lo guardado en el navegador se lee una sola vez, antes del primer dibujo. */
function alEntrar() {
  const perfiles = leerPerfiles()
  const ultimo = leerUltimoPerfil()
  const p = perfiles[ultimo]
  const { moneda = 'ARS', ...fijos } = p ?? {}
  return {
    perfiles,
    productos: leerProductos(),
    perfilActual: p ? ultimo : '',
    gastos: p ? (fijos as GastosFijos) : GASTOS_POR_DEFECTO,
    moneda,
  }
}

export default function Calculadora() {
  const [inicial] = useState(alEntrar)
  const [gastos, setGastos] = useState<GastosFijos>(inicial.gastos)
  const [pieza, setPieza] = useState<Pieza>(PIEZA_VACIA)
  const [multiplicador, setMultiplicador] = useState(3)
  const [otroMultiplicador, setOtroMultiplicador] = useState('')
  const [moneda, setMoneda] = useState(inicial.moneda)
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>(inicial.perfiles)
  const [perfilActual, setPerfilActual] = useState(inicial.perfilActual)
  const [nombrePerfil, setNombrePerfil] = useState<string | null>(null)
  const [productos, setProductos] = useState<Producto[]>(inicial.productos)
  const [nombreProducto, setNombreProducto] = useState<string | null>(null)
  const [verReferencias, setVerReferencias] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const s = simboloDe(moneda)
  const entradas: Entradas = { ...gastos, ...pieza, multiplicador }
  // Las cuentas son cuatro multiplicaciones: se rehacen en cada dibujo, sin memoria de por medio
  const r = calcular(entradas)
  const plata = (n: number) => formatear(n, moneda)

  const elegirPerfil = (nombre: string) => {
    setPerfilActual(nombre)
    const p = perfiles[nombre]
    if (!p) return
    const { moneda: m, ...fijos } = p
    setGastos(fijos)
    setMoneda(m)
    recordarUltimoPerfil(nombre)
  }

  const nuevoPerfil = () => {
    setPerfilActual('')
    setGastos(GASTOS_POR_DEFECTO)
  }

  const confirmarPerfil = (nombre: string) => {
    if (!nombre.trim()) return setNombrePerfil(null)
    setPerfiles(guardarPerfil(nombre.trim(), { ...gastos, moneda }))
    setPerfilActual(nombre.trim())
    setNombrePerfil(null)
  }

  const confirmarProducto = (nombre: string) => {
    if (!nombre.trim()) return setNombreProducto(null)
    setProductos(
      guardarProducto({
        nombre: nombre.trim(),
        perfil: perfilActual,
        moneda,
        entradas,
        resultados: r,
      }),
    )
    setNombreProducto(null)
  }

  const cargarProducto = (p: Producto) => {
    const { horas, minutos, gramos, insumos, multiplicador: m, ...fijos } = p.entradas
    setGastos(fijos)
    setPieza({ horas, minutos, gramos, insumos })
    setMultiplicador(m)
    setMoneda(p.moneda)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const traerJson = async (archivo: File | undefined) => {
    if (!archivo) return
    const r = desdeJson(await archivo.text())
    if (!r) return setAviso(t.productos.noEntro)
    setPerfiles(leerPerfiles())
    setProductos(leerProductos())
    setAviso(t.productos.importados(r.perfiles, r.productos))
  }

  const esPersonalizado = !MULTIPLICADORES.some((m) => m.valor === multiplicador)

  return (
    <div className="min-h-svh">
      <Encabezado appActual="calculadora" />

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-titulo text-[28px] font-normal sm:text-[38px]">{t.nombre}</h1>
          <p className="text-tiza-suave">{t.bajada}</p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="flex flex-col gap-5">
            {/* ---------------------------------------------------------- perfil */}
            <section className={TARJETA}>
              <h2 className={TITULO}>{t.perfil.titulo}</h2>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-semibold text-tiza-suave">
                  {t.perfil.titulo}
                  <select
                    value={perfilActual}
                    onChange={(e) => elegirPerfil(e.target.value)}
                    className="min-h-11 rounded-lg border border-borde-fuerte bg-grafito px-3 text-tiza"
                  >
                    <option value="">{t.perfil.nuevo}</option>
                    {Object.keys(perfiles).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold text-tiza-suave">
                  {t.perfil.moneda}
                  <select
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value)}
                    className="min-h-11 rounded-lg border border-borde-fuerte bg-grafito px-3 text-tiza"
                  >
                    {MONEDAS.map((m) => (
                      <option key={m.codigo} value={m.codigo}>
                        {m.nombre} ({m.simbolo})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {nombrePerfil === null ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={nuevoPerfil} className={BOTON}>
                    {t.perfil.botonNuevo}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNombrePerfil(perfilActual)}
                    className={BOTON_LIMA}
                  >
                    {t.perfil.guardar}
                  </button>
                  {perfilActual && (
                    <button
                      type="button"
                      onClick={() => {
                        setPerfiles(borrarPerfil(perfilActual))
                        nuevoPerfil()
                      }}
                      className={BOTON}
                    >
                      {t.perfil.borrar}
                    </button>
                  )}
                </div>
              ) : (
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    confirmarPerfil(nombrePerfil)
                  }}
                >
                  <input
                    autoFocus
                    value={nombrePerfil}
                    onChange={(e) => setNombrePerfil(e.target.value)}
                    placeholder={t.perfil.comoSeLlama}
                    className="min-h-11 min-w-48 flex-1 rounded-lg border border-borde-fuerte bg-grafito px-3 text-tiza"
                  />
                  <button type="submit" className={BOTON_LIMA}>
                    {t.perfil.guardar}
                  </button>
                </form>
              )}
              <p className="text-xs text-tenue">{t.perfil.ayuda}</p>
            </section>

            {/* ---------------------------------------------------------- gastos fijos */}
            <section className={TARJETA}>
              <h2 className={TITULO}>{t.gastos.titulo}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  etiqueta={t.gastos.precioKg(s)}
                  valor={gastos.precioKg}
                  alCambiar={(precioKg) => setGastos({ ...gastos, precioKg })}
                />
                <Campo
                  etiqueta={t.gastos.precioKwh(s)}
                  valor={gastos.precioKwh}
                  alCambiar={(precioKwh) => setGastos({ ...gastos, precioKwh })}
                />
                <label className="flex flex-col gap-1 text-sm font-semibold text-tiza-suave">
                  {t.gastos.modelo}
                  <select
                    value={gastos.modelo}
                    onChange={(e) => {
                      const i = IMPRESORAS.find((x) => x.nombre === e.target.value)
                      setGastos({
                        ...gastos,
                        modelo: e.target.value,
                        watts: i?.w ?? gastos.watts,
                      })
                    }}
                    className="min-h-11 rounded-lg border border-borde-fuerte bg-grafito px-3 text-tiza"
                  >
                    {IMPRESORAS.map((i) => (
                      <option key={i.nombre} value={i.nombre}>
                        {i.w === null ? i.nombre : `${i.nombre} (${i.w} W)`}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs leading-relaxed font-normal text-tenue">
                    {t.gastos.modeloAyuda}
                  </span>
                </label>
                <Campo
                  etiqueta={t.gastos.watts}
                  valor={gastos.watts}
                  // Tocar el consumo a mano deja el modelo en "Otro"
                  alCambiar={(watts) => setGastos({ ...gastos, watts, modelo: OTRA_IMPRESORA })}
                  ayuda={t.gastos.wattsAyuda}
                />
                <Campo
                  etiqueta={t.gastos.vidaUtil}
                  valor={gastos.vidaUtilHs}
                  alCambiar={(vidaUtilHs) => setGastos({ ...gastos, vidaUtilHs })}
                  ayuda={t.gastos.vidaUtilAyuda}
                />
                <Campo
                  etiqueta={t.gastos.repuestos(s)}
                  valor={gastos.repuestos}
                  alCambiar={(repuestos) => setGastos({ ...gastos, repuestos })}
                />
                <Campo
                  etiqueta={t.gastos.error}
                  valor={gastos.errorPct}
                  alCambiar={(errorPct) => setGastos({ ...gastos, errorPct })}
                  ayuda={t.gastos.errorAyuda}
                />
              </div>
            </section>

            {/* ---------------------------------------------------------- pieza */}
            <section className={TARJETA}>
              <h2 className={TITULO}>{t.pieza.titulo}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  etiqueta={t.pieza.horas}
                  valor={pieza.horas}
                  alCambiar={(horas) => setPieza({ ...pieza, horas })}
                  vacioSiCero
                />
                <Campo
                  etiqueta={t.pieza.minutos}
                  valor={pieza.minutos}
                  alCambiar={(minutos) => setPieza({ ...pieza, minutos })}
                  vacioSiCero
                  max={59}
                />
                <Campo
                  etiqueta={t.pieza.gramos}
                  valor={pieza.gramos}
                  alCambiar={(gramos) => setPieza({ ...pieza, gramos })}
                  vacioSiCero
                />
                <Campo
                  etiqueta={t.pieza.insumos(s)}
                  valor={pieza.insumos}
                  alCambiar={(insumos) => setPieza({ ...pieza, insumos })}
                  vacioSiCero
                  ayuda={t.pieza.insumosAyuda}
                />
              </div>
            </section>

            {/* ---------------------------------------------------------- margen */}
            <section className={TARJETA}>
              <h2 className={TITULO}>{t.margen.titulo}</h2>
              <div className="flex flex-wrap gap-2">
                {MULTIPLICADORES.map((m) => (
                  <button
                    key={m.valor}
                    type="button"
                    onClick={() => setMultiplicador(m.valor)}
                    className={`min-h-11 min-w-14 rounded-lg border px-3 font-bold ${
                      multiplicador === m.valor
                        ? 'border-lima bg-lima text-carbon'
                        : 'border-borde-fuerte bg-grafito text-tiza-suave hover:border-tiza'
                    }`}
                  >
                    ×{String(m.valor).replace('.', ',')}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMultiplicador(aNumero(otroMultiplicador) || 2.8)}
                  className={`min-h-11 rounded-lg border px-3 font-bold ${
                    esPersonalizado
                      ? 'border-lima bg-lima text-carbon'
                      : 'border-borde-fuerte bg-grafito text-tiza-suave hover:border-tiza'
                  }`}
                >
                  {t.margen.personalizado}
                </button>
              </div>

              {esPersonalizado && (
                <div className="flex flex-col gap-1">
                  <input
                    value={otroMultiplicador}
                    inputMode="decimal"
                    onChange={(e) => {
                      setOtroMultiplicador(e.target.value)
                      const n = aNumero(e.target.value)
                      if (n > 0) setMultiplicador(n)
                    }}
                    placeholder="2,8"
                    className="min-h-11 max-w-40 rounded-lg border border-borde-fuerte bg-grafito px-3 text-tiza tabular-nums"
                  />
                  <p className="text-xs text-tenue">{t.margen.personalizadoAyuda}</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setVerReferencias((v) => !v)}
                className="min-h-11 self-start text-sm text-tiza-suave underline underline-offset-4"
              >
                {verReferencias ? t.margen.ocultar : t.margen.referencias}
              </button>
              {verReferencias && (
                <dl className="flex flex-col gap-1 text-sm">
                  {MULTIPLICADORES.map((m) => (
                    <div key={m.valor} className="flex gap-3">
                      <dt className="w-12 font-bold tabular-nums">
                        ×{String(m.valor).replace('.', ',')}
                      </dt>
                      <dd className="text-tiza-suave">{m.referencia}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </div>

          {/* ------------------------------------------------------------ resultados */}
          <section className={`${TARJETA} lg:sticky lg:top-4`}>
            <h2 className={TITULO}>{t.resultados.titulo}</h2>
            <dl className="flex flex-col gap-2 text-sm">
              {[
                [t.resultados.material, r.material],
                [t.resultados.luz, r.luz],
                [t.resultados.desgaste, r.desgaste],
                [t.resultados.error, r.margenError],
                [t.resultados.costoTotal, r.costoTotal],
                [t.resultados.insumos, r.insumosFinal],
              ].map(([nombre, valor]) => (
                <div key={nombre as string} className="flex justify-between gap-3">
                  <dt className="text-tiza-suave">{nombre as string}</dt>
                  <dd className="font-semibold tabular-nums">{plata(valor as number)}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-3 border-t border-borde pt-4">
              <div className="flex flex-col gap-1">
                <span className={TITULO}>{t.resultados.total}</span>
                <span className="text-3xl font-black tabular-nums text-lima">
                  {plata(r.totalCobrar)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className={TITULO}>{t.resultados.ml}</span>
                <span className="text-2xl font-black tabular-nums text-[#7EC8F2]">
                  {plata(r.precioML)}
                </span>
                <span className="text-xs text-tenue">{t.resultados.mlAyuda}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(plata(r.totalCobrar)).then(() => {
                    setCopiado(true)
                    setTimeout(() => setCopiado(false), 1500)
                  })
                }}
                className={BOTON}
              >
                {copiado ? t.resultados.copiado : t.resultados.copiar}
              </button>

              {nombreProducto === null ? (
                <button type="button" onClick={() => setNombreProducto('')} className={BOTON_LIMA}>
                  {t.resultados.guardarProducto}
                </button>
              ) : (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    confirmarProducto(nombreProducto)
                  }}
                >
                  <input
                    autoFocus
                    value={nombreProducto}
                    onChange={(e) => setNombreProducto(e.target.value)}
                    placeholder={t.resultados.comoSeLlamaProducto}
                    className="min-h-11 rounded-lg border border-borde-fuerte bg-grafito px-3 text-tiza"
                  />
                  <button type="submit" className={BOTON_LIMA}>
                    {t.resultados.guardarProducto}
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>

        {/* -------------------------------------------------------------- productos */}
        <section className={TARJETA}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={TITULO}>{t.productos.titulo}</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  bajarArchivo(
                    new TextEncoder().encode(comoJson()),
                    'calculadora-3d.json',
                    'application/json',
                  )
                }
                className={BOTON}
              >
                {t.productos.exportarJson}
              </button>
              <button
                type="button"
                onClick={() =>
                  bajarArchivo(new TextEncoder().encode(comoCsv()), 'mis-productos.csv', 'text/csv')
                }
                className={BOTON}
              >
                {t.productos.exportarCsv}
              </button>
              <label className={`${BOTON} cursor-pointer content-center`}>
                {t.productos.importarJson}
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => void traerJson(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          {aviso && <p className="rounded-lg bg-aviso p-3 text-sm text-aviso-texto">{aviso}</p>}

          {productos.length === 0 ? (
            <p className="text-sm text-tenue">{t.productos.vacio}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="text-xs text-tenue uppercase">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">{t.productos.nombre}</th>
                    <th className="py-2 pr-3 font-semibold">{t.productos.fecha}</th>
                    <th className="py-2 pr-3 font-semibold">{t.productos.gramos}</th>
                    <th className="py-2 pr-3 font-semibold">{t.productos.tiempo}</th>
                    <th className="py-2 pr-3 font-semibold">{t.productos.costo}</th>
                    <th className="py-2 pr-3 font-semibold">{t.productos.total}</th>
                    <th className="py-2 pr-3 font-semibold">{t.productos.ml}</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {productos.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-3 font-semibold">{p.nombre}</td>
                      <td className="py-2 pr-3 text-tenue">
                        {new Date(p.fecha).toLocaleDateString('es-AR')}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{p.entradas.gramos} g</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {p.entradas.horas} h {p.entradas.minutos} min
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {formatear(p.resultados.costoTotal, p.moneda)}
                      </td>
                      <td className="py-2 pr-3 font-bold tabular-nums text-lima">
                        {formatear(p.resultados.totalCobrar, p.moneda)}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-[#7EC8F2]">
                        {formatear(p.resultados.precioML, p.moneda)}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => cargarProducto(p)}
                            className="min-h-11 rounded-lg px-3 text-sm font-bold text-lima"
                          >
                            {t.productos.cargar}
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductos(borrarProducto(p.id))}
                            className="min-h-11 rounded-lg px-3 text-sm text-tiza-suave"
                          >
                            {t.productos.borrar}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-tenue">{t.guardadoAca}</p>
        </section>
      </main>
    </div>
  )
}
