// /descargar (plan §4.6): un solo boton grande. El selector de slicer no cambia que se baja:
// solo cambia cual archivo lleva la estrella y que pasos se muestran.

import { useEffect, useMemo, useState } from 'react'
import { BotonPrimario, BotonSecundario, Grupo, Opciones } from '../crear/controles.tsx'
import { bajarArchivo, coloresDePiezas } from '../crear/util.ts'
import Vista3D from '../crear/Vista3D.tsx'
import { desarmarZip } from '../export/paquete.ts'
import { guardarDiseno, useCuenta } from '../estado/cuenta.ts'
import { armarZip, empezarDeNuevo, useDocumento, type Construccion } from '../estado/documento.ts'
import { es } from '../i18n/es.ts'
import Encabezado from '../marco/Encabezado.tsx'
import { ir } from '../ruta.ts'

type Slicer = 'bambu' | 'prusa' | 'otro'

export default function Descargar() {
  const diseno = useDocumento((s) => s.diseno)
  const [armado, setArmado] = useState<Construccion | null>(null)
  const [slicer, setSlicer] = useState<Slicer>('bambu')
  const { correo, guardando } = useCuenta()
  const [guardado, setGuardado] = useState(false)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (!diseno) {
      ir('/')
      return
    }
    let vigente = true
    void armarZip().then((c) => vigente && setArmado(c))
    return () => {
      vigente = false
    }
  }, [diseno])

  const r = armado?.resultado
  const colores = useMemo(() => (r ? coloresDePiezas(r) : []), [r])
  if (!diseno) return null

  const paquete = armado?.paquete
  const descargar = () => {
    if (!paquete) return
    setFallo(!bajarArchivo(paquete.zip, paquete.nombreZip, 'application/zip'))
  }

  return (
    <div className="min-h-svh">
      <Encabezado
        accion={
          <BotonSecundario onClick={() => ir('/llaveros/crear', 'llavero')}>
            ← {es.descargar.volver}
          </BotonSecundario>
        }
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-6">
        {!r ? (
          <p role="status" className="text-tiza-suave">
            {es.descargar.preparando}
          </p>
        ) : (
          <>
            <section className="grid gap-5 sm:grid-cols-[14rem_1fr]">
              <div className="h-56 overflow-hidden rounded-2xl bg-lienzo">
                <Vista3D piezas={r.piezas} colores={colores} modo="3d" />
              </div>
              <div className="flex flex-col gap-1.5">
                <h1 className="text-2xl font-bold tracking-tight">{es.descargar.listo}</h1>
                <p>
                  {es.descargar.medidas(
                    r.medidas[0],
                    r.medidas[1],
                    r.medidas[2],
                    r.filamentos.length,
                  )}
                </p>
                <p className="text-tiza-suave">{es.descargar.pieza(r.estimacion.gramosPieza)}</p>
                {r.modoColor === 'a_ras' && r.estimacion.cambios > 0 && (
                  <p className="text-tiza-suave">
                    {es.descargar.purga(r.estimacion.gramosPurga, r.estimacion.cambios)}
                  </p>
                )}
                {r.modoColor === 'apilado' && r.estimacion.cambios > 0 && (
                  <p className="text-tiza-suave">
                    {es.descargar.cebado(
                      r.estimacion.cambios,
                      r.estimacion.gramosCebado / r.estimacion.cambios,
                    )}
                  </p>
                )}
              </div>
            </section>

            {r.bloqueante ? (
              <section className="flex flex-col gap-3 rounded-xl bg-alerta p-4 text-alerta-texto">
                <p className="font-semibold">{es.descargar.bloqueado}</p>
                <ul className="list-disc pl-5">
                  {r.avisos
                    .filter((a) => a.nivel === 'error')
                    .map((a) => (
                      <li key={a.mensaje}>{a.mensaje}</li>
                    ))}
                </ul>
              </section>
            ) : (
              <>
                {r.modoColor === 'a_ras' && r.estimacion.cambios > 0 && (
                  <p className="rounded-xl bg-aviso p-4 text-aviso-texto">
                    💡{' '}
                    {es.descargar.consejoPurga(r.estimacion.gramosPurga, r.estimacion.gramosPieza)}
                  </p>
                )}

                <button
                  type="button"
                  onClick={descargar}
                  disabled={!paquete}
                  className="min-h-14 rounded-2xl bg-lima px-6 text-lg font-bold text-carbon hover:bg-lima-claro disabled:opacity-40"
                >
                  {paquete ? es.descargar.boton(paquete.zip.byteLength) : es.descargar.preparando}
                </button>

                {fallo && paquete && (
                  <section className="flex flex-col gap-2 rounded-xl bg-aviso p-4 text-aviso-texto">
                    <p>⚠ {es.descargar.fallo}</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(desarmarZip(paquete.zip))
                        .filter(([nombre]) => !nombre.startsWith('stl/'))
                        .map(([nombre, datos]) => (
                          <button
                            key={nombre}
                            type="button"
                            onClick={() => bajarArchivo(datos, nombre)}
                            className="min-h-11 rounded-lg border border-aviso-texto/40 px-3 text-sm"
                          >
                            {nombre}
                          </button>
                        ))}
                    </div>
                  </section>
                )}

                {r.modoColor === 'apilado' && r.cambiosDeCapa.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h2 className="text-sm font-semibold tracking-wide text-tenue uppercase">
                      {es.descargar.cuandoCambiar}
                    </h2>
                    <ol className="flex flex-col gap-1 rounded-xl bg-grafito p-4 font-mono text-sm">
                      {r.cambiosDeCapa.map((c, i) => (
                        <li key={c.z}>
                          {es.descargar.capa(
                            Math.round(c.z / diseno.impresion.alturaCapa),
                            c.z,
                            r.filamentos[i + 1]?.nombre ?? c.hex,
                          )}
                        </li>
                      ))}
                    </ol>
                    <p className="text-sm text-tiza-suave">{es.descargar.pausaSola}</p>
                  </section>
                )}

                <Grupo titulo={es.descargar.slicer}>
                  <Opciones<Slicer>
                    nombre="slicer"
                    valor={slicer}
                    alCambiar={setSlicer}
                    opciones={(['bambu', 'prusa', 'otro'] as const).map((s) => ({
                      valor: s,
                      etiqueta: es.descargar.slicers[s],
                    }))}
                  />
                </Grupo>

                {paquete && (
                  <section className="flex flex-col gap-2">
                    <h2 className="text-sm font-semibold tracking-wide text-tenue uppercase">
                      {es.descargar.adentro}
                    </h2>
                    <ul className="flex flex-col gap-1 text-sm">
                      {paquete.archivos.map((nombre) => {
                        const destacado =
                          (slicer === 'bambu' && nombre.endsWith('.3mf')) ||
                          (slicer !== 'bambu' &&
                            nombre.startsWith('stl/') &&
                            // Un filamento: la pieza entera con pausas. Varios: un STL por color.
                            nombre.includes('pieza-entera') === (r.modoColor === 'apilado'))
                        const detalle = nombre.endsWith('.3mf')
                          ? es.descargar.archivos.tresMf
                          : nombre.includes('pieza-entera')
                            ? es.descargar.archivos.stlEntera
                            : nombre.startsWith('stl/')
                              ? es.descargar.archivos.stlColores
                              : nombre === 'INSTRUCCIONES.txt'
                                ? es.descargar.archivos.instrucciones
                                : es.descargar.archivos.proyecto
                        return (
                          <li
                            key={nombre}
                            className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2"
                          >
                            <span aria-hidden>{destacado ? '★' : ''}</span>
                            <span>
                              <span className="font-mono">{nombre}</span>{' '}
                              <span className="text-tenue">· {detalle}</span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold tracking-wide text-tenue uppercase">
                    {es.descargar.comoImprimir}
                  </h2>
                  <ol className="list-decimal pl-5 text-tiza">
                    {(r.modoColor === 'apilado' ? es.descargar.pasosApilado : es.descargar.pasos)[
                      slicer
                    ].map((paso) => (
                      <li key={paso}>{paso}</li>
                    ))}
                  </ol>
                </section>
              </>
            )}

            <div className="flex flex-wrap gap-2 border-t border-borde pt-4">
              <BotonSecundario
                onClick={() => {
                  empezarDeNuevo()
                  ir('/')
                }}
              >
                {es.descargar.otro}
              </BotonSecundario>
              <BotonSecundario
                onClick={() =>
                  bajarArchivo(
                    new TextEncoder().encode(JSON.stringify(diseno, null, 2)),
                    'proyecto.json',
                    'application/json',
                  )
                }
              >
                {es.descargar.guardar}
              </BotonSecundario>
              {correo ? (
                <BotonPrimario
                  onClick={() => void guardarDiseno(diseno).then(setGuardado)}
                  disabled={guardando || guardado}
                >
                  {guardado
                    ? es.cuenta.guardado
                    : guardando
                      ? es.cuenta.guardando
                      : es.cuenta.guardar}
                </BotonPrimario>
              ) : (
                <BotonSecundario onClick={() => ir('/', 'cuenta')}>
                  {es.cuenta.paraGuardar}
                </BotonSecundario>
              )}
            </div>
          </>
        )}
        {!r && (
          <BotonPrimario onClick={() => ir('/llaveros/crear', 'llavero')}>
            {es.descargar.volver}
          </BotonPrimario>
        )}
      </div>
    </div>
  )
}
