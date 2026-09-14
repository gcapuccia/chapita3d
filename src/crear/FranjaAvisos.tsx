// Avisos del llavero (validaciones) y de la imagen (casos feos), con semaforo (plan §4.5).

import type { CasoFeo } from '../pipeline/diagnostico.ts'
import type { Aviso } from '../geometria/drc.ts'
import { es } from '../i18n/es.ts'

export default function FranjaAvisos({ avisos, casos }: { avisos: Aviso[]; casos: CasoFeo[] }) {
  const todos = [
    ...avisos.map((a) => ({
      clave: `${a.codigo}-${a.mensaje}`,
      error: a.nivel === 'error',
      mensaje: a.mensaje,
    })),
    ...casos.map((c) => ({ clave: c.codigo, error: false, mensaje: c.mensaje })),
  ]
  if (!todos.length) return null
  const hayError = todos.some((t) => t.error)
  return (
    <section aria-label={es.avisos.titulo(todos.length)} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-stone-700">
        {hayError ? es.avisos.bloqueante : es.avisos.titulo(todos.length)}
      </h3>
      <ul className="flex flex-col gap-2">
        {todos.map((t) => (
          <li
            key={t.clave}
            className={`flex gap-2 rounded-lg p-3 text-sm ${t.error ? 'bg-red-50 text-red-900' : 'bg-amber-50 text-amber-950'}`}
          >
            <span aria-hidden>{t.error ? '🔴' : '🟡'}</span>
            <span>{t.mensaje}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
