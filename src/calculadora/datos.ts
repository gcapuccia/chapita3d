// Las tablas de la calculadora (docs/calculadora-3d-spec.md §5 y §6) y el formato de plata.
// Las monedas solo cambian el simbolo: no se convierte nada.

import type { GastosFijos } from './formulas.ts'

export type Moneda = { codigo: string; nombre: string; simbolo: string }

export const MONEDAS: Moneda[] = [
  { codigo: 'ARS', nombre: 'Pesos argentinos', simbolo: 'AR$' },
  { codigo: 'USD', nombre: 'Dólares', simbolo: 'US$' },
  { codigo: 'EUR', nombre: 'Euros', simbolo: '€' },
  { codigo: 'MXN', nombre: 'Pesos mexicanos', simbolo: 'MX$' },
  { codigo: 'COP', nombre: 'Pesos colombianos', simbolo: 'COL$' },
  { codigo: 'CLP', nombre: 'Pesos chilenos', simbolo: 'CLP$' },
  { codigo: 'PEN', nombre: 'Soles', simbolo: 'S/' },
  { codigo: 'UYU', nombre: 'Pesos uruguayos', simbolo: '$U' },
  { codigo: 'DOP', nombre: 'Pesos dominicanos', simbolo: 'RD$' },
  { codigo: 'PYG', nombre: 'Guaraníes', simbolo: '₲' },
]

export const simboloDe = (codigo: string) =>
  MONEDAS.find((m) => m.codigo === codigo)?.simbolo ?? '$'

const numero = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Redondea recien acá: las cuentas van con toda la precisión (spec §4). */
export const formatear = (n: number, moneda: string) =>
  `${simboloDe(moneda)} ${numero.format(Number.isFinite(n) ? n : 0)}`

export const OTRA_IMPRESORA = 'Otro / Personalizado'

export type Impresora = { nombre: string; w: number | null }

export const IMPRESORAS: Impresora[] = [
  { nombre: 'Bambu Lab A1', w: 95 },
  { nombre: 'Bambu Lab A1 Mini', w: 45 },
  { nombre: 'Bambu Lab P1P', w: 80 },
  { nombre: 'Bambu Lab P1S', w: 100 },
  { nombre: 'Bambu Lab X1 Carbon', w: 120 },
  { nombre: 'Bambu Lab P2S', w: 130 },
  { nombre: 'Bambu Lab H2S', w: 210 },
  { nombre: 'Bambu Lab H2D', w: 210 },
  { nombre: 'Bambu Lab H2C', w: 210 },
  { nombre: 'Prusa MK3S+', w: 80 },
  { nombre: 'Prusa MK4', w: 100 },
  { nombre: 'Creality Ender 3 V2', w: 110 },
  { nombre: 'Creality Ender 3 S1', w: 120 },
  { nombre: 'Creality K1', w: 100 },
  { nombre: 'Creality K1C', w: 100 },
  { nombre: 'Creality K1 Max', w: 200 },
  { nombre: 'Creality K2', w: 150 },
  { nombre: 'Creality K2 Pro', w: 180 },
  { nombre: 'Creality K2 Plus', w: 220 },
  { nombre: 'Anycubic Kobra 2', w: 75 },
  { nombre: 'Anycubic Vyper', w: 80 },
  { nombre: 'SnapMaker U1', w: 130 },
  { nombre: 'Elegoo Saturn 3 (resina)', w: 75 },
  { nombre: 'Elegoo Saturn 4 (resina)', w: 75 },
  { nombre: 'Voron 2.4 (350mm DIY)', w: 225 },
  { nombre: OTRA_IMPRESORA, w: null },
]

/** Los valores con los que arranca un perfil nuevo (spec §2.2). */
export const GASTOS_POR_DEFECTO: GastosFijos = {
  precioKg: 25000,
  precioKwh: 140,
  modelo: OTRA_IMPRESORA,
  watts: 100,
  vidaUtilHs: 4320,
  repuestos: 150000,
  errorPct: 5,
}

/** Los multiplicadores de la fila de botones, con su referencia (spec §2.4). */
export const MULTIPLICADORES: { valor: number; referencia: string }[] = [
  { valor: 2, referencia: 'Alto volumen o descuento' },
  { valor: 2.5, referencia: 'Volumen medio' },
  { valor: 3, referencia: 'Mayorista' },
  { valor: 3.5, referencia: 'Intermedio' },
  { valor: 4, referencia: 'Minorista' },
  { valor: 5, referencia: 'Llaveros y piezas chicas' },
]
