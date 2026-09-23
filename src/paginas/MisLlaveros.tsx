// Los llaveros guardados de la cuenta. Se guarda el diseño, no la imagen: al abrirlo se puede
// seguir tocando tamaño, colores y texto, pero no volver a la solapa Fondo.

import { useEffect } from 'react'
import { Marca } from '../marca/Isotipo.tsx'
import { usarDiseno } from '../estado/documento.ts'
import { borrarGuardado, listarGuardados, salir, traerDiseno, useCuenta } from '../estado/cuenta.ts'
import { es } from '../i18n/es.ts'
import { ir } from '../ruta.ts'

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR')

export default function MisLlaveros() {
  const { correo, guardados } = useCuenta()

  useEffect(() => {
    if (correo && !guardados) void listarGuardados()
  }, [correo, guardados])

  // Sin cuenta no hay nada que mostrar: a la landing, donde esta el ingreso
  useEffect(() => {
    if (correo === null) ir('/')
  }, [correo])

  const abrir = async (id: string) => {
    const d = await traerDiseno(id)
    if (d) {
      usarDiseno(d)
      ir('/llaveros/crear', 'llavero')
    }
  }

  return (
    <div className="min-h-svh bg-carbon text-tiza">
      <header className="flex items-center justify-between border-b border-borde px-4 py-3 sm:px-8">
        <button type="button" onClick={() => ir('/')} className="min-h-11">
          <Marca tam={30} texto="text-[17px] sm:text-[21px]" />
        </button>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-tenue sm:block">{correo}</span>
          <button
            type="button"
            onClick={() => void salir().then(() => ir('/'))}
            className="min-h-11 rounded-xl border border-borde-fuerte px-4 font-bold text-tiza"
          >
            {es.cuenta.salir}
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
        <h1 className="font-titulo text-[28px] font-normal sm:text-[38px]">
          {es.cuenta.misLlaveros}
        </h1>

        {guardados === null && <p className="text-tiza-suave">…</p>}

        {guardados?.length === 0 && (
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-borde bg-grafito p-6">
            <p className="text-tiza-suave">{es.cuenta.vacio}</p>
            <button
              type="button"
              onClick={() => ir('/')}
              className="min-h-11 rounded-xl bg-lima px-5 font-extrabold text-carbon"
            >
              {es.cuenta.empezar}
            </button>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {(guardados ?? []).map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-borde bg-grafito p-4"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-bold">{g.nombre}</span>
                <span className="text-sm text-tenue">
                  {es.cuenta.guardadoEl(fecha(g.actualizadoEn))}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void abrir(g.id)}
                className="min-h-11 rounded-xl bg-lima px-5 font-extrabold text-carbon"
              >
                {es.cuenta.abrir}
              </button>
              <button
                type="button"
                onClick={() => void borrarGuardado(g.id)}
                className="min-h-11 rounded-xl border border-borde-fuerte px-4 font-bold text-tiza-suave"
              >
                {es.cuenta.borrar}
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
