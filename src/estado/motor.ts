// Los dos workers como singletons de modulo: arrancan en la landing (plan §4.1) y sobreviven a los
// montajes de React. Cancelar termina el de imagen y lo reemplaza por uno nuevo.

import { crearClienteGeometria, crearClienteImagen } from '../workers/clientes.ts'

let imagen: ReturnType<typeof crearClienteImagen> | null = null
let geometria: ReturnType<typeof crearClienteGeometria> | null = null

export function clienteImagen() {
  imagen ??= crearClienteImagen()
  return imagen.api
}

export function clienteGeometria() {
  geometria ??= crearClienteGeometria()
  return geometria.api
}

/** Arranca los workers sin usarlos todavia: el costo de carga queda detras de elegir el archivo. */
export function precalentar(): void {
  clienteImagen()
  void clienteGeometria().cargar()
}

/** Cancelar un proceso de imagen: worker.terminate() y uno nuevo (plan §4.2). */
export function reiniciarImagen(): void {
  imagen?.terminar()
  imagen = null
}
