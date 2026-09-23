// Saca la bisagra en STL para imprimir una de prueba y calibrar la holgura.
// Uso: node spikes/10-sellos/bisagra-stl.ts [holgura]   →  spikes/10-sellos/salida/bisagra-0.3.stl

import { mkdirSync, writeFileSync } from 'node:fs'
import { escribirStl } from '../../src/export/stl.ts'
import { aPiezaExport } from '../../src/geometria/malla.ts'
import { cargarManifold, withScope } from '../../src/geometria/manifold.ts'
import { BISAGRA_POR_DEFECTO, bisagra } from '../../src/sellos/bisagra.ts'

const holgura = Number(process.argv[2] ?? BISAGRA_POR_DEFECTO.holgura)
await cargarManifold()

mkdirSync('spikes/10-sellos/salida', { recursive: true })
const pieza = withScope((m) => {
  const b = bisagra(m, { ...BISAGRA_POR_DEFECTO, holgura })
  const caja = b.boundingBox()
  console.log(
    `holgura ${holgura} mm · ${(caja.max[0] - caja.min[0]).toFixed(1)} × ` +
      `${(caja.max[1] - caja.min[1]).toFixed(1)} × ${(caja.max[2] - caja.min[2]).toFixed(1)} mm · ` +
      `${b.decompose().length} piezas · ${b.volume().toFixed(0)} mm³`,
  )
  return aPiezaExport(b, `bisagra ${holgura}`, 1)
})
const ruta = `spikes/10-sellos/salida/bisagra-${holgura}.stl`
writeFileSync(ruta, escribirStl(pieza))
console.log('listo:', ruta)
