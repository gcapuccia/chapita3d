// Carga de manifold-3d y withScope(): la unica forma permitida de crear objetos de Manifold.
//
// Manifold corre en WASM y NO tiene recolector de basura: cada CrossSection o Manifold
// ocupa memoria del heap del WASM hasta que alguien llama a delete(). Tras unas cientas
// de ediciones sin borrar, la pestaña muere (plan §13, riesgo 5).
//
// Al cargar el modulo se envuelven TODOS los metodos que pueden devolver objetos
// (estaticos, de instancia y constructores) y cada resultado se registra en el scope
// activo. Al salir de withScope() se borra todo lo registrado. Crear un objeto fuera
// de un scope es un error en tiempo de ejecucion: es la regla que el lint no puede
// expresar (plan §5.3), hecha cumplir por el propio modulo.
//
// Por que no se usa lib/garbage-collector.js de manifold-3d: envuelve una lista FIJA de
// nombres de metodos. Un metodo nuevo en una version futura filtraria memoria en
// silencio. Aca se envuelve todo lo que exista.
//
// Tambien se envuelven los metodos INTERNOS, porque la propia libreria pierde memoria
// (manifold-3d 3.5.3, medido en F0.6 — docs/pruebas/f0.6-manifold.md):
//  - ofPolygons(), new CrossSection(poligonos) y add/subtract/intersect con arrays arman
//    un Vector2_vec2 haciendo push_back(new Vector_vec2(...)). push_back COPIA, y al
//    liberar se borran copias obtenidas con get(i): los Vector_vec2 originales nunca
//    se borran. Pierde una copia de cada contorno en cada llamada. Es la fuga grande.
//  - extrude() y revolve() llaman a this._ToPolygons() y nunca borran ese vector.
//  - toPolygons() borra el vector externo, pero no las copias que devuelve vec.get(i).
//  - extrude(..., center=true) no borra el solido sin centrar.
// Los vectores de embind no tienen finalizador, asi que eso se pierde para siempre.
// Registrando tambien esos temporales en el scope, se borran igual que el resto.

import Module from 'manifold-3d'
import type { ManifoldToplevel } from 'manifold-3d'

export type {
  CrossSection,
  FillRule,
  Manifold,
  ManifoldToplevel,
  Mesh,
  SimplePolygon,
  Vec2,
} from 'manifold-3d'

type Borrable = { delete(): void; isDeleted(): boolean }
type Funcion = (this: unknown, ...args: unknown[]) => unknown

const pila: Set<Borrable>[] = []
const contadores = { creados: 0, borrados: 0 }
let modulo: ManifoldToplevel | null = null
let cargando: Promise<ManifoldToplevel> | null = null
let memoria: WebAssembly.Memory | null = null

// Los metodos de embind que administran el propio handle: no devuelven geometria nueva.
const NO_ENVOLVER = new Set(['constructor', 'delete', 'isDeleted', 'deleteLater', 'isAliasOf'])

function esBorrable(v: unknown): v is Borrable {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Borrable).delete === 'function' &&
    typeof (v as Borrable).isDeleted === 'function'
  )
}

function registrar<T>(resultado: T): T {
  const objetos: unknown[] = Array.isArray(resultado) ? resultado : [resultado]
  for (const o of objetos) {
    if (!esBorrable(o)) continue
    const scope = pila.at(-1)
    if (!scope) {
      o.delete()
      throw new Error(
        'Objeto de Manifold creado fuera de withScope(). ' +
          'Envolvé el código en withScope(({ CrossSection, Manifold }) => { ... }).',
      )
    }
    if (!scope.has(o)) {
      scope.add(o)
      contadores.creados++
    }
  }
  return resultado
}

function envolver(original: Funcion): Funcion {
  return function (this: unknown, ...args: unknown[]) {
    return registrar(original.apply(this, args))
  }
}

/** Envuelve cada funcion propia y escribible del objeto que cumpla el filtro. */
function envolverFunciones(objeto: object, filtro: (nombre: string) => boolean = () => true): void {
  for (const nombre of Object.getOwnPropertyNames(objeto)) {
    if (NO_ENVOLVER.has(nombre) || !filtro(nombre)) continue
    const d = Object.getOwnPropertyDescriptor(objeto, nombre)
    if (!d || typeof d.value !== 'function' || !d.writable) continue
    ;(objeto as Record<string, unknown>)[nombre] = envolver(d.value as Funcion)
  }
}

function envolverConstructor<C extends object>(clase: C): C {
  return new Proxy(clase, {
    construct(objetivo, args) {
      return registrar(Reflect.construct(objetivo as new (...a: unknown[]) => object, args))
    },
  })
}

function instrumentar(w: ManifoldToplevel): void {
  // Los metodos de instancia viven en un prototipo interno de embind, distinto de
  // CrossSection.prototype: se llega a el desde una instancia real.
  const cs = w.CrossSection.square([1, 1])
  const mf = w.Manifold.cube([1, 1, 1])
  const protoCrossSection = Object.getPrototypeOf(cs) as object
  const protoManifold = Object.getPrototypeOf(mf) as object
  const protoHandle = Object.getPrototypeOf(protoCrossSection) as object
  cs.delete()
  mf.delete()

  // Incluye los metodos internos (_ToPolygons, _Offset...): la API publica los usa y a
  // veces no borra lo que devuelven.
  envolverFunciones(protoCrossSection)
  envolverFunciones(protoManifold)
  envolverFunciones(w.CrossSection)
  envolverFunciones(w.Manifold)
  // Funciones que exporta C++ al modulo (_Extrude, _Revolve...). El filtro deja afuera
  // los internos de emscripten (_malloc, _free, __embind_*), que empiezan en minuscula.
  envolverFunciones(w, (nombre) => /^_[A-Z]/.test(nombre))
  // Vectores de embind: los crea la propia libreria con `new Module.Vector_vec2` (que se
  // resuelve en tiempo de llamada, asi que el Proxy lo intercepta), y vec.get(i) devuelve
  // una COPIA del elemento como handle nuevo. Las dos cosas hay que borrarlas.
  const exportado = w as unknown as Record<string, object>
  for (const nombre of Object.keys(exportado).filter((k) => k.startsWith('Vector'))) {
    const clase = exportado[nombre] as { prototype?: object }
    if (!clase.prototype) continue
    envolverFunciones(clase.prototype, (m) => m === 'get')
    exportado[nombre] = envolverConstructor(clase)
  }
  // clone() vive en el ClassHandle compartido y devuelve un handle nuevo que hay que borrar
  const clone = Object.getOwnPropertyDescriptor(protoHandle, 'clone')
  if (clone?.writable && typeof clone.value === 'function') {
    ;(protoHandle as Record<string, unknown>).clone = envolver(clone.value as Funcion)
  }
  w.CrossSection = envolverConstructor(w.CrossSection)
  w.Manifold = envolverConstructor(w.Manifold)
}

/**
 * El modulo no expone HEAP8, asi que la memoria se captura interceptando la
 * instanciacion del WASM. Se restaura apenas termina la carga.
 */
async function instanciarCapturandoMemoria(): Promise<ManifoldToplevel> {
  const capturar = <R>(r: R): R => {
    const instancia = (r as { instance?: WebAssembly.Instance }).instance ?? r
    for (const v of Object.values((instancia as WebAssembly.Instance).exports ?? {})) {
      if (v instanceof WebAssembly.Memory) memoria = v
    }
    return r
  }
  const { instantiate, instantiateStreaming } = WebAssembly
  WebAssembly.instantiate = ((...a: Parameters<typeof instantiate>) =>
    instantiate(...a).then(capturar)) as typeof instantiate
  if (instantiateStreaming) {
    WebAssembly.instantiateStreaming = ((...a: Parameters<typeof instantiateStreaming>) =>
      instantiateStreaming(...a).then(capturar)) as typeof instantiateStreaming
  }
  try {
    return await Module()
  } finally {
    WebAssembly.instantiate = instantiate
    if (instantiateStreaming) WebAssembly.instantiateStreaming = instantiateStreaming
  }
}

/** Carga el WASM una sola vez (singleton). Se puede llamar muchas veces. */
export function cargarManifold(): Promise<ManifoldToplevel> {
  cargando ??= (async () => {
    const w = await instanciarCapturandoMemoria()
    w.setup()
    instrumentar(w)
    modulo = w
    return w
  })().catch((error: unknown) => {
    cargando = null
    throw error
  })
  return cargando
}

function liberar(scope: Set<Borrable>): void {
  for (const o of scope) {
    if (!o.isDeleted()) o.delete()
    contadores.borrados++
  }
  scope.clear()
}

/**
 * Ejecuta fn y borra todos los objetos de Manifold creados adentro.
 *
 * - Lo que fn devuelve (un objeto o un array de objetos) ESCAPA al scope padre y se
 *   borra cuando ese termina. Desde el scope mas externo no se puede devolver
 *   geometria: hay que convertirla a datos adentro (getMesh, toPolygons, area).
 * - Si fn lanza, se libera todo igual.
 * - fn tiene que ser sincronica: con await en el medio el scope ya se cerro.
 */
export function withScope<T>(fn: (m: ManifoldToplevel) => T): T {
  if (!modulo) {
    throw new Error('Manifold no está cargado: esperá cargarManifold() antes de usar withScope().')
  }
  const scope = new Set<Borrable>()
  pila.push(scope)
  let resultado: T
  try {
    resultado = fn(modulo)
    if (typeof (resultado as { then?: unknown } | null)?.then === 'function') {
      throw new Error(
        'withScope() no admite funciones async: el scope se cierra antes del await y los objetos quedarían sin dueño.',
      )
    }
  } catch (error) {
    pila.pop()
    liberar(scope)
    throw error
  }
  pila.pop()

  const escapan = (Array.isArray(resultado) ? resultado : [resultado]).filter(esBorrable)
  for (const o of escapan) scope.delete(o)
  liberar(scope)

  if (escapan.length) {
    const padre = pila.at(-1)
    if (!padre) {
      for (const o of escapan) {
        o.delete()
        contadores.borrados++
      }
      throw new Error(
        'No se puede devolver un objeto de Manifold desde el withScope() más externo: ' +
          'convertilo a datos adentro (getMesh(), toPolygons(), area()).',
      )
    }
    for (const o of escapan) padre.add(o)
  }
  return resultado
}

/** Tamaño actual del heap del WASM. Solo crece: nunca se devuelve memoria al sistema. */
export function memoriaWasmBytes(): number {
  return memoria?.buffer.byteLength ?? 0
}

/** Objetos creados y borrados desde la carga. `vivos` distinto de 0 fuera de un scope = fuga. */
export function estadisticasManifold(): { creados: number; borrados: number; vivos: number } {
  return { ...contadores, vivos: contadores.creados - contadores.borrados }
}
