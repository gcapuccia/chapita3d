// Cliente de Supabase: es lo unico de la app que habla con un servidor.
//
// Se guarda el DISEÑO (las formas ya trazadas, en mm), nunca la imagen original: esa no sale del
// navegador de quien la subio, como promete la landing.
//
// Si no hay variables de entorno, la app funciona igual: sin cuentas y sin guardar nada.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Diseno } from '../diseno/tipos.ts'

export type FilaDiseno = {
  id: string
  usuario_id: string
  nombre: string
  diseno: Diseno
  creado_en: string
  actualizado_en: string
}

type Esquema = {
  public: {
    Tables: {
      disenos: {
        Row: FilaDiseno
        Insert: { usuario_id: string; nombre: string; diseno: Diseno; id?: string }
        Update: { nombre?: string; diseno?: Diseno }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_CLAVE

let cliente: Promise<SupabaseClient<Esquema>> | null = null

/**
 * null cuando la app corre sin cuentas (sin variables de entorno).
 * La libreria se baja recien cuando alguien la necesita: son ~70 KB que la landing no paga.
 */
export function supabase(): Promise<SupabaseClient<Esquema>> | null {
  if (!url || !clave) return null
  cliente ??= import('@supabase/supabase-js').then((m) =>
    m.createClient<Esquema>(url, clave, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  )
  return cliente
}

export const hayCuentas = Boolean(url && clave)
