// Vista 3D con three puro (plan §6: se reemplaza por R3F en la Fase 5).
// Cambiar un filamento NO recalcula geometria: solo cambia el color de un material (plan §4.4).

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { PiezaExport } from '../export/tipos.ts'

export type ModoVista = 'arriba' | '3d' | 'capas'

type Props = {
  piezas: PiezaExport[]
  /** Color de cada pieza, en el mismo orden. */
  colores: string[]
  modo: ModoVista
  className?: string
}

/** mm entre piezas en la vista explotada por capas. */
const SEPARACION_CAPAS = 4

type Escena = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controles: OrbitControls
  grupo: THREE.Group
}

function crearEscena(lienzo: HTMLCanvasElement): Escena {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8178, 2.2))
  const sol = new THREE.DirectionalLight(0xffffff, 2)
  sol.position.set(40, -60, 120)
  scene.add(sol)
  // z hacia arriba, como en el slicer
  THREE.Object3D.DEFAULT_UP.set(0, 0, 1)
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 2000)
  camera.up.set(0, 0, 1)
  const controles = new OrbitControls(camera, lienzo)
  controles.enableDamping = true
  controles.enablePan = false
  const grupo = new THREE.Group()
  scene.add(grupo)
  return { renderer, scene, camera, controles, grupo }
}

function liberar(grupo: THREE.Group) {
  for (const hijo of [...grupo.children]) {
    const malla = hijo as THREE.Mesh
    malla.geometry.dispose()
    ;(malla.material as THREE.Material).dispose()
    grupo.remove(hijo)
  }
}

export default function Vista3D({ piezas, colores, modo, className }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const escena = useRef<Escena | null>(null)

  // Escena: una vez por montaje
  useEffect(() => {
    const c = lienzo.current
    if (!c) return
    const e = crearEscena(c)
    escena.current = e
    let cuadro = 0
    const animar = () => {
      e.controles.update()
      e.renderer.render(e.scene, e.camera)
      cuadro = requestAnimationFrame(animar)
    }
    const ajustar = () => {
      const { clientWidth: w, clientHeight: h } = c
      if (!w || !h) return
      e.renderer.setSize(w, h, false)
      e.camera.aspect = w / h
      e.camera.updateProjectionMatrix()
    }
    const observador = new ResizeObserver(ajustar)
    observador.observe(c)
    ajustar()
    animar()
    return () => {
      cancelAnimationFrame(cuadro)
      observador.disconnect()
      liberar(e.grupo)
      e.controles.dispose()
      e.renderer.dispose()
      escena.current = null
    }
  }, [])

  // Geometria: solo cuando cambian las piezas
  useEffect(() => {
    const e = escena.current
    if (!e) return
    liberar(e.grupo)
    for (const p of piezas) {
      const geometria = new THREE.BufferGeometry()
      geometria.setAttribute('position', new THREE.BufferAttribute(p.vertices, 3))
      geometria.setIndex(new THREE.BufferAttribute(p.indices, 1))
      // flatShading: las mallas comparten vertices entre caras a 90° y el suavizado las derretiria
      const material = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.55,
        flatShading: true,
      })
      e.grupo.add(new THREE.Mesh(geometria, material))
    }
  }, [piezas])

  // Colores: solo materiales
  useEffect(() => {
    escena.current?.grupo.children.forEach((hijo, i) => {
      const material = (hijo as THREE.Mesh).material as THREE.MeshStandardMaterial
      material.color.set(colores[i] ?? '#cccccc')
    })
  }, [colores, piezas])

  // Modo de vista y encuadre
  useEffect(() => {
    const e = escena.current
    if (!e) return
    e.grupo.children.forEach((hijo, i) =>
      hijo.position.set(0, 0, modo === 'capas' ? i * SEPARACION_CAPAS : 0),
    )
    const caja = new THREE.Box3().setFromObject(e.grupo)
    if (caja.isEmpty()) return
    const centro = caja.getCenter(new THREE.Vector3())
    const radio = caja.getSize(new THREE.Vector3()).length() / 2
    const distancia = (radio / Math.sin(THREE.MathUtils.degToRad(e.camera.fov / 2))) * 1.05
    const direccion =
      modo === 'arriba' ? new THREE.Vector3(0, -0.001, 1) : new THREE.Vector3(0.35, -1, 0.9)
    e.camera.position.copy(centro).add(direccion.normalize().multiplyScalar(distancia))
    e.controles.target.copy(centro)
    e.controles.update()
  }, [modo, piezas])

  return <canvas ref={lienzo} className={`block size-full touch-none ${className ?? ''}`} />
}
