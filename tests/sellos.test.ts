// La bisagra de los sellos. Lo que se puede verificar sin imprimir: que sea un solido valido, que
// mida lo que dice, que apoye en el piso y —lo importante— que las dos mitades no se toquen.
// Si se tocaran, saldria soldada de la impresora y no giraria.

import { beforeAll, describe, expect, test } from 'vitest'
import { cargarManifold, withScope } from '../src/geometria/manifold.ts'
import {
  BISAGRA_POR_DEFECTO,
  bisagra,
  bisagraRepetida,
  medidasBisagra,
  mitadesDeBisagra,
} from '../src/sellos/bisagra.ts'

beforeAll(async () => {
  await cargarManifold()
})

describe('bisagra print-in-place', () => {
  test('es un solido valido y apoya en z = 0', () => {
    const caja = withScope((m) => {
      const b = bisagra(m, BISAGRA_POR_DEFECTO)
      expect(String(b.status())).toMatch(/^(0|NoError)$/)
      // Dos piezas sueltas que se enganchan: la hoja izquierda y la derecha
      expect(b.decompose().length).toBe(2)
      return b.boundingBox()
    })
    const p = BISAGRA_POR_DEFECTO
    const medidas = medidasBisagra(p)
    expect(caja.min[2]).toBeCloseTo(0, 6)
    expect(caja.max[2]).toBeCloseTo(medidas.altoZ, 6)
    expect(caja.max[1] - caja.min[1]).toBeCloseTo(p.largoY, 6)
    // De punta a punta: las dos hojas mas el barril
    expect(caja.max[0]).toBeCloseTo(medidas.hojaX, 6)
    expect(caja.min[0]).toBeCloseTo(-medidas.hojaX, 6)
  })

  test('las dos mitades no se tocan: sale girando', () => {
    const { pisado, volumen } = withScope((m) => {
      const { izquierda, derecha } = mitadesDeBisagra(m, BISAGRA_POR_DEFECTO)
      return {
        pisado: m.Manifold.intersection([izquierda, derecha]).volume(),
        volumen: izquierda.volume() + derecha.volume(),
      }
    })
    expect(volumen).toBeGreaterThan(0)
    expect(Math.abs(pisado)).toBeLessThan(1e-6)
  })

  test('sin holgura las mitades sí se pisan (la prueba de arriba mide algo)', () => {
    const pisado = withScope((m) => {
      const { izquierda, derecha } = mitadesDeBisagra(m, {
        ...BISAGRA_POR_DEFECTO,
        holgura: 0,
      })
      return m.Manifold.intersection([izquierda, derecha]).volume()
    })
    expect(pisado).toBeGreaterThan(0)
  })

  test('el eje queda a la altura de la cara del sello: al cerrar, las caras se encuentran', () => {
    const p = BISAGRA_POR_DEFECTO
    expect(medidasBisagra(p).eje).toBe(p.espesorHoja)
  })

  test('dos y tres unidades miden el doble y el triple, sin huecos', () => {
    for (const veces of [2, 3]) {
      const caja = withScope((m) => bisagraRepetida(m, BISAGRA_POR_DEFECTO, veces).boundingBox())
      expect(caja.max[1] - caja.min[1]).toBeCloseTo(BISAGRA_POR_DEFECTO.largoY * veces, 6)
    }
  })
})

// ------------------------------------------------------------------ las placas

import { BISAGRA_POR_DEFECTO as BIS } from '../src/sellos/bisagra.ts'
import { sello, SELLO_POR_DEFECTO, profundidadDe } from '../src/sellos/placas.ts'
import type { SimplePolygon } from '../src/geometria/manifold.ts'

/** Una "O": un cuadrado con un agujero adentro. Sirve para ver islas y agujeros. */
const LOGO_O: SimplePolygon[] = [
  [
    [0, 0],
    [40, 0],
    [40, 40],
    [0, 40],
  ],
  [
    [12, 12],
    [28, 12],
    [28, 28],
    [12, 28],
  ],
]

/** Cerrar el sello: la hembra gira 180° sobre el eje de la bisagra, que esta a la altura de la cara. */
const plegar = (
  pieza: {
    rotate: (v: [number, number, number]) => any
    translate: (v: [number, number, number]) => any
  },
  espesor: number,
) => pieza.rotate([0, 180, 0]).translate([0, 0, 2 * espesor])

describe('placas del sello', () => {
  test('cada placa es una sola pieza y las dos no se tocan', () => {
    const { piezasMacho, piezasHembra, pisado } = withScope((m) => {
      const s = sello(m, LOGO_O, SELLO_POR_DEFECTO, BIS)
      return {
        piezasMacho: s.macho.decompose().length,
        piezasHembra: s.hembra.decompose().length,
        pisado: m.Manifold.intersection([s.macho, s.hembra]).volume(),
      }
    })
    expect(piezasMacho).toBe(1)
    expect(piezasHembra).toBe(1)
    expect(Math.abs(pisado)).toBeLessThan(1e-6)
  })

  test('al cerrarlo, el relieve entra en el hueco sin tocar', () => {
    const p = SELLO_POR_DEFECTO
    const pisado = withScope((m) => {
      const s = sello(m, LOGO_O, p, BIS)
      return m.Manifold.intersection([s.macho, plegar(s.hembra, p.espesor)]).volume()
    })
    expect(Math.abs(pisado)).toBeLessThan(1e-6)
  })

  test('con tolerancia negativa el relieve choca: la prueba de arriba mide algo', () => {
    const p = { ...SELLO_POR_DEFECTO, tolerancia: -0.3 }
    const pisado = withScope((m) => {
      const s = sello(m, LOGO_O, p, BIS)
      return m.Manifold.intersection([s.macho, plegar(s.hembra, p.espesor)]).volume()
    })
    expect(pisado).toBeGreaterThan(0)
  })

  test('el hueco de la hembra es mas hondo que el relieve del macho', () => {
    for (const relieve of [0.4, 0.5, 0.6, 1.2]) {
      expect(profundidadDe(relieve)).toBeGreaterThan(relieve)
    }
  })

  test('el logo entra en la placa con su margen', () => {
    const p = SELLO_POR_DEFECTO
    const { logoMm, medidas } = withScope((m) => sello(m, LOGO_O, p, BIS))
    expect(logoMm[0]).toBeLessThanOrEqual(p.anchoPlaca - 2 * p.margen + 0.001)
    expect(logoMm[1]).toBeLessThanOrEqual(BIS.largoY - 2 * p.margen + 0.001)
    expect(medidas[1]).toBeCloseTo(BIS.largoY, 6)
  })

  test('con dos y tres bisagras las placas se alargan igual', () => {
    for (const bisagras of [2, 3] as const) {
      const alto = withScope(
        (m) => sello(m, LOGO_O, { ...SELLO_POR_DEFECTO, bisagras }, BIS).medidas[1],
      )
      expect(alto).toBeCloseTo(BIS.largoY * bisagras, 6)
    }
  })
})
