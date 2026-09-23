// Las cuentas de la calculadora (docs/calculadora-3d-spec.md §4). Verificadas contra los dos casos
// de la §8 en tests/calculadora.test.ts.
//
// Reglas que no se tocan:
//  - el margen de error se aplica sobre material + luz + desgaste, nunca sobre los insumos
//  - los insumos no se multiplican: solo llevan su recargo fijo
//  - el precio de MercadoLibre agrega su recargo solo a la parte multiplicada
//  - no se redondea en el medio: se redondea recien al mostrar

/** Recargo fijo de los insumos (30 %). */
export const RECARGO_INSUMOS = 0.3
/** Lo que agrega MercadoLibre sobre la parte multiplicada (16 %). */
export const RECARGO_ML = 0.16

export type GastosFijos = {
  /** Precio del filamento por kilo. */
  precioKg: number
  /** Precio del kilovatio hora. */
  precioKwh: number
  /** Modelo de impresora elegido (solo para recordar la eleccion). */
  modelo: string
  /** Consumo promedio de la impresora, en vatios. */
  watts: number
  /** Vida util de la maquina, en horas. 0 = sin desgaste. */
  vidaUtilHs: number
  /** Cuanto sale el juego de repuestos de esa vida util. */
  repuestos: number
  /** Margen de error, en porcentaje. */
  errorPct: number
}

export type Pieza = {
  horas: number
  minutos: number
  gramos: number
  /** Insumos extra: imanes, argollas, cajas. */
  insumos: number
}

export type Entradas = GastosFijos & Pieza & { multiplicador: number }

export type Resultados = {
  tiempoHs: number
  material: number
  luz: number
  desgaste: number
  margenError: number
  /** Costo total sin insumos. */
  costoTotal: number
  /** Insumos con su recargo. */
  insumosFinal: number
  totalCobrar: number
  precioML: number
}

/** Un numero valido y nunca negativo: los campos vacios valen 0. */
const sano = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0)

export function calcular(e: Entradas): Resultados {
  const tiempoHs = sano(e.horas) + sano(e.minutos) / 60

  const material = (sano(e.gramos) / 1000) * sano(e.precioKg)
  const luz = (sano(e.watts) / 1000) * tiempoHs * sano(e.precioKwh)
  const vidaUtilHs = sano(e.vidaUtilHs)
  const desgaste = vidaUtilHs > 0 ? (sano(e.repuestos) / vidaUtilHs) * tiempoHs : 0
  const margenError = (material + luz + desgaste) * (sano(e.errorPct) / 100)

  const costoTotal = material + luz + desgaste + margenError
  const insumosFinal = sano(e.insumos) * (1 + RECARGO_INSUMOS)

  const multiplicado = costoTotal * sano(e.multiplicador)
  return {
    tiempoHs,
    material,
    luz,
    desgaste,
    margenError,
    costoTotal,
    insumosFinal,
    totalCobrar: multiplicado + insumosFinal,
    precioML: multiplicado * (1 + RECARGO_ML) + insumosFinal,
  }
}

/** Acepta coma o punto como decimal, y descarta lo que no sea un numero. */
export function aNumero(texto: string): number {
  const limpio = texto.replace(/\s/g, '').replace(',', '.')
  const n = Number(limpio)
  return Number.isFinite(n) && n > 0 ? n : 0
}
