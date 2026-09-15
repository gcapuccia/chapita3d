// Panel de un color del llavero (F2.3): elegir otro color de la paleta (o uno propio) y ajustar el
// grosor de las lineas de ESE color. El color es del diseño y se ve al toque; el grosor reprocesa
// la imagen con espera, porque lo decide la limpieza (src/pipeline/limpiar.ts).

import { useState } from 'react'
import { PALETA } from '../datos/paleta.ts'
import type { Filamento } from '../diseno/tipos.ts'
import {
  cambiarColorDeFilamento,
  cambiarGrosorDeLineas,
  useDocumento,
} from '../estado/documento.ts'
import { es } from '../i18n/es.ts'
import * as D from '../pipeline/defaults.ts'
import { Grupo } from './controles.tsx'

const paso = (n: number) => Math.round(n * 10) / 10
const enMm = (n: number) => String(paso(n)).replace('.', ',')

export default function EditorDeColor({
  filamento,
  hayImagen,
}: {
  filamento: Filamento
  hayImagen: boolean
}) {
  const grosorPorHex = useDocumento((s) => s.grosorPorHex)
  const hexes = filamento.deLaImagen ?? []
  const guardado = hexes.map((h) => grosorPorHex[h]).find((v) => v !== undefined) ?? null
  const [borrador, setBorrador] = useState<number | null>(null)
  const grosor = borrador ?? guardado

  const ponerGrosor = (mm: number | null) => {
    setBorrador(mm)
    for (const h of hexes) cambiarGrosorDeLineas(h, mm)
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-stone-300 bg-white p-3">
      <Grupo titulo={es.colores.elegirColor}>
        <div className="grid grid-cols-8 gap-1.5">
          {PALETA.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.nombre}
              aria-label={c.nombre}
              aria-pressed={c.hex.toUpperCase() === filamento.hex.toUpperCase()}
              onClick={() => cambiarColorDeFilamento(filamento.id, c.hex)}
              style={{ background: c.hex }}
              className={`size-8 rounded-full border transition-transform hover:scale-110 ${
                c.hex.toUpperCase() === filamento.hex.toUpperCase()
                  ? 'border-stone-900 ring-2 ring-stone-900 ring-offset-1'
                  : 'border-stone-300'
              }`}
            />
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-stone-600">
          <input
            type="color"
            value={filamento.hex}
            onChange={(e) => cambiarColorDeFilamento(filamento.id, e.target.value.toUpperCase())}
            className="size-8 cursor-pointer rounded border border-stone-300 bg-white"
          />
          {es.colores.colorPropio}
        </label>
      </Grupo>

      {hayImagen && hexes.length > 0 && (
        <Grupo titulo={es.colores.grosor}>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={D.GROSOR_LINEAS_MM.minimo}
              max={D.GROSOR_LINEAS_MM.maximo}
              step={0.1}
              value={grosor ?? D.GROSOR_LINEAS_MM.porDefecto}
              onChange={(e) => ponerGrosor(paso(Number(e.target.value)))}
              className="h-11 flex-1 accent-stone-900"
              aria-label={es.colores.grosor}
            />
            <span className="w-20 text-right text-sm font-semibold tabular-nums">
              {grosor === null ? es.colores.grosorAuto : `${enMm(grosor)} mm`}
            </span>
          </div>
          {grosor !== null && (
            <button
              type="button"
              onClick={() => ponerGrosor(null)}
              className="min-h-11 self-start text-sm text-stone-600 underline underline-offset-4"
            >
              {es.colores.volverAuto}
            </button>
          )}
          <p className="text-xs text-stone-500">{es.colores.grosorAyuda}</p>
          {grosor !== null && grosor < D.GROSOR_LINEAS_SEGURO_MM && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              ⚠ {es.colores.grosorFragil(D.GROSOR_LINEAS_SEGURO_MM)}
            </p>
          )}
        </Grupo>
      )}
    </div>
  )
}
