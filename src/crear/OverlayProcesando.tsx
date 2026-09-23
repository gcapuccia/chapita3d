// Overlay de procesando (plan §4.2): la imagen del usuario, cuatro hitos con nombre (no un
// porcentaje, que seria mentira) y Cancelar, que deja el archivo cargado.

import { useEffect, useState } from 'react'
import { cancelar, type Hito } from '../estado/documento.ts'
import { es } from '../i18n/es.ts'
import { ir } from '../ruta.ts'

const ORDEN: Hito[] = ['leer', 'fondo', 'colores', 'llavero']

// Una sola URL viva, la del ultimo archivo. Revocarla en el cleanup de un efecto la rompe con
// StrictMode (desmonta y vuelve a montar con el mismo useMemo) y al reprocesar el mismo archivo.
let miniatura: { archivo: File; url: string } | null = null
function urlDe(archivo: File): string {
  if (miniatura?.archivo !== archivo) {
    if (miniatura) URL.revokeObjectURL(miniatura.url)
    miniatura = { archivo, url: URL.createObjectURL(archivo) }
  }
  return miniatura.url
}

export default function OverlayProcesando({
  archivo,
  hito,
  desde,
}: {
  archivo: File | null
  hito: Hito
  desde: number
}) {
  const url = archivo ? urlDe(archivo) : null

  // Mensajes a los 3 s y a los 8 s (plan §4.2)
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSegundos((performance.now() - desde) / 1000), 500)
    return () => clearInterval(t)
  }, [desde])

  const actual = ORDEN.indexOf(hito)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      className="fixed inset-0 z-50 grid place-items-center bg-grafito/95 p-6 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {url && (
          <div className="relative size-40 overflow-hidden rounded-2xl bg-grafito shadow-md">
            <img src={url} alt="" className="size-full object-contain" />
            <div className="animate-barrido pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        )}
        <ol className="flex w-full flex-col gap-2">
          {ORDEN.map((h, i) => (
            <li
              key={h}
              className={`flex items-center gap-3 text-base ${i > actual ? 'text-tenue' : 'text-tiza'}`}
            >
              <span className="grid size-6 place-items-center rounded-full text-sm" aria-hidden>
                {i < actual ? (
                  '✓'
                ) : i === actual ? (
                  <span className="size-3 animate-pulse rounded-full bg-aviso0" />
                ) : (
                  '·'
                )}
              </span>
              {es.procesando.hitos[h]}
            </li>
          ))}
        </ol>
        {segundos >= 3 && (
          <p className="text-center text-sm text-tiza-suave">
            {segundos >= 8 ? es.procesando.lento : es.procesando.grande}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            cancelar()
            ir('/')
          }}
          className="min-h-11 rounded-lg px-4 text-tiza-suave underline underline-offset-4 hover:text-tiza"
        >
          {es.procesando.cancelar}
        </button>
      </div>
    </div>
  )
}
