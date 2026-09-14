// Capa 2 del chequeo de licencias: mira lo que REALMENTE entra a lo que se publica.
//
// Vite compila cada Web Worker en un build SEPARADO, cuyo resultado no aparece en los
// chunks del build principal. Por eso el chequeo tiene dos plugins que comparten un
// registro: uno va en `worker.plugins` y el otro en `plugins`. Juntos cubren todo.
//
// En cada build:
//  - toma los modulos que quedaron en los chunks y los agrupa por paquete npm
//  - rompe si alguno esta en la lista negra, en EXCEPCIONES (una excepcion es
//    "instalado pero nunca publicado"), o tiene una licencia no permitida
//  - el build principal emite dist/LICENSES.txt con TODO lo acumulado (app + workers)
//
// Esta capa no admite excepciones: lo que se publica tiene que estar limpio.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin, Rolldown } from 'vite'
import {
  licenciaDePackageJson,
  licenciaPermitida,
  motivoExcepcion,
  motivoListaNegra,
} from './reglas-licencias.ts'

type PaqueteBundle = { nombre: string; dir: string; version: string; licencia: string | undefined }

/** "C:\\x\\node_modules\\.pnpm\\a@1\\node_modules\\@s\\p\\lib\\i.js" -> { nombre: "@s/p", dir } */
function paqueteDeModulo(id: string): { nombre: string; dir: string } | null {
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

function erroresDe(p: PaqueteBundle): string | null {
  const id = `${p.nombre}@${p.version}`
  const negra = motivoListaNegra(p.nombre)
  if (negra) return `LISTA NEGRA en el bundle: ${id} — ${negra}`
  if (motivoExcepcion(p.nombre)) {
    return (
      `EXCEPCION en el bundle: ${id}. Estaba registrada como "instalada pero no publicada" ` +
      'y llego al codigo que se publica: la excepcion ya no es valida.'
    )
  }
  if (!licenciaPermitida(p.licencia, p.nombre)) {
    return `LICENCIA NO PERMITIDA en el bundle: ${id} (${p.licencia ?? 'sin licencia'})`
  }
  return null
}

function textoLicencias(paquetes: PaqueteBundle[]): string {
  const separador = `\n\n${'='.repeat(78)}\n\n`
  const secciones = paquetes.map((p) => {
    const { licencia, notice } = leerTextos(p.dir)
    const pkg = JSON.parse(readFileSync(join(p.dir, 'package.json'), 'utf8')) as {
      homepage?: string
    }
    const lineas = [`${p.nombre}@${p.version} — ${p.licencia ?? 'sin licencia declarada'}`]
    if (pkg.homepage) lineas.push(pkg.homepage)
    lineas.push('', licencia || '(el paquete no incluye archivo de licencia)')
    if (notice) lineas.push('', '--- NOTICE ---', notice)
    return lineas.join('\n')
  })
  return (
    '3D Llaveros — licencias del software de terceros incluido en este sitio\n' +
    `${paquetes.length} paquetes, generado automaticamente en el build.` +
    separador +
    secciones.join(separador) +
    '\n'
  )
}

export function crearChequeoLicencias() {
  const registro = new Map<string, PaqueteBundle>()

  /** Agrega al registro los paquetes de este bundle y devuelve los errores que encontro. */
  function recolectar(bundle: Rolldown.OutputBundle): string[] {
    const errores: string[] = []
    for (const salida of Object.values(bundle)) {
      if (salida.type !== 'chunk') continue
      for (const id of Object.keys(salida.modules)) {
        const ubicacion = paqueteDeModulo(id)
        if (!ubicacion || registro.has(ubicacion.nombre)) continue
        const pkg = JSON.parse(readFileSync(join(ubicacion.dir, 'package.json'), 'utf8'))
        const paquete: PaqueteBundle = {
          ...ubicacion,
          version: String(pkg.version),
          licencia: licenciaDePackageJson(pkg),
        }
        registro.set(paquete.nombre, paquete)
        const error = erroresDe(paquete)
        if (error) errores.push(error)
      }
    }
    return errores
  }

  return {
    /** Va en `worker.plugins`: revisa el bundle de cada worker. */
    worker(): Plugin {
      return {
        name: '3dllaveros:licencias-worker',
        apply: 'build',
        generateBundle(_opciones, bundle) {
          const errores = recolectar(bundle)
          if (errores.length)
            this.error(`Chequeo de licencias del worker:\n  ${errores.join('\n  ')}`)
        },
      }
    },

    /** Va en `plugins`: revisa la app y emite LICENSES.txt con app + workers. */
    principal(): Plugin {
      return {
        name: '3dllaveros:licencias',
        apply: 'build',
        generateBundle(_opciones, bundle) {
          const errores = recolectar(bundle)
          if (errores.length)
            this.error(`Chequeo de licencias del bundle:\n  ${errores.join('\n  ')}`)

          const paquetes = [...registro.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
          this.emitFile({
            type: 'asset',
            fileName: 'LICENSES.txt',
            source: textoLicencias(paquetes),
          })
          this.info(
            `LICENSES.txt: ${paquetes.length} paquetes (app + workers), todos con licencia permitida`,
          )
        },
      }
    },
  }
}
