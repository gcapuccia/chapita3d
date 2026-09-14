// Reglas de texto del plan (§4.7), verificadas en CI:
//  1. Nunca la palabra "Error".
//  2. Nunca jerga sin traducir (lista negra).
// Se revisan los textos de la interfaz y tambien los mensajes de validaciones y casos feos, que la
// interfaz muestra aunque vivan en su propio modulo.

import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { es } from '../src/i18n/es.ts'

const JERGA = [
  'extrusor',
  'manifold',
  'offset',
  'mesh',
  'render',
  'buffer',
  'worker',
  'polígono',
  'vértice',
  'boolean',
  'malla',
  'wasm',
]

/** Todos los textos de es.ts, llamando a las funciones con argumentos de ejemplo. */
function textos(valor: unknown): string[] {
  if (typeof valor === 'string') return [valor]
  if (typeof valor === 'function') {
    // No se sabe si cada argumento es texto o numero: se prueban combinaciones hasta que una sirva
    const fn = valor as (...a: unknown[]) => unknown
    for (const args of [
      [3, 2, 1, 4],
      ['ejemplo.png', 3, 2, 1],
      [3, 2, '#FFFFFF'],
      ['ejemplo.png'],
    ]) {
      try {
        return [String(fn(...args))]
      } catch {
        // siguiente combinacion
      }
    }
    throw new Error(`No pude evaluar el texto ${fn.toString().slice(0, 60)}`)
  }
  if (Array.isArray(valor)) return valor.flatMap(textos)
  if (valor && typeof valor === 'object') return Object.values(valor).flatMap(textos)
  return []
}

/** Literales de texto de un archivo fuente, sin comentarios. */
function literales(ruta: string): string[] {
  const codigo = readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  return (
    [...codigo.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)]
      .map((m) => m[2]!)
      // identificadores de codigo ('solido-invalido', 'Round'...), no texto para personas
      .filter((s) => /\s/.test(s))
  )
}

describe('textos de la interfaz', () => {
  const todos = textos(es)

  test('hay textos para revisar', () => {
    expect(todos.length).toBeGreaterThan(60)
  })

  test('nunca la palabra "Error"', () => {
    expect(todos.filter((t) => /\berror\b/i.test(t))).toEqual([])
  })

  test.each(JERGA)('sin jerga: «%s»', (palabra) => {
    expect(todos.filter((t) => t.toLowerCase().includes(palabra))).toEqual([])
  })
})

describe('mensajes de validaciones y casos feos', () => {
  const mensajes = ['src/geometria/drc.ts', 'src/pipeline/diagnostico.ts'].flatMap(literales)

  test('hay mensajes para revisar', () => {
    expect(mensajes.length).toBeGreaterThan(15)
  })

  test.each(JERGA)('sin jerga: «%s»', (palabra) => {
    expect(mensajes.filter((t) => t.toLowerCase().includes(palabra))).toEqual([])
  })
})
