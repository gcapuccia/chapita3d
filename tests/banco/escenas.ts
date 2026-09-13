// Banco golden sintetico (F0.7): imagenes generadas por codigo, con la verdad conocida.
//
// Por que sinteticas: son 100 % material propio (sin riesgo legal, audit-03 §4) y, sobre todo,
// se sabe EXACTAMENTE que mascara, que colores y que area tiene cada color. Asi "salio bien"
// se mide con numeros y no a ojo.
//
// Lo que NO cubren: las 5 fotos de mascota del plan. Una foto sintetica no se parece a una real
// y medir sobre eso seria mentirse. Quedan pendientes de fotos reales del usuario.

import { FONDO, type ImagenRGBA, type Recorte } from '../../src/pipeline/tipos.ts'

type P = [number, number]

export type Forma =
  | { tipo: 'circulo'; cx: number; cy: number; r: number }
  | { tipo: 'elipse'; cx: number; cy: number; rx: number; ry: number; rot?: number }
  | { tipo: 'rect'; x0: number; y0: number; x1: number; y1: number; radio?: number }
  | { tipo: 'poligono'; puntos: P[] }
  | { tipo: 'anillo'; cx: number; cy: number; r0: number; r1: number }
  | { tipo: 'trazo'; puntos: P[]; ancho: number }

export type Capa = {
  forma: Forma
  hex: string
  /** Indice en `colores`. */
  etiqueta: number
  /** Opacidad 0–1. Con menos de 0,5 no cuenta como dibujo (sombras). */
  alfa?: number
  /** Se ve, pero no se imprime (mas fino que el ancho minimo): no entra en la verdad. */
  soloVisual?: boolean
  /** Variacion de brillo vertical dentro de la forma, en unidades 0–255. */
  sombreado?: number
}

export type Fondo =
  | { tipo: 'solido'; hex: string }
  | { tipo: 'transparente' }
  | { tipo: 'degradado'; desde: string; hasta: string }
  | { tipo: 'vinieta'; centro: string; borde: string }

export type Escena = {
  id: string
  categoria: 'logo' | 'dibujo' | 'sticker' | 'horrible'
  descripcion: string
  /** Lo que se espera que pase, dicho antes de medir. */
  expectativa: 'deberia-andar' | 'debilidad-conocida'
  ancho: number
  alto: number
  fondo: Fondo
  capas: Capa[]
  /** Colores de diseño, indexados por etiqueta. */
  colores: string[]
  degradar?: { ruido?: number; desenfoque?: number; bloques?: number; oscurecer?: number }
}

// ------------------------------------------------------------------------------ geometria
function estrella(
  cx: number,
  cy: number,
  rExt: number,
  rInt: number,
  puntas: number,
  giro = -90,
): P[] {
  return Array.from({ length: puntas * 2 }, (_, i) => {
    const r = i % 2 === 0 ? rExt : rInt
    const t = ((giro + (i * 180) / puntas) * Math.PI) / 180
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as P
  })
}

function poligonoRegular(cx: number, cy: number, r: number, lados: number, giro = -90): P[] {
  return Array.from({ length: lados }, (_, i) => {
    const t = ((giro + (i * 360) / lados) * Math.PI) / 180
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as P
  })
}

function corazon(cx: number, cy: number, escala: number): P[] {
  return Array.from({ length: 180 }, (_, i) => {
    const t = (i / 180) * Math.PI * 2
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return [cx + x * escala, cy - y * escala] as P
  })
}

type Caja = [number, number, number, number]

function cajaDe(f: Forma): Caja {
  switch (f.tipo) {
    case 'circulo':
      return [f.cx - f.r, f.cy - f.r, f.cx + f.r, f.cy + f.r]
    case 'anillo':
      return [f.cx - f.r1, f.cy - f.r1, f.cx + f.r1, f.cy + f.r1]
    case 'elipse': {
      const r = Math.max(f.rx, f.ry)
      return [f.cx - r, f.cy - r, f.cx + r, f.cy + r]
    }
    case 'rect':
      return [f.x0, f.y0, f.x1, f.y1]
    case 'poligono':
    case 'trazo': {
      const m = f.tipo === 'trazo' ? f.ancho / 2 : 0
      const xs = f.puntos.map((p) => p[0])
      const ys = f.puntos.map((p) => p[1])
      return [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m]
    }
  }
}

function contiene(f: Forma, x: number, y: number): boolean {
  switch (f.tipo) {
    case 'circulo':
      return (x - f.cx) ** 2 + (y - f.cy) ** 2 <= f.r * f.r
    case 'anillo': {
      const d = (x - f.cx) ** 2 + (y - f.cy) ** 2
      return d >= f.r0 * f.r0 && d <= f.r1 * f.r1
    }
    case 'elipse': {
      const t = ((f.rot ?? 0) * Math.PI) / 180
      const dx = x - f.cx
      const dy = y - f.cy
      const u = dx * Math.cos(t) + dy * Math.sin(t)
      const v = -dx * Math.sin(t) + dy * Math.cos(t)
      return (u / f.rx) ** 2 + (v / f.ry) ** 2 <= 1
    }
    case 'rect': {
      const r = f.radio ?? 0
      const hx = (f.x1 - f.x0) / 2 - r
      const hy = (f.y1 - f.y0) / 2 - r
      const qx = Math.abs(x - (f.x0 + f.x1) / 2) - hx
      const qy = Math.abs(y - (f.y0 + f.y1) / 2) - hy
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) <= r
    }
    case 'poligono': {
      let dentro = false
      const p = f.puntos
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, yi] = p[i]!
        const [xj, yj] = p[j]!
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro
      }
      return dentro
    }
    case 'trazo': {
      const r2 = (f.ancho / 2) ** 2
      for (let i = 0; i < f.puntos.length - 1; i++) {
        const [ax, ay] = f.puntos[i]!
        const [bx, by] = f.puntos[i + 1]!
        const lx = bx - ax
        const ly = by - ay
        const t = Math.max(0, Math.min(1, ((x - ax) * lx + (y - ay) * ly) / (lx * lx + ly * ly)))
        if ((x - ax - t * lx) ** 2 + (y - ay - t * ly) ** 2 <= r2) return true
      }
      return false
    }
  }
}

// ------------------------------------------------------------------------------ render
const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number]
}

type Preparada = { capa: Capa; caja: Caja; color: [number, number, number] }

function preparar(e: Escena): Preparada[] {
  return e.capas.map((capa) => ({ capa, caja: cajaDe(capa.forma), color: rgb(capa.hex) }))
}

const dentroDeCaja = (c: Caja, x: number, y: number) =>
  x >= c[0] && x <= c[2] && y >= c[1] && y <= c[3]

/** Etiqueta de la verdad en un punto: la capa de arriba que cuenta como dibujo. */
function etiquetaEn(capas: Preparada[], x: number, y: number): number {
  for (let k = capas.length - 1; k >= 0; k--) {
    const c = capas[k]!
    if ((c.capa.alfa ?? 1) < 0.5 || c.capa.soloVisual) continue
    if (dentroDeCaja(c.caja, x, y) && contiene(c.capa.forma, x, y)) return c.capa.etiqueta
  }
  return FONDO
}

/** Firma: que capas cubren el punto. Si las 4 esquinas de un pixel coinciden, no hace falta supermuestrear. */
function firmaEn(capas: Preparada[], x: number, y: number): number {
  let firma = 0
  for (let k = 0; k < capas.length; k++) {
    const c = capas[k]!
    if (dentroDeCaja(c.caja, x, y) && contiene(c.capa.forma, x, y)) firma |= 1 << k
  }
  return firma
}

function colorEn(e: Escena, capas: Preparada[], x: number, y: number, salida: Float64Array): void {
  const f = e.fondo
  let a = 1
  let r: number
  let g: number
  let b: number
  if (f.tipo === 'transparente') {
    ;[r, g, b] = [255, 255, 255]
    a = 0
  } else if (f.tipo === 'solido') {
    ;[r, g, b] = rgb(f.hex)
  } else {
    const t =
      f.tipo === 'degradado'
        ? y / e.alto
        : Math.min(
            1,
            Math.hypot(x - e.ancho / 2, y - e.alto / 2) / Math.hypot(e.ancho / 2, e.alto / 2),
          ) ** 2
    const [d0, d1] =
      f.tipo === 'degradado' ? [rgb(f.desde), rgb(f.hasta)] : [rgb(f.centro), rgb(f.borde)]
    ;[r, g, b] = [0, 1, 2].map((i) => d0[i]! + (d1[i]! - d0[i]!) * t) as [number, number, number]
  }
  for (const c of capas) {
    if (!dentroDeCaja(c.caja, x, y) || !contiene(c.capa.forma, x, y)) continue
    const alfa = c.capa.alfa ?? 1
    const brillo = c.capa.sombreado
      ? c.capa.sombreado * ((y - (c.caja[1] + c.caja[3]) / 2) / ((c.caja[3] - c.caja[1]) / 2 || 1))
      : 0
    r = r * (1 - alfa) + (c.color[0] + brillo) * alfa
    g = g * (1 - alfa) + (c.color[1] + brillo) * alfa
    b = b * (1 - alfa) + (c.color[2] + brillo) * alfa
    a = a * (1 - alfa) + alfa
  }
  salida[0] = r
  salida[1] = g
  salida[2] = b
  salida[3] = a
}

export type Verdad = {
  imagen: ImagenRGBA
  /** Etiqueta de verdad por pixel de la fuente (mayoria de 16 submuestras en los bordes). */
  etiquetas: Uint8Array
  /** 1 si el pixel es interior (una sola etiqueta en todo el pixel). */
  interior: Uint8Array
  /** Color efectivo de cada etiqueta: el promedio real de sus pixeles interiores, ya degradados. */
  coloresEfectivos: string[]
  pixelesPorEtiqueta: number[]
  caja: Recorte
}

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

function degradar(e: Escena, px: Uint8ClampedArray): void {
  const d = e.degradar
  if (!d) return
  const { ancho, alto } = e
  if (d.oscurecer) {
    for (let o = 0; o < px.length; o += 4) {
      for (let c = 0; c < 3; c++) px[o + c] = (128 + (px[o + c]! - 128) * 0.6) * d.oscurecer
    }
  }
  if (d.desenfoque) {
    const r = d.desenfoque
    const tmp = new Float32Array(ancho * alto * 3)
    for (let pasada = 0; pasada < 2; pasada++) {
      const horizontal = pasada === 0
      const [n, m] = horizontal ? [alto, ancho] : [ancho, alto]
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
          for (let c = 0; c < 3; c++) {
            let s = 0
            let k = 0
            for (let q = Math.max(0, j - r); q <= Math.min(m - 1, j + r); q++) {
              s += px[(horizontal ? i * ancho + q : q * ancho + i) * 4 + c]!
              k++
            }
            tmp[(horizontal ? i * ancho + j : j * ancho + i) * 3 + c] = s / k
          }
        }
      }
      for (let p = 0; p < ancho * alto; p++)
        for (let c = 0; c < 3; c++) px[p * 4 + c] = tmp[p * 3 + c]!
    }
  }
  const azar = aleatorio(e.id.length * 7919 + e.ancho)
  if (d.bloques) {
    for (let by = 0; by < alto; by += 8) {
      for (let bx = 0; bx < ancho; bx += 8) {
        const delta = [0, 1, 2].map(() => (azar() * 2 - 1) * d.bloques!)
        for (let y = by; y < Math.min(alto, by + 8); y++) {
          for (let x = bx; x < Math.min(ancho, bx + 8); x++) {
            for (let c = 0; c < 3; c++)
              px[(y * ancho + x) * 4 + c] = px[(y * ancho + x) * 4 + c]! + delta[c]!
          }
        }
      }
    }
  }
  if (d.ruido) {
    for (let o = 0; o < px.length; o += 4) {
      for (let c = 0; c < 3; c++) {
        const gauss = Math.sqrt(-2 * Math.log(azar() || 1e-9)) * Math.cos(2 * Math.PI * azar())
        px[o + c] = px[o + c]! + gauss * d.ruido
      }
    }
  }
}

const SUB = 4

export function renderizar(e: Escena): Verdad {
  const capas = preparar(e)
  const { ancho, alto } = e
  const pixeles = new Uint8ClampedArray(ancho * alto * 4)
  const etiquetas = new Uint8Array(ancho * alto)
  const interior = new Uint8Array(ancho * alto)
  const muestra = new Float64Array(4)
  const acumulado = new Float64Array(4)

  // Firmas en las esquinas de los pixeles: (ancho+1) × (alto+1)
  const esquinas = new Int32Array((ancho + 1) * (alto + 1))
  for (let y = 0; y <= alto; y++)
    for (let x = 0; x <= ancho; x++) esquinas[y * (ancho + 1) + x] = firmaEn(capas, x, y)

  const votos = new Map<number, number>()
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      const f = esquinas[y * (ancho + 1) + x]!
      const uniforme =
        f === esquinas[y * (ancho + 1) + x + 1] &&
        f === esquinas[(y + 1) * (ancho + 1) + x] &&
        f === esquinas[(y + 1) * (ancho + 1) + x + 1]
      if (uniforme) {
        colorEn(e, capas, x + 0.5, y + 0.5, acumulado)
        etiquetas[i] = etiquetaEn(capas, x + 0.5, y + 0.5)
        interior[i] = 1
      } else {
        acumulado.fill(0)
        votos.clear()
        for (let sy = 0; sy < SUB; sy++) {
          for (let sx = 0; sx < SUB; sx++) {
            const px = x + (sx + 0.5) / SUB
            const py = y + (sy + 0.5) / SUB
            colorEn(e, capas, px, py, muestra)
            // premultiplicado, para que un borde transparente no oscurezca
            for (let c = 0; c < 3; c++) acumulado[c]! += muestra[c]! * muestra[3]!
            acumulado[3]! += muestra[3]!
            const et = etiquetaEn(capas, px, py)
            votos.set(et, (votos.get(et) ?? 0) + 1)
          }
        }
        const a = acumulado[3]!
        for (let c = 0; c < 3; c++) acumulado[c] = a > 0 ? acumulado[c]! / a : 255
        acumulado[3] = a / (SUB * SUB)
        etiquetas[i] = [...votos.entries()].sort((p, q) => q[1] - p[1])[0]![0]
      }
      pixeles[i * 4] = acumulado[0]!
      pixeles[i * 4 + 1] = acumulado[1]!
      pixeles[i * 4 + 2] = acumulado[2]!
      pixeles[i * 4 + 3] = acumulado[3]! * 255
    }
  }

  degradar(e, pixeles)

  const suma = e.colores.map(() => [0, 0, 0, 0])
  const pixelesPorEtiqueta = e.colores.map(() => 0)
  let [x0, y0, x1, y1] = [ancho, alto, -1, -1]
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      const et = etiquetas[i]!
      if (et === FONDO) continue
      pixelesPorEtiqueta[et]!++
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
      if (!interior[i]) continue
      const s = suma[et]!
      for (let c = 0; c < 3; c++) s[c]! += pixeles[i * 4 + c]!
      s[3]!++
    }
  }
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()
  return {
    imagen: { ancho, alto, pixeles },
    etiquetas,
    interior,
    coloresEfectivos: suma.map((s, k) =>
      s[3] ? `#${hex(s[0]! / s[3]!)}${hex(s[1]! / s[3]!)}${hex(s[2]! / s[3]!)}` : e.colores[k]!,
    ),
    pixelesPorEtiqueta,
    caja: { x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 },
  }
}

/** Mascara de verdad (1 = dibujo) muestreada sobre la grilla de trabajo de un recorte. */
export function mascaraVerdadEn(
  e: Escena,
  recorte: Recorte,
  ancho: number,
  alto: number,
): Uint8Array {
  const capas = preparar(e)
  const salida = new Uint8Array(ancho * alto)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let dibujo = 0
      for (let s = 0; s < 4; s++) {
        const sx = recorte.x + ((x + (s % 2 ? 0.75 : 0.25)) * recorte.ancho) / ancho
        const sy = recorte.y + ((y + (s >> 1 ? 0.75 : 0.25)) * recorte.alto) / alto
        if (etiquetaEn(capas, sx, sy) !== FONDO) dibujo++
      }
      salida[y * ancho + x] = dibujo >= 2 ? 1 : 0
    }
  }
  return salida
}

// ------------------------------------------------------------------------------ escenas
const L = 2000 // lado de las fuentes

export const ESCENAS: Escena[] = [
  // ------------------------------------------------------------------ logos
  {
    id: 'logo-01-sello-transparente',
    categoria: 'logo',
    descripcion: 'PNG con alfa: circulo rojo con estrella blanca y anillo negro',
    expectativa: 'deberia-andar',
    ancho: L,
    alto: L,
    fondo: { tipo: 'transparente' },
    colores: ['#D62828', '#FFFFFF', '#1B1B1B'],
    capas: [
      { forma: { tipo: 'circulo', cx: 1000, cy: 1000, r: 700 }, hex: '#D62828', etiqueta: 0 },
      {
        forma: { tipo: 'poligono', puntos: estrella(1000, 1010, 480, 200, 5) },
        hex: '#FFFFFF',
        etiqueta: 1,
      },
      {
        forma: { tipo: 'anillo', cx: 1000, cy: 1000, r0: 700, r1: 780 },
        hex: '#1B1B1B',
        etiqueta: 2,
      },
    ],
  },
  {
    id: 'logo-02-escudo-ruido',
    categoria: 'logo',
    descripcion:
      'Fondo blanco con ruido leve: escudo azul, banda amarilla y circulo blanco interior',
    expectativa: 'deberia-andar',
    ancho: L,
    alto: L,
    fondo: { tipo: 'solido', hex: '#FFFFFF' },
    colores: ['#1D3A8A', '#F2C230', '#FFFFFF'],
    degradar: { ruido: 3 },
    capas: [
      {
        forma: {
          tipo: 'poligono',
          puntos: [
            [400, 300],
            [1600, 300],
            [1600, 1100],
            [1000, 1750],
            [400, 1100],
          ],
        },
        hex: '#1D3A8A',
        etiqueta: 0,
      },
      {
        forma: {
          tipo: 'poligono',
          puntos: [
            [400, 700],
            [1600, 400],
            [1600, 600],
            [400, 900],
          ],
        },
        hex: '#F2C230',
        etiqueta: 1,
      },
      { forma: { tipo: 'circulo', cx: 1000, cy: 1150, r: 260 }, hex: '#FFFFFF', etiqueta: 2 },
    ],
  },
  {
    id: 'logo-03-formas-crema',
    categoria: 'logo',
    descripcion:
      'Fondo crema: triangulo verde, circulo naranja y cuadrado gris redondeado superpuestos',
    expectativa: 'deberia-andar',
    ancho: L,
    alto: L,
    fondo: { tipo: 'solido', hex: '#F7F5F0' },
    colores: ['#2E9E5B', '#F28C28', '#44474F'],
    capas: [
      {
        forma: {
          tipo: 'poligono',
          puntos: [
            [300, 1600],
            [900, 400],
            [1500, 1600],
          ],
        },
        hex: '#2E9E5B',
        etiqueta: 0,
      },
      { forma: { tipo: 'circulo', cx: 1250, cy: 800, r: 420 }, hex: '#F28C28', etiqueta: 1 },
      {
        forma: { tipo: 'rect', x0: 1000, y0: 1050, x1: 1700, y1: 1700, radio: 90 },
        hex: '#44474F',
        etiqueta: 2,
      },
    ],
  },
  {
    id: 'logo-04-chico-320px',
    categoria: 'logo',
    descripcion:
      'Fuente chica de 320 × 240 que hay que agrandar: hexagono violeta con aro blanco y punto magenta',
    expectativa: 'deberia-andar',
    ancho: 320,
    alto: 240,
    fondo: { tipo: 'solido', hex: '#FFFFFF' },
    colores: ['#5B2A86', '#FFFFFF', '#E0288F'],
    capas: [
      {
        forma: { tipo: 'poligono', puntos: poligonoRegular(160, 120, 105, 6) },
        hex: '#5B2A86',
        etiqueta: 0,
      },
      {
        forma: { tipo: 'poligono', puntos: poligonoRegular(160, 120, 62, 6) },
        hex: '#FFFFFF',
        etiqueta: 1,
      },
      { forma: { tipo: 'circulo', cx: 160, cy: 120, r: 30 }, hex: '#E0288F', etiqueta: 2 },
    ],
  },
  {
    id: 'logo-05-jpg-sucio',
    categoria: 'logo',
    descripcion:
      'Como un JPG muy comprimido: bloques de 8 px y ruido, ola azul, circulo cian y barras azul noche',
    expectativa: 'deberia-andar',
    ancho: L,
    alto: L,
    fondo: { tipo: 'solido', hex: '#FFFFFF' },
    colores: ['#1E4FD8', '#27C3D8', '#0B1F4B'],
    degradar: { bloques: 6, ruido: 4 },
    capas: [
      {
        forma: {
          tipo: 'poligono',
          puntos: [
            ...Array.from(
              { length: 60 },
              (_, i) => [300 + i * 23.7, 1000 + 180 * Math.sin(i / 6)] as P,
            ),
            ...Array.from(
              { length: 60 },
              (_, i) => [300 + (59 - i) * 23.7, 1350 + 180 * Math.sin((59 - i) / 6)] as P,
            ),
          ],
        },
        hex: '#1E4FD8',
        etiqueta: 0,
      },
      { forma: { tipo: 'circulo', cx: 1000, cy: 600, r: 280 }, hex: '#27C3D8', etiqueta: 1 },
      {
        forma: { tipo: 'rect', x0: 450, y0: 1550, x1: 1550, y1: 1680, radio: 20 },
        hex: '#0B1F4B',
        etiqueta: 2,
      },
    ],
  },
  // ------------------------------------------------------------------ dibujos
  {
    id: 'dibujo-01-carita-sombreada',
    categoria: 'dibujo',
    descripcion: 'Carita amarilla con sombreado suave, ojos y sonrisa negros, cachetes rojos',
    expectativa: 'deberia-andar',
    ancho: L,
    alto: L,
    fondo: { tipo: 'solido', hex: '#FFFFFF' },
    colores: ['#F5C518', '#1A1A1A', '#E23B3B'],
    capas: [
      {
        forma: { tipo: 'circulo', cx: 1000, cy: 1000, r: 800 },
        hex: '#F5C518',
        etiqueta: 0,
        sombreado: 12,
      },
      { forma: { tipo: 'elipse', cx: 720, cy: 800, rx: 90, ry: 140 }, hex: '#1A1A1A', etiqueta: 1 },
      {
        forma: { tipo: 'elipse', cx: 1280, cy: 800, rx: 90, ry: 140 },
        hex: '#1A1A1A',
        etiqueta: 1,
      },
      {
        forma: {
          tipo: 'trazo',
          ancho: 70,
          puntos: Array.from({ length: 30 }, (_, i) => {
            const t = Math.PI * (0.15 + (0.7 * i) / 29)
            return [1000 + 450 * Math.cos(t), 1050 + 380 * Math.sin(t)] as P
          }),
        },
        hex: '#1A1A1A',
        etiqueta: 1,
      },
      { forma: { tipo: 'circulo', cx: 500, cy: 1150, r: 110 }, hex: '#E23B3B', etiqueta: 2 },
      { forma: { tipo: 'circulo', cx: 1500, cy: 1150, r: 110 }, hex: '#E23B3B', etiqueta: 2 },
    ],
  },
  {
    id: 'dibujo-02-gato-fondo-celeste',
    categoria: 'dibujo',
    descripcion: 'Fondo celeste: silueta de gato negra con ojos blancos y nariz rosa',
    expectativa: 'deberia-andar',
    ancho: L,
    alto: L,
    fondo: { tipo: 'solido', hex: '#DDEEFF' },
    colores: ['#161616', '#FFFFFF', '#F48FB1'],
    capas: [
      {
        forma: {
          tipo: 'poligono',
          puntos: [
            [500, 1750],
            [420, 900],
            [470, 380],
            [760, 700],
            [1240, 700],
            [1530, 380],
            [1580, 900],
            [1500, 1750],
          ],
        },
        hex: '#161616',
        etiqueta: 0,
      },
      {
        forma: { tipo: 'elipse', cx: 780, cy: 1000, rx: 110, ry: 80 },
        hex: '#FFFFFF',
        etiqueta: 1,
      },
      {
        forma: { tipo: 'elipse', cx: 1220, cy: 1000, rx: 110, ry: 80 },
        hex: '#FFFFFF',
        etiqueta: 1,
      },
      {
        forma: {
          tipo: 'poligono',
          puntos: [
            [930, 1200],
            [1070, 1200],
            [1000, 1290],
          ],
        },
        hex: '#F48FB1',
        etiqueta: 2,
      },
    ],
  },
  {
    id: 'dibujo-03-flor',
    categoria: 'dibujo',
    descripcion: 'Flor: 6 petalos rosas en elipses rotadas, centro naranja, tallo y hoja verdes',
    expectativa: 'deberia-andar',
    ancho: L,
    alto: L,
    fondo: { tipo: 'solido', hex: '#FFFFFF' },
    colores: ['#EC6FA9', '#F59E0B', '#3F9C35'],
    capas: [
      {
        forma: {
          tipo: 'trazo',
          ancho: 80,
          puntos: [
            [1000, 900],
            [1000, 1850],
          ],
        },
        hex: '#3F9C35',
        etiqueta: 2,
      },
      {
        forma: { tipo: 'elipse', cx: 1250, cy: 1500, rx: 230, ry: 90, rot: -30 },
        hex: '#3F9C35',
        etiqueta: 2,
      },
      ...Array.from({ length: 6 }, (_, i): Capa => {
        const t = (i * Math.PI) / 3
        return {
          forma: {
            tipo: 'elipse',
            cx: 1000 + 330 * Math.cos(t),
            cy: 750 + 330 * Math.sin(t),
            rx: 260,
            ry: 130,
            rot: (i * 180) / 3,
          },
          hex: '#EC6FA9',
          etiqueta: 0,
        }
      }),
      { forma: { tipo: 'circulo', cx: 1000, cy: 750, r: 190 }, hex: '#F59E0B', etiqueta: 1 },
    ],
  },
  {
    id: 'dibujo-04-escaneado',
    categoria: 'dibujo',
    descripcion:
      'Como un escaneo: papel ahuesado con ruido y desenfoque, corazon rojo con contorno negro grueso',
    expectativa: 'deberia-andar',
    ancho: L,
    alto: L,
    fondo: { tipo: 'solido', hex: '#F2EDE3' },
    colores: ['#1E1E1E', '#C8232C'],
    degradar: { desenfoque: 2, ruido: 6 },
    capas: [
      { forma: { tipo: 'poligono', puntos: corazon(1000, 950, 44) }, hex: '#1E1E1E', etiqueta: 0 },
      { forma: { tipo: 'poligono', puntos: corazon(1000, 950, 38) }, hex: '#C8232C', etiqueta: 1 },
    ],
  },
  {
    id: 'dibujo-05-lineas-finas',
    categoria: 'dibujo',
    descripcion:
      'Circulo azul con cruz amarilla y rayos blancos de 0,3 mm, mas finos que el minimo imprimible',
    expectativa: 'deberia-andar',
    ancho: L,
    alto: L,
    fondo: { tipo: 'solido', hex: '#FFFFFF' },
    colores: ['#1F6FEB', '#FFD43B'],
    capas: [
      { forma: { tipo: 'circulo', cx: 1000, cy: 1000, r: 850 }, hex: '#1F6FEB', etiqueta: 0 },
      {
        forma: {
          tipo: 'trazo',
          ancho: 160,
          puntos: [
            [1000, 350],
            [1000, 1650],
          ],
        },
        hex: '#FFD43B',
        etiqueta: 1,
      },
      {
        forma: {
          tipo: 'trazo',
          ancho: 160,
          puntos: [
            [350, 1000],
            [1650, 1000],
          ],
        },
        hex: '#FFD43B',
        etiqueta: 1,
      },
      // 12 px en una fuente de 1700 px para 50 mm = 0,35 mm: se ven, pero no se imprimen
      ...Array.from({ length: 8 }, (_, i): Capa => {
        const t = ((i + 0.5) * Math.PI) / 4
        return {
          forma: {
            tipo: 'trazo',
            ancho: 12,
            puntos: [
              [1000 + 250 * Math.cos(t), 1000 + 250 * Math.sin(t)],
              [1000 + 780 * Math.cos(t), 1000 + 780 * Math.sin(t)],
            ],
          },
          hex: '#FFFFFF',
          etiqueta: 0,
          soloVisual: true,
        }
      }),
    ],
  },
  // ------------------------------------------------------------------ stickers
  {
    id: 'sticker-01-borde-blanco-sombra',
    categoria: 'sticker',
    descripcion:
      'PNG con alfa: sticker con borde blanco, sombra semitransparente, hoja verde y tallo marron',
    expectativa: 'deberia-andar',
    ancho: L,
    alto: L,
    fondo: { tipo: 'transparente' },
    colores: ['#FFFFFF', '#43A047', '#6D4C41'],
    capas: [
      {
        forma: { tipo: 'elipse', cx: 1040, cy: 1060, rx: 620, ry: 780, rot: 25 },
        hex: '#000000',
        etiqueta: 0,
        alfa: 0.3,
      },
      {
        forma: { tipo: 'elipse', cx: 1000, cy: 1000, rx: 620, ry: 780, rot: 25 },
        hex: '#FFFFFF',
        etiqueta: 0,
      },
      {
        forma: { tipo: 'elipse', cx: 1000, cy: 1000, rx: 500, ry: 660, rot: 25 },
        hex: '#43A047',
        etiqueta: 1,
      },
      {
        forma: {
          tipo: 'trazo',
          ancho: 70,
          puntos: [
            [1180, 1450],
            [1340, 1700],
          ],
        },
        hex: '#6D4C41',
        etiqueta: 2,
      },
    ],
  },
  {
    id: 'sticker-02-captura-degradado',
    categoria: 'sticker',
    descripcion:
      'Captura: fondo con degradado vertical suave, tarjeta naranja con icono blanco y barras gris oscuro',
    expectativa: 'deberia-andar',
    ancho: L,
    alto: 1500,
    fondo: { tipo: 'degradado', desde: '#FFFFFF', hasta: '#E6E6E6' },
    colores: ['#F57C00', '#FFFFFF', '#37474F'],
    capas: [
      {
        forma: { tipo: 'rect', x0: 300, y0: 250, x1: 1700, y1: 1250, radio: 120 },
        hex: '#F57C00',
        etiqueta: 0,
      },
      { forma: { tipo: 'circulo', cx: 650, cy: 750, r: 230 }, hex: '#FFFFFF', etiqueta: 1 },
      {
        forma: { tipo: 'rect', x0: 1000, y0: 580, x1: 1550, y1: 680, radio: 30 },
        hex: '#37474F',
        etiqueta: 2,
      },
      {
        forma: { tipo: 'rect', x0: 1000, y0: 820, x1: 1400, y1: 920, radio: 30 },
        hex: '#37474F',
        etiqueta: 2,
      },
    ],
  },
  {
    id: 'sticker-03-vinieta',
    categoria: 'sticker',
    descripcion:
      'Fondo con vinieta fuerte (centro blanco, esquinas grises): estrella verde azulada con punto blanco',
    expectativa: 'debilidad-conocida',
    ancho: L,
    alto: L,
    fondo: { tipo: 'vinieta', centro: '#FFFFFF', borde: '#B8B8B8' },
    colores: ['#00897B', '#FFFFFF'],
    capas: [
      {
        forma: { tipo: 'poligono', puntos: estrella(1000, 1030, 650, 300, 5) },
        hex: '#00897B',
        etiqueta: 0,
      },
      { forma: { tipo: 'circulo', cx: 1000, cy: 1030, r: 130 }, hex: '#FFFFFF', etiqueta: 1 },
    ],
  },
  // ------------------------------------------------------------------ horribles
  {
    id: 'horrible-01-oscura',
    categoria: 'horrible',
    descripcion:
      'Como una foto oscura y lavada: fondo gris oscuro con ruido, circulo bordo y mancha ocre',
    expectativa: 'debilidad-conocida',
    ancho: L,
    alto: L,
    fondo: { tipo: 'solido', hex: '#3A3A3A' },
    colores: ['#6B2A2A', '#8F7A2E'],
    degradar: { oscurecer: 0.7, ruido: 8 },
    capas: [
      { forma: { tipo: 'circulo', cx: 950, cy: 1000, r: 650 }, hex: '#6B2A2A', etiqueta: 0 },
      {
        forma: { tipo: 'elipse', cx: 1150, cy: 900, rx: 300, ry: 200, rot: 20 },
        hex: '#8F7A2E',
        etiqueta: 1,
      },
    ],
  },
  {
    id: 'horrible-02-fondo-igual',
    categoria: 'horrible',
    descripcion:
      'Sujeto casi del mismo color que el fondo: silueta beige apenas mas oscura con detalles marrones',
    expectativa: 'debilidad-conocida',
    ancho: L,
    alto: L,
    fondo: { tipo: 'solido', hex: '#E9E4D8' },
    colores: ['#DCD4C2', '#6D4C2F'],
    capas: [
      {
        forma: { tipo: 'elipse', cx: 1000, cy: 1000, rx: 700, ry: 820 },
        hex: '#DCD4C2',
        etiqueta: 0,
      },
      { forma: { tipo: 'circulo', cx: 780, cy: 850, r: 90 }, hex: '#6D4C2F', etiqueta: 1 },
      { forma: { tipo: 'circulo', cx: 1220, cy: 850, r: 90 }, hex: '#6D4C2F', etiqueta: 1 },
      {
        forma: { tipo: 'rect', x0: 750, y0: 1250, x1: 1250, y1: 1330, radio: 30 },
        hex: '#6D4C2F',
        etiqueta: 1,
      },
    ],
  },
]
