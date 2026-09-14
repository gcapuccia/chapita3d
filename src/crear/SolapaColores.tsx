// Solapa Colores (plan §4.4). Incremento 1: cuantos colores, la lista y la pregunta de la impresora.
// Cambiar filamentos, reordenar y fusionar llegan en el incremento 2.

import { cambiarColores, cambiarDiseno, useDocumento } from '../estado/documento.ts'
import { es } from '../i18n/es.ts'
import { Grupo, Opciones } from './controles.tsx'

export function PanelColores() {
  const colores = useDocumento((s) => s.colores)
  const diseno = useDocumento((s) => s.diseno)
  const construccion = useDocumento((s) => s.construccion)
  const hayImagen = useDocumento((s) => !!s.archivo)
  if (!diseno) return null
  const r = construccion?.resultado
  const modo = diseno.impresion.modoColor
  const enImagen = new Set(
    diseno.piezas.filter((p) => p.tipo === 'region').map((p) => p.filamentoId),
  ).size
  const filamentos = r?.filamentos ?? [...diseno.filamentos].sort((a, b) => a.slot - b.slot)

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
        <ul className="flex flex-col divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {filamentos.map((f, i) => (
            <li key={`${f.id}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span
                className="size-6 shrink-0 rounded-md border border-stone-300"
                style={{ background: f.hex }}
              />
              <span className="flex-1">{f.nombre}</span>
              <span className="text-xs text-stone-500">
                {modo === 'a_ras' ? es.colores.lugar(f.slot) : i === 0 ? es.colores.base : `${i}°`}
              </span>
            </li>
          ))}
        </ul>
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
