// Capa 1 del chequeo de licencias: revisa el arbol INSTALADO de dependencias de
// produccion, incluidas las transitivas. Rompe (exit 1) si encuentra:
//  - un paquete de la lista negra, en cualquier profundidad del arbol
//  - una licencia no permitida sin excepcion registrada con su motivo
//
// La capa 2 (scripts/vite-plugin-licencias.ts) revisa lo que entra al bundle.
//
// Uso:  pnpm chequear-licencias

import { execSync } from 'node:child_process'
import { licenciaPermitida, motivoExcepcion, motivoListaNegra } from './reglas-licencias.ts'

type Paquete = { name: string; versions: string[]; license: string }

// Comando fijo, sin datos externos: execSync funciona igual en Windows (pnpm.cmd) y en Linux.
const salida = execSync('pnpm licenses list --json --prod', {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const porLicencia = JSON.parse(salida) as Record<string, Paquete[]>

const errores: string[] = []
const excepcionesUsadas: string[] = []
let total = 0

for (const [licencia, paquetes] of Object.entries(porLicencia)) {
  for (const p of paquetes) {
    total++
    const id = `${p.name}@${p.versions.join(',')}`

    const negra = motivoListaNegra(p.name)
    if (negra) {
      errores.push(`LISTA NEGRA  ${id}  (${licencia})\n               ${negra}`)
      continue
    }
    if (licenciaPermitida(licencia)) continue

    const excepcion = motivoExcepcion(p.name)
    if (excepcion) {
      excepcionesUsadas.push(`${id}  (${licencia})\n               ${excepcion}`)
      continue
    }
    errores.push(`NO PERMITIDA ${id}  (${licencia})`)
  }
}

console.log(`Licencias: ${total} paquetes de produccion revisados (incluye transitivas)`)
for (const [licencia, paquetes] of Object.entries(porLicencia)) {
  console.log(`  ${licencia.padEnd(34)} ${paquetes.length}`)
}

if (excepcionesUsadas.length) {
  console.log('\nExcepciones aplicadas (el build verifica que NO entren al bundle):')
  for (const e of excepcionesUsadas) console.log(`  ${e}`)
}

if (errores.length) {
  console.error(`\nFALLO: ${errores.length} problema(s) de licencia`)
  for (const e of errores) console.error(`  ${e}`)
  console.error(
    '\nSi un paquete es seguro porque no llega al bundle, registralo en EXCEPCIONES ' +
      '(scripts/reglas-licencias.ts) con el motivo por escrito.',
  )
  process.exit(1)
}

console.log('\nOK: ninguna licencia prohibida')
