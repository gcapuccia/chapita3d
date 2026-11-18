// La medida del iman de heladera: las que mas se venden en un toque, u otra a mano.
// La usan el llavero desde imagen y el de nombre: el hueco es el mismo.

import { useState } from 'react'
import { cambiarDiseno, useDocumento } from '../estado/documento.ts'
import { es } from '../i18n/es.ts'
import * as D from '../pipeline/defaults.ts'
import { Opciones } from './controles.tsx'

const t = es.iman
const coma = (n: number) => String(n).replace('.', ',')

function CampoMedida({
  etiqueta,
  valor,
  min,
  max,
  alCambiar,
}: {
  etiqueta: string
  valor: number
  min: number
  max: number
  alCambiar: (v: number) => void
}) {
  const [borrador, setBorrador] = useState<string | null>(null)
  return (
    <label className="flex flex-1 flex-col gap-1 text-xs text-tenue">
      {etiqueta}
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={0.5}
          value={borrador ?? valor}
          onChange={(e) => {
            setBorrador(e.target.value)
            const n = Number(e.target.value.replace(',', '.'))
            if (Number.isFinite(n) && n >= min && n <= max) alCambiar(n)
          }}
          onBlur={() => setBorrador(null)}
          className="min-h-11 w-full min-w-0 rounded-lg border border-borde-fuerte bg-grafito px-3 text-base text-tiza tabular-nums"
        />
        <span className="text-sm text-tiza-suave">mm</span>
      </span>
    </label>
  )
}

export function MedidaDelIman() {
  const iman = useDocumento((s) => s.diseno?.iman)
  const hueco = useDocumento((s) => s.construccion?.resultado?.iman)
  const [otra, setOtra] = useState(false)
  if (!iman) return null

  const clave = (d: number, a: number) => `${d}x${a}`
  const comun = D.IMANES.some(([d, a]) => d === iman.diametro && a === iman.alto)
  const elegida = otra || !comun ? 'otra' : clave(iman.diametro, iman.alto)
  const poner = (cambio: Partial<typeof iman>, demora?: number) =>
    cambiarDiseno((d) => (d.iman ? { ...d, iman: { ...d.iman, ...cambio } } : d), demora)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-tiza-suave">{t.medida}</p>
      <Opciones<string>
        nombre="medida-iman"
        valor={elegida}
        alCambiar={(v) => {
          if (v === 'otra') return setOtra(true)
          setOtra(false)
          const [diametro, alto] = D.IMANES.find(([d, a]) => clave(d, a) === v)!
          poner({ diametro, alto })
        }}
        opciones={[
          ...D.IMANES.map(([d, a]) => ({
            valor: clave(d, a),
            etiqueta: `${coma(d)} × ${coma(a)}`,
            detalle: 'mm',
          })),
          { valor: 'otra', etiqueta: t.otra, detalle: '…' },
        ]}
      />
      {elegida === 'otra' && (
        <>
          <div className="flex gap-3">
            <CampoMedida
              etiqueta={t.diametro}
              valor={iman.diametro}
              min={4}
              max={40}
              alCambiar={(diametro) => poner({ diametro }, 400)}
            />
            <CampoMedida
              etiqueta={t.alto}
              valor={iman.alto}
              min={1}
              max={6}
              alCambiar={(alto) => poner({ alto }, 400)}
            />
          </div>
          <p className="text-xs text-tenue">{t.comoMedir}</p>
        </>
      )}
      {hueco && <p className="text-xs text-tenue">{t.ayuda(hueco.diametro, hueco.profundidad)}</p>}
    </div>
  )
}
