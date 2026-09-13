import { describe, expect, test } from 'vitest'
import {
  licenciaDePackageJson,
  licenciaPermitida,
  motivoExcepcion,
  motivoListaNegra,
} from '../scripts/reglas-licencias.ts'

describe('licenciaPermitida', () => {
  test.each(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'CC0-1.0', '0BSD'])('permite %s', (l) => {
    expect(licenciaPermitida(l)).toBe(true)
  })

  test.each(['GPL-2.0', 'AGPL-3.0', 'LGPL-3.0-or-later', 'MPL-2.0'])('rechaza %s', (l) => {
    expect(licenciaPermitida(l)).toBe(false)
  })

  test('OR permite elegir: alcanza con una opcion permitida', () => {
    expect(licenciaPermitida('MIT OR Apache-2.0')).toBe(true)
    expect(licenciaPermitida('(GPL-3.0 OR MIT)')).toBe(true)
  })

  test('AND obliga a cumplir todas: una sola prohibida ya rechaza', () => {
    // el caso real de @img/sharp-win32-x64
    expect(licenciaPermitida('Apache-2.0 AND LGPL-3.0-or-later')).toBe(false)
    expect(licenciaPermitida('MIT AND ISC')).toBe(true)
    // el caso real de pako
    expect(licenciaPermitida('(MIT AND Zlib)')).toBe(true)
  })

  test('lo que no es SPDX se rechaza, aunque adentro diga MIT', () => {
    // @imgly/background-removal declara esto y adentro es AGPL
    expect(licenciaPermitida('SEE LICENSE IN LICENSE.md')).toBe(false)
    expect(licenciaPermitida('UNKNOWN')).toBe(false)
    expect(licenciaPermitida('Custom: MIT')).toBe(false)
    expect(licenciaPermitida('')).toBe(false)
    expect(licenciaPermitida(undefined)).toBe(false)
  })
})

describe('lista negra', () => {
  test('bloquea por nombre exacto', () => {
    expect(motivoListaNegra('potrace')).toMatch(/GPL/)
    expect(motivoListaNegra('marchingsquares')).toMatch(/AGPL/)
  })

  test('un patron de scope bloquea todo el scope', () => {
    expect(motivoListaNegra('@imgly/background-removal')).toMatch(/AGPL/)
    expect(motivoListaNegra('@imgly/cualquier-otro')).not.toBeNull()
  })

  test('no bloquea nombres parecidos', () => {
    expect(motivoListaNegra('potrace-lite')).toBeNull()
    expect(motivoListaNegra('imgly')).toBeNull()
    expect(motivoListaNegra('d3-contour')).toBeNull()
  })
})

describe('excepciones', () => {
  test('cubre los binarios de sharp', () => {
    expect(motivoExcepcion('@img/sharp-win32-x64')).not.toBeNull()
    expect(motivoExcepcion('@img/sharp-libvips-linux-x64')).not.toBeNull()
  })

  test('NO cubre el resto del scope @img', () => {
    // @img/colour tambien viene de sharp pero es MIT: no necesita excepcion
    // y un patron demasiado ancho escondería problemas futuros
    expect(motivoExcepcion('@img/colour')).toBeNull()
  })
})

describe('licenciaDePackageJson', () => {
  test('lee los tres formatos historicos del campo', () => {
    expect(licenciaDePackageJson({ license: 'MIT' })).toBe('MIT')
    expect(licenciaDePackageJson({ license: { type: 'ISC' } })).toBe('ISC')
    expect(licenciaDePackageJson({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] })).toBe(
      'MIT OR Apache-2.0',
    )
    expect(licenciaDePackageJson({})).toBeUndefined()
  })
})
