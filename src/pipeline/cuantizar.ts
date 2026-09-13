// Paso 5 del plan (§3): reducir la imagen a N colores con k-means++ en OKLab.
// Sin dithering, nunca (audit-01 §2.2): el dithering arruina la vectorizacion.

import { deltaE2000, oklabARgb, rgbAHex, rgbAOklab } from './color.ts'
import { FONDO, type ColorPaleta, type ImagenRGBA, type Oklab } from './tipos.ts'

export type ParamsCuantizar = {
  colores: number
  muestra: number
  iteraciones: number
  corte: number
  /** Centroides mas parecidos que esto (ΔE2000) se fusionan. */
  fusionDeltaE2000: number
  semilla: number
}

export type ResultadoCuantizacion = { paleta: ColorPaleta[]; etiquetas: Uint8Array }

/** PRNG deterministico (mulberry32): la misma imagen da siempre el mismo resultado. */
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

const d2 = (lab: Float32Array, i: number, c: Float64Array, k: number) => {
  const dL = lab[i * 3]! - c[k * 3]!
  const da = lab[i * 3 + 1]! - c[k * 3 + 1]!
  const db = lab[i * 3 + 2]! - c[k * 3 + 2]!
  return dL * dL + da * da + db * db
}

export function cuantizar(
  img: ImagenRGBA,
  mascara: Uint8Array,
  p: ParamsCuantizar,
): ResultadoCuantizacion {
  const indices: number[] = []
  for (let i = 0; i < mascara.length; i++) if (mascara[i] === 1) indices.push(i)
  const etiquetas = new Uint8Array(mascara.length).fill(FONDO)
  if (indices.length === 0) return { paleta: [], etiquetas }

  const lab = new Float32Array(indices.length * 3)
  indices.forEach((i, k) =>
    rgbAOklab(img.pixeles[i * 4]!, img.pixeles[i * 4 + 1]!, img.pixeles[i * 4 + 2]!, lab, k * 3),
  )

  // Muestra aleatoria sin reposicion (Fisher-Yates parcial)
  const azar = aleatorio(p.semilla)
  const tam = Math.min(p.muestra, indices.length)
  const orden = Int32Array.from({ length: indices.length }, (_, i) => i)
  for (let i = 0; i < tam; i++) {
    const j = i + Math.floor(azar() * (orden.length - i))
    const t = orden[i]!
    orden[i] = orden[j]!
    orden[j] = t
  }
  const muestra = orden.subarray(0, tam)
  const k = Math.min(p.colores, tam)

  // k-means++: cada centroide nuevo con probabilidad proporcional a la distancia² al mas cercano
  const c = new Float64Array(k * 3)
  const copiar = (m: number, destino: number) => {
    c[destino * 3] = lab[m * 3]!
    c[destino * 3 + 1] = lab[m * 3 + 1]!
    c[destino * 3 + 2] = lab[m * 3 + 2]!
  }
  copiar(muestra[Math.floor(azar() * tam)]!, 0)
  const cercana = new Float64Array(tam).fill(Infinity)
  for (let nuevo = 1; nuevo < k; nuevo++) {
    let suma = 0
    for (let s = 0; s < tam; s++) {
      cercana[s] = Math.min(cercana[s]!, d2(lab, muestra[s]!, c, nuevo - 1))
      suma += cercana[s]!
    }
    let objetivo = azar() * suma
    let elegida = tam - 1
    for (let s = 0; s < tam; s++) {
      objetivo -= cercana[s]!
      if (objetivo <= 0) {
        elegida = s
        break
      }
    }
    copiar(muestra[elegida]!, nuevo)
  }

  // Lloyd
  const asignacion = new Uint8Array(tam)
  const suma = new Float64Array(k * 3)
  const cuenta = new Float64Array(k)
  for (let it = 0; it < p.iteraciones; it++) {
    suma.fill(0)
    cuenta.fill(0)
    for (let s = 0; s < tam; s++) {
      const m = muestra[s]!
      let mejor = 0
      let mejorD = Infinity
      for (let j = 0; j < k; j++) {
        const d = d2(lab, m, c, j)
        if (d < mejorD) {
          mejorD = d
          mejor = j
        }
      }
      asignacion[s] = mejor
      suma[mejor * 3]! += lab[m * 3]!
      suma[mejor * 3 + 1]! += lab[m * 3 + 1]!
      suma[mejor * 3 + 2]! += lab[m * 3 + 2]!
      cuenta[mejor]!++
    }
    let movimiento = 0
    for (let j = 0; j < k; j++) {
      if (cuenta[j] === 0) continue // un cluster vacio conserva su centroide
      for (let e = 0; e < 3; e++) {
        const nuevo = suma[j * 3 + e]! / cuenta[j]!
        movimiento = Math.max(movimiento, Math.abs(nuevo - c[j * 3 + e]!))
        c[j * 3 + e] = nuevo
      }
    }
    if (movimiento < p.corte) break
  }

  // Asignar todos los pixeles de la mascara
  const porCentroide = new Array<number>(k).fill(0)
  const etiquetaDe = new Uint8Array(indices.length)
  for (let q = 0; q < indices.length; q++) {
    let mejor = 0
    let mejorD = Infinity
    for (let j = 0; j < k; j++) {
      const d = d2(lab, q, c, j)
      if (d < mejorD) {
        mejorD = d
        mejor = j
      }
    }
    etiquetaDe[q] = mejor
    porCentroide[mejor]!++
  }

  // Fusionar centroides casi iguales: gastar un slot del AMS en un tono de antialias no sirve
  const grupos = Array.from({ length: k }, (_, j) => ({
    miembros: [j],
    oklab: [c[j * 3]!, c[j * 3 + 1]!, c[j * 3 + 2]!] as Oklab,
    pixeles: porCentroide[j]!,
  })).filter((g) => g.pixeles > 0)
  const hex = (o: Oklab) => rgbAHex(oklabARgb(o))
  for (let fusiono = true; fusiono;) {
    fusiono = false
    buscar: for (let a = 0; a < grupos.length; a++) {
      for (let b = a + 1; b < grupos.length; b++) {
        const ga = grupos[a]!
        const gb = grupos[b]!
        if (deltaE2000(hex(ga.oklab), hex(gb.oklab)) >= p.fusionDeltaE2000) continue
        const total = ga.pixeles + gb.pixeles
        ga.oklab = ga.oklab.map(
          (v, e) => (v * ga.pixeles + gb.oklab[e]! * gb.pixeles) / total,
        ) as Oklab
        ga.pixeles = total
        ga.miembros.push(...gb.miembros)
        grupos.splice(b, 1)
        fusiono = true
        break buscar
      }
    }
  }

  // De mas pixeles a menos: el orden de la paleta es estable y legible
  grupos.sort((a, b) => b.pixeles - a.pixeles)
  const nuevoIndice = new Uint8Array(k)
  grupos.forEach((g, i) => g.miembros.forEach((m) => (nuevoIndice[m] = i)))
  for (let q = 0; q < indices.length; q++) etiquetas[indices[q]!] = nuevoIndice[etiquetaDe[q]!]!

  return {
    paleta: grupos.map((g) => ({ hex: hex(g.oklab), oklab: g.oklab, pixeles: g.pixeles })),
    etiquetas,
  }
}
