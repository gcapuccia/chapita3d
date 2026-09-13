// 3MF multicolor para Bambu Studio y OrcaSlicer (perfil A, plan §9.2).
// Viene del spike F0.2 (spikes/3mf/generar.mjs), ahora sobre fflate y con piezas reales.
//
// Las 6 reglas verificadas en el codigo fuente de los slicers (audit-02):
//  1. metadata "Application" = "BambuStudio-..." en 3dmodel.model: es EL interruptor.
//  2. extruder en model_settings.config = indice en filament_colour + 1.
//  3. Nada de <basematerials> ni displaycolor: ningun slicer objetivo los lee.
//  4. Nada de requiredextensions="p".
//  5. Componentes en orden topologico: los hijos antes que el ensamble.
//  6. project_settings.config minimo, para no pisarle los presets al usuario.
// Y la trampa de los arrays paralelos: los arrays de filamento tienen que tener
// exactamente `slots` entradas, aunque el diseño use menos colores.

import { strToU8, zipSync, type Zippable } from 'fflate'
import type { CambioDeCapa, PiezaExport } from '../tipos.ts'

export type OpcionesBambu = {
  nombre: string
  /** Un color "#RRGGBB" por slot. Su largo ES la cantidad de slots declarados. */
  colores: string[]
  presetFilamento?: string
  /** Centro de la cama en mm (128 para A1 / P1S / X1C de 256 mm). */
  centroCama?: number
  /** Modo apilado: cambios de filamento por altura (M600). */
  cambiosDeCapa?: CambioDeCapa[]
  /** Fecha para el metadato CreationDate, "AAAA-MM-DD". */
  fecha?: string
  incluirProjectSettings?: boolean
}

export const APLICACION_BAMBU = 'BambuStudio-02.05.00.00'

const escaparXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const numero = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(5)

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

/** Rompe antes de escribir un archivo que el slicer abriria mal o en silencio. */
function validar(piezas: readonly PiezaExport[], o: OpcionesBambu): void {
  if (piezas.length === 0) throw new Error('3MF: no hay piezas para exportar')
  if (o.colores.length === 0) throw new Error('3MF: hace falta al menos un slot')
  for (const hex of [...o.colores, ...(o.cambiosDeCapa ?? []).map((c) => c.hex)]) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new Error(`3MF: color invalido "${hex}"`)
  }
  for (const p of piezas) {
    if (!Number.isInteger(p.slot) || p.slot < 1 || p.slot > o.colores.length) {
      throw new Error(
        `3MF: la pieza "${p.nombre}" usa el slot ${p.slot}, fuera de [1, ${o.colores.length}]`,
      )
    }
    if (p.indices.length === 0 || p.indices.length % 3 !== 0) {
      throw new Error(`3MF: la pieza "${p.nombre}" no tiene triangulos validos`)
    }
    const cantidad = p.vertices.length / 3
    for (let i = 0; i < p.vertices.length; i++) {
      const valor = p.vertices[i]!
      if (!Number.isFinite(valor))
        throw new Error(`3MF: la pieza "${p.nombre}" tiene un vertice no finito`)
      if (i % 3 === 2 && valor < -1e-4) {
        throw new Error(`3MF: la pieza "${p.nombre}" atraviesa la cama (z = ${valor})`)
      }
    }
    for (const indice of p.indices) {
      if (indice >= cantidad)
        throw new Error(`3MF: la pieza "${p.nombre}" referencia un vertice inexistente`)
    }
  }
}

function xmlModelo(piezas: readonly PiezaExport[], o: OpcionesBambu, idEnsamble: number): string {
  const centro = o.centroCama ?? 128
  const objetos = piezas.map((p, i) => {
    const v = p.vertices
    const vertices: string[] = []
    for (let k = 0; k < v.length; k += 3) {
      vertices.push(
        `<vertex x="${numero(v[k]!)}" y="${numero(v[k + 1]!)}" z="${numero(v[k + 2]!)}"/>`,
      )
    }
    const triangulos: string[] = []
    for (let k = 0; k < p.indices.length; k += 3) {
      triangulos.push(
        `<triangle v1="${p.indices[k]}" v2="${p.indices[k + 1]}" v3="${p.indices[k + 2]}"/>`,
      )
    }
    // regla 5: los hijos (id 1..N) se definen antes que el ensamble
    return `    <object id="${i + 1}" type="model" name="${escaparXml(p.nombre)}">
      <mesh>
        <vertices>${vertices.join('')}</vertices>
        <triangles>${triangulos.join('')}</triangles>
      </mesh>
    </object>`
  })
  const componentes = piezas
    .map((_, i) => `        <component objectid="${i + 1}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Application">${APLICACION_BAMBU}</metadata>
  <metadata name="ApplicationTitle">3dllaveros</metadata>
  <metadata name="Title">${escaparXml(o.nombre)}</metadata>
  <metadata name="CreationDate">${o.fecha ?? ''}</metadata>
  <resources>
${objetos.join('\n')}
    <object id="${idEnsamble}" type="model" name="${escaparXml(o.nombre)}">
      <components>
${componentes}
      </components>
    </object>
  </resources>
  <build>
    <item objectid="${idEnsamble}" transform="1 0 0 0 1 0 0 0 1 ${centro} ${centro} 0" printable="1"/>
  </build>
</model>`
}

function xmlModelSettings(
  piezas: readonly PiezaExport[],
  o: OpcionesBambu,
  idEnsamble: number,
): string {
  const partes = piezas
    .map(
      (p, i) => `    <part id="${i + 1}" subtype="normal_part">
      <metadata key="name" value="${escaparXml(p.nombre)}"/>
      <metadata key="extruder" value="${p.slot}"/>
      <mesh_stat edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>
    </part>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="${idEnsamble}">
    <metadata key="name" value="${escaparXml(o.nombre)}"/>
    <metadata key="extruder" value="1"/>
${partes}
  </object>
</config>`
}

function jsonProjectSettings(o: OpcionesBambu): string {
  const colores = o.colores
  return JSON.stringify(
    {
      filament_colour: colores,
      filament_type: colores.map(() => 'PLA'),
      filament_settings_id: colores.map(() => o.presetFilamento ?? 'Bambu PLA Basic @BBL A1'),
      filament_diameter: colores.map(() => '1.75'),
      filament_is_support: colores.map(() => '0'),
      version: '01.10.00.00',
    },
    null,
    2,
  )
}

/** Formato verificado en bbs_3mf.cpp:8954-8990 (audit-02, paso 3). type 0 = ColorChange. */
function xmlCambiosDeCapa(cambios: readonly CambioDeCapa[]): string {
  const capas = [...cambios]
    .sort((a, b) => a.z - b.z)
    .map(
      (c) =>
        `    <layer top_z="${Number(c.z.toFixed(3))}" type="0" extruder="1" color="${c.hex}" extra="" gcode="M600"/>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<custom_gcodes_per_layer>
  <plate>
    <plate_info id="1"/>
${capas}
    <mode value="SingleExtruder"/>
  </plate>
</custom_gcodes_per_layer>`
}

export function escribir3mfBambu(
  piezas: readonly PiezaExport[],
  opciones: OpcionesBambu,
): Uint8Array {
  validar(piezas, opciones)
  // Contiguo, como numera Bambu Studio sus propios archivos: piezas 1..N, ensamble N+1
  const idEnsamble = piezas.length + 1
  const archivos: Zippable = {
    // OPC: [Content_Types].xml primero y sin comprimir
    '[Content_Types].xml': [strToU8(CONTENT_TYPES), { level: 0 }],
    '_rels/.rels': strToU8(RELS),
    '3D/3dmodel.model': strToU8(xmlModelo(piezas, opciones, idEnsamble)),
    'Metadata/model_settings.config': strToU8(xmlModelSettings(piezas, opciones, idEnsamble)),
  }
  if (opciones.incluirProjectSettings ?? true) {
    archivos['Metadata/project_settings.config'] = strToU8(jsonProjectSettings(opciones))
  }
  if (opciones.cambiosDeCapa?.length) {
    archivos['Metadata/custom_gcode_per_layer.xml'] = strToU8(
      xmlCambiosDeCapa(opciones.cambiosDeCapa),
    )
  }
  return zipSync(archivos, { level: 6 })
}
