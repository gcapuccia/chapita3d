// Rutas con la History API, sin router (plan F2.1: "~20 lineas"). La solapa va en el hash: /crear#colores.

import { useSyncExternalStore } from 'react'

export type Ruta =
  | '/'
  | '/llaveros/crear'
  | '/llaveros/descargar'
  | '/sellos/crear'
  | '/vector/crear'
  | '/calculadora'
  | '/mis-llaveros'

const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((o) => o())
addEventListener('popstate', avisar)
addEventListener('hashchange', avisar)

const suscribir = (o: () => void) => {
  oyentes.add(o)
  return () => oyentes.delete(o)
}
const leer = () => `${location.pathname}${location.hash}`

export function ir(ruta: Ruta, hash = ''): void {
  const destino = `${ruta}${hash ? `#${hash}` : ''}`
  if (destino === leer()) return
  history.pushState(null, '', destino)
  avisar()
  scrollTo(0, 0)
}

export function useRuta(): { ruta: string; hash: string } {
  const actual = useSyncExternalStore(suscribir, leer)
  const [ruta = '/', hash = ''] = actual.split('#')
  return { ruta, hash }
}
