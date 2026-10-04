// El lienzo donde se edita: dibuja el mapa de etiquetas y traduce lo que hace el dedo (o el mouse)
// a pixeles del mapa.
//
// Todo el dibujo es imperativo sobre un canvas; React solo entra cuando cambia `version`. Con la
// herramienta de manchas, pasar por encima prende la mancha entera ANTES de tocar: asi nadie borra
// medio dibujo sin querer.

import { useCallback, useEffect, useRef } from 'react'
import { FONDO } from '../pipeline/tipos.ts'
import {
  empezarTrazo,
  seguirTrazo,
  terminarTrazo,
  tocarMancha,
  useVector,
} from '../estado/vector.ts'
import { componenteEn } from './pincel.ts'

/** Cuadritos del fondo: los mismos de la vista del recorte. */
const CUADRO = 8
const CUADRO_A = '#1e222a'
const CUADRO_B = '#262b34'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 16

type Vista = { z: number; dx: number; dy: number }

export default function Lienzo({ className }: { className?: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const capa = useRef<HTMLCanvasElement | null>(null)
  const resalte = useRef<HTMLCanvasElement | null>(null)
  const marcados = useRef<Uint32Array | null>(null)
  const vista = useRef<Vista>({ z: 1, dx: 0, dy: 0 })
  const puntero = useRef<{ x: number; y: number } | null>(null)
  const ultimo = useRef<{ x: number; y: number } | null>(null)
  const dedos = useRef(new Map<number, { x: number; y: number }>())
  const gesto = useRef<{ dist: number; cx: number; cy: number } | null>(null)
  const pedido = useRef(0)

  const mapa = useVector((s) => s.mapa)
  const version = useVector((s) => s.version)
  const paleta = useVector((s) => s.conversion?.paleta)
  const herramienta = useVector((s) => s.herramienta)
  const radio = useVector((s) => s.radio)

  // ---------------------------------------------------------------- dibujo

  const pintarCapa = useCallback(() => {
    if (!mapa || !paleta) return
    let c = capa.current
    if (!c || c.width !== mapa.ancho || c.height !== mapa.alto) {
      c = document.createElement('canvas')
      c.width = mapa.ancho
      c.height = mapa.alto
      capa.current = c
      const r = document.createElement('canvas')
      r.width = mapa.ancho
      r.height = mapa.alto
      resalte.current = r
      marcados.current = null
    }
    const ctx = c.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(mapa.ancho, mapa.alto)
    const rgb = paleta.map((p) => {
      const n = Number.parseInt(p.hex.slice(1), 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
    })
    for (let i = 0; i < mapa.etiquetas.length; i++) {
      const color = rgb[mapa.etiquetas[i]!]
      if (!color) continue
      const j = i * 4
      img.data[j] = color[0]
      img.data[j + 1] = color[1]
      img.data[j + 2] = color[2]
      img.data[j + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [mapa, paleta])

  const dibujar = useCallback(() => {
    const el = lienzo.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || !mapa) return
    const dpr = Math.min(devicePixelRatio, 2)
    const ancho = el.clientWidth
    const alto = el.clientHeight
    if (el.width !== Math.round(ancho * dpr) || el.height !== Math.round(alto * dpr)) {
      el.width = Math.round(ancho * dpr)
      el.height = Math.round(alto * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, ancho, alto)

    const { z, dx, dy } = vista.current
    const w = mapa.ancho * z
    const h = mapa.alto * z

    // Los cuadritos marcan lo que es fondo, igual que en la solapa Fondo
    ctx.save()
    ctx.beginPath()
    ctx.rect(dx, dy, w, h)
    ctx.clip()
    for (let y = 0; y < h; y += CUADRO) {
      for (let x = 0; x < w; x += CUADRO) {
        ctx.fillStyle = ((x / CUADRO + y / CUADRO) | 0) % 2 === 0 ? CUADRO_A : CUADRO_B
        ctx.fillRect(dx + x, dy + y, CUADRO, CUADRO)
      }
    }
    ctx.restore()

    ctx.imageSmoothingEnabled = z < 1
    if (capa.current) ctx.drawImage(capa.current, dx, dy, w, h)
    if (resalte.current && marcados.current?.length) {
      ctx.globalAlpha = 0.55
      ctx.drawImage(resalte.current, dx, dy, w, h)
      ctx.globalAlpha = 1
    }

    // El circulo del pincel, para saber cuanto abarca antes de apretar
    const p = puntero.current
    if (p && herramienta !== 'mancha') {
      ctx.beginPath()
      ctx.arc(dx + p.x * z, dy + p.y * z, Math.max(2, radio * z), 0, Math.PI * 2)
      ctx.strokeStyle = '#f5f6f8'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.strokeStyle = '#14161a'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
  }, [mapa, herramienta, radio])

  const pedirDibujo = useCallback(() => {
    if (pedido.current) return
    pedido.current = requestAnimationFrame(() => {
      pedido.current = 0
      dibujar()
    })
  }, [dibujar])

  /** Prende la mancha que se borraria (o se rellenaria) al tocar. */
  const marcar = useCallback(
    (x: number, y: number) => {
      const r = resalte.current
      const ctx = r?.getContext('2d')
      if (!mapa || !r || !ctx) return
      const indices = componenteEn(mapa, x, y)
      const antes = marcados.current
      if (antes?.length === indices?.length && antes?.[0] === indices?.[0]) return

      const img = ctx.getImageData(0, 0, r.width, r.height)
      if (antes) for (const i of antes) img.data[i * 4 + 3] = 0
      if (indices) {
        // Rojo si se va, lima si se rellena
        const borra = mapa.etiquetas[indices[0]!] !== FONDO
        const [cr, cg, cb] = borra ? [255, 169, 169] : [198, 242, 78]
        for (const i of indices) {
          const j = i * 4
          img.data[j] = cr
          img.data[j + 1] = cg
          img.data[j + 2] = cb
          img.data[j + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
      marcados.current = indices
    },
    [mapa],
  )

  const desmarcar = useCallback(() => {
    const r = resalte.current
    const ctx = r?.getContext('2d')
    if (!r || !ctx || !marcados.current) return
    ctx.clearRect(0, 0, r.width, r.height)
    marcados.current = null
  }, [])

  // ---------------------------------------------------------------- encuadre

  const encuadrar = useCallback(() => {
    const el = lienzo.current
    if (!el || !mapa) return
    const z = Math.min(el.clientWidth / mapa.ancho, el.clientHeight / mapa.alto) * 0.94
    vista.current = {
      z,
      dx: (el.clientWidth - mapa.ancho * z) / 2,
      dy: (el.clientHeight - mapa.alto * z) / 2,
    }
    pedirDibujo()
  }, [mapa, pedirDibujo])

  /** Acerca o aleja dejando quieto el punto que esta abajo del cursor. */
  const acercar = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = vista.current
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.z * factor))
      const k = z / v.z
      vista.current = { z, dx: cx - (cx - v.dx) * k, dy: cy - (cy - v.dy) * k }
      pedirDibujo()
    },
    [pedirDibujo],
  )

  useEffect(() => {
    pintarCapa()
    pedirDibujo()
  }, [pintarCapa, pedirDibujo, version])

  useEffect(() => {
    const el = lienzo.current
    if (!el) return
    const observador = new ResizeObserver(() => pedirDibujo())
    observador.observe(el)
    return () => observador.disconnect()
  }, [pedirDibujo])

  // Encuadra cuando llega un dibujo nuevo (otro tamaño de mapa)
  useEffect(encuadrar, [encuadrar])

  // ---------------------------------------------------------------- puntero

  const aMapa = (e: { clientX: number; clientY: number }) => {
    const el = lienzo.current
    if (!el) return { x: 0, y: 0 }
    const caja = el.getBoundingClientRect()
    const { z, dx, dy } = vista.current
    return { x: (e.clientX - caja.left - dx) / z, y: (e.clientY - caja.top - dy) / z }
  }

  const centroYDistancia = () => {
    const [a, b] = [...dedos.current.values()]
    if (!a || !b) return null
    return {
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    }
  }

  const alBajar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = lienzo.current
    if (!el || !mapa) return
    const caja = el.getBoundingClientRect()
    dedos.current.set(e.pointerId, { x: e.clientX - caja.left, y: e.clientY - caja.top })
    // Si el puntero ya no esta activo, capturar tira NotFoundError y no pasa nada
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* sin captura: igual funciona mientras el puntero este encima */
    }

    // Dos dedos: se mueve y se acerca, no se pinta
    if (dedos.current.size >= 2) {
      terminarTrazo()
      ultimo.current = null
      const g = centroYDistancia()
      if (g) gesto.current = g
      return
    }
    if (e.shiftKey || e.button === 1) return // mover con shift o con la rueda apretada

    const p = aMapa(e)
    if (herramienta === 'mancha') {
      tocarMancha(p.x, p.y)
      desmarcar()
    } else {
      empezarTrazo(p.x, p.y)
      ultimo.current = p
    }
    pedirDibujo()
  }

  const alMover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = lienzo.current
    if (!el || !mapa) return
    const caja = el.getBoundingClientRect()
    const pantalla = { x: e.clientX - caja.left, y: e.clientY - caja.top }
    if (dedos.current.has(e.pointerId)) dedos.current.set(e.pointerId, pantalla)

    if (dedos.current.size >= 2) {
      const g = centroYDistancia()
      const antes = gesto.current
      if (g && antes) {
        const v = vista.current
        const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (v.z * g.dist) / antes.dist))
        const k = z / v.z
        vista.current = {
          z,
          dx: g.cx - (antes.cx - v.dx) * k,
          dy: g.cy - (antes.cy - v.dy) * k,
        }
        gesto.current = g
        pedirDibujo()
      }
      return
    }

    // Arrastrar con shift o con la rueda apretada mueve el dibujo
    if (dedos.current.size === 1 && (e.shiftKey || e.buttons === 4)) {
      vista.current = {
        ...vista.current,
        dx: vista.current.dx + e.movementX,
        dy: vista.current.dy + e.movementY,
      }
      pedirDibujo()
      return
    }

    const p = aMapa(e)
    puntero.current = p
    if (ultimo.current) {
      seguirTrazo(ultimo.current.x, ultimo.current.y, p.x, p.y)
      ultimo.current = p
    } else if (herramienta === 'mancha') {
      marcar(p.x, p.y)
    }
    pedirDibujo()
  }

  const alSoltar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dedos.current.delete(e.pointerId)
    if (dedos.current.size < 2) gesto.current = null
    if (ultimo.current) {
      ultimo.current = null
      terminarTrazo()
    }
    pedirDibujo()
  }

  const alSalir = (e: React.PointerEvent<HTMLCanvasElement>) => {
    alSoltar(e)
    puntero.current = null
    desmarcar()
    pedirDibujo()
  }

  const alRodar = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const el = lienzo.current
    if (!el) return
    const caja = el.getBoundingClientRect()
    acercar(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - caja.left, e.clientY - caja.top)
  }

  return (
    <canvas
      ref={lienzo}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSalir}
      onPointerLeave={alSalir}
      onWheel={alRodar}
      className={`block size-full cursor-crosshair touch-none ${className ?? ''}`}
    />
  )
}
