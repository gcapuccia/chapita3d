// Escritor PNG minimo (RGBA 8 bits, sin filtros) para poder mirar el banco. Sin dependencias.

import { deflateSync } from 'node:zlib'
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
