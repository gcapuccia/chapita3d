# Cuentas · cómo está armado y qué falta configurar

**Fecha:** 2026-09-20 · Proyecto Supabase **chapita3d** (`cplgguhtibrshficpmki`, región San Pablo),
organización TalentoAr, plan gratis (0 USD).

## Cómo funciona

- Se entra **con un enlace al correo**, sin contraseña (`signInWithOtp`). No hay pantalla de registro
  aparte: el primer ingreso crea la cuenta.
- Lo único que sale a internet es **el diseño** (las formas ya trazadas, en mm) cuando alguien toca
  «Guardar en mi cuenta». **La imagen original nunca se sube**, como promete la landing.
- Sin variables de entorno la app funciona igual, sin cuentas (`hayCuentas === false`).

| Pieza | Archivo |
|---|---|
| Cliente (carga diferida: ~70 KB que la landing no paga) | `src/cuenta/cliente.ts` |
| Estado de la sesión y de los llaveros guardados | `src/estado/cuenta.ts` |
| Bloque de ingreso de la landing | `src/cuenta/BloqueCuenta.tsx` |
| Lista de llaveros guardados | `src/paginas/MisLlaveros.tsx` (`/mis-llaveros`) |
| Botón «Guardar en mi cuenta» | `src/paginas/Descargar.tsx` |

## Base de datos

Tabla `public.disenos` (migración `crear_disenos`): `id`, `usuario_id`, `nombre`, `diseno` (jsonb),
`creado_en`, `actualizado_en`. Con **reglas por fila**: cada cuenta solo ve, guarda, edita y borra lo
suyo. `actualizado_en` lo pone un disparador, no el cliente.

## Variables de entorno

`.env.local` (no va al repo) y en Vercel, entorno Producción:

```
VITE_SUPABASE_URL=https://cplgguhtibrshficpmki.supabase.co
VITE_SUPABASE_CLAVE=sb_publishable_…
```

La clave publicable es pública a propósito: sin sesión no puede leer ni escribir nada, porque las
reglas por fila piden `auth.uid()`.

## ⚠️ Lo que falta configurar a mano (una vez)

En el panel de Supabase, proyecto **chapita3d** → *Authentication* → *URL Configuration*:

1. **Site URL:** `https://3dllaveros.vercel.app`
2. **Redirect URLs**, agregar las dos:
   - `https://3dllaveros.vercel.app/**`
   - `http://localhost:5173/**`

Sin esto, el enlace del correo lleva a la dirección por defecto (`localhost:3000`) y no entra.

## ⚠️ El correo tiene un tope bajo

El servidor de correo que viene con Supabase es **solo para probar**: manda muy pocos mensajes por
hora y suele caer en correo no deseado. Para uso real hay que conectar un servidor propio
(*Authentication → SMTP Settings*). Resend regala 3.000 mensajes por mes y alcanza de sobra.

## Pendiente

- Google: hace falta crear credenciales en Google Cloud. El botón está puesto pero apagado.
- Que «Mis llaveros» muestre una miniatura de cada uno.
- Avisar al volver: «Seguí donde lo dejaste» con lo último guardado.
