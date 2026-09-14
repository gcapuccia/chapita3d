// Spike 07 · Casos reales: replicas sinteticas (100 % material propio) de las categorias de imagen que
// sube la gente y que el banco de F0.7 no cubre. Nacio del logo "La Ronda · Tienda", que salio inservible.
//
// Cada escena trae la verdad POR ELEMENTO (el contorno, el texto, el mate...), no solo por color:
// asi se puede decir "el circulo desaparecio" con un numero y no a ojo.
//
// Uso desde otro script (por ejemplo, para prototipar arreglos):
//   import { ESCENAS_REALES, renderizarReal, salidaEnFuente } from './escenas.ts'
//   const v = renderizarReal(ESCENAS_REALES[0])   // v.imagen es un ImagenRGBA listo para convertir()
//
// Diferencias con tests/banco/escenas.ts: las formas son poligonos con regla NonZero (asi entran los
// glifos de una fuente OFL y los trazos gruesos), el fondo admite degradados en cualquier angulo,
// texturas y madera, y la degradacion de "foto" incluye luz despareja y JPEG real (jpeg-js, que ya esta
// en node_modules como dependencia transitiva; si no esta, se simula con bloques).

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as opentype from 'opentype.js'
import { FONDO, type ImagenRGBA, type Recorte } from '../../src/pipeline/tipos.ts'

export type P = [number, number]
/** Contornos cerrados con regla NonZero, en pixeles de la imagen fuente (y hacia abajo). */
export type Contornos = P[][]

export type Elemento = {
  id: string
  descripcion: string
  hex: string
  /** Indice en `colores` de la escena. */
  etiqueta: number
  contornos: Contornos
  /** Lo mas angosto del elemento, en px de la fuente (el grosor del trazo, de la hoja, del palo de la letra). */
  anchoPx: number
  /** Opacidad 0–1. Con menos de 0,5 no cuenta como dibujo (sombras). */
  alfa?: number
}

export type FondoReal =
  | { tipo: 'solido'; hex: string }
  /** angulo en grados: 0 = de izquierda a derecha, 90 = de arriba hacia abajo. */
  | { tipo: 'degradado'; desde: string; hasta: string; angulo: number }
  | { tipo: 'textura'; hex: string; amplitud: number; escala: number }
  | { tipo: 'madera'; claro: string; oscuro: string }

export type DegradarReal = {
  /** Luz despareja: multiplica por un factor que va de `desde` a `hasta` en la direccion `angulo`, mas viñeta. */
  iluminacion?: { desde: number; hasta: number; angulo: number; vinieta: number }
  /** Radio de un desenfoque de caja (2 pasadas). */
  desenfoque?: number
  /** Desvio del ruido gaussiano, en 0–255. */
  ruido?: number
  /** Calidad JPEG 1–100 (codificar y decodificar de verdad). */
  jpeg?: number
}

export type EscenaReal = {
  id: string
  categoria: string
  descripcion: string
  /** Que problema aisla la escena. */
  aisla: string
  ancho: number
  alto: number
  fondo: FondoReal
  elementos: Elemento[]
  /** Colores de diseño, indexados por etiqueta. */
  colores: string[]
  degradar?: DegradarReal
}

// ------------------------------------------------------------------------------ geometria
const rad = (g: number) => (g * Math.PI) / 180

function areaFirmada(p: P[]): number {
  let a = 0
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    a += p[j]![0] * p[i]![1] - p[i]![0] * p[j]![1]
  return a / 2
}
/** Misma orientacion para todo: con NonZero, la union de piezas superpuestas sale bien. */
const positivo = (p: P[]): P[] => (areaFirmada(p) < 0 ? [...p].reverse() : p)
const negativo = (p: P[]): P[] => (areaFirmada(p) > 0 ? [...p].reverse() : p)

export function circulo(cx: number, cy: number, r: number): P[] {
  const n = Math.max(24, Math.ceil((2 * Math.PI * r) / 1.5))
  return positivo(
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2
      return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as P
    }),
  )
}

export function elipse(cx: number, cy: number, rx: number, ry: number, rot = 0): P[] {
  const n = Math.max(24, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / 1.5))
  const c = Math.cos(rad(rot))
  const s = Math.sin(rad(rot))
  return positivo(
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2
      const u = rx * Math.cos(t)
      const v = ry * Math.sin(t)
      return [cx + u * c - v * s, cy + u * s + v * c] as P
    }),
  )
}

/** Anillo: circulo de afuera positivo y de adentro negativo (agujero con NonZero). */
export function anillo(cx: number, cy: number, r0: number, r1: number): Contornos {
  return [circulo(cx, cy, r1), negativo(circulo(cx, cy, r0))]
}

export function rectRedondeado(x0: number, y0: number, x1: number, y1: number, r: number): P[] {
  const p: P[] = []
  const esquinas: [number, number, number][] = [
    [x1 - r, y0 + r, -90],
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, 90],
    [x0 + r, y0 + r, 180],
  ]
  for (const [cx, cy, a0] of esquinas)
    for (let k = 0; k <= 8; k++) {
      const t = rad(a0 + (k / 8) * 90)
      p.push([cx + r * Math.cos(t), cy + r * Math.sin(t)])
    }
  return positivo(p)
}

/** Trazo de ancho constante por una polilinea, con uniones y puntas redondas. */
export function trazo(puntos: P[], ancho: number, cerrado = false): Contornos {
  const h = ancho / 2
  const salida: Contornos = []
  const pts = cerrado ? [...puntos, puntos[0]!] : puntos
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]!
    const [bx, by] = pts[i + 1]!
    const l = Math.hypot(bx - ax, by - ay)
    if (l < 1e-9) continue
    const nx = (-(by - ay) / l) * h
    const ny = ((bx - ax) / l) * h
    salida.push(
      positivo([
        [ax + nx, ay + ny],
        [bx + nx, by + ny],
        [bx - nx, by - ny],
        [ax - nx, ay - ny],
      ]),
    )
  }
  for (const [x, y] of pts) salida.push(circulo(x, y, h))
  return salida
}

export function arco(cx: number, cy: number, r: number, desde: number, hasta: number): P[] {
  const n = Math.max(8, Math.ceil((Math.abs(rad(hasta - desde)) * r) / 2))
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = rad(desde + ((hasta - desde) * i) / n)
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as P
  })
}

// ------------------------------------------------------------------------------ texto (OFL)
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..')
const parse: typeof opentype.parse =
  (opentype as { parse?: typeof opentype.parse }).parse ?? opentype.default.parse
const cacheFuentes = new Map<string, opentype.Font>()
/** Nunito (OFL-1.1), peso 200–900, subset latin. */
function nunito(peso: number): opentype.Font {
  const archivo = `@fontsource/nunito/files/nunito-latin-${peso}-normal.woff`
  let f = cacheFuentes.get(archivo)
  if (!f) {
    const b = readFileSync(join(RAIZ, 'node_modules', archivo))
    f = parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    cacheFuentes.set(archivo, f)
  }
  return f
}

/** Contornos de un glifo en coordenadas locales: x desde el origen del glifo, y hacia abajo, base en 0. */
function contornosDeGlifo(glifo: opentype.Glyph, tamano: number): Contornos {
  const out: Contornos = []
  let actual: P[] = []
  let x0 = 0
  let y0 = 0
  const agregar = (x: number, y: number) => {
    actual.push([x, y])
    x0 = x
    y0 = y
  }
  const cerrar = () => {
    if (actual.length >= 3) out.push(actual)
    actual = []
  }
  for (const c of glifo.getPath(0, 0, tamano).commands) {
    if (c.type === 'M') {
      cerrar()
      agregar(c.x, c.y)
    } else if (c.type === 'L') agregar(c.x, c.y)
    else if (c.type === 'Q') {
      const [ax, ay] = [x0, y0]
      for (let i = 1; i <= 8; i++) {
        const t = i / 8
        const u = 1 - t
        agregar(
          u * u * ax + 2 * u * t * c.x1 + t * t * c.x,
          u * u * ay + 2 * u * t * c.y1 + t * t * c.y,
        )
      }
    } else if (c.type === 'C') {
      const [ax, ay] = [x0, y0]
      for (let i = 1; i <= 12; i++) {
        const t = i / 12
        const u = 1 - t
        agregar(
          u * u * u * ax + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * ay + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        )
      }
    } else cerrar()
  }
  cerrar()
  return out
}

function avances(fuente: opentype.Font, texto: string, tamano: number, espaciado = 0) {
  const escala = tamano / fuente.unitsPerEm
  const glifos = Array.from(texto).map((l) => fuente.charToGlyph(l))
  const pos: number[] = []
  let a = 0
  glifos.forEach((g, i) => {
    pos.push(a)
    a += (g.advanceWidth ?? 0) * escala + espaciado
    const sig = glifos[i + 1]
    if (sig) a += fuente.getKerningValue(g, sig) * escala
  })
  return { glifos, pos, total: a - espaciado }
}

/** Texto recto centrado en cx, con la linea de base en `base`. */
export function texto(
  peso: number,
  str: string,
  tamano: number,
  cx: number,
  base: number,
  espaciado = 0,
): Contornos {
  const f = nunito(peso)
  const { glifos, pos, total } = avances(f, str, tamano, espaciado)
  return glifos.flatMap((g, i) =>
    contornosDeGlifo(g, tamano).map((c) =>
      c.map(([x, y]) => [cx - total / 2 + pos[i]! + x, base + y] as P),
    ),
  )
}

/**
 * Texto curvo por dentro de un circulo, arriba (anguloCentro -90) o abajo: cada letra se para sobre la
 * circunferencia de radio `radioBase` con la parte de arriba hacia afuera.
 */
export function textoEnArco(
  peso: number,
  str: string,
  tamano: number,
  cx: number,
  cy: number,
  radioBase: number,
  anguloCentro: number,
  espaciado = 0,
): Contornos {
  const f = nunito(peso)
  const escala = tamano / f.unitsPerEm
  const { glifos, pos, total } = avances(f, str, tamano, espaciado)
  const salida: Contornos = []
  glifos.forEach((g, i) => {
    const mitad = ((g.advanceWidth ?? 0) * escala) / 2
    const s = pos[i]! + mitad - total / 2
    const t = rad(anguloCentro) + s / radioBase
    const px = cx + radioBase * Math.cos(t)
    const py = cy + radioBase * Math.sin(t)
    const tx = -Math.sin(t) // tangente
    const ty = Math.cos(t)
    const ix = -Math.cos(t) // hacia el centro = "abajo" del glifo
    const iy = -Math.sin(t)
    for (const c of contornosDeGlifo(g, tamano))
      salida.push(
        c.map(([x, y]) => [px + (x - mitad) * tx + y * ix, py + (x - mitad) * ty + y * iy] as P),
      )
  })
  return salida
}

// ------------------------------------------------------------------------------ azar
function aleatorio(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const semillaDe = (s: string) =>
  [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)

/** Ruido de valor suave en [-1, 1]. */
function ruidoDeValor(semilla: number) {
  const hash = (x: number, y: number) => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + semilla
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1
  }
  return (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const fx = x - xi
    const fy = y - yi
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * sx
    const b = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * sx
    return a + (b - a) * sy
  }
}

// ------------------------------------------------------------------------------ escenas
const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const GRIS_LOGO = '#555555'

function escenaLaRonda(): EscenaReal {
  const cx = 250
  const cy = 255
  // Perfil del mate: medio ancho segun y (de la boca a la base)
  const perfil: [number, number][] = [
    [212, 21],
    [222, 23],
    [236, 25],
    [250, 32],
    [265, 38],
    [280, 40],
    [294, 36],
    [304, 27],
    [310, 14],
    [312, 0],
  ]
  const lado: P[] = []
  for (let k = 0; k < perfil.length - 1; k++) {
    const [ya, wa] = perfil[k]!
    const [yb, wb] = perfil[k + 1]!
    for (let s = 0; s < 6; s++) {
      const t = s / 6
      const w = wa + (wb - wa) * (t * t * (3 - 2 * t))
      lado.push([cx + w, ya + (yb - ya) * t])
    }
  }
  lado.push([cx, 312])
  const cuerpo: P[] = [...lado, ...[...lado].reverse().map(([x, y]) => [2 * cx - x, y] as P)]
  const azar = aleatorio(7)
  const motas: Contornos = []
  while (motas.length < 28) {
    const x = cx - 32 + azar() * 64
    const y = 240 + azar() * 62
    const w = perfil.find(([py]) => py >= y)?.[1] ?? 0
    if (Math.abs(x - cx) < w - 7) motas.push(circulo(x, y, 1.3))
  }
  // Laureles: tallo en arco y hojas de a pares
  const laurel = (desde: number, hasta: number) => {
    const r = 120
    const tallo = trazo(arco(cx, cy, r, desde, hasta), 3)
    const hojas: Contornos = []
    const pasos = 7
    for (let k = 0; k < pasos; k++) {
      const a = desde + ((hasta - desde) * (k + 0.5)) / pasos
      const t = rad(a)
      const dir = Math.sign(hasta - desde) // sentido del tallo
      const tang = (a + 90 * dir) % 360
      for (const lado of [-1, 1]) {
        const off = 9 * lado
        const hx = cx + (r + off) * Math.cos(t)
        const hy = cy + (r + off) * Math.sin(t)
        const grosor = k % 2 ? 4.5 : 3.5 // hojas de 7 a 9 px
        hojas.push(elipse(hx, hy, 11, grosor, tang + 35 * lado * dir))
      }
    }
    return { tallo, hojas }
  }
  const izq = laurel(172, 112)
  const der = laurel(8, 68)
  return {
    id: 'real-01-la-ronda',
    categoria: 'logo lineal sobre degradado',
    descripcion:
      'Replica de "La Ronda · Tienda": degradado horizontal gris #9a9a9a→#f2f2f2, circulo de 3 px, texto curvo fino, mate de lineas relleno de blanco hueso con motas, "TIENDA" y dos laureles',
    aisla: 'todo junto: lineas finas + fondo encerrado + degradado',
    ancho: 500,
    alto: 500,
    fondo: { tipo: 'degradado', desde: '#9A9A9A', hasta: '#F2F2F2', angulo: 0 },
    colores: [GRIS_LOGO, '#EEEAE4'],
    elementos: [
      {
        id: 'circulo',
        descripcion: 'contorno circular de 3 px',
        hex: GRIS_LOGO,
        etiqueta: 0,
        anchoPx: 3,
        contornos: anillo(cx, cy, 148.5, 151.5),
      },
      {
        id: 'texto-la-ronda',
        descripcion: 'texto curvo Nunito 400, palos ~2,5 px',
        hex: GRIS_LOGO,
        etiqueta: 0,
        anchoPx: 2.5,
        contornos: textoEnArco(400, 'LA RONDA', 30, cx, cy, 118, -90, 3),
      },
      {
        id: 'mate-relleno',
        descripcion: 'relleno blanco hueso del mate',
        hex: '#EEEAE4',
        etiqueta: 1,
        anchoPx: 40,
        contornos: [positivo(cuerpo)],
      },
      {
        id: 'mate-motas',
        descripcion: 'motas de 2,6 px',
        hex: GRIS_LOGO,
        etiqueta: 0,
        anchoPx: 2.6,
        contornos: motas,
      },
      {
        id: 'mate-contorno',
        descripcion: 'linea del mate de 3 px',
        hex: GRIS_LOGO,
        etiqueta: 0,
        anchoPx: 3,
        contornos: trazo(cuerpo, 3, true),
      },
      {
        id: 'bombilla',
        descripcion: 'bombilla de 3 px',
        hex: GRIS_LOGO,
        etiqueta: 0,
        anchoPx: 3,
        contornos: trazo(
          [
            [258, 216],
            [290, 150],
            [301, 145],
          ],
          3,
        ),
      },
      {
        id: 'texto-tienda',
        descripcion: 'TIENDA Nunito 400, palos ~2,2 px',
        hex: GRIS_LOGO,
        etiqueta: 0,
        anchoPx: 2.2,
        contornos: texto(400, 'TIENDA', 24, cx, 348, 2),
      },
      {
        id: 'laurel-tallos',
        descripcion: 'tallos de 3 px',
        hex: GRIS_LOGO,
        etiqueta: 0,
        anchoPx: 3,
        contornos: [...izq.tallo, ...der.tallo],
      },
      {
        id: 'laurel-hojas',
        descripcion: 'hojas de 7–9 px de grosor',
        hex: GRIS_LOGO,
        etiqueta: 0,
        anchoPx: 7,
        contornos: [...izq.hojas, ...der.hojas],
      },
    ],
  }
}

export const ESCENAS_REALES: EscenaReal[] = [
  escenaLaRonda(),
  {
    id: 'real-02-lineal-blanco',
    categoria: 'icono lineal sobre blanco',
    descripcion:
      'Icono de montaña y sol con trazos abiertos de 6 px y la palabra "montaña" en Nunito 300, fondo blanco plano',
    aisla: 'solo lineas finas (sin degradado; el unico fondo encerrado son los ojos de las letras)',
    ancho: 800,
    alto: 800,
    fondo: { tipo: 'solido', hex: '#FFFFFF' },
    colores: ['#1F2937'],
    elementos: [
      {
        id: 'montania',
        descripcion: 'zigzag abierto 6 px',
        hex: '#1F2937',
        etiqueta: 0,
        anchoPx: 6,
        contornos: trazo(
          [
            [140, 560],
            [300, 330],
            [380, 430],
            [480, 280],
            [660, 560],
          ],
          6,
        ),
      },
      {
        id: 'suelo',
        descripcion: 'linea 6 px',
        hex: '#1F2937',
        etiqueta: 0,
        anchoPx: 6,
        contornos: trazo(
          [
            [110, 600],
            [690, 600],
          ],
          6,
        ),
      },
      {
        id: 'sol',
        descripcion: 'arco abierto 6 px',
        hex: '#1F2937',
        etiqueta: 0,
        anchoPx: 6,
        contornos: trazo(arco(580, 230, 48, 140, 400), 6),
      },
      {
        id: 'rayos',
        descripcion: 'rayos 6 px',
        hex: '#1F2937',
        etiqueta: 0,
        anchoPx: 6,
        contornos: [200, 240, 280, 320, 360].flatMap((a) =>
          trazo(
            [
              [580 + 66 * Math.cos(rad(a)), 230 + 66 * Math.sin(rad(a))],
              [580 + 92 * Math.cos(rad(a)), 230 + 92 * Math.sin(rad(a))],
            ],
            6,
          ),
        ),
      },
      {
        id: 'texto',
        descripcion: '"montaña" Nunito 300, palos ~6 px',
        hex: '#1F2937',
        etiqueta: 0,
        anchoPx: 6,
        contornos: texto(300, 'montaña', 96, 400, 735),
      },
    ],
  },
  {
    id: 'real-03-anillo-cerrado',
    categoria: 'logo relleno dentro de un aro',
    descripcion:
      'Fondo crema plano: aro verde de 30 px y estrella roja rellena; entre la estrella y el aro hay fondo',
    aisla: 'solo fondo encerrado (trazos gruesos, fondo plano)',
    ancho: 800,
    alto: 800,
    fondo: { tipo: 'solido', hex: '#F7F5F0' },
    colores: ['#2E7D32', '#D62828'],
    elementos: [
      {
        id: 'aro',
        descripcion: 'aro de 30 px',
        hex: '#2E7D32',
        etiqueta: 0,
        anchoPx: 30,
        contornos: anillo(400, 400, 300, 330),
      },
      {
        id: 'estrella',
        descripcion: 'estrella rellena',
        hex: '#D62828',
        etiqueta: 1,
        anchoPx: 60,
        contornos: [
          positivo(
            Array.from({ length: 10 }, (_, i) => {
              const r = i % 2 ? 80 : 190
              const t = rad(-90 + i * 36)
              return [400 + r * Math.cos(t), 410 + r * Math.sin(t)] as P
            }),
          ),
        ],
      },
    ],
  },
  {
    id: 'real-04-degradado-abierto',
    categoria: 'logo relleno sobre degradado',
    descripcion:
      'El mismo degradado de La Ronda (#9a9a9a→#f2f2f2) con formas rellenas gruesas y sin contornos cerrados',
    aisla: 'solo el degradado',
    ancho: 800,
    alto: 800,
    fondo: { tipo: 'degradado', desde: '#9A9A9A', hasta: '#F2F2F2', angulo: 0 },
    colores: ['#2E9E5B', '#F28C28', '#333333'],
    elementos: [
      {
        id: 'hoja',
        descripcion: 'elipse verde rotada',
        hex: '#2E9E5B',
        etiqueta: 0,
        anchoPx: 160,
        contornos: [elipse(310, 360, 190, 90, -35)],
      },
      {
        id: 'circulo',
        descripcion: 'circulo naranja',
        hex: '#F28C28',
        etiqueta: 1,
        anchoPx: 220,
        contornos: [circulo(540, 330, 110)],
      },
      {
        id: 'barra',
        descripcion: 'barra gris oscuro',
        hex: '#333333',
        etiqueta: 2,
        anchoPx: 70,
        contornos: [rectRedondeado(150, 560, 650, 630, 20)],
      },
    ],
  },
  {
    id: 'real-05-foto-sticker-mesa',
    categoria: 'foto de celular de un sticker',
    descripcion:
      'Sticker de borde blanco con un logo (circulo azul y rayo amarillo) sobre una mesa de madera, luz despareja, sombra, desenfoque, ruido y JPEG calidad 55',
    aisla: 'foto real: fondo con textura + luz despareja + JPEG',
    ancho: 1000,
    alto: 750,
    fondo: { tipo: 'madera', claro: '#A7774A', oscuro: '#6E4A2C' },
    colores: ['#FFFFFF', '#1E4FD8', '#F5C518'],
    degradar: {
      iluminacion: { desde: 1.15, hasta: 0.62, angulo: 25, vinieta: 0.25 },
      desenfoque: 1,
      ruido: 6,
      jpeg: 55,
    },
    elementos: [
      {
        id: 'sombra',
        descripcion: 'sombra (no es dibujo)',
        hex: '#000000',
        etiqueta: 0,
        anchoPx: 400,
        alfa: 0.35,
        contornos: [rectRedondeado(265, 195, 785, 615, 60)],
      },
      {
        id: 'borde-blanco',
        descripcion: 'sticker blanco',
        hex: '#FFFFFF',
        etiqueta: 0,
        anchoPx: 40,
        contornos: [rectRedondeado(240, 170, 760, 590, 60)],
      },
      {
        id: 'circulo-azul',
        descripcion: 'circulo azul',
        hex: '#1E4FD8',
        etiqueta: 1,
        anchoPx: 300,
        contornos: [circulo(500, 380, 165)],
      },
      {
        id: 'rayo',
        descripcion: 'rayo amarillo',
        hex: '#F5C518',
        etiqueta: 2,
        anchoPx: 40,
        contornos: [
          positivo([
            [520, 250],
            [430, 400],
            [490, 400],
            [465, 515],
            [575, 350],
            [510, 350],
            [555, 250],
          ]),
        ],
      },
    ],
  },
  {
    id: 'real-06-texto-corto',
    categoria: 'logo solo texto (palabra corta)',
    descripcion: '"Lucía" en Nunito 800 (sans redondeada gruesa), negro sobre blanco',
    aisla: 'texto grueso: control (deberia andar)',
    ancho: 1000,
    alto: 420,
    fondo: { tipo: 'solido', hex: '#FFFFFF' },
    colores: ['#222222'],
    elementos: [
      {
        id: 'texto',
        descripcion: 'Lucía, palos ~45 px',
        hex: '#222222',
        etiqueta: 0,
        anchoPx: 45,
        contornos: texto(800, 'Lucía', 300, 500, 320),
      },
    ],
  },
  {
    id: 'real-07-texto-largo',
    categoria: 'logo solo texto (nombre largo)',
    descripcion: '"Panadería San Martín" en Nunito 700, una linea, negro sobre blanco',
    aisla:
      'texto de nombre comercial largo: los palos quedan finos al llevar el lado mayor a 50 mm',
    ancho: 1000,
    alto: 300,
    fondo: { tipo: 'solido', hex: '#FFFFFF' },
    colores: ['#222222'],
    elementos: [
      {
        id: 'texto',
        descripcion: 'palos ~10 px',
        hex: '#222222',
        etiqueta: 0,
        anchoPx: 10,
        contornos: texto(700, 'Panadería San Martín', 84, 500, 180),
      },
    ],
  },
  {
    id: 'real-08-oscuro-textura',
    categoria: 'logo oscuro sobre fondo oscuro con textura',
    descripcion:
      'Fondo gris casi negro con textura y ruido, escudo azul pizarra de bajo contraste y una "M" celeste grisacea, JPEG 70',
    aisla: 'bajo contraste + textura',
    ancho: 800,
    alto: 800,
    fondo: { tipo: 'textura', hex: '#2B2B30', amplitud: 14, escala: 40 },
    colores: ['#38415A', '#7C8DB5'],
    degradar: { ruido: 7, jpeg: 70 },
    elementos: [
      {
        id: 'escudo',
        descripcion: 'escudo de bajo contraste',
        hex: '#38415A',
        etiqueta: 0,
        anchoPx: 300,
        contornos: [
          positivo([
            [180, 150],
            [620, 150],
            [620, 430],
            [400, 680],
            [180, 430],
          ]),
        ],
      },
      {
        id: 'letra-m',
        descripcion: 'M Nunito 900, palos ~50 px',
        hex: '#7C8DB5',
        etiqueta: 1,
        anchoPx: 45,
        contornos: texto(900, 'M', 300, 400, 480),
      },
    ],
  },
  {
    id: 'real-09-avatar-circular',
    categoria: 'captura de foto de perfil (recorte circular)',
    descripcion:
      'Captura de avatar: esquinas blancas, disco beige con taza marron y vapor blanco de 12 px',
    aisla: 'recorte circular con esquinas blancas + blanco encerrado',
    ancho: 600,
    alto: 600,
    fondo: { tipo: 'solido', hex: '#FFFFFF' },
    colores: ['#F3D9B1', '#6D4C41', '#FFFFFF'],
    elementos: [
      {
        id: 'disco',
        descripcion: 'disco beige',
        hex: '#F3D9B1',
        etiqueta: 0,
        anchoPx: 570,
        contornos: [circulo(300, 300, 285)],
      },
      {
        id: 'taza',
        descripcion: 'taza marron con asa',
        hex: '#6D4C41',
        etiqueta: 1,
        anchoPx: 22,
        contornos: [rectRedondeado(190, 280, 380, 450, 40), ...anillo(390, 355, 30, 54)],
      },
      {
        id: 'vapor',
        descripcion: 'vapor blanco de 12 px',
        hex: '#FFFFFF',
        etiqueta: 2,
        anchoPx: 12,
        contornos: [230, 285, 340].flatMap((x) =>
          trazo(
            Array.from({ length: 12 }, (_, i) => [x + 12 * Math.sin(i / 2), 250 - i * 9] as P),
            12,
          ),
        ),
      },
    ],
  },
  {
    id: 'real-10-mascota-caricatura',
    categoria: 'dibujo de mascota con contorno negro',
    descripcion:
      'Perro de caricatura: rellenos planos (cabeza, orejas, hocico, lengua) con contorno negro de 4 px, ojos y nariz negros, brillos blancos',
    aisla: 'contornos negros finos alrededor de rellenos',
    ancho: 800,
    alto: 800,
    fondo: { tipo: 'solido', hex: '#FFFFFF' },
    colores: ['#111111', '#C8915A', '#6B4423', '#F2E3CF', '#E86A8A', '#FFFFFF'],
    elementos: [
      {
        id: 'orejas',
        descripcion: 'orejas marron oscuro',
        hex: '#6B4423',
        etiqueta: 2,
        anchoPx: 90,
        contornos: [elipse(215, 330, 70, 150, 25), elipse(585, 330, 70, 150, -25)],
      },
      {
        id: 'orejas-contorno',
        descripcion: 'contorno 4 px',
        hex: '#111111',
        etiqueta: 0,
        anchoPx: 4,
        contornos: [
          ...trazo(elipse(215, 330, 70, 150, 25), 4, true),
          ...trazo(elipse(585, 330, 70, 150, -25), 4, true),
        ],
      },
      {
        id: 'cabeza',
        descripcion: 'cabeza marron claro',
        hex: '#C8915A',
        etiqueta: 1,
        anchoPx: 300,
        contornos: [elipse(400, 410, 230, 250)],
      },
      {
        id: 'cabeza-contorno',
        descripcion: 'contorno 4 px',
        hex: '#111111',
        etiqueta: 0,
        anchoPx: 4,
        contornos: trazo(elipse(400, 410, 230, 250), 4, true),
      },
      {
        id: 'lengua',
        descripcion: 'lengua rosa',
        hex: '#E86A8A',
        etiqueta: 4,
        anchoPx: 40,
        contornos: [elipse(400, 590, 32, 45)],
      },
      {
        id: 'hocico',
        descripcion: 'hocico crema',
        hex: '#F2E3CF',
        etiqueta: 3,
        anchoPx: 120,
        contornos: [elipse(400, 520, 120, 80)],
      },
      {
        id: 'hocico-contorno',
        descripcion: 'contorno 4 px',
        hex: '#111111',
        etiqueta: 0,
        anchoPx: 4,
        contornos: trazo(elipse(400, 520, 120, 80), 4, true),
      },
      {
        id: 'nariz',
        descripcion: 'nariz negra',
        hex: '#111111',
        etiqueta: 0,
        anchoPx: 40,
        contornos: [elipse(400, 485, 38, 26)],
      },
      {
        id: 'ojos',
        descripcion: 'ojos negros',
        hex: '#111111',
        etiqueta: 0,
        anchoPx: 44,
        contornos: [circulo(320, 380, 24), circulo(480, 380, 24)],
      },
      {
        id: 'brillos',
        descripcion: 'brillos blancos de 10 px',
        hex: '#FFFFFF',
        etiqueta: 5,
        anchoPx: 10,
        contornos: [circulo(328, 372, 5), circulo(488, 372, 5)],
      },
    ],
  },
  {
    id: 'real-12-degradado-fuerte',
    categoria: 'logo blanco sobre degradado de color',
    descripcion:
      'Degradado diagonal saturado estilo Canva/Instagram (#FFD89B → #19547B, «Horizon») con un logo blanco relleno y una barra gris oscuro, sin contornos cerrados',
    aisla: 'degradado de mucho recorrido (mas que 2 × la tolerancia del flood fill)',
    ancho: 800,
    alto: 800,
    fondo: { tipo: 'degradado', desde: '#FFD89B', hasta: '#19547B', angulo: 45 },
    colores: ['#FFFFFF', '#222222'],
    elementos: [
      {
        id: 'gota',
        descripcion: 'gota blanca',
        hex: '#FFFFFF',
        etiqueta: 0,
        anchoPx: 200,
        contornos: [positivo([...arco(400, 380, 130, -20, 200), [400, 170] as P])],
      },
      {
        id: 'barra',
        descripcion: 'barra gris oscuro',
        hex: '#222222',
        etiqueta: 1,
        anchoPx: 60,
        contornos: [rectRedondeado(220, 560, 580, 620, 20)],
      },
    ],
  },
  {
    id: 'real-13-anillo-fondo-color',
    categoria: 'logo dentro de un aro sobre fondo de color plano',
    descripcion:
      'Lo mismo que real-03 pero sobre un cuadrado rojo plano (#C62828): aro blanco de 30 px y estrella amarilla; entre la estrella y el aro hay rojo de fondo',
    aisla: 'fondo encerrado que NO se confunde con la base blanca',
    ancho: 800,
    alto: 800,
    fondo: { tipo: 'solido', hex: '#C62828' },
    colores: ['#FFFFFF', '#F5C518'],
    elementos: [
      {
        id: 'aro',
        descripcion: 'aro blanco de 30 px',
        hex: '#FFFFFF',
        etiqueta: 0,
        anchoPx: 30,
        contornos: anillo(400, 400, 300, 330),
      },
      {
        id: 'estrella',
        descripcion: 'estrella amarilla',
        hex: '#F5C518',
        etiqueta: 1,
        anchoPx: 60,
        contornos: [
          positivo(
            Array.from({ length: 10 }, (_, i) => {
              const r = i % 2 ? 80 : 190
              const t = rad(-90 + i * 36)
              return [400 + r * Math.cos(t), 410 + r * Math.sin(t)] as P
            }),
          ),
        ],
      },
    ],
  },
  (() => {
    // Calibracion: barras cuyo ancho, con el lado mayor a 50 mm, es el indicado en mm
    const anchosMm = [0.3, 0.5, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5]
    const x0 = 60
    const x1 = 940
    const pxPorMm = (x1 - x0) / 50
    const anchos = anchosMm.map((m) => m * pxPorMm)
    const libre = x1 - x0 - anchos.reduce((a, b) => a + b, 0)
    const hueco = libre / (anchos.length - 1)
    let x = x0
    const elementos: Elemento[] = anchos.map((w, i) => {
      const e: Elemento = {
        id: `barra-${anchosMm[i]!.toFixed(1)}mm`,
        descripcion: `barra de ${w.toFixed(1)} px = ${anchosMm[i]} mm a 50 mm`,
        hex: '#222222',
        etiqueta: 0,
        anchoPx: w,
        contornos: [
          positivo([
            [x, 50],
            [x + w, 50],
            [x + w, 450],
            [x, 450],
          ]),
        ],
      }
      x += w + hueco
      return e
    })
    return {
      id: 'real-11-escalera-trazos',
      categoria: 'calibracion de grosores',
      descripcion: 'Ocho barras negras sobre blanco de 0,3 a 1,5 mm (con el lado mayor a 50 mm)',
      aisla: 'el umbral de detalle fino, sin nada mas',
      ancho: 1000,
      alto: 500,
      fondo: { tipo: 'solido', hex: '#FFFFFF' },
      colores: ['#222222'],
      elementos,
    } satisfies EscenaReal
  })(),
]

// ------------------------------------------------------------------------------ rasterizado
const SUB = 4

type Cobertura = { x0: number; y0: number; w: number; h: number; cob: Float32Array }

/** Cobertura exacta en x y con SUB filas por pixel en y, regla NonZero. */
function rasterizar(contornos: Contornos, ancho: number, alto: number): Cobertura {
  const ax: number[] = []
  const ay: number[] = []
  const bx: number[] = []
  const by: number[] = []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of contornos) {
    for (let i = 0; i < c.length; i++) {
      const [x0, y0] = c[i]!
      const [x1, y1] = c[(i + 1) % c.length]!
      minX = Math.min(minX, x0)
      maxX = Math.max(maxX, x0)
      minY = Math.min(minY, y0)
      maxY = Math.max(maxY, y0)
      if (y0 === y1) continue
      ax.push(x0)
      ay.push(y0)
      bx.push(x1)
      by.push(y1)
    }
  }
  const X0 = Math.max(0, Math.floor(minX))
  const Y0 = Math.max(0, Math.floor(minY))
  const X1 = Math.min(ancho, Math.ceil(maxX) + 1)
  const Y1 = Math.min(alto, Math.ceil(maxY) + 1)
  const w = Math.max(0, X1 - X0)
  const h = Math.max(0, Y1 - Y0)
  const cob = new Float32Array(w * h)
  const cruces: [number, number][] = []
  for (let py = Y0; py < Y1; py++) {
    for (let s = 0; s < SUB; s++) {
      const ys = py + (s + 0.5) / SUB
      cruces.length = 0
      for (let e = 0; e < ax.length; e++) {
        const ya = ay[e]!
        const yb = by[e]!
        if (ya <= yb ? ys < ya || ys >= yb : ys < yb || ys >= ya) continue
        cruces.push([ax[e]! + ((ys - ya) * (bx[e]! - ax[e]!)) / (yb - ya), ya < yb ? 1 : -1])
      }
      if (cruces.length < 2) continue
      cruces.sort((p, q) => p[0] - q[0])
      let giro = 0
      let inicio = 0
      for (const [x, d] of cruces) {
        const antes = giro
        giro += d
        if (antes === 0 && giro !== 0) inicio = x
        else if (antes !== 0 && giro === 0) {
          const xa = Math.max(X0, inicio)
          const xb = Math.min(X1, x)
          for (let px = Math.floor(xa); px < Math.ceil(xb) && px < X1; px++) {
            const solape = Math.min(xb, px + 1) - Math.max(xa, px)
            if (solape > 0) cob[(py - Y0) * w + (px - X0)]! += solape / SUB
          }
        }
      }
    }
  }
  return { x0: X0, y0: Y0, w, h, cob }
}

// ------------------------------------------------------------------------------ render
export type VerdadReal = {
  imagen: ImagenRGBA
  /** Etiqueta de color por pixel de la fuente (FONDO = 255). */
  etiquetas: Uint8Array
  /** Indice del elemento visible (el de mas arriba con cobertura >= 0,5) o 255. */
  elementos: Uint8Array
  /** Pixeles visibles por elemento. */
  pixelesPorElemento: number[]
  /** Color real de cada etiqueta en la imagen ya degradada (promedio de pixeles con cobertura completa). */
  coloresEfectivos: string[]
  /** Caja del dibujo verdadero en px de la fuente. */
  caja: Recorte
}

function colorDeFondo(
  e: EscenaReal,
  ruido: (x: number, y: number) => number,
  x: number,
  y: number,
): [number, number, number] {
  const f = e.fondo
  switch (f.tipo) {
    case 'solido':
      return rgb(f.hex)
    case 'degradado': {
      const ux = Math.cos(rad(f.angulo))
      const uy = Math.sin(rad(f.angulo))
      const esquinas = [
        [0, 0],
        [e.ancho, 0],
        [0, e.alto],
        [e.ancho, e.alto],
      ].map(([a, b]) => a! * ux + b! * uy)
      const lo = Math.min(...esquinas)
      const hi = Math.max(...esquinas)
      const t = (x * ux + y * uy - lo) / (hi - lo)
      const a = rgb(f.desde)
      const b = rgb(f.hasta)
      return [0, 1, 2].map((c) => a[c]! + (b[c]! - a[c]!) * t) as [number, number, number]
    }
    case 'textura': {
      const n =
        ruido(x / f.escala, y / f.escala) * 0.7 +
        ruido(x / (f.escala / 4), y / (f.escala / 4)) * 0.3
      return rgb(f.hex).map((v) => v + n * f.amplitud) as [number, number, number]
    }
    case 'madera': {
      const vetas =
        0.5 + 0.5 * Math.sin(y * 0.045 + ruido(x / 180, y / 40) * 3 + ruido(x / 30, y / 8) * 0.6)
      const a = rgb(f.claro)
      const b = rgb(f.oscuro)
      return [0, 1, 2].map((c) => a[c]! + (b[c]! - a[c]!) * vetas) as [number, number, number]
    }
  }
}

let jpegJs: { encode: Function; decode: Function } | null | undefined
function cargarJpeg() {
  if (jpegJs !== undefined) return jpegJs
  try {
    const require = createRequire(import.meta.url)
    jpegJs = require(join(RAIZ, 'node_modules/.pnpm/jpeg-js@0.4.4/node_modules/jpeg-js'))
  } catch {
    jpegJs = null
  }
  return jpegJs
}
/** Decodificador JPEG ya instalado (dependencia transitiva), o null. */
export function decodificarJpeg(datos: Uint8Array): ImagenRGBA | null {
  const j = cargarJpeg()
  if (!j) return null
  const r = j.decode(datos, { useTArray: true, formatAsRGBA: true })
  return {
    ancho: r.width,
    alto: r.height,
    pixeles: new Uint8ClampedArray(r.data.buffer, r.data.byteOffset, r.data.length),
  }
}

function degradar(e: EscenaReal, px: Uint8ClampedArray): void {
  const d = e.degradar
  if (!d) return
  const { ancho, alto } = e
  if (d.iluminacion) {
    const { desde, hasta, angulo, vinieta } = d.iluminacion
    const ux = Math.cos(rad(angulo))
    const uy = Math.sin(rad(angulo))
    const lo = Math.min(0, ancho * ux, alto * uy, ancho * ux + alto * uy)
    const hi = Math.max(0, ancho * ux, alto * uy, ancho * ux + alto * uy)
    for (let y = 0; y < alto; y++)
      for (let x = 0; x < ancho; x++) {
        const t = (x * ux + y * uy - lo) / (hi - lo)
        const r = Math.hypot(x / ancho - 0.5, y / alto - 0.5) / Math.SQRT1_2
        const k = (desde + (hasta - desde) * t) * (1 - vinieta * r * r)
        const o = (y * ancho + x) * 4
        for (let c = 0; c < 3; c++) px[o + c] = px[o + c]! * k
      }
  }
  if (d.desenfoque) {
    const r = d.desenfoque
    const tmp = new Float32Array(ancho * alto * 3)
    for (let pasada = 0; pasada < 2; pasada++) {
      const horizontal = pasada === 0
      const [n, m] = horizontal ? [alto, ancho] : [ancho, alto]
      for (let i = 0; i < n; i++)
        for (let j = 0; j < m; j++)
          for (let c = 0; c < 3; c++) {
            let s = 0
            let k = 0
            for (let q = Math.max(0, j - r); q <= Math.min(m - 1, j + r); q++) {
              s += px[(horizontal ? i * ancho + q : q * ancho + i) * 4 + c]!
              k++
            }
            tmp[(horizontal ? i * ancho + j : j * ancho + i) * 3 + c] = s / k
          }
      for (let p = 0; p < ancho * alto; p++)
        for (let c = 0; c < 3; c++) px[p * 4 + c] = tmp[p * 3 + c]!
    }
  }
  const azar = aleatorio(semillaDe(e.id))
  if (d.ruido) {
    for (let o = 0; o < px.length; o += 4)
      for (let c = 0; c < 3; c++) {
        const g = Math.sqrt(-2 * Math.log(azar() || 1e-9)) * Math.cos(2 * Math.PI * azar())
        px[o + c] = px[o + c]! + g * d.ruido
      }
  }
  if (d.jpeg) {
    const j = cargarJpeg()
    if (j) {
      const cod = j.encode(
        { data: Buffer.from(px.buffer, px.byteOffset, px.length), width: ancho, height: alto },
        d.jpeg,
      )
      const dec = j.decode(cod.data, { useTArray: true, formatAsRGBA: true })
      px.set(dec.data)
    } else {
      // Sin jpeg-js: bloques de 8 px como aproximacion
      for (let by = 0; by < alto; by += 8)
        for (let bx = 0; bx < ancho; bx += 8) {
          const delta = [0, 1, 2].map(() => (azar() * 2 - 1) * (100 - d.jpeg!) * 0.08)
          for (let y = by; y < Math.min(alto, by + 8); y++)
            for (let x = bx; x < Math.min(ancho, bx + 8); x++)
              for (let c = 0; c < 3; c++)
                px[(y * ancho + x) * 4 + c] = px[(y * ancho + x) * 4 + c]! + delta[c]!
        }
    }
  }
  for (let o = 3; o < px.length; o += 4) px[o] = 255
}

export function renderizarReal(e: EscenaReal): VerdadReal {
  const { ancho, alto } = e
  const n = ancho * alto
  const coberturas = e.elementos.map((el) => rasterizar(el.contornos, ancho, alto))
  const colores = e.elementos.map((el) => rgb(el.hex))
  const ruido = ruidoDeValor(semillaDe(e.id))
  const pixeles = new Uint8ClampedArray(n * 4)
  const etiquetas = new Uint8Array(n).fill(FONDO)
  const elementos = new Uint8Array(n).fill(255)
  const completo = new Uint8Array(n)
  const pixelesPorElemento = e.elementos.map(() => 0)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      let [r, g, b] = colorDeFondo(e, ruido, x + 0.5, y + 0.5)
      let arriba = -1
      let cobArriba = 0
      for (let k = 0; k < coberturas.length; k++) {
        const c = coberturas[k]!
        const lx = x - c.x0
        const ly = y - c.y0
        if (lx < 0 || ly < 0 || lx >= c.w || ly >= c.h) continue
        const v = Math.min(1, c.cob[ly * c.w + lx]!)
        if (v <= 0) continue
        const a = v * (e.elementos[k]!.alfa ?? 1)
        r = r * (1 - a) + colores[k]![0] * a
        g = g * (1 - a) + colores[k]![1] * a
        b = b * (1 - a) + colores[k]![2] * a
        if (v >= 0.5 && (e.elementos[k]!.alfa ?? 1) >= 0.5) {
          arriba = k
          cobArriba = v
        }
      }
      pixeles[i * 4] = r
      pixeles[i * 4 + 1] = g
      pixeles[i * 4 + 2] = b
      pixeles[i * 4 + 3] = 255
      if (arriba >= 0) {
        elementos[i] = arriba
        etiquetas[i] = e.elementos[arriba]!.etiqueta
        pixelesPorElemento[arriba]!++
        if (cobArriba >= 0.999) completo[i] = 1
      }
    }
  }
  degradar(e, pixeles)

  const suma = e.colores.map(() => [0, 0, 0, 0])
  let [x0, y0, x1, y1] = [ancho, alto, -1, -1]
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      const et = etiquetas[i]!
      if (et === FONDO) continue
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
      if (!completo[i]) continue
      const s = suma[et]!
      for (let c = 0; c < 3; c++) s[c]! += pixeles[i * 4 + c]!
      s[3]!++
    }
  const hx = (v: number) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()
  return {
    imagen: { ancho, alto, pixeles },
    etiquetas,
    elementos,
    pixelesPorElemento,
    coloresEfectivos: suma.map((s, k) =>
      s[3] ? `#${hx(s[0]! / s[3]!)}${hx(s[1]! / s[3]!)}${hx(s[2]! / s[3]!)}` : e.colores[k]!,
    ),
    caja: { x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 },
  }
}

/**
 * Lleva un mapa de etiquetas de salida (grilla de trabajo sobre `recorte`) a la grilla de la fuente,
 * por vecino mas cercano. Lo que cae fuera del recorte es FONDO.
 */
export function salidaEnFuente(
  etiquetasSalida: Uint8Array,
  ancho: number,
  alto: number,
  recorte: Recorte,
  anchoFuente: number,
  altoFuente: number,
): Uint8Array {
  const out = new Uint8Array(anchoFuente * altoFuente).fill(FONDO)
  for (let y = 0; y < altoFuente; y++) {
    const oy = Math.floor(((y + 0.5 - recorte.y) * alto) / recorte.alto)
    if (oy < 0 || oy >= alto) continue
    for (let x = 0; x < anchoFuente; x++) {
      const ox = Math.floor(((x + 0.5 - recorte.x) * ancho) / recorte.ancho)
      if (ox < 0 || ox >= ancho) continue
      out[y * anchoFuente + x] = etiquetasSalida[oy * ancho + ox]!
    }
  }
  return out
}
