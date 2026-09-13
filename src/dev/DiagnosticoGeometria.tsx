// Pagina de diagnostico de F0.6: /#/dev/geometria
// Corre en el navegador (y en el celular) las mismas pruebas que los tests de Node, pero
// con Manifold adentro de un Web Worker, que es como va a funcionar la app.

import { useState } from 'react'
import { crearClienteGeometria } from '../workers/clientes.ts'

const MB = 1024 * 1024
const REPETICIONES = 10 // plan F0.6: "el pipeline completo corre 10 veces seguidas"
const CICLOS_FUGAS = 500 // plan F0.6
const VERTICES = 800 // igual que tests/fugas.test.ts
const LIMITE_FUGA = 5 * MB

type Verificacion = { nombre: string; ok: boolean; detalle: string }

type Resultado = {
  verificaciones: Verificacion[]
  datos: Record<string, unknown>
}

function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b)
  return o[Math.floor(o.length / 2)] ?? 0
}

async function correrPruebas(avisar: (paso: string) => void): Promise<Resultado> {
  const { api, terminar } = crearClienteGeometria()
  try {
    avisar('Cargando Manifold en el worker…')
    const carga = await api.cargar()

    avisar(`Construyendo la pieza de prueba ${REPETICIONES} veces…`)
    const construccion = await api.construir(REPETICIONES, VERTICES)

    avisar(`Prueba de fugas: ${CICLOS_FUGAS} ciclos (puede tardar un minuto en celular)…`)
    const fugas = await api.fugas(CICLOS_FUGAS, VERTICES)

    const piezasValidas = construccion.piezas.every((p) => p.estado === 'NoError' && p.volumen > 0)
    const t = construccion.tiemposMs
    const nav = navigator as Navigator & { deviceMemory?: number }

    return {
      verificaciones: [
        {
          nombre: 'Manifold carga en un Web Worker sin COOP/COEP',
          ok: !carga.aisladoCrossOrigin,
          detalle: `${carga.ms.toFixed(0)} ms · heap inicial ${(carga.memoriaBytes / MB).toFixed(1)} MB`,
        },
        {
          nombre: `${REPETICIONES} construcciones seguidas sin romperse`,
          ok: t.length === REPETICIONES,
          detalle: `mín ${Math.min(...t).toFixed(0)} · mediana ${mediana(t).toFixed(0)} · máx ${Math.max(...t).toFixed(0)} ms`,
        },
        {
          nombre: 'Todas las piezas: status NoError y volumen > 0',
          ok: piezasValidas,
          detalle: construccion.piezas.map((p) => `${p.id} ${p.estado}`).join(' · '),
        },
        {
          nombre: `Fugas: el heap crece ≤ 5 MB en ${CICLOS_FUGAS} ciclos`,
          ok: fugas.crecimientoBytes <= LIMITE_FUGA,
          detalle: `${(fugas.bytesAntes / MB).toFixed(1)} → ${(fugas.bytesDespues / MB).toFixed(1)} MB en ${(fugas.ms / 1000).toFixed(1)} s`,
        },
        {
          nombre: 'Ningún objeto de Manifold queda vivo',
          ok: fugas.objetosVivos === 0 && construccion.objetosVivos === 0,
          detalle: `${fugas.objetosCreados} objetos creados y borrados`,
        },
      ],
      datos: {
        dispositivo: {
          userAgent: navigator.userAgent,
          nucleos: navigator.hardwareConcurrency,
          memoriaGB: nav.deviceMemory ?? 'no informado',
        },
        carga,
        construccion: { ...construccion, piezas: construccion.piezas },
        fugas,
      },
    }
  } finally {
    terminar()
  }
}

export default function DiagnosticoGeometria() {
  const [paso, setPaso] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState<string | null>(null)

  const correr = async () => {
    setResultado(null)
    setError(null)
    try {
      setResultado(await correrPruebas(setPaso))
    } catch (e) {
      setError(e instanceof Error ? `${e.message}\n\n${e.stack ?? ''}` : String(e))
    } finally {
      setPaso(null)
    }
  }

  const todoOk = resultado?.verificaciones.every((v) => v.ok)

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-4 bg-stone-50 p-4 text-stone-900">
      <header>
        <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
          Diagnóstico · F0.6
        </p>
        <h1 className="text-2xl font-bold">Motor de geometría</h1>
        <p className="text-sm text-stone-600">
          Carga Manifold en un Web Worker y corre las pruebas de aceptación del plan en este
          dispositivo.
        </p>
      </header>

      <button
        type="button"
        onClick={correr}
        disabled={paso !== null}
        className="rounded-lg bg-stone-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {paso ? 'Corriendo…' : 'Correr pruebas'}
      </button>

      {paso && (
        <p role="status" className="text-sm text-stone-600">
          {paso}
        </p>
      )}

      {error && (
        <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-xs whitespace-pre-wrap text-red-900">
          {error}
        </pre>
      )}

      {resultado && (
        <>
          <p
            className={`rounded-lg p-3 font-semibold ${todoOk ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}
          >
            {todoOk ? '✅ Todas las pruebas pasaron' : '❌ Alguna prueba falló'}
          </p>
          <ul className="flex flex-col gap-2">
            {resultado.verificaciones.map((v) => (
              <li key={v.nombre} className="rounded-lg bg-white p-3 shadow-sm">
                <p className="font-medium">
                  {v.ok ? '✅' : '❌'} {v.nombre}
                </p>
                <p className="text-sm break-words text-stone-600">{v.detalle}</p>
              </li>
            ))}
          </ul>
          <details>
            <summary className="cursor-pointer text-sm text-stone-600">
              Datos completos (para copiar)
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-xs">
              {JSON.stringify(resultado.datos, null, 2)}
            </pre>
          </details>
        </>
      )}
    </main>
  )
}
