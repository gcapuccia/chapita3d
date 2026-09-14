import { lazy, Suspense, useEffect, useState } from 'react'

// Paginas de diagnostico de la Fase 0. Carga diferida: no pesan en la pagina principal.
const DiagnosticoGeometria = lazy(() => import('./dev/DiagnosticoGeometria.tsx'))
const DiagnosticoPipeline = lazy(() => import('./dev/DiagnosticoPipeline.tsx'))

function useHash(): string {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const alCambiar = () => setHash(location.hash)
    addEventListener('hashchange', alCambiar)
    return () => removeEventListener('hashchange', alCambiar)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()

  if (hash === '#/dev/pipeline') {
    return (
      <Suspense fallback={null}>
        <DiagnosticoPipeline />
      </Suspense>
    )
  }

  if (hash === '#/dev/geometria') {
    return (
      <Suspense fallback={null}>
        <DiagnosticoGeometria />
      </Suspense>
    )
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-stone-50 p-6 text-center text-stone-900">
      <h1 className="text-4xl font-bold tracking-tight">3D Llaveros</h1>
      <p className="max-w-md text-lg text-stone-600">
        Subí una imagen y bajate un llavero 3D multicolor listo para imprimir.
      </p>
      <p className="rounded-full bg-amber-100 px-4 py-1 text-sm font-medium text-amber-900">
        En construcción
      </p>
    </main>
  )
}
