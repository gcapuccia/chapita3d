import { lazy, Suspense, useEffect } from 'react'
import { escucharCuenta } from './estado/cuenta.ts'
import Inicio from './paginas/Inicio.tsx'
import { useRuta } from './ruta.ts'

// La landing carga sola y liviana; three.js (la mayor parte del peso) llega con Crear y Descargar,
// que la landing precarga apenas se muestra.
const Crear = lazy(() => import('./paginas/Crear.tsx'))
const Descargar = lazy(() => import('./paginas/Descargar.tsx'))
const MisLlaveros = lazy(() => import('./paginas/MisLlaveros.tsx'))
// Paginas de diagnostico de la Fase 0 y 1. Carga diferida: no pesan en la app.
const DiagnosticoGeometria = lazy(() => import('./dev/DiagnosticoGeometria.tsx'))
const DiagnosticoPipeline = lazy(() => import('./dev/DiagnosticoPipeline.tsx'))

function Pagina() {
  const { ruta, hash } = useRuta()
  if (hash === '/dev/pipeline') return <DiagnosticoPipeline />
  if (hash === '/dev/geometria') return <DiagnosticoGeometria />
  if (ruta === '/crear') return <Crear hash={hash} />
  if (ruta === '/descargar') return <Descargar />
  if (ruta === '/mis-llaveros') return <MisLlaveros />
  return <Inicio />
}

export default function App() {
  // La sesion se mira una sola vez, al arrancar
  useEffect(escucharCuenta, [])
  return (
    <Suspense fallback={null}>
      <Pagina />
    </Suspense>
  )
}
