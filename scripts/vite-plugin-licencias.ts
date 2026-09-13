// Capa 2 del chequeo de licencias: mira lo que REALMENTE entra al bundle.
//
// En cada build:
//  - toma los modulos que quedaron en los chunks y los agrupa por paquete npm
//  - rompe si alguno esta en la lista negra, en EXCEPCIONES (una excepcion es
//    "instalado pero nunca publicado"), o tiene una licencia no permitida
//  - emite dist/LICENSES.txt con el texto de licencia y el NOTICE de cada paquete
//
// Esta capa no admite excepciones: lo que se publica tiene que estar limpio.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import {
  licenciaDePackageJson,
  licenciaPermitida,
  motivoExcepcion,
  motivoListaNegra,
} from './reglas-licencias.ts'

type PaqueteBundle = { nombre: string; dir: string }

/** "C:\\x\\node_modules\\.pnpm\\a@1\\node_modules\\@s\\p\\lib\\i.js" -> { nombre: "@s/p", dir } */
function paqueteDeModulo(id: string): PaqueteBundle | null {
  const ruta = id.replace(/^\0/, '').split('?')[0]!.replace(/\\/g, '/')
  const corte = ruta.lastIndexOf('/node_modules/')
  if (corte === -1) return null
  const base = ruta.slice(0, corte + '/node_modules/'.length)
  const partes = ruta.slice(base.length).split('/')
  const nombre = partes[0]!.startsWith('@') ? `${partes[0]}/${partes[1]}` : partes[0]!
  return { nombre, dir: base + nombre }
}

function leerTextos(dir: string): { licencia: string; notice: string } {
  const archivos = existsSync(dir) ? readdirSync(dir) : []
  const leer = (re: RegExp) => {
    const f = archivos.find((a) => re.test(a))
    return f ? readFileSync(join(dir, f), 'utf8').trim() : ''
  }
  return { licencia: leer(/^(licen[cs]e|copying)(\.|$)/i), notice: leer(/^notice(\.|$)/i) }
}

export function licencias(): Plugin {
  return {
    name: '3dllaveros:licencias',
    apply: 'build',
    generateBundle(_opciones, bundle) {
      const paquetes = new Map<string, PaqueteBundle>()
      for (const salida of Object.values(bundle)) {
        if (salida.type !== 'chunk') continue
        for (const id of Object.keys(salida.modules)) {
          const p = paqueteDeModulo(id)
          if (p) paquetes.set(p.nombre, p)
        }
      }

      const errores: string[] = []
      const secciones: string[] = []

      for (const p of [...paquetes.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))) {
        const pkg = JSON.parse(readFileSync(join(p.dir, 'package.json'), 'utf8'))
        const licencia = licenciaDePackageJson(pkg)
        const id = `${p.nombre}@${pkg.version}`

        const negra = motivoListaNegra(p.nombre)
        if (negra) errores.push(`LISTA NEGRA en el bundle: ${id} — ${negra}`)
        else if (motivoExcepcion(p.nombre)) {
          errores.push(
            `EXCEPCION en el bundle: ${id}. Estaba registrada como "instalada pero no publicada" ` +
              'y llego al codigo que se publica: la excepcion ya no es valida.',
          )
        } else if (!licenciaPermitida(licencia)) {
          errores.push(`LICENCIA NO PERMITIDA en el bundle: ${id} (${licencia ?? 'sin licencia'})`)
        }

        const { licencia: texto, notice } = leerTextos(p.dir)
        secciones.push(
          [
            `${id} — ${licencia ?? 'sin licencia declarada'}`,
            pkg.homepage ? `${pkg.homepage}` : '',
            '',
            texto || '(el paquete no incluye archivo de licencia)',
            notice ? `\n--- NOTICE ---\n${notice}` : '',
          ]
            .filter((l, i) => i !== 1 || l)
            .join('\n'),
        )
      }

      if (errores.length) {
        this.error(`Chequeo de licencias del bundle:\n  ${errores.join('\n  ')}`)
      }

      const separador = `\n\n${'='.repeat(78)}\n\n`
      this.emitFile({
        type: 'asset',
        fileName: 'LICENSES.txt',
        source:
          `3D Llaveros — licencias del software de terceros incluido en este sitio\n` +
          `${paquetes.size} paquetes, generado automaticamente en el build.` +
          separador +
          secciones.join(separador) +
          '\n',
      })
      this.info(
        `LICENSES.txt: ${paquetes.size} paquetes en el bundle, todos con licencia permitida`,
      )
    },
  }
}
