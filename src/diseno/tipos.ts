// El documento: todo lo que define un llavero, en datos planos y serializables (plan §8.1).
//
// Lo 3D nunca se guarda: se deriva con construir(). Asi el JSON queda en decenas de KB, el
// deshacer es barato y se puede persistir tal cual en IndexedDB o, algun dia, en una base.
//
// Ubicacion: el plan (§8.1) lo pone en src/pipeline/tipos.ts, pero §6 dice que el pipeline "no
// sabe que es un llavero". Vive en su propia carpeta para que pipeline, geometria y export lo
// usen sin depender entre si.
//
// Diferencia con §8.1: la argolla es un campo propio en vez de dos piezas sueltas (agujero y
// pestaña), porque siempre van juntas y el editor las mueve juntas.

export type Filamento = {
  id: string
  nombre: string
  hex: string
  slot: number
  /** El usuario eligio este color a mano: sobrevive a reprocesar la imagen. */
  elegido?: boolean
  /** Colores de la imagen que cayeron en este filamento: con eso se ajusta el grosor de sus lineas. */
  deLaImagen?: string[]
}

export type Transform = { x: number; y: number; rotZ: number; sx: number; sy: number }

export type GeometriaPieza =
  | { kind: 'poligonos'; contornos: [number, number][][] }
  | { kind: 'texto'; texto: string; fuente: string; tamano: number; negrita: number }
  | { kind: 'primitiva'; forma: 'rect' | 'circulo'; params: Record<string, number> }

export type Pieza = {
  id: string
  tipo: 'region' | 'texto' | 'forma'
  /** Para los avisos: "el color 2", "las patas del gato". */
  nombre: string
  filamentoId: string
  /** Mayor numero = gana en la cadena de resta y va mas arriba en modo apilado. */
  prioridad: number
  transform: Transform
  geometria: GeometriaPieza
  visible: boolean
}

export type TipoArgolla = 'bola' | 'comun' | 'gruesa' | 'sin'

/** auto: arriba al centro (un dibujo). izquierda: a media altura (un nombre, que es ancho). */
export type PosicionArgolla = 'auto' | 'izquierda' | [number, number]

/** De que pantalla salio el diseño: decide a donde se vuelve. Sin campo, un llavero desde imagen. */
export type Producto = 'nombre'

export type Diseno = {
  version: 1
  id: string
  nombre: string
  creadoEn: string
  actualizadoEn: string
  appVersion: string
  unidades: 'mm'
  impresion: {
    alturaCapa: number
    boquilla: number
    /** a_ras: AMS/MMU, colores incrustados arriba. apilado: un extrusor, franjas con M600. */
    modoColor: 'a_ras' | 'apilado'
    slots: number
    impresoraId: string
  }
  cuerpo: { espesor: number; alturaColor: number }
  contorno: {
    activo: boolean
    offset: number
    filamentoId: string
    /** Si el borde queda en varias partes (letras sueltas), una franja las une en un solo cuerpo. */
    unir?: boolean
  }
  argolla: { tipo: TipoArgolla; posicion: PosicionArgolla }
  producto?: Producto
  filamentos: Filamento[]
  piezas: Pieza[]
  imagenOrigen?: { assetId: string; parametros: Record<string, unknown> }
}

export const TRANSFORM_IDENTIDAD: Transform = { x: 0, y: 0, rotZ: 0, sx: 1, sy: 1 }
