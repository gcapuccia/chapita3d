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

## Incremento 1b · Editor de color y grosor de líneas (2026-09-15)

Pedido del usuario después de probar su logo: poder cambiar el grosor de las líneas y ver otros
colores de filamento.

| Qué | Dónde | Cómo funciona |
|---|---|---|
| Tocar un color abre su editor | `src/crear/SolapaColores.tsx` + `src/crear/EditorDeColor.tsx` | La fila se despliega; queda un solo editor abierto |
| Paleta de 24 colores + color propio | `src/datos/paleta.ts`, `cambiarColorDeFilamento` | Es solo del diseño: se ve en la vista 3D al toque, sin reprocesar la imagen |
| Grosor de las líneas de ESE color | `ParamsPipeline.grosorPorHex` → `ParamsLimpiar.grosorPorColorMm` | Deslizador de 0,8 a 3 mm, con «Volver al automático». Reprocesa con 400 ms de espera: **1,6 s** de punta a punta en La Ronda |
| Aviso de fragilidad | `GROSOR_LINEAS_SEGURO_MM = 2,0` | Abajo de 2 mm avisa «puede salir frágil», pero deja seguir (decisión del usuario) |
| Lo elegido sobrevive al reprocesar | `colorElegido` en `estado/documento.ts`, `Filamento.deLaImagen` | La identidad de un filamento es el color de la imagen que cayó en él, no su lugar: si al engrosar quedan menos colores, el elegido no se pierde |

Detalles medidos:
- Elegir un grosor a mano **no** apaga el engrosado automático de los demás colores (`tests/arreglos.test.ts`).
- Con 2,6 mm las letras de un logo se funden entre sí: es esperable y se ve en la vista 3D antes de descargar.

También se arregló el layout: con el editor abierto, el panel derecho estiraba la página y la vista 3D
quedaba recortada. Ahora en pantallas grandes la página ocupa el alto de la ventana, el panel tiene su
propio scroll, y la cámara se reencuadra cuando el lienzo cambia de forma (antes solo usaba el campo
de visión vertical).

## Incremento 1c · La app en Modo taller (2026-09-22)

Se migró `/crear` y `/descargar` a la paleta oscura de la marca, siguiendo el turno 7 del diseño
(`docs/marca/diseno/Chapita3d.dc.html`). Los colores salen del mapa que da el propio diseño (7b):

| Antes | Ahora |
|---|---|
| `stone-50` panel | `carbon` #14161A |
| `white` header, pie, tarjetas | `grafito` #1E222A |
| `stone-100` lienzo | `lienzo` #101317 |
| `stone-200` / `300` bordes | `borde` #2A2E36 / `borde-fuerte` #3A3F49 |
| `stone-900` botón y solapa activa | `lima` #C6F24E con texto carbón |
| `stone-700` / `500` texto | `tiza-suave` #C3C8D2 / `tenue` #9AA1AE |
| `amber-50` / `950` aviso | `aviso` #2A2312 / `aviso-texto` #F5D08A |
| `red-50` / `900` bloqueante | `alerta` #2C1618 / `alerta-texto` #FFA9A9 |

No cambió ningún texto, ninguna medida ni el alto mínimo de 44 px de los controles.

**El marco compartido** (`src/marco/Encabezado.tsx` + `src/marco/apps.ts`): marca a la izquierda,
conmutador de apps al lado, los pasos de la app en el medio y su botón principal a la derecha. Lo usan
`/llaveros/crear` y `/llaveros/descargar`.

**Las direcciones se mudaron** a `/llaveros/crear` y `/llaveros/descargar`, como recomienda el diseño,
así sumar la segunda app es agregarla a `APPS` y crear su carpeta de páginas. Las direcciones viejas
redirigen solas.

Además: el damero de la solapa Fondo ahora es oscuro, el color elegido en la paleta se marca con un
anillo lima, y las capturas de la landing (`public/marca/paso-*.png`, `resuelve-4.png`) se rehicieron
con la app oscura.
