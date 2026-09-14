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

/** Dilatacion con un disco de radio `radio` pixeles (d² <= r²), en O(pixeles). */
export function dilatar(
  mascara: Uint8Array,
  ancho: number,
  alto: number,
  radio: number,
): Uint8Array {
  const d = distanciaCuadrada((i) => mascara[i] === 1, ancho, alto)
  const salida = new Uint8Array(ancho * alto)
  const r2 = radio * radio
  for (let i = 0; i < salida.length; i++) salida[i] = d[i]! <= r2 ? 1 : 0
  return salida
}

/**
 * Esqueleto de Zhang-Suen (1984). Recorre solo los pixeles encendidos: sobre partes finas termina en
 * pocas pasadas (una por pixel de medio ancho).
 * ⚠️ Borra entera una diagonal de 2 px de ancho: quien lo usa tiene que contemplar ese caso.
 */
export function esqueleto(mascara: Uint8Array, ancho: number, alto: number): Uint8Array {
  const m = new Uint8Array(mascara)
  let activos: number[] = []
  for (let i = 0; i < m.length; i++) if (m[i]) activos.push(i)
  const en = (x: number, y: number) =>
    x < 0 || y < 0 || x >= ancho || y >= alto ? 0 : m[y * ancho + x]!
  for (let cambio = true; cambio;) {
    cambio = false
    for (const paso of [0, 1]) {
      const borrar: number[] = []
      for (const i of activos) {
        if (!m[i]) continue
        const x = i % ancho
        const y = (i / ancho) | 0
        const p2 = en(x, y - 1)
        const p3 = en(x + 1, y - 1)
        const p4 = en(x + 1, y)
        const p5 = en(x + 1, y + 1)
        const p6 = en(x, y + 1)
        const p7 = en(x - 1, y + 1)
        const p8 = en(x - 1, y)
        const p9 = en(x - 1, y - 1)
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
        if (b < 2 || b > 6) continue
        const s = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
        let a = 0
        for (let k = 0; k < 8; k++) if (!s[k] && s[k + 1]) a++
        if (a !== 1) continue
        if (paso === 0) {
          if (p2 * p4 * p6 || p4 * p6 * p8) continue
        } else if (p2 * p4 * p8 || p2 * p6 * p8) continue
        borrar.push(i)
      }
      for (const i of borrar) m[i] = 0
      if (borrar.length) cambio = true
    }
    activos = activos.filter((i) => m[i])
  }
  return m
}

/** Componentes conexas (8 u 4 vecinos). Llama `alVisitar` con los indices de cada una. */
export function componentes(
  esParte: (i: number) => boolean,
  ancho: number,
  alto: number,
  ocho: boolean,
  alVisitar: (miembros: Int32Array) => void,
): void {
  const n = ancho * alto
  const visto = new Uint8Array(n)
  const cola = new Int32Array(n)
  for (let inicio = 0; inicio < n; inicio++) {
    if (visto[inicio] || !esParte(inicio)) continue
    let fin = 0
    cola[fin++] = inicio
    visto[inicio] = 1
    for (let c = 0; c < fin; c++) {
      const i = cola[c]!
      const x = i % ancho
      const y = (i / ancho) | 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= alto) continue
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || (!ocho && dx && dy)) continue
          const xx = x + dx
          if (xx < 0 || xx >= ancho) continue
          const j = yy * ancho + xx
          if (visto[j] || !esParte(j)) continue
          visto[j] = 1
          cola[fin++] = j
        }
      }
    }
    alVisitar(cola.slice(0, fin))
  }
}

/** Pixeles en 0 que NO se alcanzan desde el borde de la imagen pasando por ceros (4 vecinos). */
export function encerrados(mascara: Uint8Array, ancho: number, alto: number): Uint8Array {
  const n = ancho * alto
  const afuera = new Uint8Array(n)
  const cola = new Int32Array(n)
  let fin = 0
  const sembrar = (i: number) => {
    if (mascara[i] === 0 && !afuera[i]) {
      afuera[i] = 1
      cola[fin++] = i
    }
  }
  for (let x = 0; x < ancho; x++) {
    sembrar(x)
    sembrar((alto - 1) * ancho + x)
  }
  for (let y = 0; y < alto; y++) {
    sembrar(y * ancho)
    sembrar(y * ancho + ancho - 1)
  }
  for (let c = 0; c < fin; c++) {
    const i = cola[c]!
    const x = i % ancho
    if (x > 0) sembrar(i - 1)
    if (x < ancho - 1) sembrar(i + 1)
    if (i >= ancho) sembrar(i - ancho)
    if (i + ancho < n) sembrar(i + ancho)
  }
  const salida = new Uint8Array(n)
  for (let i = 0; i < n; i++) salida[i] = mascara[i] === 0 && !afuera[i] ? 1 : 0
  return salida
}
