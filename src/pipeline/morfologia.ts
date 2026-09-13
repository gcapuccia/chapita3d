// Transformada de distancia euclidea exacta (Felzenszwalb y Huttenlocher, 2012) y las
// operaciones morfologicas con disco que se construyen encima.
//
// Con la distancia, erosionar o dilatar con un disco de radio r cuesta lo mismo para
// cualquier r: O(pixeles). Con un kernel explicito costaria O(pixeles × r²).

const INFINITO = 1e20

/** Distancia² 1D: f[i] es 0 en los pixeles "objetivo" e INFINITO en el resto. */
function distancia1D(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0
  v[0] = 0
  z[0] = -INFINITO
  z[1] = INFINITO
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!)
    while (s <= z[k]!) {
      k--
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!)
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INFINITO
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++
    const dq = q - v[k]!
    d[q] = dq * dq + f[v[k]!]!
  }
}

/**
 * Distancia² de cada pixel al pixel "objetivo" mas cercano.
 * `bordeEsObjetivo`: si fuera de la imagen cuenta como objetivo (para erosionar hasta el borde).
 */
export function distanciaCuadrada(
  esObjetivo: (i: number) => boolean,
  ancho: number,
  alto: number,
  bordeEsObjetivo = false,
): Float64Array {
  // Con borde objetivo se agrega un marco de 1 pixel alrededor
  const m = bordeEsObjetivo ? 1 : 0
  const w = ancho + 2 * m
  const h = alto + 2 * m
  const grilla = new Float64Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dentro = x >= m && y >= m && x < w - m && y < h - m
      const objetivo = dentro ? esObjetivo((y - m) * ancho + (x - m)) : bordeEsObjetivo
      grilla[y * w + x] = objetivo ? 0 : INFINITO
    }
  }
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grilla[y * w + x]!
    distancia1D(f, h, d, v, z)
    for (let y = 0; y < h; y++) grilla[y * w + x] = d[y]!
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grilla[y * w + x]!
    distancia1D(f, w, d, v, z)
    for (let x = 0; x < w; x++) grilla[y * w + x] = d[x]!
  }
  if (!m) return grilla
  const recortada = new Float64Array(ancho * alto)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) recortada[y * ancho + x] = grilla[(y + 1) * w + (x + 1)]!
  }
  return recortada
}

/**
 * Apertura con un disco de radio `radio` pixeles: borra lo que es mas angosto que 2·radio
 * y conserva intacto lo demas. Devuelve la mascara abierta.
 */
export function apertura(
  mascara: Uint8Array,
  ancho: number,
  alto: number,
  radio: number,
): Uint8Array {
  const r2 = radio * radio
  // Erosion: queda lo que esta a mas de `radio` de cualquier pixel de afuera (o del borde)
  const aFuera = distanciaCuadrada((i) => mascara[i] === 0, ancho, alto, true)
  const erosionada = new Uint8Array(ancho * alto)
  for (let i = 0; i < erosionada.length; i++) erosionada[i] = aFuera[i]! > r2 ? 1 : 0
  // Dilatacion de lo erosionado, limitada a la mascara original
  const aErosionada = distanciaCuadrada((i) => erosionada[i] === 1, ancho, alto)
  const abierta = new Uint8Array(ancho * alto)
  for (let i = 0; i < abierta.length; i++) {
    abierta[i] = mascara[i] === 1 && aErosionada[i]! <= r2 ? 1 : 0
  }
  return abierta
}
