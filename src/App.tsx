import { lazy, Suspense, useEffect } from 'react'
import { escucharCuenta } from './estado/cuenta.ts'
import Inicio from './paginas/Inicio.tsx'
import { ir, useRuta, type Ruta } from './ruta.ts'

// La landing carga sola y liviana; three.js (la mayor parte del peso) llega con Crear y Descargar,
// que la landing precarga apenas se muestra.
const Crear = lazy(() => import('./paginas/Crear.tsx'))
const Descargar = lazy(() => import('./paginas/Descargar.tsx'))
const MisLlaveros = lazy(() => import('./paginas/MisLlaveros.tsx'))
const Calculadora = lazy(() => import('./paginas/Calculadora.tsx'))
const Sellos = lazy(() => import('./paginas/Sellos.tsx'))
const Vector = lazy(() => import('./paginas/Vector.tsx'))
// Paginas de diagnostico de la Fase 0 y 1. Carga diferida: no pesan en la app.
const DiagnosticoGeometria = lazy(() => import('./dev/DiagnosticoGeometria.tsx'))
const DiagnosticoPipeline = lazy(() => import('./dev/DiagnosticoPipeline.tsx'))

function Pagina() {
  const { ruta, hash } = useRuta()
  if (hash === '/dev/pipeline') return <DiagnosticoPipeline />
  if (hash === '/dev/geometria') return <DiagnosticoGeometria />
  if (ruta === '/llaveros/crear') return <Crear hash={hash} />
  if (ruta === '/llaveros/descargar') return <Descargar />
  // Las direcciones viejas, de antes de que la app viviera abajo de /llaveros
  if (ruta === '/crear' || ruta === '/descargar') {
    ir(('/llaveros' + ruta) as Ruta, hash)
    return null
  }
  if (ruta === '/sellos/crear') return <Sellos />
  if (ruta === '/vector/crear') return <Vector />
  if (ruta === '/calculadora') return <Calculadora />
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
