// La cuenta y los llaveros guardados. Aparte del documento actual (estado/documento.ts) porque
// es lo unico que sale a internet.

import { create } from 'zustand'
import { supabase, type FilaDiseno } from '../cuenta/cliente.ts'
import type { Diseno } from '../diseno/tipos.ts'

export type Guardado = { id: string; nombre: string; actualizadoEn: string }

type Estado = {
  /** null = sin cuenta. undefined = todavia no se sabe (arrancando). */
  correo: string | null | undefined
  usuarioId: string | null
  enviando: boolean
  /** Correo al que se acaba de mandar el enlace. */
  enviadoA: string | null
  error: string | null
  guardando: boolean
  guardados: Guardado[] | null
}

export const useCuenta = create<Estado>(() => ({
  correo: undefined,
  usuarioId: null,
  enviando: false,
  enviadoA: null,
  error: null,
  guardando: false,
  guardados: null,
}))

const set = useCuenta.setState
const get = useCuenta.getState

/** Se llama una vez al arrancar la app. */
export function escucharCuenta(): void {
  const pedido = supabase()
  if (!pedido) {
    set({ correo: null })
    return
  }
  void pedido.then(async (sb) => {
    const { data } = await sb.auth.getSession()
    set({ correo: data.session?.user.email ?? null, usuarioId: data.session?.user.id ?? null })
    sb.auth.onAuthStateChange((_evento, sesion) => {
      set({
        correo: sesion?.user.email ?? null,
        usuarioId: sesion?.user.id ?? null,
        guardados: null,
        enviadoA: null,
      })
    })
  })
}

/** Manda el enlace de ingreso. El correo no se guarda en ningun lado hasta que la persona entra. */
export async function mandarEnlace(correo: string): Promise<boolean> {
  const sb = await supabase()
  if (!sb) return false
  set({ enviando: true, error: null, enviadoA: null })
  const { error } = await sb.auth.signInWithOtp({
    email: correo.trim(),
    options: { emailRedirectTo: `${location.origin}/mis-llaveros` },
  })
  set({ enviando: false, enviadoA: error ? null : correo.trim(), error: error?.message ?? null })
  return !error
}

export async function salir(): Promise<void> {
  await (await supabase())?.auth.signOut()
  set({ correo: null, usuarioId: null, guardados: null })
}

// ------------------------------------------------------------------ llaveros guardados

export async function listarGuardados(): Promise<void> {
  const sb = await supabase()
  const { usuarioId } = get()
  if (!sb || !usuarioId) return
  const { data, error } = await sb
    .from('disenos')
    .select('id, nombre, actualizado_en')
    .order('actualizado_en', { ascending: false })
  if (error) {
    set({ error: error.message })
    return
  }
  const filas = (data ?? []) as Pick<FilaDiseno, 'id' | 'nombre' | 'actualizado_en'>[]
  set({
    guardados: filas.map((f) => ({ id: f.id, nombre: f.nombre, actualizadoEn: f.actualizado_en })),
    error: null,
  })
}

/** Guarda (o actualiza, si ya existe uno con ese id) el diseño de la cuenta. */
export async function guardarDiseno(diseno: Diseno): Promise<boolean> {
  const sb = await supabase()
  const { usuarioId } = get()
  if (!sb || !usuarioId) return false
  set({ guardando: true, error: null })
  const { error } = await sb
    .from('disenos')
    .upsert({ id: diseno.id, usuario_id: usuarioId, nombre: diseno.nombre, diseno })
  set({ guardando: false, error: error?.message ?? null, guardados: null })
  return !error
}

export async function traerDiseno(id: string): Promise<Diseno | null> {
  const sb = await supabase()
  if (!sb) return null
  const { data, error } = await sb.from('disenos').select('diseno').eq('id', id).single()
  if (error || !data) {
    set({ error: error?.message ?? 'No pude abrirlo' })
    return null
  }
  return (data as { diseno: Diseno }).diseno
}

export async function borrarGuardado(id: string): Promise<void> {
  const sb = await supabase()
  if (!sb) return
  const { error } = await sb.from('disenos').delete().eq('id', id)
  if (error) {
    set({ error: error.message })
    return
  }
  set({ guardados: (get().guardados ?? []).filter((g) => g.id !== id) })
}
