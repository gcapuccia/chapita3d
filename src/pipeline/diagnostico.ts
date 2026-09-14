// Los casos feos del plan (§4.8), con deteccion calculable y sin IA.
// El caso 4 (detalle mas fino que la boquilla) es geometrico y vive en la DRC.
//
// ⚠️ Los umbrales marcados PROVISORIO salen del banco sintetico (F1.1). Se recalibran con las
// fotos reales, porque ahi es donde estos casos aparecen de verdad.

import { deltaE2000 } from './color.ts'
import type { NombrePreset } from './presets.ts'
import { varianzaLaplaciano } from './presets.ts'
import { FONDO, type ColorPaleta, type ImagenRGBA } from './tipos.ts'

export type CodigoCaso =
  | 'fondo-complejo'
  | 'imagen-chica'
  | 'imagen-borrosa'
  | 'demasiados-colores'
  | 'texto-chico'
  | 'dibujo-no-encontrado'
  | 'sin-fondo'
  | 'huecos-en-dibujo'

export type CasoFeo = {
  caso: 1 | 2 | 3 | 5 | 6
  codigo: CodigoCaso
  mensaje: string
  /** Si el arreglo es cambiar de preset. */
  sugerirPreset?: NombrePreset
  /** true: convertirAutomatico() cambia de preset solo. false: se ofrece, no se impone. */
  cambiarSolo?: boolean
}

export const UMBRALES = {
  /** px. Lado mayor minimo de la fuente (plan §4.8). */
  ladoMinimoPx: 200,
  /** Varianza del laplaciano a resolucion de trabajo. ⚠️ PROVISORIO. */
  varianzaLaplacianoMinima: 20,
  /** Fraccion de fondo en la imagen entera: fuera de este rango, el flood fill no es confiable (plan §4.8). */
  fondoMinimo: 0.15,
  fondoMaximo: 0.85,
  /** Fraccion de dibujo o de fondo por debajo de la cual el recorte salio mal (plan §4.8 caso 6). */
  recorteVacio: 0.05,
  /** Huecos de fondo adentro del dibujo (plan §4.8 caso 6c). */
  huecosMaximos: 30,
  /**
   * ΔE2000 de un pixel a su color asignado a partir del cual "no entra" en la paleta, y la fraccion
   * de pixeles asi que dispara el aviso. El plan corre un segundo k-means con N = 6 y mira clusters
   * con ≥ 5 % de area y ΔE > 15; aca se mide lo mismo sin el segundo k-means.
   */
  deltaEFueraDePaleta: 15,
  fraccionFueraDePaleta: 0.05,
  /** Componentes con relacion de aspecto > 4 y lado corto < 1 mm: si hay 5 o mas, es texto (plan §4.8 caso 5). */
  aspectoTexto: 4,
  trazoTextoMm: 1.0,
  componentesTexto: 5,
}

export type EntradaDiagnostico = {
  fuente: ImagenRGBA
  /** Mascara de la previa (imagen entera) y si salio del flood fill. */
  mascaraPrevia: Uint8Array
  porFloodFill: boolean
  trabajo: ImagenRGBA
  mascara: Uint8Array
  crudas: Uint8Array
  paleta: readonly ColorPaleta[]
  etiquetas: Uint8Array
  mmPorPixel: number
}

function componentes(
  esParte: (i: number) => boolean,
  ancho: number,
  alto: number,
  alVisitar: (pixeles: number[], tocaBorde: boolean) => void,
) {
  const n = ancho * alto
  const visto = new Uint8Array(n)
  const cola = new Int32Array(n)
  for (let inicio = 0; inicio < n; inicio++) {
    if (visto[inicio] || !esParte(inicio)) continue
    let fin = 0
    cola[fin++] = inicio
    visto[inicio] = 1
    let tocaBorde = false
    const miembros: number[] = []
    for (let cabeza = 0; cabeza < fin; cabeza++) {
      const i = cola[cabeza]!
      miembros.push(i)
      const x = i % ancho
      const y = (i / ancho) | 0
      if (x === 0 || y === 0 || x === ancho - 1 || y === alto - 1) tocaBorde = true
      for (const j of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
        if (j < 0 || j >= n || visto[j] || !esParte(j)) continue
        visto[j] = 1
        cola[fin++] = j
      }
    }
    alVisitar(miembros, tocaBorde)
  }
}

export function diagnosticar(e: EntradaDiagnostico): CasoFeo[] {
  const casos: CasoFeo[] = []

  // 2 · Chica o borrosa
  if (Math.max(e.fuente.ancho, e.fuente.alto) < UMBRALES.ladoMinimoPx) {
    casos.push({
      caso: 2,
      codigo: 'imagen-chica',
      mensaje: `La imagen mide ${e.fuente.ancho} × ${e.fuente.alto} px: es chica y los bordes pueden salir escalonados.`,
    })
  }
  if (varianzaLaplaciano(e.trabajo) < UMBRALES.varianzaLaplacianoMinima) {
    casos.push({
      caso: 2,
      codigo: 'imagen-borrosa',
      mensaje: 'La imagen parece borrosa: los bordes van a salir redondeados.',
    })
  }

  // 6a / 6b / 1 · Cuanto fondo encontro el recorte, sobre la imagen entera
  const dibujo = e.mascaraPrevia.reduce((s, v) => s + v, 0) / e.mascaraPrevia.length
  const fondo = 1 - dibujo
  if (dibujo < UMBRALES.recorteVacio) {
    casos.push({
      caso: 6,
      codigo: 'dibujo-no-encontrado',
      mensaje: 'Casi toda la imagen quedó como fondo: el recorte no encontró el dibujo.',
      // El plan (§4.8) sugeria Silueta. Medido en el banco (F1.1): Foto rescata las dos imagenes
      // horribles (fondo igual al sujeto: IoU 0,23 → 1,00; foto oscura: 0,00 → 0,98) y Silueta ninguna.
      sugerirPreset: 'foto',
      cambiarSolo: true,
    })
  } else if (fondo < UMBRALES.recorteVacio) {
    casos.push({
      caso: 6,
      codigo: 'sin-fondo',
      mensaje:
        'No encontré fondo para sacar. Si tu imagen ya viene recortada, está perfecto: seguí.',
    })
  } else if (e.porFloodFill && (fondo < UMBRALES.fondoMinimo || fondo > UMBRALES.fondoMaximo)) {
    casos.push({
      caso: 1,
      codigo: 'fondo-complejo',
      mensaje: 'Si el recorte no quedó bien, probá tocando qué colores son fondo.',
      // Se ofrece pero no se impone: en la viñeta del banco este caso salta con el recorte bien
      // hecho, y pasar a Foto lo empeora (IoU 1,00 → 0,16)
      sugerirPreset: 'foto',
      cambiarSolo: false,
    })
  }

  const { ancho, alto } = e.trabajo

  // 6c · Huecos de fondo adentro del dibujo
  let huecos = 0
  componentes(
    (i) => e.mascara[i] === 0,
    ancho,
    alto,
    (_, tocaBorde) => {
      if (!tocaBorde) huecos++
    },
  )
  if (huecos > UMBRALES.huecosMaximos) {
    casos.push({
      caso: 6,
      codigo: 'huecos-en-dibujo',
      mensaje: `Quedaron ${huecos} huecos adentro del dibujo.`,
    })
  }

  // 3 · Colores que no entran en la paleta
  let dibujoPx = 0
  let fuera = 0
  for (let i = 0; i < e.crudas.length; i++) {
    const et = e.crudas[i]!
    if (et === FONDO || et >= e.paleta.length) continue
    dibujoPx++
    const o = i * 4
    const hex = `#${[0, 1, 2].map((c) => e.trabajo.pixeles[o + c]!.toString(16).padStart(2, '0')).join('')}`
    // Se muestrea 1 de cada 7 pixeles: ΔE2000 es caro y la fraccion no necesita mas precision
    if (i % 7 === 0 && deltaE2000(hex, e.paleta[et]!.hex) > UMBRALES.deltaEFueraDePaleta) fuera += 7
  }
  if (dibujoPx && fuera / dibujoPx >= UMBRALES.fraccionFueraDePaleta) {
    casos.push({
      caso: 3,
      codigo: 'demasiados-colores',
      mensaje: `El ${Math.round((fuera / dibujoPx) * 100)} % del dibujo tiene colores que no entran en la paleta: con más colores se vería mejor, a costa de más purga.`,
    })
  }

  // 5 · Texto que va a salir ilegible: muchas piezas finas y alargadas
  let alargadas = 0
  const umbralTrazoPx = UMBRALES.trazoTextoMm / e.mmPorPixel
  for (let color = 0; color < e.paleta.length; color++) {
    componentes(
      (i) => e.etiquetas[i] === color,
      ancho,
      alto,
      (miembros) => {
        if (miembros.length < 4) return
        let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
        for (const i of miembros) {
          const x = i % ancho
          const y = (i / ancho) | 0
          x0 = Math.min(x0, x)
          x1 = Math.max(x1, x)
          y0 = Math.min(y0, y)
          y1 = Math.max(y1, y)
        }
        const corto = Math.min(x1 - x0 + 1, y1 - y0 + 1)
        const largo = Math.max(x1 - x0 + 1, y1 - y0 + 1)
        if (largo / corto > UMBRALES.aspectoTexto && corto < umbralTrazoPx) alargadas++
      },
    )
  }
  if (alargadas >= UMBRALES.componentesTexto) {
    casos.push({
      caso: 5,
      codigo: 'texto-chico',
      mensaje: 'Parece que hay texto chico: puede salir ilegible. Probá hacerlo más grande.',
    })
  }

  return casos
}
