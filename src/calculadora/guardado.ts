// Perfiles y productos de la calculadora, guardados en el navegador (spec §7).
// Todo va envuelto en try/catch: en una ventana privada o con el almacenamiento bloqueado, la
// calculadora tiene que seguir funcionando igual, solo que sin memoria.

import type { Entradas, GastosFijos, Resultados } from './formulas.ts'

const CLAVE_PERFILES = 'calc3d_perfiles'
const CLAVE_ULTIMO = 'calc3d_ultimo_perfil'
const CLAVE_PRODUCTOS = 'calc3d_productos'

export type Perfil = GastosFijos & { moneda: string }
export type Producto = {
  id: string
  nombre: string
  /** Fecha ISO. */
  fecha: string
  perfil: string
  moneda: string
  entradas: Entradas
  resultados: Resultados
}

function leer<T>(clave: string, siFalla: T): T {
  try {
    const crudo = localStorage.getItem(clave)
    return crudo ? (JSON.parse(crudo) as T) : siFalla
  } catch {
    return siFalla
  }
}

function escribir(clave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
    return true
  } catch {
    return false
  }
}

// ------------------------------------------------------------------ perfiles

export const leerPerfiles = (): Record<string, Perfil> => leer(CLAVE_PERFILES, {})

export function guardarPerfil(nombre: string, perfil: Perfil): Record<string, Perfil> {
  const todos = { ...leerPerfiles(), [nombre]: perfil }
  escribir(CLAVE_PERFILES, todos)
  escribir(CLAVE_ULTIMO, nombre)
  return todos
}

export function borrarPerfil(nombre: string): Record<string, Perfil> {
  const todos = leerPerfiles()
  delete todos[nombre]
  escribir(CLAVE_PERFILES, todos)
  if (leerUltimoPerfil() === nombre) escribir(CLAVE_ULTIMO, '')
  return todos
}

export const leerUltimoPerfil = (): string => leer(CLAVE_ULTIMO, '')
export const recordarUltimoPerfil = (nombre: string) => escribir(CLAVE_ULTIMO, nombre)

// ------------------------------------------------------------------ productos

export const leerProductos = (): Producto[] => leer(CLAVE_PRODUCTOS, [] as Producto[])

export function guardarProducto(p: Omit<Producto, 'id' | 'fecha'>): Producto[] {
  const producto: Producto = { ...p, id: crypto.randomUUID(), fecha: new Date().toISOString() }
  const todos = [producto, ...leerProductos()]
  escribir(CLAVE_PRODUCTOS, todos)
  return todos
}

export function borrarProducto(id: string): Producto[] {
  const todos = leerProductos().filter((p) => p.id !== id)
  escribir(CLAVE_PRODUCTOS, todos)
  return todos
}

// ------------------------------------------------------------------ llevarse los datos

export const comoJson = (): string =>
  JSON.stringify({ perfiles: leerPerfiles(), productos: leerProductos() }, null, 2)

/** Devuelve cuantos perfiles y productos entraron, o null si el archivo no sirve. */
export function desdeJson(texto: string): { perfiles: number; productos: number } | null {
  try {
    const datos = JSON.parse(texto) as {
      perfiles?: Record<string, Perfil>
      productos?: Producto[]
    }
    const perfiles = { ...leerPerfiles(), ...(datos.perfiles ?? {}) }
    const productos = [...(datos.productos ?? []), ...leerProductos()]
    escribir(CLAVE_PERFILES, perfiles)
    escribir(CLAVE_PRODUCTOS, productos)
    return {
      perfiles: Object.keys(datos.perfiles ?? {}).length,
      productos: (datos.productos ?? []).length,
    }
  } catch {
    return null
  }
}

const COLUMNAS = [
  'nombre',
  'fecha',
  'moneda',
  'gramos',
  'horas',
  'minutos',
  'insumos',
  'multiplicador',
  'costoTotal',
  'totalCobrar',
  'precioML',
] as const

/** CSV con punto y coma: es lo que abre Excel en español sin pelear con la coma decimal. */
export function comoCsv(productos = leerProductos()): string {
  const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const filas = productos.map((p) =>
    [
      p.nombre,
      p.fecha,
      p.moneda,
      p.entradas.gramos,
      p.entradas.horas,
      p.entradas.minutos,
      p.entradas.insumos,
      p.entradas.multiplicador,
      p.resultados.costoTotal.toFixed(2),
      p.resultados.totalCobrar.toFixed(2),
      p.resultados.precioML.toFixed(2),
    ]
      .map(celda)
      .join(';'),
  )
  return [COLUMNAS.join(';'), ...filas].join('\n')
}
