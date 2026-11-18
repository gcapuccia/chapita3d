// PNG minimo (escribe RGBA 8 bits sin filtros, lee RGB y RGBA) para poder mirar el banco. Sin dependencias.

import { deflateSync, inflateSync } from 'node:zlib'
import type { ImagenRGBA } from '../../src/pipeline/tipos.ts'

const TABLA = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc(datos: Uint8Array): number {
  let c = -1
  for (const b of datos) c = TABLA[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function bloque(tipo: string, datos: Uint8Array): Buffer {
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const suma = Buffer.alloc(4)
  suma.writeUInt32BE(crc(cuerpo))
  return Buffer.concat([largo, cuerpo, suma])
}

export function escribirPng(img: ImagenRGBA): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(img.ancho, 0)
  ihdr.writeUInt32BE(img.alto, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  const filas = Buffer.alloc((img.ancho * 4 + 1) * img.alto)
  for (let y = 0; y < img.alto; y++) {
    const o = y * (img.ancho * 4 + 1)
    filas[o] = 0 // filtro "ninguno"
    filas.set(img.pixeles.subarray(y * img.ancho * 4, (y + 1) * img.ancho * 4), o + 1)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloque('IHDR', ihdr),
    bloque('IDAT', deflateSync(filas, { level: 9 })),
    bloque('IEND', new Uint8Array()),
  ])
}

/** Lee un PNG de 8 bits RGB o RGBA sin entrelazar: alcanza para las imagenes de prueba del repo. */
export function leerPng(archivo: Buffer): ImagenRGBA {
  const idat: Buffer[] = []
  let [ancho, alto, canales] = [0, 0, 0]
  for (let p = 8; p < archivo.length;) {
    const largo = archivo.readUInt32BE(p)
    const tipo = archivo.toString('ascii', p + 4, p + 8)
    const datos = archivo.subarray(p + 8, p + 8 + largo)
    if (tipo === 'IHDR') {
      ancho = datos.readUInt32BE(0)
      alto = datos.readUInt32BE(4)
      if (datos[8] !== 8 || (datos[9] !== 2 && datos[9] !== 6) || datos[12] !== 0)
        throw new Error('PNG no soportado')
      canales = datos[9] === 6 ? 4 : 3
    }
    if (tipo === 'IDAT') idat.push(datos)
    p += 12 + largo
  }
  const crudo = inflateSync(Buffer.concat(idat))
  const paso = ancho * canales
  const pixeles = new Uint8ClampedArray(ancho * alto * 4)
  let previa = new Uint8Array(paso)
  for (let y = 0; y < alto; y++) {
    const inicio = y * (paso + 1)
    const filtro = crudo[inicio]!
    const fila = new Uint8Array(paso)
    for (let x = 0; x < paso; x++) {
      const a = x >= canales ? fila[x - canales]! : 0
      const b = previa[x]!
      const c = x >= canales ? previa[x - canales]! : 0
      const predicho = [
        0,
        a,
        b,
        (a + b) >> 1,
        Math.abs(b - c) <= Math.abs(a - c) && Math.abs(b - c) <= Math.abs(a + b - 2 * c)
          ? a
          : Math.abs(a - c) <= Math.abs(a + b - 2 * c)
            ? b
            : c,
      ][filtro]!
      fila[x] = crudo[inicio + 1 + x]! + predicho
    }
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4
      pixeles[i] = fila[x * canales]!
      pixeles[i + 1] = fila[x * canales + 1]!
      pixeles[i + 2] = fila[x * canales + 2]!
      pixeles[i + 3] = canales === 4 ? fila[x * canales + 3]! : 255
    }
    previa = fila
  }
  return { ancho, alto, pixeles }
}
