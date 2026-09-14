// Spike 08 · Arreglos: mide cada arreglo solo y combinado sobre ESCENAS_REALES (+ el gato del usuario)
// y sobre el banco original (regresiones contra el pipeline de hoy y tests/banco/esperados.json).
//
//   node spikes/08-arreglos/correr.ts                      todo (~10 min)
//   node spikes/08-arreglos/correr.ts --escenas real-01-la-ronda,gato --configs hoy,combo --sin-banco
//
// Escribe salida/informe.md, salida/resultados.json y PNG en salida/<escena>/ (git los ignora).
// La imagen del usuario se lee de C:\Users\guido\Downloads\prueba.jpg y NO se copia.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  convertir,
  convertirAutomatico,
  paramsPorDefecto,
  type ParamsPipeline,
} from '../../src/pipeline/index.ts'
import type { NombrePreset } from '../../src/pipeline/presets.ts'
import type { ImagenRGBA } from '../../src/pipeline/tipos.ts'
import { ESCENAS, renderizar } from '../../tests/banco/escenas.ts'
import { evaluar } from '../../tests/banco/evaluar.ts'
import { escribirPng } from '../../tests/banco/png.ts'
import {
  decodificarJpeg,
  ESCENAS_REALES,
  renderizarReal,
  type EscenaReal,
  type VerdadReal,
} from '../07-casos-reales/escenas.ts'
import {
  ladoALado,
  medir,
  medirLineas,
  vistaEtiquetas,
  vistaMascara,
  type Medida,
  type MedidaLineas,
} from './medir.ts'
import {
  convertirAutomaticoV2,
  convertirConPolitica,
  convertirV2,
  SIN_ARREGLOS,
  type Arreglos,
  type ResultadoV2,
} from './pipeline2.ts'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = join(AQUI, 'salida')
const RUTA_GATO = 'C:/Users/guido/Downloads/prueba.jpg'

const arg = (nombre: string) => {
  const k = process.argv.indexOf(nombre)
  return k >= 0 ? process.argv[k + 1]!.split(',') : null
}
const soloEscenas = arg('--escenas')
const soloConfigs = arg('--configs')
const sinBanco = process.argv.includes('--sin-banco')

// ------------------------------------------------------------------ configuraciones
type Salida = ResultadoV2 & { preset: NombrePreset; decision?: string[] }
type Config = {
  nombre: string
  grupo: string
  descripcion: string
  /** Sobre las escenas reales: con el camino por defecto de la app (automatico, 4 colores). */
  real: (img: ImagenRGBA) => Salida
  /** Sobre el banco: preset Dibujo (como tests/banco/esperados.json). null = no se corre en el banco. */
  banco: ((img: ImagenRGBA) => ResultadoV2) | null
  lineas?: number
}

const A = (x: Partial<Arreglos>): Arreglos => ({ ...SIN_ARREGLOS, ...x })
const auto =
  (a: Arreglos, extra: Partial<ParamsPipeline> = {}) =>
  (img: ImagenRGBA) =>
    convertirAutomaticoV2(img, { colores: 4, ...extra }, a)
const dibujo =
  (a: Arreglos, extra: Partial<ParamsPipeline> = {}) =>
  (img: ImagenRGBA) =>
    convertirV2(img, { ...paramsPorDefecto('dibujo'), ...extra }, a)

/** Envuelve el pipeline ORIGINAL de src/ con la misma forma de salida. */
const original =
  (f: (img: ImagenRGBA) => ReturnType<typeof convertir> & { preset?: NombrePreset }) =>
  (img: ImagenRGBA): Salida => {
    const t0 = performance.now()
    const r = f(img)
    return {
      ...r,
      preset: r.preset ?? 'dibujo',
      extra: {
        ...(null as unknown as ResultadoV2['extra']),
        totalMs: performance.now() - t0,
        relleno: null,
        limpieza: {
          perdidaPorColor: [],
          fraccionPerdida: NaN,
          fraccionLineas: NaN,
          largoLineasMm: NaN,
          agregados: 0,
          halosDescartados: 0,
        },
      } as ResultadoV2['extra'],
    }
  }

/** Engrosar "completo": con la guarda anti-halo y sin perder trazos en la erosion anti-halo. */
const ENG = (grosor: number, x: Partial<Arreglos> = {}) =>
  A({ grosorMinimoLineasMm: grosor, guardaHalo: true, interiorConservaTrazos: true, ...x })
const SEGUROS = A({
  cajaSinMotas: true,
  fusionarIntermedios: true,
  guardaHalo: true,
  interiorConservaTrazos: true,
})
const COMBO = ENG(0.8, { fondoEncerrado: true, cajaSinMotas: true, fusionarIntermedios: true })

const CONFIGS: Config[] = [
  {
    nombre: 'hoy',
    grupo: '0',
    descripcion: 'src/ tal cual (convertirAutomatico, 4 colores)',
    real: original((img) => convertirAutomatico(img, { colores: 4 })),
    banco: original((img) => convertir(img, paramsPorDefecto('dibujo'))),
  },
  {
    nombre: '1-iso-mayorIgual',
    grupo: '1',
    descripcion: 'solo el criterio de erosion d² >= r² (sin engrosar)',
    real: auto(A({ umbralFino: 'mayorIgual' })),
    banco: dibujo(A({ umbralFino: 'mayorIgual' })),
  },
  {
    nombre: '1-iso-medioPx',
    grupo: '1',
    descripcion: 'solo el criterio de erosion d² >= (r+0,5)² (sin engrosar)',
    real: auto(A({ umbralFino: 'medioPx' })),
    banco: dibujo(A({ umbralFino: 'medioPx' })),
  },
  {
    nombre: '1-engrosar-0.8-crudo',
    grupo: '1',
    descripcion: 'engrosar a 0,8 mm sin guarda anti-halo ni conservar trazos (primera version)',
    real: auto(A({ grosorMinimoLineasMm: 0.8 })),
    banco: dibujo(A({ grosorMinimoLineasMm: 0.8 })),
  },
  {
    nombre: '1-engrosar-0.8',
    grupo: '1',
    descripcion: 'engrosar a 0,8 mm + guarda anti-halo + conservar trazos (criterio de hoy)',
    real: auto(ENG(0.8)),
    banco: dibujo(ENG(0.8)),
  },
  {
    nombre: '1-engrosar-0.8-medioPx',
    grupo: '1',
    descripcion: 'igual, con criterio medioPx',
    real: auto(ENG(0.8, { umbralFino: 'medioPx' })),
    banco: dibujo(ENG(0.8, { umbralFino: 'medioPx' })),
  },
  {
    nombre: '1-engrosar-1.0',
    grupo: '1',
    descripcion: 'engrosar a 1,0 mm',
    real: auto(ENG(1.0)),
    banco: null,
  },
  {
    nombre: '1-engrosar-1.5',
    grupo: '1',
    descripcion: 'engrosar a 1,5 mm',
    real: auto(ENG(1.5)),
    banco: null,
  },
  {
    nombre: '1-hoy-lado80',
    grupo: '1',
    descripcion: 'src/ con ladoMayorMm = 80 (el tamaño llega al pipeline, sin engrosar)',
    real: original((img) => convertirAutomatico(img, { colores: 4, ladoMayorMm: 80 })),
    banco: null,
  },
  {
    nombre: '1-engrosar-0.8-lado80',
    grupo: '1',
    descripcion: 'engrosar a 0,8 mm con ladoMayorMm = 80',
    real: auto(ENG(0.8), { ladoMayorMm: 80 }),
    banco: null,
  },
  {
    nombre: '2-fondo',
    grupo: '2',
    descripcion: 'fondo encerrado + degradado (modelo del borde, respeta la base)',
    real: auto(A({ fondoEncerrado: true })),
    banco: dibujo(A({ fondoEncerrado: true })),
  },
  {
    nombre: '2-fondo-sin-guarda',
    grupo: '2',
    descripcion: 'fondo encerrado sin la guarda de la base',
    real: auto(A({ fondoEncerrado: true, fondoRespetaBase: false })),
    banco: dibujo(A({ fondoEncerrado: true, fondoRespetaBase: false })),
  },
  {
    nombre: '3-caja',
    grupo: '3',
    descripcion: 'caja sin motas (componentes >= 1 % de la mayor)',
    real: auto(A({ cajaSinMotas: true })),
    banco: dibujo(A({ cajaSinMotas: true })),
  },
  {
    nombre: '4a-transiciones',
    grupo: '4',
    descripcion: 'k-means ajustado sin pixeles de transicion',
    real: auto(A({ kmeansSinTransiciones: true })),
    banco: dibujo(A({ kmeansSinTransiciones: true })),
  },
  {
    nombre: '4b-intermedios',
    grupo: '4',
    descripcion: 'fundir colores intermedios en forma de cinta',
    real: auto(A({ fusionarIntermedios: true })),
    banco: dibujo(A({ fusionarIntermedios: true })),
  },
  {
    nombre: '4ab',
    grupo: '4',
    descripcion: '4a + 4b',
    real: auto(A({ kmeansSinTransiciones: true, fusionarIntermedios: true })),
    banco: dibujo(A({ kmeansSinTransiciones: true, fusionarIntermedios: true })),
  },
  {
    nombre: '4c-base-cuenta',
    grupo: '4',
    descripcion: 'la base cuenta como color si no esta en la imagen (N-1)',
    real: auto(A({ baseCuentaComoColor: true })),
    banco: dibujo(A({ baseCuentaComoColor: true })),
  },
  {
    nombre: 'combo',
    grupo: 'C',
    descripcion: '1 (0,8, con guarda) + 2 + 3 + 4b, siempre prendidos',
    real: auto(COMBO),
    banco: dibujo(COMBO),
  },
  {
    nombre: 'combo+4a',
    grupo: 'C',
    descripcion: 'combo + k-means sin transiciones',
    real: auto({ ...COMBO, kmeansSinTransiciones: true }),
    banco: dibujo({ ...COMBO, kmeansSinTransiciones: true }),
  },
  {
    nombre: 'combo+4c',
    grupo: 'C',
    descripcion: 'combo + la base cuenta como color',
    real: auto({ ...COMBO, baseCuentaComoColor: true }),
    banco: dibujo({ ...COMBO, baseCuentaComoColor: true }),
  },
  {
    nombre: 'politica',
    grupo: '5',
    descripcion:
      '2 + 3 + 4b siempre; engrosar a 0,8 solo si las lineas finas son >= 4 % del dibujo (automatico, puede pasar a Foto)',
    real: (img: ImagenRGBA) => convertirConPolitica(img, { colores: 4 }, SEGUROS),
    banco: (img: ImagenRGBA) => convertirConPolitica(img, { colores: 4 }, SEGUROS),
  },
  {
    nombre: 'silueta-hoy',
    grupo: '8',
    descripcion: 'preset Silueta de hoy, 4 colores',
    real: original((img: ImagenRGBA) => ({
      ...convertir(img, { ...paramsPorDefecto('silueta'), colores: 4 }),
      preset: 'silueta' as const,
    })),
    banco: null,
  },
  {
    nombre: '8-silueta-polaridad',
    grupo: '8',
    descripcion: 'Silueta con deteccion de tinta clara sobre oscuro',
    real: (img: ImagenRGBA) => ({
      ...convertirV2(
        img,
        { ...paramsPorDefecto('silueta'), colores: 4 },
        A({ polaridadSilueta: true }),
      ),
      preset: 'silueta' as const,
    }),
    banco: null,
  },
  {
    nombre: '6-lineas',
    grupo: '6',
    descripcion: 'modo Lineas: tinta (umbral + polaridad) engrosada a 1,0 mm + interior como base',
    real: (img: ImagenRGBA) => ({
      ...convertirV2(
        img,
        paramsPorDefecto('dibujo'),
        A({ modoLineas: true, grosorMinimoLineasMm: 1.0 }),
      ),
      preset: 'dibujo' as const,
    }),
    banco: null,
    lineas: 1.0,
  },
].filter((c) => !soloConfigs || soloConfigs.includes(c.nombre))

// ------------------------------------------------------------------ casos
type Caso = { id: string; escena: EscenaReal | null; imagen: ImagenRGBA; verdad: VerdadReal | null }
const casos: Caso[] = []
for (const e of ESCENAS_REALES.filter((x) => !soloEscenas || soloEscenas.includes(x.id))) {
  const v = renderizarReal(e)
  casos.push({ id: e.id, escena: e, imagen: v.imagen, verdad: v })
}
if ((!soloEscenas || soloEscenas.includes('gato')) && existsSync(RUTA_GATO)) {
  const img = decodificarJpeg(readFileSync(RUTA_GATO))
  if (img) casos.push({ id: 'usuario-gato', escena: null, imagen: img, verdad: null })
}

/** PNG para todas las configuraciones en estas escenas; en el resto, solo hoy / combo / politica / lineas. */
const CON_TODAS_LAS_VISTAS = ['real-01-la-ronda', 'usuario-gato']
const VISTAS_BASICAS = [
  'hoy',
  'combo',
  'politica',
  '6-lineas',
  '1-engrosar-0.8',
  '2-fondo',
  '8-silueta-polaridad',
  '3-caja',
]

type FilaReal = {
  config: string
  preset: string
  medida?: Medida
  lineas?: MedidaLineas
  decision?: string[]
  extra: Record<string, unknown>
  error?: string
}
const resultados: Record<string, FilaReal[]> = {}
const equivalencia: Record<string, boolean> = {}
const salidas: Record<string, Record<string, ImagenRGBA>> = {}

for (const c of casos) {
  const dir = join(SALIDA, c.id)
  mkdirSync(dir, { recursive: true })
  if (c.escena) writeFileSync(join(dir, 'original.png'), escribirPng(c.imagen))
  const filas: FilaReal[] = []
  const t0 = performance.now()

  // Verificacion: V2 con todo apagado = src/ byte a byte
  const hoy = convertirAutomatico(c.imagen, { colores: 4 })
  const v2 = convertirAutomaticoV2(c.imagen, { colores: 4 }, SIN_ARREGLOS)
  equivalencia[c.id] =
    hoy.diagnostico.etiquetas.length === v2.diagnostico.etiquetas.length &&
    hoy.diagnostico.etiquetas.every((x, i) => x === v2.diagnostico.etiquetas[i]) &&
    hoy.paleta.map((p) => p.hex).join() === v2.paleta.map((p) => p.hex).join()

  for (const cfg of CONFIGS) {
    try {
      const t = performance.now()
      const r = cfg.real(c.imagen)
      const ms = performance.now() - t
      const fila: FilaReal = {
        config: cfg.nombre,
        preset: r.preset,
        decision: r.decision,
        extra: {
          paleta: r.paleta.map((p) => p.hex),
          fraccionLineas: r.extra.limpieza.fraccionLineas,
          largoLineasMm: r.extra.limpieza.largoLineasMm,
          fraccionPerdida: r.extra.limpieza.fraccionPerdida,
          perdidaPorColor: r.extra.limpieza.perdidaPorColor,
          agregados: r.extra.limpieza.agregados,
          halosDescartados: r.extra.limpieza.halosDescartados,
          fondo: r.extra.fondo
            ? {
                ...r.extra.fondo,
                modelo: r.extra.fondo.modelo
                  ? {
                      sigma: r.extra.fondo.modelo.sigma,
                      confianza: r.extra.fondo.modelo.confianza,
                      recorridoL: r.extra.fondo.modelo.recorridoL,
                    }
                  : null,
              }
            : null,
          caja: r.extra.caja,
          transicionesExcluidas: r.extra.transicionesExcluidas,
          intermediosSacados: r.extra.intermediosSacados,
          recuantizoPorBase: r.extra.recuantizoPorBase,
          tintaClara: r.extra.tintaClara,
          tiemposMs: r.diagnostico.tiemposMs,
          tiemposArreglosMs: r.extra.tiemposArreglosMs,
          trabajo: `${r.diagnostico.ancho}×${r.diagnostico.alto}`,
        },
      }
      if (cfg.lineas && c.escena && c.verdad)
        fila.lineas = medirLineas(c.escena, c.verdad, c.imagen, r, cfg.lineas, ms)
      else fila.medida = medir(c.escena, c.verdad, c.imagen, r, ms)
      filas.push(fila)
      if (CON_TODAS_LAS_VISTAS.includes(c.id) || VISTAS_BASICAS.includes(cfg.nombre)) {
        const et = vistaEtiquetas(r)
        writeFileSync(join(dir, `${cfg.nombre}-etiquetas.png`), escribirPng(et))
        if (!cfg.lineas)
          writeFileSync(
            join(dir, `${cfg.nombre}-mascara.png`),
            escribirPng(vistaMascara(c.imagen, r, c.verdad)),
          )
        ;(salidas[c.id] ??= {})[cfg.nombre] = et
      }
    } catch (err) {
      filas.push({
        config: cfg.nombre,
        preset: '—',
        extra: {},
        error: err instanceof Error ? (err.stack ?? err.message) : String(err),
      })
    }
  }
  resultados[c.id] = filas
  const h = filas.find((f) => f.config === 'hoy')?.medida
  const co = filas.find((f) => f.config === 'combo')?.medida
  console.log(
    `${c.id} (${((performance.now() - t0) / 1000).toFixed(1)} s) equivalencia=${equivalencia[c.id]}` +
      (h && co
        ? ` · IoU color hoy ${h.iouColor.toFixed(3)} → combo ${co.iouColor.toFixed(3)} · IoU ${h.iou.toFixed(3)} → ${co.iou.toFixed(3)}`
        : ''),
  )
}

// Lado a lado de La Ronda: original | hoy | mejor combinacion (por IoU color)
const ronda = casos.find((c) => c.id === 'real-01-la-ronda')
if (ronda && salidas[ronda.id]) {
  const candidatas = resultados[ronda.id]!.filter(
    (f) =>
      f.medida &&
      f.config !== 'hoy' &&
      salidas[ronda.id]![f.config] &&
      !f.config.startsWith('silueta'),
  )
  candidatas.sort((a, b) => b.medida!.iouColor - a.medida!.iouColor)
  const mejor = candidatas[0]
  if (mejor && salidas[ronda.id]!.hoy) {
    const img = ladoALado(
      [ronda.imagen, salidas[ronda.id]!.hoy!, salidas[ronda.id]![mejor.config]!],
      500,
    )
    writeFileSync(join(SALIDA, 'la-ronda-lado-a-lado.png'), escribirPng(img))
    console.log(`La Ronda lado a lado: original | hoy | ${mejor.config}`)
    if (salidas[ronda.id]!['6-lineas']) {
      const img2 = ladoALado(
        [
          ronda.imagen,
          salidas[ronda.id]!.hoy!,
          salidas[ronda.id]![mejor.config]!,
          salidas[ronda.id]!['6-lineas']!,
        ],
        500,
      )
      writeFileSync(join(SALIDA, 'la-ronda-lado-a-lado-con-lineas.png'), escribirPng(img2))
    }
  }
}

// Gato: imagen del usuario (achicada) | hoy | politica | lineas. Solo salidas: la foto no se copia al repo
const gato = casos.find((c) => c.id === 'usuario-gato')
if (gato && salidas[gato.id]?.hoy) {
  const s = salidas[gato.id]!
  const vistas = [s.hoy!, s.politica, s['6-lineas'], s['8-silueta-polaridad']].filter(
    (x): x is ImagenRGBA => !!x,
  )
  writeFileSync(join(SALIDA, 'gato-lado-a-lado.png'), escribirPng(ladoALado(vistas, 530)))
  console.log('Gato lado a lado: hoy | politica | 6-lineas | 8-silueta-polaridad')
}

// ------------------------------------------------------------------ banco original
type FilaBanco = {
  config: string
  id: string
  exito: boolean
  iou: number
  colores: number
  motivos: string[]
  maxErrorArea: number
  ms: number
  decision?: string[]
}
const banco: FilaBanco[] = []
const esperados = JSON.parse(readFileSync(join(AQUI, '../../tests/banco/esperados.json'), 'utf8'))
  .imagenes as Record<string, { exito: boolean; iou: number; colores: unknown[] }>
if (!sinBanco) {
  for (const escena of ESCENAS) {
    const verdad = renderizar(escena)
    const t0 = performance.now()
    for (const cfg of CONFIGS) {
      if (!cfg.banco) continue
      try {
        const t = performance.now()
        const r = cfg.banco(verdad.imagen)
        const ms = performance.now() - t
        const ev = evaluar(escena, verdad, r, paramsPorDefecto('dibujo').ladoMayorMm)
        banco.push({
          config: cfg.nombre,
          id: escena.id,
          exito: ev.exito,
          iou: ev.iou,
          colores: ev.coloresObtenidos,
          motivos: ev.motivos,
          maxErrorArea: Math.max(
            0,
            ...ev.colores.map((x) => (Number.isFinite(x.errorArea) ? x.errorArea : 0)),
          ),
          ms,
          decision: (r as { decision?: string[] }).decision,
        })
      } catch (err) {
        banco.push({
          config: cfg.nombre,
          id: escena.id,
          exito: false,
          iou: 0,
          colores: 0,
          motivos: [`ERROR ${err}`],
          maxErrorArea: 1,
          ms: 0,
        })
      }
    }
    console.log(`banco ${escena.id} (${((performance.now() - t0) / 1000).toFixed(1)} s)`)
  }
}

// ------------------------------------------------------------------ informe
const f3 = (x: number | undefined) => (x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(3))
const pct = (x: number | undefined) =>
  x === undefined || !Number.isFinite(x) ? '—' : `${Math.round(x * 100)}`
const md: string[] = [
  '# Spike 08 · resultados generados por spikes/08-arreglos/correr.ts',
  '',
  `Equivalencia convertirV2(SIN_ARREGLOS) = src/ (etiquetas y paleta): ${Object.entries(
    equivalencia,
  )
    .map(([k, v]) => `${k} ${v ? '✅' : '❌'}`)
    .join(' · ')}`,
  '',
  '## Configuraciones',
  '',
  ...CONFIGS.map((c) => `- **${c.nombre}**: ${c.descripcion}`),
  '',
]
for (const c of casos) {
  const filas = resultados[c.id]!
  md.push(`## ${c.id}`, '')
  const ids = c.escena?.elementos.map((e) => e.id) ?? []
  md.push(
    `| config | preset | col | slots | lado real mm | IoU | recall | FP % | FP lejos % | IoU color | piezas | ms | ${ids.join(' | ')} | líneas % | pérdida % | decisión / casos |`,
    `|---|---|---|---|---|---|---|---|---|---|---|---|${ids.map(() => '---|').join('')}---|---|---|`,
  )
  for (const f of filas) {
    if (f.error) {
      md.push(`| ${f.config} | ERROR ${f.error.split('\n')[0]} |`)
      continue
    }
    const x = f.extra
    if (f.lineas) {
      md.push(
        `| ${f.config} | líneas | 2 | 2 | — | silueta ${f3(f.lineas.siluetaIoU)} | — | tinta lejos ${pct(f.lineas.tintaLejos)} | — | — | — | ${Math.round(f.lineas.ms)} | ${ids.map((k) => (k in f.lineas!.elementos ? pct(f.lineas!.elementos[k]) : '·')).join(' | ')} | ${pct(x.fraccionLineas as number)} | — | tinta clara: ${x.tintaClara} |`,
      )
      continue
    }
    const m = f.medida!
    md.push(
      `| ${f.config} | ${f.preset} | ${m.colores} | ${m.slots} | ${Number.isFinite(m.ladoRealMm) ? m.ladoRealMm.toFixed(1) : '—'} | ${f3(m.iou)} | ${f3(m.recall)} | ${pct(m.fp)} | ${pct(m.fpLejos)} | ${f3(m.iouColor)} | ${m.piezas} | ${Math.round(m.ms)} | ${ids.map((k) => pct(m.elementos[k] ?? 0)).join(' | ')} | ${pct(x.fraccionLineas as number)} | ${pct(x.fraccionPerdida as number)} | ${[...(f.decision ?? []), ...m.casos].join(', ') || '—'} |`,
    )
  }
  md.push('')
}
if (banco.length) {
  md.push('## Banco original (preset Dibujo, 4 colores)', '')
  const cfgs = [...new Set(banco.map((b) => b.config))]
  md.push(
    `| escena | esperado | ${cfgs.join(' | ')} |`,
    `|---|---|${cfgs.map(() => '---|').join('')}`,
  )
  for (const escena of ESCENAS) {
    const esp = esperados[escena.id]
    md.push(
      `| ${escena.id} | ${esp?.exito ? '✅' : '❌'} ${esp?.iou.toFixed(4)} ${esp?.colores.length}c | ${cfgs
        .map((cf) => {
          const b = banco.find((x) => x.config === cf && x.id === escena.id)
          if (!b) return '—'
          return `${b.exito ? '✅' : '❌'} ${b.iou.toFixed(4)} ${b.colores}c ${Math.round(b.maxErrorArea * 100)}%`
        })
        .join(' | ')} |`,
    )
  }
  md.push('', '### Motivos que cambian contra hoy', '')
  for (const b of banco) {
    const h = banco.find((x) => x.config === 'hoy' && x.id === b.id)
    if (!h || b.config === 'hoy') continue
    if (
      b.motivos.join() !== h.motivos.join() ||
      Math.abs(b.iou - h.iou) > 0.002 ||
      b.colores !== h.colores
    )
      md.push(
        `- **${b.config}** · ${b.id}: IoU ${h.iou.toFixed(4)} → ${b.iou.toFixed(4)}, colores ${h.colores} → ${b.colores}, motivos: ${b.motivos.join('; ') || '—'}${b.decision ? ` (decisión: ${b.decision.join(', ') || 'nada'})` : ''}`,
      )
  }
  md.push('')
  md.push('### Tiempo medio por imagen del banco (ms)', '')
  for (const cf of cfgs) {
    const xs = banco.filter((b) => b.config === cf).map((b) => b.ms)
    md.push(
      `- ${cf}: ${Math.round(xs.reduce((s, v) => s + v, 0) / xs.length)} ms (máx ${Math.round(Math.max(...xs))})`,
    )
  }
}
mkdirSync(SALIDA, { recursive: true })
writeFileSync(join(SALIDA, 'informe.md'), `${md.join('\n')}\n`)
writeFileSync(
  join(SALIDA, 'resultados.json'),
  JSON.stringify({ equivalencia, resultados, banco }, null, 2),
)
console.log(`\nInforme: ${join(SALIDA, 'informe.md')}`)
