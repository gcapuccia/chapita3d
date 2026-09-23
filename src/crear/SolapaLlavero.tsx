// Solapa Llavero (plan §4.5): cinco controles y nada mas. Tamaño, espesor, argolla, borde y texto.
// La manipulacion directa en el lienzo llega en el incremento 2.

import { useState } from 'react'
import { FUENTES, type IdFuente } from '../datos/fuentes.ts'
import { agregarTexto } from '../diseno/texto.ts'
import type { Diseno, TipoArgolla } from '../diseno/tipos.ts'
import { cambiarDiseno, useDocumento } from '../estado/documento.ts'
import { es } from '../i18n/es.ts'
import * as D from '../pipeline/defaults.ts'
import { Grupo, Opciones } from './controles.tsx'

const LADO_BASE = D.LADO_MAYOR_MM

/** Escala el dibujo (las regiones) y acompaña la posicion del texto. */
function escalar(d: Diseno, lado: number): Diseno {
  const actual = d.piezas.find((p) => p.tipo === 'region')?.transform.sx ?? 1
  const nueva = lado / LADO_BASE
  return {
    ...d,
    piezas: d.piezas.map((p) =>
      p.tipo === 'region'
        ? { ...p, transform: { ...p.transform, sx: nueva, sy: nueva } }
        : { ...p, transform: { ...p.transform, y: (p.transform.y / actual) * nueva } },
    ),
  }
}

export function PanelLlavero() {
  const diseno = useDocumento((s) => s.diseno)
  const [borrador, setBorrador] = useState<string | null>(null)
  if (!diseno) return null

  const lado = Math.round(
    (diseno.piezas.find((p) => p.tipo === 'region')?.transform.sx ?? 1) * LADO_BASE,
  )
  const texto = diseno.piezas.find((p) => p.tipo === 'texto')
  const valorTexto = borrador ?? (texto?.geometria.kind === 'texto' ? texto.geometria.texto : '')
  const fuente = (
    texto?.geometria.kind === 'texto' ? texto.geometria.fuente : FUENTES[0]!.id
  ) as IdFuente

  const ponerTexto = (nuevo: string, nuevaFuente: IdFuente) => {
    cambiarDiseno((d) => {
      const piezas = d.piezas.filter((p) => p.tipo !== 'texto')
      // Si el texto habia sumado un filamento propio (negro), se va con el
      const usados = new Set([d.contorno.filamentoId, ...piezas.map((p) => p.filamentoId)])
      const sinTexto = { ...d, piezas, filamentos: d.filamentos.filter((f) => usados.has(f.id)) }
      return nuevo.trim() ? agregarTexto(sinTexto, nuevo.trim(), { fuente: nuevaFuente }) : sinTexto
    }, 300)
  }

  return (
    <div className="flex flex-col gap-6">
      <Grupo titulo={es.llavero.tamano}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={25}
            max={80}
            value={lado}
            onChange={(e) => cambiarDiseno((d) => escalar(d, Number(e.target.value)))}
            className="h-11 flex-1 accent-lima"
            aria-label={es.llavero.tamano}
          />
          <span className="w-16 text-right text-sm font-semibold tabular-nums">{lado} mm</span>
        </div>
        <p className="text-xs text-tenue">{es.llavero.referencia(lado)}</p>
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

      <Grupo titulo={es.llavero.argolla}>
        <Opciones<TipoArgolla>
          nombre="argolla"
          valor={diseno.argolla.tipo}
          alCambiar={(tipo) => cambiarDiseno((d) => ({ ...d, argolla: { ...d.argolla, tipo } }))}
          opciones={(['bola', 'comun', 'gruesa', 'sin'] as const).map((k) => ({
            valor: k,
            etiqueta: es.llavero.argollas[k],
            detalle: k === 'sin' ? '—' : `Ø${String(D.DIAMETRO_AGUJERO[k]).replace('.', ',')}`,
          }))}
        />
      </Grupo>

      <Grupo titulo={es.llavero.borde}>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={diseno.contorno.activo}
            onChange={(e) =>
              cambiarDiseno((d) => ({
                ...d,
                contorno: { ...d.contorno, activo: e.target.checked },
              }))
            }
            className="size-5 accent-lima"
          />
          {es.llavero.borde} de {String(diseno.contorno.offset).replace('.', ',')} mm
        </label>
      </Grupo>

      <Grupo titulo={es.llavero.texto}>
        <div className="flex gap-2">
          <input
            type="text"
            value={valorTexto}
            maxLength={24}
            placeholder={es.llavero.textoPlaceholder}
            onChange={(e) => {
              // El borrador conserva los espacios mientras se escribe; el diseño lleva el texto limpio
              setBorrador(e.target.value)
              ponerTexto(e.target.value, fuente)
            }}
            onBlur={() => setBorrador(null)}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-borde-fuerte px-3"
          />
          <select
            value={fuente}
            onChange={(e) => ponerTexto(valorTexto, e.target.value as IdFuente)}
            aria-label={es.llavero.fuente}
            className="min-h-11 rounded-lg border border-borde-fuerte bg-grafito px-2"
          >
            {FUENTES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </div>
      </Grupo>
    </div>
  )
}
