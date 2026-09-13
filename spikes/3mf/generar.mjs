// Spike F0.2 — 3MF multicolor escrito a mano, perfil Bambu Studio / OrcaSlicer.
//
// Objetivo: confirmar que un 3MF generado por nosotros abre en Bambu Studio con
// los colores YA asignados a los slots del AMS, sin pintar nada a mano.
// Si esto funciona, el resto del proyecto es trabajo. Si no, cambia el producto.
//
// Sin dependencias: ZIP propio sobre zlib. Correr con:  node generar.mjs
//
// Reglas verificadas en el codigo fuente de los slicers (docs/research/audit-02):
//  1. metadata "Application" = "BambuStudio-..."  -> es EL interruptor
//  2. extruder en model_settings.config = indice en filament_colour + 1
//  3. nada de <basematerials> ni displaycolor: ningun slicer objetivo los lee
//  4. nada de requiredextensions="p"
//  5. componentes en orden topologico (hijos antes que padres)
//  6. project_settings.config minimo, para no pisarle los presets al usuario

import { deflateRawSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = join(AQUI, 'salida')

// ---------------------------------------------------------------- parametros
const APLICACION = 'BambuStudio-02.05.00.00' // el interruptor (regla 1)
const SLOTS = 4 // slots declarados del AMS
const PRESET_FILAMENTO = 'Bambu PLA Basic @BBL A1'
const CENTRO_CAMA = 128 // A1 / P1S = 256 mm

// El llavero de prueba: base + dos barras de color encima.
// Cajas nada mas: este spike valida el FORMATO, no la geometria.
const PIEZAS = [
  { nombre: 'base', slot: 1, hex: '#FFFFFF', caja: [-20, -12.5, 0, 20, 12.5, 2.4] },
  { nombre: 'rojo', slot: 2, hex: '#E53935', caja: [-15, -9, 2.4, 15, -3, 3.0] },
  { nombre: 'negro', slot: 3, hex: '#1C1C1C', caja: [-10, 3, 2.4, 10, 9, 3.0] },
]

// ------------------------------------------------------------------ geometria
// Caja con normales hacia afuera (CCW visto desde fuera), como exige 3MF.
function caja([x0, y0, z0, x1, y1, z1]) {
  const v = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
  ]
  const t = [
    [0, 2, 1],
    [0, 3, 2], // abajo   (-Z)
    [4, 5, 6],
    [4, 6, 7], // arriba  (+Z)
    [0, 1, 5],
    [0, 5, 4], // frente  (-Y)
    [1, 2, 6],
    [1, 6, 5], // derecha (+X)
    [2, 3, 7],
    [2, 7, 6], // atras   (+Y)
    [3, 0, 4],
    [3, 4, 7], // izq     (-X)
  ]
  return { vertices: v, triangulos: t }
}

// --------------------------------------------------------------------- ZIP
const TABLA_CRC = (() => {
  const t = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function zip(archivos) {
  const locales = []
  const central = []
  let offset = 0
  for (const a of archivos) {
    const nombre = Buffer.from(a.nombre, 'utf8')
    const crudo = Buffer.from(a.datos, 'utf8')
    const comprimir = !a.guardarSinComprimir
    const datos = comprimir ? deflateRawSync(crudo, { level: 9 }) : crudo
    const metodo = comprimir ? 8 : 0
    const crc = crc32(crudo)

    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt16LE(0, 6)
    lh.writeUInt16LE(metodo, 8)
    lh.writeUInt16LE(0, 10)
    lh.writeUInt16LE(33, 12)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(datos.length, 18)
    lh.writeUInt32LE(crudo.length, 22)
    lh.writeUInt16LE(nombre.length, 26)
    lh.writeUInt16LE(0, 28)
    locales.push(lh, nombre, datos)

    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(0, 8)
    cd.writeUInt16LE(metodo, 10)
    cd.writeUInt16LE(0, 12)
    cd.writeUInt16LE(33, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(datos.length, 20)
    cd.writeUInt32LE(crudo.length, 24)
    cd.writeUInt16LE(nombre.length, 28)
    cd.writeUInt32LE(0, 30)
    cd.writeUInt32LE(0, 34)
    cd.writeUInt32LE(0, 38)
    cd.writeUInt32LE(offset, 42)
    central.push(cd, nombre)

    offset += lh.length + nombre.length + datos.length
  }
  const cuerpo = Buffer.concat(locales)
  const dir = Buffer.concat(central)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(archivos.length, 8)
  fin.writeUInt16LE(archivos.length, 10)
  fin.writeUInt32LE(dir.length, 12)
  fin.writeUInt32LE(cuerpo.length, 16)
  return Buffer.concat([cuerpo, dir, fin])
}

// ---------------------------------------------------------------- los 5 XML
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="png" ContentType="image/png"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel-1" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

const ID_ENSAMBLE = 99

function modelo(piezas) {
  const objetos = piezas
    .map((p, i) => {
      const g = caja(p.caja)
      const vs = g.vertices
        .map(
          ([x, y, z]) =>
            `          <vertex x="${x.toFixed(5)}" y="${y.toFixed(5)}" z="${z.toFixed(5)}"/>`,
        )
        .join('\n')
      const ts = g.triangulos
        .map(([a, b, c]) => `          <triangle v1="${a}" v2="${b}" v3="${c}"/>`)
        .join('\n')
      // regla 5: los hijos (id 1..N) se definen ANTES que el ensamble (id 99)
      return `    <object id="${i + 1}" type="model" name="${p.nombre}">
      <mesh>
        <vertices>
${vs}
        </vertices>
        <triangles>
${ts}
        </triangles>
      </mesh>
    </object>`
    })
    .join('\n')

  const componentes = piezas
    .map((_, i) => `        <component objectid="${i + 1}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Application">${APLICACION}</metadata>
  <metadata name="ApplicationTitle">3dllaveros</metadata>
  <metadata name="CreationDate">2026-09-12</metadata>
  <resources>
${objetos}
    <object id="${ID_ENSAMBLE}" type="model" name="llavero-spike">
      <components>
${componentes}
      </components>
    </object>
  </resources>
  <build>
    <item objectid="${ID_ENSAMBLE}" transform="1 0 0 0 1 0 0 0 1 ${CENTRO_CAMA} ${CENTRO_CAMA} 0" printable="1"/>
  </build>
</model>`
}

function modelSettings(piezas) {
  const partes = piezas
    .map(
      (p, i) => `    <part id="${i + 1}" subtype="normal_part">
      <metadata key="name" value="${p.nombre}"/>
      <metadata key="extruder" value="${p.slot}"/>
      <mesh_stat edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>
    </part>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="${ID_ENSAMBLE}">
    <metadata key="name" value="llavero-spike"/>
    <metadata key="extruder" value="1"/>
${partes}
  </object>
</config>`
}

function projectSettings(piezas) {
  // arrays paralelos base 0, todo string, largo === SLOTS (la trampa del audit-02)
  const colores = []
  for (let i = 0; i < SLOTS; i++) {
    const p = piezas.find((q) => q.slot === i + 1)
    colores.push(p ? p.hex : '#808080')
  }
  return JSON.stringify(
    {
      filament_colour: colores,
      filament_type: colores.map(() => 'PLA'),
      filament_settings_id: colores.map(() => PRESET_FILAMENTO),
      filament_diameter: colores.map(() => '1.75'),
      filament_is_support: colores.map(() => '0'),
      version: '01.10.00.00',
    },
    null,
    2,
  )
}

// ------------------------------------------------- invariantes (van a CI luego)
function verificar(piezas) {
  const fallos = []
  const cfg = JSON.parse(projectSettings(piezas))
  const largos = [
    cfg.filament_colour,
    cfg.filament_type,
    cfg.filament_settings_id,
    cfg.filament_diameter,
    cfg.filament_is_support,
  ].map((a) => a.length)
  if (!largos.every((l) => l === SLOTS)) {
    fallos.push(`arrays de filamento con largos distintos: ${largos.join(',')} (esperado ${SLOTS})`)
  }
  for (const p of piezas) {
    if (p.slot < 1 || p.slot > SLOTS)
      fallos.push(`${p.nombre}: extruder ${p.slot} fuera de [1, ${SLOTS}]`)
    const [x0, y0, z0, x1, y1, z1] = p.caja
    if (z0 < 0) fallos.push(`${p.nombre}: z negativo (${z0}), la pieza atraviesa la cama`)
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) fallos.push(`${p.nombre}: caja invertida`)
  }
  const xml = modelo(piezas)
  if (!xml.includes('BambuStudio-')) fallos.push('falta el metadato Application (regla 1)')
  if (xml.includes('basematerials') || xml.includes('displaycolor'))
    fallos.push('tiene basematerials/displaycolor (regla 3)')
  if (xml.includes('requiredextensions')) fallos.push('declara requiredextensions (regla 4)')
  return fallos
}

// ------------------------------------------------------------------ ejecucion
const fallos = verificar(PIEZAS)
if (fallos.length) {
  console.error('INVARIANTES ROTAS:')
  fallos.forEach((f) => console.error('  - ' + f))
  process.exit(1)
}

mkdirSync(SALIDA, { recursive: true })

const base = [
  { nombre: '[Content_Types].xml', datos: CONTENT_TYPES, guardarSinComprimir: true },
  { nombre: '_rels/.rels', datos: RELS },
  { nombre: '3D/3dmodel.model', datos: modelo(PIEZAS) },
  { nombre: 'Metadata/model_settings.config', datos: modelSettings(PIEZAS) },
]

// Variante A: completa (con project_settings.config -> declara los filamentos)
const a = zip([
  ...base,
  { nombre: 'Metadata/project_settings.config', datos: projectSettings(PIEZAS) },
])
writeFileSync(join(SALIDA, 'A-completo.3mf'), a)

// Variante B: sin project_settings.config. Aisla que hace cada archivo:
// si B tambien llega con los extrusores asignados, entonces project_settings
// solo aporta los colores de la muestra y podemos omitirlo (menos riesgo de
// pisarle los presets de impresora al usuario, issue #7797).
const b = zip(base)
writeFileSync(join(SALIDA, 'B-sin-project-settings.3mf'), b)

console.log('OK — invariantes en verde')
console.log(`  piezas: ${PIEZAS.map((p) => `${p.nombre} (slot ${p.slot})`).join(', ')}`)
console.log(`  triangulos: ${PIEZAS.length * 12}  ·  slots declarados: ${SLOTS}`)
console.log(`  A-completo.3mf              ${a.length} bytes`)
console.log(`  B-sin-project-settings.3mf  ${b.length} bytes`)
console.log(`  en: ${SALIDA}`)
