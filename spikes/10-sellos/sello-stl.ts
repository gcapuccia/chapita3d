// Un sello de prueba en STL, para mirarlo y para imprimirlo.
// Uso: node spikes/10-sellos/sello-stl.ts [texto]   →  spikes/10-sellos/salida/sello-<texto>.stl

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { FUENTES } from '../../src/datos/fuentes.ts'
import { escribirStl } from '../../src/export/stl.ts'
import { aPiezaExport } from '../../src/geometria/malla.ts'
import { cargarManifold, withScope } from '../../src/geometria/manifold.ts'
import { contornosDeTexto, registrarFuente } from '../../src/geometria/texto.ts'
import { BISAGRA_POR_DEFECTO } from '../../src/sellos/bisagra.ts'
import { sello, SELLO_POR_DEFECTO } from '../../src/sellos/placas.ts'

const texto = process.argv[2] ?? 'HOLA'
await cargarManifold()

const fuente = FUENTES.find((f) => f.id === 'gruesa') ?? FUENTES[0]!
const datos = readFileSync(`node_modules/${fuente.archivo}`)
registrarFuente(
  fuente.id,
  datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength),
)

mkdirSync('spikes/10-sellos/salida', { recursive: true })
const { piezas, info } = withScope((m) => {
  const contornos = contornosDeTexto(fuente.id, texto, 40)
  const s = sello(m, contornos, SELLO_POR_DEFECTO, BISAGRA_POR_DEFECTO)
  const entero = m.Manifold.union([s.macho, s.hembra])
  return {
    piezas: [
      aPiezaExport(entero, `sello ${texto}`, 1),
      aPiezaExport(s.macho, 'macho', 1),
      aPiezaExport(s.hembra, 'hembra', 2),
    ],
    info: {
      medidas: s.medidas.map((v) => v.toFixed(1)).join(' × '),
      logo: s.logoMm.map((v) => v.toFixed(1)).join(' × '),
      piezasSueltas: entero.decompose().length,
      volumen: entero.volume().toFixed(0),
    },
  }
})

writeFileSync(`spikes/10-sellos/salida/sello-${texto}.stl`, escribirStl(piezas[0]!))
console.log(
  `«${texto}» · ${info.medidas} mm · logo ${info.logo} mm · ${info.piezasSueltas} piezas · ${info.volumen} mm³`,
)
console.log('listo: spikes/10-sellos/salida/sello-' + texto + '.stl')
