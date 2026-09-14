// Texto → contornos en mm (plan §8.2 herramienta 9): opentype.js lee la fuente y las curvas se
// aproximan con polilineas. La limpieza con regla NonZero y la negrita se hacen en construir(),
// con Manifold, porque las fuentes TrueType superponen contornos dentro de una misma letra.

import * as opentype from 'opentype.js'

// En el bundler (ESM) parse es un export con nombre; en Node (CommonJS) viene dentro de default
const parse: typeof opentype.parse =
  (opentype as { parse?: typeof opentype.parse }).parse ?? opentype.default.parse

const fuentes = new Map<string, opentype.Font>()

/** mm. Largo de cada tramo recto con que se aproxima una curva. */
const TRAMO_CURVA_MM = 0.25

export function registrarFuente(id: string, datos: ArrayBuffer): void {
  fuentes.set(id, parse(datos))
}

export const fuenteRegistrada = (id: string) => fuentes.has(id)

/**
 * Contornos del texto, en mm, con y hacia arriba y centrados en el origen.
 * `tamanoMm` es el tamaño de la fuente (el em); la altura de una mayuscula ronda el 70 %.
 */
export function contornosDeTexto(
  idFuente: string,
  texto: string,
  tamanoMm: number,
): [number, number][][] {
  const fuente = fuentes.get(idFuente)
  if (!fuente) throw new Error(`La fuente "${idFuente}" no está cargada.`)
  const contornos: [number, number][][] = []
  let actual: [number, number][] = []
  let x0 = 0
  let y0 = 0
  const agregar = (x: number, y: number) => {
    actual.push([x, -y]) // opentype usa y hacia abajo
    x0 = x
    y0 = y
  }
  const cerrar = () => {
    if (actual.length >= 3) contornos.push(actual)
    actual = []
  }

  // Letra por letra, con avance y kerning de la fuente, en vez de font.getPath(): ese camino aplica
  // siempre las sustituciones tipograficas (GSUB) y opentype.js 2.0 no las soporta todas. Con Nunito
  // lanza "lookupType: 6 - substFormat: 2 is not yet supported". En un llavero no hacen falta.
  const escala = tamanoMm / fuente.unitsPerEm
  const glifos = Array.from(texto).map((letra) => fuente.charToGlyph(letra))
  const comandos: opentype.ComandoRuta[] = []
  let avance = 0
  glifos.forEach((glifo, i) => {
    comandos.push(...glifo.getPath(avance, 0, tamanoMm).commands)
    avance += (glifo.advanceWidth ?? 0) * escala
    const siguiente = glifos[i + 1]
    if (siguiente) avance += fuente.getKerningValue(glifo, siguiente) * escala
  })
  for (const c of comandos) {
    switch (c.type) {
      case 'M':
        cerrar()
        agregar(c.x, c.y)
        break
      case 'L':
        agregar(c.x, c.y)
        break
      case 'Q': {
        const n = Math.min(
          16,
          Math.max(
            2,
            Math.ceil(
              (Math.hypot(c.x1 - x0, c.y1 - y0) + Math.hypot(c.x - c.x1, c.y - c.y1)) /
                TRAMO_CURVA_MM,
            ),
          ),
        )
        const [ax, ay] = [x0, y0]
        for (let i = 1; i <= n; i++) {
          const t = i / n
          const u = 1 - t
          agregar(
            u * u * ax + 2 * u * t * c.x1 + t * t * c.x,
            u * u * ay + 2 * u * t * c.y1 + t * t * c.y,
          )
        }
        break
      }
      case 'C': {
        const largo =
          Math.hypot(c.x1 - x0, c.y1 - y0) +
          Math.hypot(c.x2 - c.x1, c.y2 - c.y1) +
          Math.hypot(c.x - c.x2, c.y - c.y2)
        const n = Math.min(24, Math.max(2, Math.ceil(largo / TRAMO_CURVA_MM)))
        const [ax, ay] = [x0, y0]
        for (let i = 1; i <= n; i++) {
          const t = i / n
          const u = 1 - t
          agregar(
            u * u * u * ax + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
            u * u * u * ay + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
          )
        }
        break
      }
      case 'Z':
        cerrar()
        break
    }
  }
  cerrar()
  if (!contornos.length) return []

  const puntos = contornos.flat()
  const cx = (Math.min(...puntos.map((p) => p[0])) + Math.max(...puntos.map((p) => p[0]))) / 2
  const cy = (Math.min(...puntos.map((p) => p[1])) + Math.max(...puntos.map((p) => p[1]))) / 2
  return contornos.map((anillo) => anillo.map(([x, y]) => [x - cx, y - cy] as [number, number]))
}
