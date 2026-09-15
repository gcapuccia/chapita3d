// Solapa Colores (plan §4.4): cuantos colores, la lista y la pregunta de la impresora.
// Tocar un color abre su editor: cambiar el filamento y el grosor de sus lineas (F2.3).

import { useState } from 'react'
import { cambiarColores, cambiarDiseno, useDocumento } from '../estado/documento.ts'
import { es } from '../i18n/es.ts'
import EditorDeColor from './EditorDeColor.tsx'
import { Grupo, Opciones } from './controles.tsx'

export function PanelColores() {
  const colores = useDocumento((s) => s.colores)
  const diseno = useDocumento((s) => s.diseno)
  const construccion = useDocumento((s) => s.construccion)
  const hayImagen = useDocumento((s) => !!s.archivo)
  const [abierto, setAbierto] = useState<string | null>(null)
  if (!diseno) return null
  const r = construccion?.resultado
  const modo = diseno.impresion.modoColor
  const enImagen = new Set(
    diseno.piezas.filter((p) => p.tipo === 'region').map((p) => p.filamentoId),
  ).size
  const filamentos = [...diseno.filamentos].sort((a, b) => a.slot - b.slot)
  // En apilado el orden es de abajo hacia arriba, y lo decide la construccion
  const orden = (id: string) => r?.filamentos.findIndex((f) => f.id === id) ?? -1

  return (
    <div className="flex flex-col gap-6">
      {hayImagen && (
        <Grupo titulo={es.colores.cuantos}>
          <Opciones
            nombre="colores"
            valor={colores}
            alCambiar={cambiarColores}
            opciones={[2, 3, 4, 5, 6].map((n) => ({ valor: n, etiqueta: n }))}
          />
          {enImagen < colores && (
            <p className="text-sm text-stone-600">{es.colores.fusionados(enImagen)}</p>
          )}
        </Grupo>
      )}

      <Grupo titulo={es.colores.lista}>
        <ul className="flex flex-col divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {filamentos.map((f) => {
            const i = orden(f.id)
            return (
              <li key={f.id} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => setAbierto(abierto === f.id ? null : f.id)}
                  aria-expanded={abierto === f.id}
                  className="flex min-h-11 items-center gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50"
                >
                  <span
                    className="size-6 shrink-0 rounded-md border border-stone-300"
                    style={{ background: f.hex }}
                  />
                  <span className="flex-1">{f.nombre}</span>
                  <span className="text-xs text-stone-500">
                    {modo === 'a_ras'
                      ? es.colores.lugar(f.slot)
                      : i <= 0
                        ? es.colores.base
                        : `${i}°`}
                  </span>
                  <span aria-hidden className="text-stone-400">
                    {abierto === f.id ? '▴' : '▾'}
                  </span>
                </button>
                {abierto === f.id && (
                  <div className="px-3 pb-3">
                    <EditorDeColor filamento={f} hayImagen={hayImagen} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-stone-500">{es.colores.tocarParaCambiar}</p>
      </Grupo>

      <Grupo titulo={es.colores.impresora}>
        <Opciones
          nombre="impresora"
          valor={modo}
          alCambiar={(m) =>
            cambiarDiseno((d) => ({ ...d, impresion: { ...d.impresion, modoColor: m } }))
          }
          opciones={[
            { valor: 'a_ras' as const, etiqueta: es.colores.variosSlots },
            { valor: 'apilado' as const, etiqueta: es.colores.unSlot },
          ]}
        />
        {modo === 'apilado' && r && r.cambiosDeCapa.length > 0 && (
          <p className="text-sm text-stone-600">{es.colores.pausas(r.cambiosDeCapa.length)}</p>
        )}
      </Grupo>
    </div>
  )
}
