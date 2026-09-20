// El bloque de cuenta de la landing: se entra con un enlace al correo, sin contraseña.
// Google queda para cuando haya credenciales propias (docs/marca/brief-landing-y-logo.md).

import { useState } from 'react'
import { hayCuentas } from './cliente.ts'
import { mandarEnlace, useCuenta } from '../estado/cuenta.ts'
import { esLanding as t } from '../i18n/esLanding.ts'
import { ir } from '../ruta.ts'

export default function BloqueCuenta() {
  const { correo, enviando, enviadoA, error } = useCuenta()
  const [escrito, setEscrito] = useState('')

  if (correo) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base text-tiza-suave">
          Ya estás adentro como <span className="font-bold text-tiza">{correo}</span>.
        </p>
        <button
          type="button"
          onClick={() => ir('/mis-llaveros')}
          className="min-h-13 rounded-2xl bg-lima px-6 text-[17px] font-extrabold text-carbon transition-colors hover:bg-lima-claro"
        >
          Ver mis llaveros
        </button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void mandarEnlace(escrito)
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-bold text-tiza-suave">
        {t.cuenta.correoEtiqueta}
        <input
          type="email"
          required
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
          placeholder={t.cuenta.correoEjemplo}
          autoComplete="email"
          className="min-h-13 rounded-2xl border border-borde-fuerte bg-carbon px-4 text-base font-normal text-tiza placeholder:text-tenue focus:border-lima focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={enviando || !hayCuentas}
        className="min-h-13 rounded-2xl bg-lima px-6 text-[17px] font-extrabold text-carbon transition-colors hover:bg-lima-claro disabled:opacity-50"
      >
        {enviando ? t.cuenta.mandando : t.cuenta.mandar}
      </button>

      {enviadoA && (
        <p role="status" className="rounded-2xl bg-lima/10 p-3 text-sm text-lima-claro">
          {t.cuenta.enviado(enviadoA)}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl bg-amber-400/10 p-3 text-sm text-amber-100">
          ⚠ {t.cuenta.fallo}
        </p>
      )}
      {!hayCuentas && <p className="text-sm text-tenue">{t.cuenta.sinCuentas}</p>}

      <button
        type="button"
        disabled
        className="flex min-h-13 items-center justify-center gap-2.5 rounded-2xl border border-borde-fuerte text-[17px] font-bold text-tiza opacity-50"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path
            fill="#4285F4"
            d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.5h6.1c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7C21.7 18.6 23 15.7 23 12.2z"
          />
          <path
            fill="#34A853"
            d="M12 23.5c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.6H2.1v2.9C3.9 21 7.7 23.5 12 23.5z"
          />
          <path
            fill="#FBBC05"
            d="M5.8 14.5c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V7H2.1C1.4 8.5 1 10.2 1 12.2s.4 3.7 1.1 5.2l3.7-2.9z"
          />
          <path
            fill="#EA4335"
            d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 3.9 3.4 2.1 7l3.7 2.9C6.7 7.2 9.1 5.4 12 5.4z"
          />
        </svg>
        {t.cuenta.google}
        <span className="rounded-full bg-carbon px-2 py-0.5 text-xs font-bold text-lima">
          {t.cuenta.pronto}
        </span>
      </button>

      <p className="text-sm leading-relaxed text-tenue">{t.cuenta.honesta}</p>
      <p className="text-sm leading-relaxed text-tenue">{t.cuenta.aclaracion}</p>
    </form>
  )
}
