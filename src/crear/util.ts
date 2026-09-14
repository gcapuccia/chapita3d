import type { ResultadoConstruccion } from '../geometria/construir.ts'

/** Color de cada pieza construida: por slot (a ras) o por franja, de abajo hacia arriba (apilado). */
export function coloresDePiezas(r: ResultadoConstruccion): string[] {
  if (r.modoColor === 'apilado') return r.piezas.map((_, i) => r.filamentos[i]?.hex ?? '#cccccc')
  return r.piezas.map((p) => r.filamentos.find((f) => f.slot === p.slot)?.hex ?? '#cccccc')
}

/** Baja un archivo generado. Devuelve false si el navegador no lo permitio. */
export function bajarArchivo(
  datos: Uint8Array,
  nombre: string,
  tipo = 'application/octet-stream',
): boolean {
  try {
    const url = URL.createObjectURL(new Blob([datos as Uint8Array<ArrayBuffer>], { type: tipo }))
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  } catch {
    return false
  }
}
