// Spike 07 · Casos reales: corre el pipeline de hoy sobre las replicas de escenas.ts con TODAS las
// combinaciones que la interfaz permite hoy, y mide contra la verdad por elemento.
//
//   node spikes/07-casos-reales/correr.ts [id ...]          (ids de ESCENAS_REALES o "gato")
//
// Controles que existen hoy en la app (src/estado/documento.ts, src/crear/Solapa*.tsx):
//  - Tipo de imagen: auto | dibujo | foto | silueta  → preset de convertir()
//  - Cantidad de colores: 2..6                       → colores
//  - Tamaño 25..80 mm: NO reprocesa. Escala las regiones despues (SolapaLlavero.tsx, escalar()): el
//    pipeline siempre limpia con ladoMayorMm = 50. Se mide aparte, como DRC de construir() a 25/50/80 mm,
//    y como contrafactico (no disponible) convertir con ladoMayorMm = 80.
//
// Escribe salida/<id>/*.png, salida/resultados.json y salida/informe.md.
// El caso "gato" usa C:\Users\guido\Downloads\prueba.jpg si existe (archivo privado: no se copia, solo
// se escriben salidas en salida/, que git ignora).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crearDiseno } from '../../src/diseno/crear.ts'
import { construir } from '../../src/geometria/construir.ts'
import { cargarManifold } from '../../src/geometria/manifold.ts'
import { deltaE2000, hexARgb } from '../../src/pipeline/color.ts'
import {
  convertir,
  convertirAutomatico,
  paramsPorDefecto,
  type ParamsPipeline,
  type ResultadoConversion,
} from '../../src/pipeline/index.ts'
import type { NombrePreset } from '../../src/pipeline/presets.ts'
import { FONDO, type ImagenRGBA } from '../../src/pipeline/tipos.ts'
import { escribirPng } from '../../tests/banco/png.ts'
import {
  decodificarJpeg,
  ESCENAS_REALES,
  renderizarReal,
  salidaEnFuente,
  type EscenaReal,
  type VerdadReal,
} from './escenas.ts'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = join(AQUI, 'salida')
const RUTA_GATO = 'C:/Users/guido/Downloads/prueba.jpg'
/** ΔE2000 por encima del cual un color de la paleta no corresponde a ningun color de la verdad. */
const DE_ESPURIO = 15

type Corrida = {
  nombre: string
  /** true = se puede lograr con los controles de hoy. */
  enApp: boolean
  correr: (img: ImagenRGBA) => ResultadoConversion & { preset: NombrePreset }
  imagenes: boolean
}

const conPreset =
  (preset: NombrePreset, extra: Partial<ParamsPipeline> = {}) =>
  (img: ImagenRGBA) => ({ ...convertir(img, { ...paramsPorDefecto(preset), ...extra }), preset })

const CORRIDAS: Corrida[] = [
  ...[2, 3, 4, 5, 6].map((n) => ({
    nombre: `auto-${n}`,
    enApp: true,
    correr: (img: ImagenRGBA) => convertirAutomatico(img, { colores: n }),
    imagenes: n === 4,
  })),
  ...(['dibujo', 'foto', 'silueta'] as const).flatMap((p) =>
    [2, 3, 4, 5, 6].map((n) => ({
      nombre: `${p}-${n}`,
      enApp: true,
      correr: conPreset(p, { colores: n }),
      imagenes: [3, 4, 6].includes(n),
    })),
  ),
  // Contrafacticos: NO se pueden hacer desde la app hoy
  {
    nombre: 'X-auto-4-lado80',
    enApp: false,
    correr: (img) => convertirAutomatico(img, { ladoMayorMm: 80 }),
    imagenes: true,
  },
  {
    nombre: 'X-dibujo-4-sin-apertura',
    enApp: false,
    correr: conPreset('dibujo', { anchoMinimoDetalleMm: 0 }),
    imagenes: true,
  },
]

// ------------------------------------------------------------------ metricas
type Medida = {
  corrida: string
  enApp: boolean
  preset: NombrePreset
  fuenteMascara: string
  colores: number
  paleta: string[]
  mmPorPxFuente: number
  cajaPx: string
  iou: number
  recall: number
  /** Fraccion de lo que salio como dibujo que en verdad es fondo. */
  fpFraccion: number
  /** IoU exigiendo ademas el color correcto. */
  iouColor: number
  /** Fraccion del dibujo de salida con un color que no esta en la verdad (ΔE > DE_ESPURIO). */
  espurio: number
  piezas: number
  piezasChicas: number
  /** Por elemento: fraccion de sus pixeles que salio con el color correcto. */
  elementos: Record<string, number>
  casos: string[]
  error?: string
}

function componentes(etq: Uint8Array, ancho: number, alto: number, mmPorPixel: number) {
  const visto = new Uint8Array(etq.length)
  const cola = new Int32Array(etq.length)
  let piezas = 0
  let chicas = 0
  for (let s = 0; s < etq.length; s++) {
    if (visto[s] || etq[s] === FONDO) continue
    let fin = 0
    cola[fin++] = s
    visto[s] = 1
    for (let c = 0; c < fin; c++) {
      const i = cola[c]!
      const x = i % ancho
      for (const j of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
        if (j < 0 || j >= etq.length || visto[j] || etq[j] === FONDO) continue
        visto[j] = 1
        cola[fin++] = j
      }
    }
    piezas++
    if (fin * mmPorPixel * mmPorPixel < 4) chicas++
  }
  void alto
  return { piezas, chicas }
}

function medir(
  e: EscenaReal | null,
  v: VerdadReal | null,
  img: ImagenRGBA,
  corrida: Corrida,
  r: ResultadoConversion & { preset: NombrePreset },
): Medida {
  const d = r.diagnostico
  const salida = salidaEnFuente(d.etiquetas, d.ancho, d.alto, d.recorte, img.ancho, img.alto)
  const { piezas, chicas } = componentes(d.etiquetas, d.ancho, d.alto, d.mmPorPixel)
  const base = {
    corrida: corrida.nombre,
    enApp: corrida.enApp,
    preset: r.preset,
    fuenteMascara: d.fuenteMascara,
    colores: r.paleta.length,
    paleta: r.paleta.map((p) => p.hex),
    mmPorPxFuente: d.mmPorPixel * (d.ancho / d.recorte.ancho),
    cajaPx: `${Math.round(d.caja.ancho)}×${Math.round(d.caja.alto)}`,
    piezas,
    piezasChicas: chicas,
    casos: d.casos.map((c) => c.codigo),
  }
  if (!e || !v) {
    // Sin verdad (el gato): referencia aproximada = todo lo que no es casi negro
    let inter = 0
    let union = 0
    let dentro = 0
    for (let i = 0; i < salida.length; i++) {
      const o = i * 4
      const ref = Math.max(img.pixeles[o]!, img.pixeles[o + 1]!, img.pixeles[o + 2]!) > 40
      const out = salida[i] !== FONDO
      if (out) dentro++
      if (ref && out) inter++
      if (ref || out) union++
    }
    return {
      ...base,
      iou: union ? inter / union : 0,
      recall: dentro / salida.length,
      fpFraccion: NaN,
      iouColor: NaN,
      espurio: NaN,
      elementos: {},
    }
  }
  // Paleta → etiqueta de verdad por ΔE2000 contra los colores efectivos. Un color de la paleta cuya
  // mayoria de pixeles es fondo en la verdad es "espurio" aunque se parezca a un color del dibujo
  // (el gris del degradado encerrado se parece al blanco hueso del mate, pero es fondo).
  const deFondo = r.paleta.map(() => 0)
  const total = r.paleta.map(() => 0)
  for (let i = 0; i < salida.length; i++) {
    const out = salida[i]!
    if (out === FONDO) continue
    total[out]!++
    if (v.etiquetas[i] === FONDO) deFondo[out]!++
  }
  const aVerdad = r.paleta.map((p, k) => {
    if (total[k]! && deFondo[k]! / total[k]! > 0.5) return -1
    let mejor = -1
    let dMin = Infinity
    v.coloresEfectivos.forEach((hex, k) => {
      const dd = deltaE2000(p.hex, hex)
      if (dd < dMin) {
        dMin = dd
        mejor = k
      }
    })
    return dMin <= DE_ESPURIO ? mejor : -1
  })
  let tp = 0
  let fp = 0
  let fn = 0
  let tpColor = 0
  let espurio = 0
  const okPorElemento = e.elementos.map(() => 0)
  for (let i = 0; i < salida.length; i++) {
    const verdad = v.etiquetas[i]!
    const out = salida[i]!
    const esOut = out !== FONDO
    if (esOut && aVerdad[out] === -1) espurio++
    if (verdad !== FONDO && esOut) {
      tp++
      if (aVerdad[out] === verdad) {
        tpColor++
        okPorElemento[v.elementos[i]!]!++
      }
    } else if (esOut) fp++
    else if (verdad !== FONDO) fn++
  }
  const elementos: Record<string, number> = {}
  e.elementos.forEach((el, k) => {
    if (v.pixelesPorElemento[k]) elementos[el.id] = okPorElemento[k]! / v.pixelesPorElemento[k]!
  })
  return {
    ...base,
    iou: tp / (tp + fp + fn || 1),
    recall: tp / (tp + fn || 1),
    fpFraccion: fp / (tp + fp || 1),
    iouColor: tpColor / (tp + fp + fn || 1),
    espurio: espurio / (tp + fp || 1),
    elementos,
  }
}

// ------------------------------------------------------------------ vistas
function vistaEtiquetas(r: ResultadoConversion): ImagenRGBA {
  const { ancho, alto, etiquetas } = r.diagnostico
  const px = new Uint8ClampedArray(ancho * alto * 4)
  const cols = r.paleta.map((c) => hexARgb(c.hex))
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      const e = etiquetas[i]!
      const damero = ((x >> 4) + (y >> 4)) % 2 ? 255 : 225
      px.set(e === FONDO ? [damero, 160, damero, 255] : [...cols[e]!, 255], i * 4)
    }
  return { ancho, alto, pixeles: px }
}

/** Sobre la fuente: verde = dibujo bien detectado, rojo = fondo que quedo como dibujo, azul = dibujo perdido. */
function vistaMascara(img: ImagenRGBA, r: ResultadoConversion, v: VerdadReal | null): ImagenRGBA {
  const d = r.diagnostico
  const salida = salidaEnFuente(d.etiquetas, d.ancho, d.alto, d.recorte, img.ancho, img.alto)
  const px = new Uint8ClampedArray(img.pixeles.length)
  for (let i = 0; i < salida.length; i++) {
    const o = i * 4
    const g = 0.3 * img.pixeles[o]! + 0.59 * img.pixeles[o + 1]! + 0.11 * img.pixeles[o + 2]!
    const out = salida[i] !== FONDO
    const verdad = v ? v.etiquetas[i] !== FONDO : out
    let c: [number, number, number]
    if (out && verdad)
      c = v
        ? [g * 0.4, 110 + g * 0.55, g * 0.4]
        : [img.pixeles[o]!, img.pixeles[o + 1]!, img.pixeles[o + 2]!]
    else if (out) c = [200 + g * 0.2, 30, 30]
    else if (verdad) c = [30, 60, 230]
    else c = [60 + g * 0.3, 60 + g * 0.3, 60 + g * 0.3]
    px.set([...c, 255], o)
  }
  return { ancho: img.ancho, alto: img.alto, pixeles: px }
}

// ------------------------------------------------------------------ DRC de la app a 25 / 50 / 80 mm
function avisosPorTamano(r: ResultadoConversion, nombre: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  if (!r.regiones.length) return out
  const base = crearDiseno(r.regiones, {
    nombre,
    id: nombre,
    ahora: '2026-09-13T12:00:00Z',
    appVersion: 'spike',
  })
  for (const lado of [25, 50, 80]) {
    const k = lado / 50
    const d = {
      ...base,
      piezas: base.piezas.map((p) => ({ ...p, transform: { ...p.transform, sx: k, sy: k } })),
    }
    try {
      out[`${lado}`] = construir(d).avisos.map((a) => `${a.nivel}:${a.codigo}: ${a.mensaje}`)
    } catch (err) {
      out[`${lado}`] = [`EXCEPCION: ${err instanceof Error ? err.message : err}`]
    }
  }
  return out
}

// ------------------------------------------------------------------ main
await cargarManifold()
const ids = process.argv.slice(2)
type Caso = { id: string; escena: EscenaReal | null; imagen: ImagenRGBA; verdad: VerdadReal | null }
const casos: Caso[] = []
for (const e of ESCENAS_REALES.filter((x) => !ids.length || ids.includes(x.id))) {
  const v = renderizarReal(e)
  casos.push({ id: e.id, escena: e, imagen: v.imagen, verdad: v })
}
if ((!ids.length || ids.includes('gato')) && existsSync(RUTA_GATO)) {
  const img = decodificarJpeg(readFileSync(RUTA_GATO))
  if (img) casos.push({ id: 'usuario-gato', escena: null, imagen: img, verdad: null })
  else console.log('gato: no hay decodificador JPEG en node_modules, se saltea')
}

const resultados: Record<
  string,
  {
    medidas: Medida[]
    avisos: Record<string, string[]>
    elementos?: { id: string; mm50: number; mm80: number }[]
  }
> = {}

for (const c of casos) {
  const dir = join(SALIDA, c.id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'original.png'), escribirPng(c.imagen))
  const medidas: Medida[] = []
  let avisos: Record<string, string[]> = {}
  const t0 = performance.now()
  for (const corrida of CORRIDAS) {
    try {
      const r = corrida.correr(c.imagen)
      medidas.push(medir(c.escena, c.verdad, c.imagen, corrida, r))
      if (corrida.imagenes) {
        writeFileSync(join(dir, `${corrida.nombre}-etiquetas.png`), escribirPng(vistaEtiquetas(r)))
        writeFileSync(
          join(dir, `${corrida.nombre}-mascara.png`),
          escribirPng(vistaMascara(c.imagen, r, c.verdad)),
        )
      }
      if (corrida.nombre === 'auto-4') avisos = avisosPorTamano(r, c.id)
    } catch (err) {
      medidas.push({
        corrida: corrida.nombre,
        enApp: corrida.enApp,
        preset: 'dibujo',
        fuenteMascara: '—',
        colores: 0,
        paleta: [],
        mmPorPxFuente: NaN,
        cajaPx: '—',
        iou: 0,
        recall: 0,
        fpFraccion: NaN,
        iouColor: 0,
        espurio: NaN,
        piezas: 0,
        piezasChicas: 0,
        elementos: {},
        casos: [],
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  const elementos =
    c.escena && c.verdad
      ? c.escena.elementos.map((el) => {
          const lado = Math.max(c.verdad!.caja.ancho, c.verdad!.caja.alto)
          return { id: el.id, mm50: (el.anchoPx * 50) / lado, mm80: (el.anchoPx * 80) / lado }
        })
      : undefined
  resultados[c.id] = { medidas, avisos, elementos }
  const a4 = medidas.find((m) => m.corrida === 'auto-4')!
  console.log(
    `${c.id} (${((performance.now() - t0) / 1000).toFixed(1)} s) auto-4: IoU ${a4.iou.toFixed(3)} · recall ${a4.recall.toFixed(3)} · FP ${(a4.fpFraccion * 100).toFixed(1)} % · ${a4.colores} col · ${a4.fuenteMascara} · ${a4.casos.join(',')}`,
  )
}

// ------------------------------------------------------------------ informe generado
const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)}` : '—')
const md: string[] = ['# Spike 07 · resultados generados por spikes/07-casos-reales/correr.ts', '']
for (const [id, res] of Object.entries(resultados)) {
  md.push(`## ${id}`, '')
  if (res.elementos)
    md.push(
      `Ancho mínimo de cada elemento (mm) con el lado mayor a 50 / 80 mm: ${res.elementos.map((e) => `${e.id} ${e.mm50.toFixed(2)} / ${e.mm80.toFixed(2)}`).join(' · ')}`,
      '',
    )
  const ids = res.elementos?.map((e) => e.id) ?? []
  md.push(
    `| corrida | preset usado | máscara | col | mm/px fuente | caja | IoU | recall | FP % | IoU color | espurio % | piezas (chicas) | ${ids.join(' | ')} | casos |`,
    `|---|---|---|---|---|---|---|---|---|---|---|---|${ids.map(() => '---|').join('')}---|`,
  )
  for (const m of res.medidas) {
    if (m.error) {
      md.push(`| ${m.corrida} | ERROR: ${m.error} |`)
      continue
    }
    md.push(
      `| ${m.corrida} | ${m.preset} | ${m.fuenteMascara} | ${m.colores} | ${m.mmPorPxFuente.toFixed(3)} | ${m.cajaPx} | ${m.iou.toFixed(3)} | ${m.recall.toFixed(3)} | ${pct(m.fpFraccion)} | ${Number.isFinite(m.iouColor) ? m.iouColor.toFixed(3) : '—'} | ${pct(m.espurio)} | ${m.piezas} (${m.piezasChicas}) | ${ids.map((k) => pct(m.elementos[k] ?? 0)).join(' | ')} | ${m.casos.join(', ') || '—'} |`,
    )
  }
  const mejores = res.medidas
    .filter((m) => m.enApp && !m.error)
    .sort((a, b) => (Number.isFinite(a.iouColor) ? b.iouColor - a.iouColor : b.iou - a.iou))
  if (mejores[0])
    md.push(
      '',
      `Mejor combinación disponible hoy: **${mejores[0].corrida}** (IoU color ${Number.isFinite(mejores[0].iouColor) ? mejores[0].iouColor.toFixed(3) : '—'}, IoU ${mejores[0].iou.toFixed(3)})`,
    )
  md.push('', 'Avisos de construir() con auto-4, por tamaño del llavero:', '')
  for (const [lado, lista] of Object.entries(res.avisos))
    md.push(`- ${lado} mm: ${lista.length ? lista.join(' · ') : 'ninguno'}`)
  md.push('')
}
writeFileSync(join(SALIDA, 'informe.md'), `${md.join('\n')}\n`)
writeFileSync(join(SALIDA, 'resultados.json'), JSON.stringify(resultados, null, 2))
console.log(`\nInforme: ${join(SALIDA, 'informe.md')}`)
