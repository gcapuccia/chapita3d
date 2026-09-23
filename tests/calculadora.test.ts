// Los dos casos de docs/calculadora-3d-spec.md §8, al peso. Si estos fallan, la calculadora miente.

import { describe, expect, test } from 'vitest'
import { aNumero, calcular, type Entradas } from '../src/calculadora/formulas.ts'
import { formatear } from '../src/calculadora/datos.ts'

const GASTOS = {
  precioKg: 25000,
  precioKwh: 140,
  modelo: 'Otro / Personalizado',
  watts: 120,
  vidaUtilHs: 4320,
  repuestos: 150000,
  errorPct: 5,
}
const base: Entradas = { ...GASTOS, horas: 0, minutos: 0, gramos: 0, insumos: 0, multiplicador: 5 }
const ars = (n: number) => formatear(n, 'ARS')

describe('casos de la especificacion', () => {
  test('caso A · 3 h, 70 g, sin insumos', () => {
    const r = calcular({ ...base, horas: 3, gramos: 70 })
    expect(ars(r.material)).toBe('AR$ 1.750,00')
    expect(ars(r.luz)).toBe('AR$ 50,40')
    expect(ars(r.desgaste)).toBe('AR$ 104,17')
    expect(ars(r.margenError)).toBe('AR$ 95,23')
    expect(ars(r.costoTotal)).toBe('AR$ 1.999,80')
    expect(ars(r.insumosFinal)).toBe('AR$ 0,00')
    expect(ars(r.totalCobrar)).toBe('AR$ 9.998,98')
    expect(ars(r.precioML)).toBe('AR$ 11.598,81')
  })

  test('caso B · 3 h 30 min, 70 g, insumos 1000', () => {
    const r = calcular({ ...base, horas: 3, minutos: 30, gramos: 70, insumos: 1000 })
    expect(ars(r.material)).toBe('AR$ 1.750,00')
    expect(ars(r.luz)).toBe('AR$ 58,80')
    expect(ars(r.desgaste)).toBe('AR$ 121,53')
    expect(ars(r.margenError)).toBe('AR$ 96,52')
    expect(ars(r.costoTotal)).toBe('AR$ 2.026,84')
    expect(ars(r.insumosFinal)).toBe('AR$ 1.300,00')
    expect(ars(r.totalCobrar)).toBe('AR$ 11.434,22')
    expect(ars(r.precioML)).toBe('AR$ 13.055,70')
  })

  test('el total sale del valor sin redondear (9.998,98 y no 9.999,00)', () => {
    const r = calcular({ ...base, horas: 3, gramos: 70 })
    expect(r.costoTotal).toBeCloseTo(1999.795, 3)
    expect(r.totalCobrar).toBeCloseTo(9998.975, 3)
  })
})

describe('bordes', () => {
  test('sin vida util no hay desgaste, y no se divide por cero', () => {
    const r = calcular({ ...base, horas: 3, gramos: 70, vidaUtilHs: 0 })
    expect(r.desgaste).toBe(0)
    expect(Number.isFinite(r.totalCobrar)).toBe(true)
  })

  test('los negativos y los vacios cuentan como cero', () => {
    const r = calcular({ ...base, horas: -5, gramos: Number.NaN, insumos: -100 })
    expect(r.material).toBe(0)
    expect(r.insumosFinal).toBe(0)
    expect(r.totalCobrar).toBe(0)
  })

  test('el margen de error no toca los insumos', () => {
    const conInsumos = calcular({ ...base, horas: 1, gramos: 10, insumos: 1000 })
    const sinInsumos = calcular({ ...base, horas: 1, gramos: 10 })
    expect(conInsumos.margenError).toBe(sinInsumos.margenError)
    expect(conInsumos.totalCobrar - sinInsumos.totalCobrar).toBeCloseTo(1300, 10)
  })

  test('se escribe con coma o con punto', () => {
    expect(aNumero('2,8')).toBe(2.8)
    expect(aNumero('2.8')).toBe(2.8)
    expect(aNumero('')).toBe(0)
    expect(aNumero('-4')).toBe(0)
  })
})

describe('monedas', () => {
  test('cada una con su simbolo y el formato de acá', () => {
    expect(formatear(11598.81, 'ARS')).toBe('AR$ 11.598,81')
    expect(formatear(11598.81, 'USD')).toBe('US$ 11.598,81')
    expect(formatear(1, 'PYG')).toBe('₲ 1,00')
  })
})
