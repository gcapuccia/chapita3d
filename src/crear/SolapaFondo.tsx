// Solapa Fondo (plan §4.3). Incremento 1: el recorte automatico y el tipo de imagen.
// Pincel, varita y clusters clickeables llegan en el incremento 2.

import { cambiarPreset, useDocumento } from '../estado/documento.ts'
import { es } from '../i18n/es.ts'
import type { NombrePreset } from '../pipeline/presets.ts'
import { Grupo, Opciones } from './controles.tsx'

export function PanelFondo() {
  const preset = useDocumento((s) => s.preset)
  const usado = useDocumento((s) => s.conversion?.preset)
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-stone-600">{es.fondo.ayuda}</p>
      <Grupo titulo={es.fondo.tipo}>
        <Opciones<NombrePreset | 'auto'>
          nombre="preset"
          valor={preset}
          alCambiar={cambiarPreset}
          opciones={(['auto', 'dibujo', 'foto', 'silueta'] as const).map((p) => ({
            valor: p,
            etiqueta: es.fondo.presets[p],
            detalle:
              p === 'auto' && preset === 'auto' && usado ? es.fondo.presets[usado] : undefined,
          }))}
        />
      </Grupo>
    </div>
  )
}
