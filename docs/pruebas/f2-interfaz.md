# Fase 2 · La interfaz, incremento 1

**Fecha:** 2026-09-13 · **Estado:** ✅ recorrido completo landing → Crear (3 solapas) → Descargar, probado en el navegador en escritorio y en celular (375 px) · ⏳ falta probarlo en un celular real y con fotos reales

## Qué quedó hecho

| Pieza | Archivos |
|---|---|
| Rutas sin librería (History API) | `src/ruta.ts`, `src/App.tsx` (Crear y Descargar con carga diferida: three.js no pesa en la landing) |
| Estado del documento | `src/estado/documento.ts` (zustand), `src/estado/motor.ts` (workers únicos, precalentados en la landing) |
| Textos | `src/i18n/es.ts` + `tests/textos.test.ts` (lista negra de jerga, también sobre los mensajes de `drc.ts` y `diagnostico.ts`) |
| Landing | `src/paginas/Inicio.tsx`: arrastrar y soltar, "Sacar una foto" en celular, 3 muestras (`public/muestras/`, generadas del banco sintético con `node tests/banco/generar-muestras.ts`), consejos, aviso de derechos, errores en línea |
| Crear | `src/paginas/Crear.tsx`, `src/crear/*`: overlay de 4 hitos con Cancelar, vista de la máscara, vista 3D (Arriba / 3D / Capas), solapas Fondo, Colores y Llavero, franja de avisos |
| Descargar | `src/paginas/Descargar.tsx`: resumen, consejo de purga, botón único con el peso del ZIP, selector de slicer (estrella + pasos, distintos para un solo filamento), lista de cambios de filamento, plan B archivo por archivo (`desarmarZip`), guardar proyecto |

## Probado en el navegador

| Caso | Resultado |
|---|---|
| Muestra Logo / Dibujo / Silueta → Crear | ✅ procesa en < 1 s, vista 3D bien |
| Cambiar tipo de imagen (Foto, Silueta) | ✅ reprocesa con overlay y miniatura |
| Colores: 4 pedidos, la imagen tiene 3 | ✅ avisa "los muy parecidos se juntan solos" |
| Impresora de 1 filamento | ✅ franjas, lista "Capa 12 (Z = 2,40 mm) → poné NEGRO", pasos propios, estrella en la pieza entera |
| Texto "Guido" | ✅ se agrega debajo, se actualiza mientras se escribe |
| Descargar | ✅ ZIP de 297 KB (a ras, 4 colores) y 103 KB (apilado) |
| HEIC, .txt, proyecto.json inválido | ✅ mensaje claro en la landing |
| Guardar proyecto → abrirlo | ✅ mismas medidas, abre en Llavero con aviso "sin la imagen original" |
| Celular 375 px | ✅ landing con cámara/galería, solapas en una línea, barra inferior fija |

## Arreglado durante la prueba

- La miniatura del overlay salía rota: StrictMode revocaba la URL del archivo.
- Enter en el texto no hacía nada con la automatización: ahora el texto se aplica mientras se escribe (con 300 ms de espera).
- Al borrar el texto quedaba un filamento negro huérfano.
- Sin imagen (proyecto abierto) se veían ✓ y "Atrás" hacia solapas bloqueadas.
- "slot" → "lugar"; en celular el botón Descargar del encabezado partía la barra en dos.
- Vite reoptimizaba three/zustand/opentype en caliente (504): declaradas en `optimizeDeps.include`.

## Observaciones

- El tipo **Silueta** sobre la muestra del gato saca solo los trazos (queda un contorno). Es el comportamiento del preset (umbral adaptativo), no un error de la interfaz; "Automático" elige Dibujo y sale bien.
- La purga sigue siendo el valor **PROVISORIO** (400 mm³ por cambio): el consejo "imprimí 6 juntos" depende de calibrarla.
- `Vista3D` pesa 554 KB (three.js); se carga después de la landing.

## Queda para el incremento 2

Editar la máscara (pincel, varita, tolerancia, deshacer), mover/escalar el dibujo, el agujero y el texto con el mouse, cambiar/reordenar/fusionar filamentos, guardar diseños en el navegador ("Seguí donde lo dejaste") y "versión para un solo filamento" al descargar.
