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
  /** Ilumina casi al ras y proyecta sombra, para que se lea un relieve de decimas de mm. */
  relieve?: boolean
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
  /** La luz de costado, si la vista es de relieve. Se acomoda al encuadrar. */
  rasante: THREE.DirectionalLight | null
}

function crearEscena(lienzo: HTMLCanvasElement, relieve: boolean): Escena {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.shadowMap.enabled = relieve
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  // Con luz rasante la sombra hace todo el trabajo: el resto de las luces bajan para no lavarla
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8178, relieve ? 0.85 : 2.2))
  const sol = new THREE.DirectionalLight(0xffffff, relieve ? 0.9 : 2)
  sol.position.set(40, -60, 120)
  scene.add(sol)
  let rasante: THREE.DirectionalLight | null = null
  if (relieve) {
    // Casi al ras: con 20 grados, 0,4 mm de relieve proyectan 1 mm de sombra y el dibujo se lee
    rasante = new THREE.DirectionalLight(0xffffff, 2.6)
    rasante.castShadow = true
    rasante.shadow.mapSize.set(2048, 2048)
    rasante.shadow.normalBias = 0.05
    scene.add(rasante, rasante.target)
  }
  // z hacia arriba, como en el slicer
  THREE.Object3D.DEFAULT_UP.set(0, 0, 1)
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 2000)
  camera.up.set(0, 0, 1)
  const controles = new OrbitControls(camera, lienzo)
  controles.enableDamping = true
  controles.enablePan = false
  const grupo = new THREE.Group()
  scene.add(grupo)
  return { renderer, scene, camera, controles, grupo, rasante }
}

/** Pone la camara de modo que entre todo, mirando desde arriba o de tres cuartos. */
function encuadrar(e: Escena, modo: ModoVista) {
  const caja = new THREE.Box3().setFromObject(e.grupo)
  if (caja.isEmpty()) return
  const centro = caja.getCenter(new THREE.Vector3())
  const radio = caja.getSize(new THREE.Vector3()).length() / 2
  // El fov es vertical: en un lienzo angosto y alto hay que alejarse mas para que entre a lo ancho
  const alcance =
    Math.sin(THREE.MathUtils.degToRad(e.camera.fov / 2)) * Math.min(1, e.camera.aspect)
  const distancia = (radio / alcance) * 1.05
  const direccion =
    modo === 'arriba' ? new THREE.Vector3(0, -0.001, 1) : new THREE.Vector3(0.35, -1, 0.9)
  e.camera.position.copy(centro).add(direccion.normalize().multiplyScalar(distancia))
  e.controles.target.copy(centro)
  e.controles.update()
  if (!e.rasante) return
  // Viene casi por el eje de la bisagra, asi los nudillos no tiran sombra sobre las placas
  const desde = new THREE.Vector3(0.25, -0.94, 0.34).normalize().multiplyScalar(radio * 3)
  e.rasante.position.copy(centro).add(desde)
  e.rasante.target.position.copy(centro)
  const sombra = e.rasante.shadow.camera
  sombra.left = -radio
  sombra.right = radio
  sombra.top = radio
  sombra.bottom = -radio
  sombra.near = radio
  sombra.far = radio * 5
  sombra.updateProjectionMatrix()
}

function liberar(grupo: THREE.Group) {
  for (const hijo of [...grupo.children]) {
    const malla = hijo as THREE.Mesh
    malla.geometry.dispose()
    ;(malla.material as THREE.Material).dispose()
    grupo.remove(hijo)
  }
}

export default function Vista3D({ piezas, colores, modo, relieve = false, className }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const escena = useRef<Escena | null>(null)
  const modoActual = useRef(modo)

  // Escena: una vez por montaje
  useEffect(() => {
    const c = lienzo.current
    if (!c) return
    const e = crearEscena(c, relieve)
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
      const antes = e.camera.aspect
      e.camera.aspect = w / h
      e.camera.updateProjectionMatrix()
      // Si el lienzo cambio de forma, lo que entraba puede dejar de entrar
      if (Math.min(1, antes) !== Math.min(1, e.camera.aspect)) encuadrar(e, modoActual.current)
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
    // relieve no cambia en vida de una vista: cada app monta la suya
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // El desfasaje de la sombra se mide sobre la normal, asi que ahi si hacen falta
      if (relieve) geometria.computeVertexNormals()
      // flatShading: las mallas comparten vertices entre caras a 90° y el suavizado las derretiria
      const material = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.55,
        flatShading: true,
      })
      const malla = new THREE.Mesh(geometria, material)
      malla.castShadow = relieve
      malla.receiveShadow = relieve
      e.grupo.add(malla)
    }
  }, [piezas, relieve])

  // Colores: solo materiales
  useEffect(() => {
    escena.current?.grupo.children.forEach((hijo, i) => {
      const material = (hijo as THREE.Mesh).material as THREE.MeshStandardMaterial
      material.color.set(colores[i] ?? '#cccccc')
    })
  }, [colores, piezas])

  // Modo de vista y encuadre
  useEffect(() => {
    modoActual.current = modo
    const e = escena.current
    if (!e) return
    e.grupo.children.forEach((hijo, i) =>
      hijo.position.set(0, 0, modo === 'capas' ? i * SEPARACION_CAPAS : 0),
    )
    encuadrar(e, modo)
  }, [modo, piezas])

  return <canvas ref={lienzo} className={`block size-full touch-none ${className ?? ''}`} />
}
