# Plan A · MVP primero: de carpeta vacía a "bajo un 3MF que imprime bien"

> **Rol:** arquitecto de software. **Fecha:** 2026-09-11.
> **Insumos:** `docs/01-stack-tecnologico.md`, `docs/02-costos-servicios.md`, `docs/research/audit-01-pipeline.md`, `docs/research/audit-02-3mf-impresion.md`, `docs/research/audit-03-licencias-competencia.md`.
> **Ángulo:** MVP primero. El objetivo no es "el producto completo", es **que exista algo útil y descargable lo antes posible**, recortando sin piedad. El editor tipo Tinkercad entra después, en fases, sin reescribir nada.

---

## Apuesta central del plan (leer esto aunque no leas el resto)

**Se construye al revés: primero el archivo, después la imagen.**

El riesgo #1 del proyecto no es el procesamiento de imagen (la auditoría 01 dice que es viable y son milisegundos). El riesgo #1 es que **el 3MF no abra bien en el slicer**, porque el formato es propietario, cambia entre versiones y **no se puede automatizar la verificación**: alguien tiene que abrir Bambu Studio y mirar. Si ese riesgo se descubre en la semana 7, el proyecto se cae en la semana 7.

Por eso el **Hito 0 escribe un 3MF a mano con dos cubos de colores distintos y lo abre en los tres slicers, antes de tocar una sola línea de procesamiento de imagen.** Son 3 días sin nada visible para el usuario y es la mejor inversión del plan.

La segunda apuesta: **el MVP no es un editor, es un asistente de 5 pasos.** El usuario no elige nada que no entienda. La "edición" del MVP son tres manipulaciones directas (mover/escalar la imagen, arrastrar el agujero, una línea de texto). El Tinkercad completo llega en la Fase 4, sobre el mismo modelo de documento que el MVP ya escribe.

---

## Índice

1. [Alcance del MVP y definición de "listo"](#1-alcance-del-mvp-y-definición-de-listo)
2. [Flujo de usuario, pantalla por pantalla](#2-flujo-de-usuario-pantalla-por-pantalla)
3. [Arquitectura](#3-arquitectura)
4. [Estructura de carpetas y módulos](#4-estructura-de-carpetas-y-módulos)
5. [El pipeline de conversión, paso a paso](#5-el-pipeline-de-conversión-paso-a-paso)
6. [El editor estilo Tinkercad (Fase 4)](#6-el-editor-estilo-tinkercad-fase-4)
7. [Exportación](#7-exportación)
8. [Modelo de datos y costuras para escalar](#8-modelo-de-datos-y-costuras-para-escalar)
9. [Fases e hitos numerados](#9-fases-e-hitos-numerados)
10. [Plan de pruebas](#10-plan-de-pruebas)
11. [Costos por fase y riesgos](#11-costos-por-fase-y-riesgos)
12. [Supuestos que asumí](#12-supuestos-que-asumí)

---

## 0. Decisiones ya tomadas (para no volver a discutirlas)

| Tema | Decisión | Fuente |
|---|---|---|
| Dónde corre todo | **Navegador**, 100%. Cero servidor en el MVP. | doc 02 §6: US$0/mes; doc 01 §5.1 |
| Hosting | **Cloudflare Workers (static assets)**, deploy desde GitHub | doc 02 §2: único gratis con uso comercial |
| Geometría | **`manifold-3d` 3.5.x** y nada más. Sin `clipper2-ts`, sin `three-bvh-csg` | audit-01 §5 |
| Vectorización | **`d3-contour` + `simplify-js`**, detrás de una interfaz `Trazador` | audit-01 §3 |
| Cuantización | **k-means++ en OKLab** (`ml-kmeans`) + ΔE2000 (`culori`) solo sobre los N centroides | audit-01 §2.3 |
| Dithering | **Nunca.** Ni como opción oculta | audit-01 §2.2 |
| 3MF | **Escritor propio con `fflate`**, dos perfiles: Bambu/Orca y Prusa. Sin `basematerials`. Con `<metadata name="Application">BambuStudio-…</metadata>` | audit-02 §1.1, §1.2 |
| Pintado por caras | **Nunca** | audit-02 §2 |
| COOP/COEP | **No poner las cabeceras.** Ni Manifold ni OpenCV usan SharedArrayBuffer | audit-01 §4.3 |
| HEIC | **No soportar.** `libheif-js`/`heic2any` son LGPL-3.0 | audit-01 §4.4 |
| IA | **No**, en ninguna fase del plan | requisito del proyecto |
| Idioma | **Español** solo, con los textos en un único archivo | audit-03 §2.2 punto 6 |

---

## 1. Alcance del MVP y definición de "listo"

### 1.1 Lo que ENTRA (lista cerrada)

**Entrada**
- Subir PNG, JPG o WebP, hasta 25 MB, hasta 8000 px de lado. Arrastrar, botón o pegar del portapapeles.
- 3 imágenes de ejemplo en el propio cargador ("probá con esto").
- 3 presets de entrada: **Logo/Dibujo**, **Foto**, **Silueta (1 color)**.

**Recorte de fondo (sin IA, sin OpenCV)**
- Canal alfa si existe (umbral 128).
- Flood fill desde los 4 bordes con tolerancia ajustable en vivo.
- Varita mágica: click = sumar al fondo, Alt+click = quitar del fondo.
- Pincel borrar/restaurar con tamaño ajustable, zoom y pan.
- Deshacer/rehacer **solo de la máscara** (buffer propio de 20 pasos, no entra al documento).
- Erosión anti-halo de 1 px, siempre activa.
- Preset "Foto": **clasificación por cluster** — se cuantiza primero y el usuario clickea qué colores son fondo (audit-01 §1.4).

**Color**
- k-means++ en OKLab sobre muestra de 30.000 px. N de 2 a 6, por defecto 4.
- Mapeo de los N centroides a una paleta de filamentos reales (JSON propio, ~24 colores PLA) con ΔE2000.
- El usuario puede: cambiar el color de un slot, fusionar dos colores, fijar un color, reordenar slots.
- Aviso de colisión ("estos dos te van a quedar iguales").

**Geometría del llavero**
- Silueta + contorno (offset 1.5 mm) + pestaña de argolla + agujero.
- Dos topologías de color: **A ras (AMS/multimaterial)** y **Apilado (cambio manual de filamento)**.
- Una línea de texto opcional, 3 fuentes OFL incluidas, movible y escalable.
- Mover, rotar y escalar la imagen dentro de la placa. Arrastrar el agujero.
- Presets de espesor: Delgado (1.6 mm) · **Estándar (3.0 mm)** · Reforzado (4.0 mm).

**Validaciones (DRC) visibles antes de descargar**
- Detalle menor a 0.8 mm, islas menores a 1 mm², anillo del agujero menor a 2 mm, colores flotantes en modo apilado, alturas que no son múltiplo de la capa, más colores que slots.

**Salida**
- Un botón "Descargar" → un ZIP con: `*_bambu-orca.3mf`, `*_prusa.3mf`, `stl/` por color, `INSTRUCCIONES.txt`.
- Estimación de gramos de pieza **y de purga**.

**Infraestructura mínima**
- Autoguardado local (IndexedDB) del documento + la imagen normalizada, para sobrevivir a un refresh o a que iOS mate la pestaña.
- "Descargar proyecto (.json)" y "Abrir proyecto".
- 4 páginas estáticas: Términos, Privacidad, **Compatibilidad** (qué versiones de slicer probamos), Licencias.
- Cloudflare Web Analytics (sin cookies) con 6 eventos de embudo.

### 1.2 Lo que NO entra, y por qué NO cierra la puerta

| Fuera del MVP | Por qué se corta | Costura que queda preparada |
|---|---|---|
| **OpenCV.js / GrabCut** | 3,75 MB gz, riesgo real de que iOS mate la pestaña (audit-01 §4.4), y sirve solo para fotos — que es justo donde peor anda (60–70% con fondo simple, 30–50% con fondo complejo). El preset "Foto" por clasificación de clusters cuesta 50 líneas y suele andar mejor. | Interfaz `Recortador` con implementación `RecorteClasico`. Agregar `RecorteGrabCut` con `import()` diferido es un archivo nuevo, cero cambios en el resto. |
| **Editor tipo Tinkercad completo** (multi-pieza, agrupar, alinear, duplicar, formas libres, deshacer del documento) | Es el mayor riesgo de cronograma de todo el proyecto (doc 01 §7 riesgo 8) y no es lo que hace falta para que alguien se lleve un archivo imprimible. | El MVP ya escribe el documento `Diseno` completo con `piezas[]`; solo que el asistente crea 3–5 piezas en vez de 40. La Fase 4 agrega herramientas, no cambia el modelo. |
| **React Three Fiber + drei** | Para una vista previa de 4 mallas estáticas, `three` puro son ~120 líneas. R3F + drei suman ~2 MB de `node_modules` y una disciplina de re-renders que recién se paga cuando hay gizmos. | `geometria/construir.ts` devuelve `BufferGeometry[]`, que es exactamente lo que consume R3F. `Vista3D.tsx` se reemplaza entero en la Fase 4 sin tocar nada más. |
| **`zundo` / deshacer del documento** | En un asistente lineal no hay qué deshacer: cada paso se re-ejecuta cambiando un slider. Lo único que necesita historial es la máscara, que tiene el suyo. | El store de documento ya está en `zustand` con `set()` inmutable. Agregar `zundo` en la Fase 4 es envolver el `create()` en `temporal()`: una línea. |
| **Importar SVG** | Es un segundo camino completo por el pipeline (sin máscara, sin cuantización), con su propio set de bugs. Y el público objetivo sube fotos y PNG, no SVG. | Interfaz `Trazador` con `TrazadorRaster`. `TrazadorSVG` (con `SVGLoader` de three) es otra implementación de la misma interfaz. |
| **Perfil "3MF genérico" / Cura** | Ninguno de los tres slicers objetivo lee `<basematerials>`/`displaycolor` (audit-02 §1.1, verificado en código). Escribirlo es trabajo que no le sirve a nadie. | El STL por color ya es el fallback universal, y va desde el día 1. |
| **Cuentas, diseños guardados, galería, compartir** | Dispara obligaciones legales reales (agente DMCA, notice & takedown, DSA art. 16 — audit-03 §5) y costo de infraestructura. Mientras todo sea local, el mínimo legal son 3 páginas y US$0. | El documento `Diseno` ya tiene `id` (uuid), `version`, `creadoEn` y `appVersion`. La imagen se referencia por `assetId`, no embebida. Migrar de IndexedDB a Postgres/R2 es cambiar la implementación de `persistencia.ts`. |
| **Modo lote (N nombres en una placa)** | Es el diferenciador con más disposición a pagar (audit-03 §3.2), pero necesita que el documento y el empaquetado en placa estén maduros. | Reusa `Diseno` + sustitución de una pieza de texto + un empaquetador. Ninguna geometría nueva. |
| **Tienda / vender impresiones** | Te convierte en **fabricante**: sin safe harbor, con moderación humana obligatoria y botón de arrepentimiento (audit-03 §4.1, §5). | Nada que preparar hoy salvo no prometer cosas que después haya que desdecir. |
| **HEIC, AVIF, TIFF** | LGPL-3.0 en la única librería práctica (audit-01 §4.4). | Detectar el fallo de decodificación y mostrar "convertí la foto a JPG o PNG". Una línea. |
| **Inglés / i18n** | Costo de mantener dos juegos de textos mientras la copy cambia todos los días. | Todos los textos en `src/i18n/es.ts`. Agregar `en.ts` es copiar el archivo. |
| **Celular optimizado** | Funciona (responsive, resolución de trabajo reducida), pero el foco de calidad es desktop. | Detección `deviceMemory`/`hardwareConcurrency` ya implementada en el MVP para bajar la resolución. |
| **Modo "boca abajo"** | Sin fuente oficial y con reportes en contra (audit-03 C-8). | Es un flag de generación de franjas Z, no un rediseño. |

### 1.3 Definición de "listo" del MVP (verificable, sin interpretación)

El MVP está listo cuando **las 9 condiciones** se cumplen a la vez:

1. **Funciona la ruta feliz sin ayuda**: una persona que nunca vio el sitio sube un PNG de logo y baja el ZIP en menos de 2 minutos sin preguntar nada. Verificación: 3 personas distintas, cronometrado.
2. **Banco de imágenes**: sobre las 20 imágenes de `tests/banco/`, **≥ 16 de 20 producen un llavero aceptable sin retoque manual de máscara** (criterio: la silueta no se comió ni agregó nada visible a 100% de zoom). Los 5 "foto de mascota" cuentan como aceptables si quedan bien **con** retoque de pincel de menos de 60 segundos.
3. **Tiempo**: pipeline completo ≤ **1,5 s** en el equipo de desarrollo y ≤ **4 s** en un Android de gama media, medido con `performance.mark()` en las 20 imágenes.
4. **3MF Bambu**: el archivo abre en **Bambu Studio (última) y en una 2.4.x** y en **OrcaSlicer (última)** con los N colores ya asignados a los slots 1..N, **sin ningún diálogo de importación de color** y sin pisar los presets del usuario.
5. **3MF Prusa**: abre en **PrusaSlicer (última y anterior)** como un objeto con N volúmenes, cada uno con su extrusor asignado.
6. **STL**: los N STL cargan en los tres slicers como "un objeto con varias partes" conservando posiciones relativas.
7. **Impresión real**: **3 piezas impresas** (un logo de 2 colores a ras, un dibujo de 4 colores a ras, un diseño de 3 colores en modo apilado) que pasan el checklist físico de §10.4: sin costuras visibles entre colores, la argolla entra, el agujero no se rompe a mano.
8. **DRC**: las 7 validaciones de §5.6 están implementadas y se muestran antes de descargar. Ninguna descarga con error bloqueante.
9. **Publicado**: online en Cloudflare, con las 4 páginas legales/informativas, CI en verde (typecheck + lint + tests + chequeo de licencias), y el evento `descargo_zip` llegando a Analytics.

**Lo que explícitamente NO es condición de listo:** que funcione perfecto en iPhone, que las fotos de mascotas queden lindas sin tocar nada, que haya editor, que haya cuentas.

---

## 2. Flujo de usuario, pantalla por pantalla

El MVP es **un asistente lineal de 5 pasos** con una barra de progreso arriba y un botón "atrás" que nunca pierde trabajo. Una sola ruta (`/crear`), 5 estados. No hay navegación libre.

### Pantalla 0 · Inicio (`/`)

- **Arriba:** la frase de posicionamiento (audit-03 §3.3): *"Convertí tu logo o dibujo en un llavero listo para imprimir, aunque tengas una impresora de un solo color. Todo en tu navegador: la foto no se sube a ningún lado."*
- **Centro:** la zona de carga, grande, ocupando la mitad de la pantalla. Arrastrar / click / pegar.
- **Debajo de la zona de carga, siempre visible:** *"Subí solo imágenes propias o con permiso. Convertirlas no te da derechos sobre personajes, logos o marcas de terceros."* (audit-03 §5, punto 4 — va acá, no escondido en Términos).
- **3 miniaturas de ejemplo** clickeables: un logo plano, un dibujo infantil, una silueta. Sirven para que alguien pruebe sin subir nada.
- **Una fila de 4 iconos** con lo que funciona bien: alto contraste, pocos colores, sin líneas finas, fondo liso. Es la guía de MakerLab, que es el benchmark de UX.
- Pie: Términos · Privacidad · Compatibilidad · Licencias.

### Pantalla 1 · Subir (`/crear`, paso 1)

Aparece apenas se suelta el archivo.

- **Validaciones inmediatas** (antes de decodificar): extensión en `[png, jpg, jpeg, webp]`, tamaño ≤ 25 MB. Si es `.heic`: *"Las fotos de iPhone en formato HEIC no se pueden abrir acá. En el celular, compartila como JPG, o convertila antes."*
- Se decodifica con `createImageBitmap` (aplica EXIF solo) y se reescala a la resolución de trabajo.
- **Una sola decisión visible: el preset.** Tres tarjetas grandes con ejemplo visual: **Logo o dibujo** (seleccionado por defecto si la imagen tiene ≤ 12 colores dominantes o canal alfa) · **Foto** · **Silueta**.
- Botón "Continuar". El pipeline hasta la máscara ya corrió en background mientras el usuario mira las tarjetas.

### Pantalla 2 · Recortar el fondo (paso 2)

Es la pantalla que decide si el producto es mágico o frustrante (audit-01 riesgo #1). Se le da la mitad del presupuesto de UI.

- **Lienzo grande** con la imagen y el fondo pintado a damero. Zoom con rueda, pan con espacio o botón del medio.
- **Barra de herramientas vertical**: Varita (activa por defecto) · Pincel borrar · Pincel restaurar · Mano.
- **Un solo slider: "Tolerancia"**, con recálculo en vivo (debounce 80 ms). Se re-ejecuta el flood fill desde los bordes.
- **Deshacer / Rehacer** propios de la máscara (Ctrl+Z / Ctrl+Shift+Z), 20 pasos.
- **En el preset "Foto" la pantalla cambia**: en vez de la máscara continua, se muestra la imagen ya posterizada a 6 clusters y una tira de 6 muestras de color abajo. El usuario clickea las que son fondo y desaparecen del lienzo. Debajo: *"¿Quedó algo de más? Usá el pincel."*
- **Botón "El fondo ya está bien"** → continúa. **Botón "Saltear"** → usa la máscara automática tal cual.
- Evento de analítica `abandono_en_mascara` si el usuario cierra acá (es la métrica #1 del producto).

### Pantalla 3 · Colores (paso 3)

- **Izquierda:** preview de la imagen ya cuantizada, actualizado en vivo.
- **Derecha:** la lista de slots, arrastrable para reordenar. Cada fila: muestra de color, nombre del filamento asignado ("PLA Basic Rojo"), botón de fusionar con el de arriba, candado para fijar.
- **Arriba de la lista: "¿Cuántos colores?"** con botones 2·3·**4**·5·6. Cada cambio re-corre k-means (≈80 ms).
- **Avisos automáticos** en la lista: *"Estos dos colores te van a quedar casi iguales al imprimir. ¿Los fusionamos?"* (ΔE2000 < 5).
- **Abajo, el interruptor que es el diferenciador #1:**
  > **¿Cuántos colores podés cargar a la vez en tu impresora?**
  > `[ 4 o más (AMS, CFS, ACE, MMU) ]` · `[ Solo 1 (cambio manual de filamento) ]`
  Si elige "Solo 1" y el diseño tiene más de 4 colores, avisa: *"Te van a quedar 3 pausas para cambiar el filamento. Te doy la lista exacta."*
- Sugerencia pasiva de orden claro→oscuro con un botón "Ordenar para purgar menos" (audit-02 §6.5).

### Pantalla 4 · El llavero (paso 4)

Es la pantalla más densa y la única con manipulación directa.

- **Centro: vista 3D** (`three` puro, órbita + zoom). Dos botones de vista: **Arriba** (ortográfica cenital, es la vista de trabajo) y **3D**. Un tercer botón: **Explotar capas** (separa las capas de color en Z para ver dónde está cada color) — sirve de validación visual contra costuras.
- **Manipulación directa:**
  - Arrastrar la imagen para moverla; handles en las esquinas para escalar; un handle de rotación.
  - Arrastrar el círculo del agujero. Si lo llevás a menos de 2 mm del borde, se pinta rojo y aparece "no va a aguantar".
  - Si hay texto: arrastrarlo y escalarlo.
- **Panel derecho, 5 controles y nada más:**
  1. **Tamaño**: lado mayor en mm, `50` por defecto, slider 25–80.
  2. **Espesor**: Delgado · **Estándar** · Reforzado (1.6 / 3.0 / 4.0 mm).
  3. **Borde**: slider 0–3 mm, `1.5` por defecto, con preview en vivo.
  4. **Argolla**: desplegable con 3 opciones dibujadas — Cadena de bolitas (Ø3.7) · **Argolla común (Ø4.2)** · Argolla gruesa (Ø5.2). Y "sin agujero".
  5. **Agregar texto**: campo de una línea + 3 fuentes + color (elige uno de los slots existentes).
- **Franja de avisos abajo del todo**, siempre visible, con colores: rojo = bloquea la descarga, amarillo = avisa. Cada aviso tiene un botón "mostrarme dónde" que resalta la zona en la vista 3D.

### Pantalla 5 · Descargar (paso 5)

- **Un botón grande: "Descargar mi llavero (ZIP)"**. Nada de elegir formato.
- Arriba del botón, un selector de una sola línea: **"¿Qué usás para imprimir?"** → `Bambu Studio / OrcaSlicer` · `PrusaSlicer` · `Otra / No sé`. **Solo cambia qué archivo se resalta en la lista de abajo; el ZIP siempre trae todo.**
- **Lista de lo que hay adentro**, con un ícono por archivo y una línea de explicación cada uno.
- **Caja de estimación honesta** (esto no lo muestra ningún competidor, audit-02 §9.8):
  > Pieza: ~5 g de filamento · Purga estimada por cambios de color: **~28 g**
  > Consejo: imprimí 6 a 12 llaveros juntos en la misma placa y activá "purgar dentro del objeto" en el slicer.
- **Instrucciones cortas en pantalla** (las mismas que van en el TXT), y para el modo apilado, la **lista de cambios**: *"Capa 12 (Z = 2.4 mm): cambiá a rojo"*.
- Aviso de UX: *"Si Bambu Studio te pregunta algo al abrir, elegí importar solo la geometría."* (audit-02, issue #7797).
- Links secundarios: "Descargar proyecto (.json)" · "Empezar otro" · "Reportar un problema".

**Error global:** si el worker falla o se queda sin memoria, un cartel *"Algo salió mal procesando la imagen. Probá con una imagen más chica."* + botón "Reintentar con menos resolución" (que baja a 400 px y reintenta). El autoguardado hace que no se pierda el paso anterior.

---

## 3. Arquitectura

### 3.1 Qué corre dónde

| Componente | Dónde | Por qué |
|---|---|---|
| Todo el procesamiento (máscara, color, contornos, geometría, 3MF, ZIP) | **Navegador del usuario**, en 2 Web Workers | US$0 a cualquier escala (doc 02 §4), sin latencia, sin arranque en frío, y "tu foto no se sube" es cierto |
| Servir la SPA | **Cloudflare Workers static assets** | Estáticos ilimitados y gratis con uso comercial (doc 02 §2). Es el único que cumple las 3 cosas |
| Persistencia | **IndexedDB** del navegador | Cero infraestructura, cero obligaciones legales |
| Analítica | **Cloudflare Web Analytics** | Sin cookies → sin banner de consentimiento (audit-03 §5.3) |
| Servidor | **No hay.** Ninguno. | — |

**Cabeceras:** `public/_headers` **sin COOP/COEP** (audit-01 §4.3: ninguna dependencia usa SharedArrayBuffer y ponerlas rompe recursos cross-origin gratis). Solo `X-Content-Type-Options`, `Referrer-Policy` y cache largo para los `.wasm`.

### 3.2 Stack del MVP

```
TypeScript estricto · Vite 8 · pnpm · ESLint + Prettier
React 19 (UI y estado de pantallas)   — sin router: el asistente es un switch sobre `paso`
Tailwind 4                            — sin shadcn en el MVP: son 12 componentes propios
three r186                            — vista previa, sin R3F ni drei hasta la Fase 4
manifold-3d 3.5.x                     — TODA la geometría 2D y 3D
d3-contour + simplify-js              — contornos
ml-kmeans + culori                    — cuantización y ΔE2000
opentype.js 2.0                       — texto → contornos
fflate                                — ZIP del 3MF y del paquete final
comlink                               — RPC con los workers
zustand 5                             — store del documento y de la UI
idb-keyval                            — autoguardado (verificar licencia en CI)
```

**Total de dependencias de producción: 11.** Lo que quedó afuera a propósito: `@techstark/opencv-js`, `image-q`, `clipper2-ts`, `three-bvh-csg`, `@react-three/fiber`, `@react-three/drei`, `zundo`, `immer`, `react-router`, `three-3mf-exporter`, `jszip`.

**Dev:** `vitest`, `@playwright/test`, `wrangler`, y un script propio de chequeo de licencias.

### 3.3 Cómo se aísla el pipeline detrás de una interfaz

Todo el valor del producto son **tres funciones puras**, sin DOM, sin React, sin `window`. Se testean en Node con Vitest y, si algún día hace falta "procesar en la nube", corren tal cual en un Worker de Cloudflare o en Node.

```ts
// src/pipeline/index.ts
export function convertir(img: ImagenNormalizada, p: ParamsPipeline): ResultadoConversion
//   ImagenNormalizada = { ancho, alto, pixeles: Uint8ClampedArray, mmPorPixel }
//   ResultadoConversion = { regiones: Region[], filamentos: Filamento[], diagnostico: Diagnostico }

// src/geometria/construir.ts
export function construir(d: Diseno): { piezas: PiezaExport[]; avisos: Aviso[] }

// src/export/paquete.ts
export function empaquetar(piezas: PiezaExport[], d: Diseno): Uint8Array   // el ZIP final
```

Y **cuatro interfaces** para poder cambiar de motor sin tocar el resto (audit-01 riesgo #5):

```ts
interface Recortador  { mascara(img, params): Uint8Array }              // RecorteClasico | (futuro) RecorteGrabCut
interface Cuantizador { paleta(img, mascara, n): Centroide[] }          // KmeansOklab | (futuro) Wu
interface Trazador    { contornos(etiquetas, params): Region[] }        // TrazadorD3 | (futuro) TrazadorVTracer, TrazadorSVG
interface Exportador  { escribir(piezas, diseno): ArchivoSalida[] }     // PerfilBambu | PerfilPrusa | PerfilStl
```

La UI **nunca** importa `d3-contour`, `ml-kmeans` ni `manifold-3d`. Solo habla con los workers vía Comlink.

### 3.4 Los dos workers

| Worker | Responsabilidad | Entra | Sale |
|---|---|---|---|
| `imagen.worker.ts` | normalizar, máscara, prefiltro, k-means, limpieza, contornos | `ImageBitmap` (transferido) + params | `Region[]` (polígonos en mm) + preview posterizado (`ImageBitmap` transferido) |
| `geometria.worker.ts` | Manifold: booleanas 2D, franjas Z, texto, extrusión, DRC, 3MF, STL, ZIP | `Diseno` (JSON) | `BufferGeometry` crudos (transferibles) + avisos + `Uint8Array` del ZIP |

Regla dura: **todo lo que sale de un worker viaja por transferencia** (`ArrayBuffer`, `ImageBitmap`), nunca por clonado de `ImageData`. Y todo objeto de Manifold vive dentro de un `withScope()` que llama `.delete()` (audit-01 riesgo #4).

### 3.5 Por qué NO Laravel/Laragon en el MVP

El editor y el pipeline serían **exactamente el mismo código TS** (doc 01 §5.5), pero Laravel obliga a un servidor PHP encendido para servir algo que es 100% cliente: US$8–11/mes y mantenimiento, contra US$0. Laragon queda útil el día que haya tienda y admin.

**Costura:** `pipeline/`, `geometria/`, `export/` y `datos/` no importan nada de React ni del router. Montarlos en una página Inertia más adelante es copiar una carpeta.

---

## 4. Estructura de carpetas y módulos

```
3dllaveros/
├─ docs/
│  ├─ 01-stack-tecnologico.md · 02-costos-servicios.md
│  ├─ research/               (las 3 auditorías + este plan)
│  └─ pruebas/                ← bitácora y capturas de la matriz de slicers (§10.3)
├─ public/
│  ├─ fuentes/                ← 3 TTF OFL subsetados (latín + acentos)
│  ├─ muestras/               ← 3 imágenes de ejemplo del cargador
│  └─ _headers                ← SIN COOP/COEP
├─ src/
│  ├─ main.tsx · App.tsx
│  ├─ paginas/
│  │  ├─ Inicio.tsx · Asistente.tsx
│  │  └─ Terminos.tsx · Privacidad.tsx · Compatibilidad.tsx · Licencias.tsx
│  ├─ asistente/
│  │  ├─ Paso1Subir.tsx · Paso2Recorte.tsx · Paso3Colores.tsx
│  │  ├─ Paso4Llavero.tsx · Paso5Descarga.tsx
│  │  ├─ LienzoMascara.tsx    ← canvas 2D: varita, pincel, zoom/pan, historial de máscara
│  │  ├─ Vista3D.tsx          ← three puro; se reemplaza por R3F en Fase 4
│  │  └─ PanelAvisos.tsx
│  ├─ pipeline/               ← TS PURO. Prohibido importar React o tocar el DOM
│  │  ├─ defaults.ts          ← TODOS los números del §5 viven acá y solo acá
│  │  ├─ tipos.ts
│  │  ├─ normalizar.ts        ← createImageBitmap, resize, tope de px
│  │  ├─ mascara.ts           ← floodFill BFS, varita, aplicar trazo de pincel, erosión anti-halo
│  │  ├─ prefiltro.ts         ← mediana 3×3/5×5
│  │  ├─ cuantizar.ts         ← muestreo + k-means++ OKLab + mapeo ΔE2000 a filamentos
│  │  ├─ limpiar.ts           ← filtro de moda, componentes conexos (union-find), apertura/cierre
│  │  ├─ contornos.ts         ← d3-contour + padding 1px + corrección 0.5px + RDP + px→mm
│  │  └─ index.ts             ← convertir()
│  ├─ geometria/
│  │  ├─ manifold.ts          ← carga del wasm, singleton, withScope() obligatorio
│  │  ├─ regiones.ts          ← cadena de resta por prioridad con ε=0.05 mm (anti-costuras)
│  │  ├─ llavero.ts           ← silueta, contorno, pestaña con fillet r=2, agujero
│  │  ├─ franjas.ts           ← franjas Z: modo 'a_ras' | 'apilado'
│  │  ├─ texto.ts             ← opentype.js → CrossSection (NonZero) → offset de negrita
│  │  ├─ construir.ts         ← Diseno → PiezaExport[] + BufferGeometry[] de preview
│  │  └─ drc.ts               ← las 7 validaciones, devuelve Aviso[]
│  ├─ export/
│  │  ├─ 3mf/comun.ts         ← [Content_Types].xml, _rels, XML de malla, orden topológico (Kahn)
│  │  ├─ 3mf/bambu.ts         ← 3dmodel.model + model_settings.config + project_settings.config
│  │  ├─ 3mf/prusa.ts         ← malla única concatenada + Slic3r_PE_model.config
│  │  ├─ 3mf/cambiosCapa.ts   ← custom_gcode_per_layer.xml y Prusa_Slicer_custom_gcode_per_print_z.xml
│  │  ├─ stl.ts               ← STL binario por color, mismo sistema de coordenadas
│  │  ├─ instrucciones.ts     ← genera el INSTRUCCIONES.txt
│  │  └─ paquete.ts           ← arma el ZIP final con fflate
│  ├─ datos/
│  │  ├─ filamentos.json      ← ~24 PLA con nombre y hex (atribución a filamentcolors.xyz, CC BY)
│  │  ├─ impresoras.json      ← cama y altura de A1 / A1 mini / P1S / X1C / MK4 / genérica
│  │  └─ presets.ts           ← Logo/Foto/Silueta + Delgado/Estándar/Reforzado
│  ├─ estado/
│  │  ├─ documento.ts         ← zustand: el Diseno (zundo entra en Fase 4)
│  │  ├─ ui.ts                ← paso actual, herramienta, selección, cámara (NO se persiste)
│  │  └─ persistencia.ts      ← idb-keyval: autosave + abrir/descargar .json + migrarDiseno()
│  ├─ workers/
│  │  ├─ imagen.worker.ts · geometria.worker.ts
│  │  └─ clientes.ts          ← wrappers Comlink tipados
│  ├─ i18n/es.ts              ← TODOS los textos visibles
│  └─ analitica.ts            ← 6 eventos, sin datos personales
├─ tests/
│  ├─ banco/                  ← 20 imágenes + esperados.json (áreas, nº de regiones, bbox)
│  ├─ pipeline.test.ts · geometria.test.ts · export3mf.test.ts · fugas.test.ts
│  └─ e2e/humo.spec.ts
├─ scripts/chequear-licencias.mjs
├─ wrangler.jsonc · vite.config.ts · .github/workflows/ci.yml
└─ LICENSES.txt               ← generado en el build
```

**Responsabilidad de cada capa en una línea:**
- `pipeline/` convierte píxeles en polígonos en milímetros. No sabe qué es un llavero.
- `geometria/` convierte polígonos en sólidos imprimibles. No sabe qué es una imagen.
- `export/` convierte sólidos en bytes. No sabe cómo se hicieron.
- `asistente/` es la única que sabe qué es un usuario.

---

## 5. El pipeline de conversión, paso a paso

Todos los números viven en `src/pipeline/defaults.ts`. **Visibilidad:** `V` = control visible siempre · `A` = solo en "Ajustes avanzados" (un acordeón cerrado) · `O` = oculto, no se expone nunca.

### 5.1 Entrada y normalización

| Paso | Cómo | Parámetro | Default | Vis. |
|---|---|---|---|---|
| 1.1 | Validar extensión y tamaño antes de decodificar | `tamanoMaxArchivo` | 25 MB | O |
| 1.2 | `createImageBitmap(file, { resizeWidth, resizeQuality:'high' })` — la orientación EXIF se aplica sola | `ladoMaxPxDesktop` / `Movil` | 900 / 640 | O |
| 1.3 | Resolución de trabajo derivada del tamaño final | `mmPorPixel` | **0.15** | A |

> **Resolución de la contradicción entre auditorías:** audit-01 §6.1 propone 0.10 mm/px; audit-02 §6.1 propone 0.20 mm/px (y corrige a doc 01 por sobredimensionado). Tomo **0.15 mm/px** como punto de partida y el Hito 1 incluye una comparación A/B sobre el banco a 0.10 / 0.15 / 0.20 para fijar el valor definitivo con evidencia, no con opinión. A 50 mm son 333 px.

### 5.2 Máscara de fondo

| Paso | Cómo | Parámetro | Default | Vis. |
|---|---|---|---|---|
| 2.1 | Si hay canal alfa útil: máscara = alfa > umbral | `umbralAlfa` | 128 | O |
| 2.2 | Si no: flood fill BFS desde los 4 bordes, distancia OKLab | `toleranciaFloodFill` | 10 (×100) | **V** (slider) |
| 2.3 | Varita mágica: flood fill desde el click; Alt = restar | `radioPincel` | 12 px de pantalla | **V** |
| 2.4 | Preset Foto: cuantizar a 6 y marcar clusters como fondo | `clustersPreviosFoto` | 6 | O |
| 2.5 | **Erosión anti-halo**, siempre | `erosionAntiHalo` | 1 px | O |
| 2.6 | Historial de máscara (buffer circular de máscaras comprimidas) | `pasosDeshacerMascara` | 20 | O |

### 5.3 Color

| Paso | Cómo | Parámetro | Default | Vis. |
|---|---|---|---|---|
| 3.1 | Prefiltro mediana (radio según preset) | `prefiltro` | r=1 Logo · r=2 Foto | A |
| 3.2 | Muestra aleatoria de píxeles no-fondo | `muestraKmeans` | 30.000 | O |
| 3.3 | k-means++ en **OKLab**, corte por convergencia 1e-4 | `iteracionesKmeans` | 20 | O |
| 3.4 | Nº de colores | `N` | **4** (2–6) | **V** |
| 3.5 | Asignación de todos los píxeles al centroide más cercano, **euclídea en OKLab** | — | — | O |
| 3.6 | Mapeo de los **N centroides** (no de los píxeles) a `filamentos.json` con `differenceCiede2000` | `mapeoPaleta` | activo | A (se puede desactivar) |
| 3.7 | Dithering | `dithering` | **`'nearest'` (apagado)** | **O — no exponer jamás** |
| 3.8 | Aviso de colisión | `avisoColision` | ΔE2000 < 5 | O |
| 3.9 | Orden de slots | sugerencia claro→oscuro | manual | **V** (arrastrar) |

### 5.4 Limpieza

| Paso | Cómo | Parámetro | Default | Vis. |
|---|---|---|---|---|
| 4.1 | Filtro de moda 3×3 sobre el mapa de etiquetas | — | 1 pasada | O |
| 4.2 | Componentes conexos (union-find): islas menores al área mínima se fusionan con el vecino dominante | `areaMinimaIsla` | **1.0 mm²** (0.5 en Logo) | A |
| 4.3 | Apertura morfológica por color, radio = ancho mínimo / 2 | `anchoMinimoDetalle` | **0.8 mm** → r = 0.4 mm | A |

### 5.5 Vectorización y geometría 2D

| Paso | Cómo | Parámetro | Default | Vis. |
|---|---|---|---|---|
| 5.1 | **Padding de 1 px de fondo** en todo el borde de la grilla antes de contornear | `paddingGrilla` | 1 px | O |
| 5.2 | `d3-contour` con umbral 0.5 sobre cada máscara binaria, `smooth(true)` | — | — | O |
| 5.3 | **Restar 0.5 px** a todas las coordenadas (gotcha de d3-contour) | `correccionMedioPixel` | activa | O |
| 5.4 | RDP con `simplify-js`, tolerancia en mm | `toleranciaRDP` | **0.05 mm** | A |
| 5.5 | `CrossSection.ofPolygons(contornos, 'EvenOdd')` — los anillos interiores quedan como agujeros | — | — | O |
| 5.6 | **Anti-costuras:** cada región crece `offset(+ε,'Miter')` y después `region_i = region_i − ∪ region_j (j de mayor prioridad)` | `epsilonSolapeCapas` | **0.05 mm** | O |
| 5.7 | Silueta = unión de todas las regiones | — | — | O |
| 5.8 | Contorno = `silueta.offset(borde,'Round')` | `offsetContorno` | **1.5 mm** | **V** (0–3) |
| 5.9 | Pestaña de argolla = círculo unido a la silueta con fillet r=2 mm | `radioFilletPestana` | 2.0 mm | O |
| 5.10 | Agujero = círculo restado de todo | `diametroAgujero` | **4.2 mm** (3.7 / 4.2 / 5.2) | **V** |
| 5.11 | Anillo de material alrededor del agujero | `margenAgujero` | **3.0 mm** (mín. 2.0) | O |
| 5.12 | Tope de vértices por región | `maxVerticesPorRegion` | 2.000 | O |

### 5.6 Extrusión y validación

| Paso | Cómo | Parámetro | Default | Vis. |
|---|---|---|---|---|
| 6.1 | Altura de capa (define la grilla de todas las alturas) | `alturaCapa` | 0.20 mm | A |
| 6.2 | Espesor de base | `alturaBase` | **2.4 mm** | **V** (preset) |
| 6.3 | Espesor de la capa de color (modo a ras) | `alturaColor` | **0.6 mm** | **V** (preset) |
| 6.4 | Franja por color (modo apilado) | `alturaFranja` | 0.6 mm | A |
| 6.5 | Máximo de cambios en modo apilado | `maxCambios` | **3** | O (avisa) |
| 6.6 | Todas las alturas se redondean a múltiplo exacto de `alturaCapa` | — | siempre | O |
| 6.7 | Extrusión por franjas Z con `CrossSection.extrude()` + `translate()` | — | — | O |
| 6.8 | Recalculo con debounce | `debounceRecalculo` | 150 ms | O |

**Las 7 validaciones DRC** (`geometria/drc.ts`), en orden, marcando cada una como bloqueante (🔴) o aviso (🟡):

1. 🔴 Alguna malla no es manifold o tiene volumen ≤ 0 (`Manifold.status()`, `volume()`).
2. 🔴 El anillo de material alrededor del agujero mide < 2.0 mm en alguna dirección.
3. 🔴 Modo apilado: un color flota sin nada abajo.
4. 🔴 Las mallas por color no son disjuntas (`intersect()` de a pares → volumen 0) y el orden de piezas no coincide con el de filamentos.
5. 🟡 Detalles menores a `anchoMinimoDetalle` (se resaltan en rojo en la vista: es el área que desaparece con `offset(-r).offset(+r)`).
6. 🟡 Islas menores al área mínima o piezas desconectadas de la silueta.
7. 🟡 Nº de colores mayor que los slots declarados → ofrecer fusionar o pasar a modo apilado.

**Invariante que se testea en CI:** `área(unión de regiones) == área(silueta)` con tolerancia de 0.001 mm². Es el test que detecta las costuras antes de que lleguen a una impresora.

---

## 6. El editor estilo Tinkercad (Fase 4)

No está en el MVP. Va acá porque el **modelo de datos que usa ya lo escribe el MVP**, y eso es lo que hace que la Fase 4 sea aditiva.

### 6.1 Modelo de datos de la escena

Es el documento `Diseno`: **formas 2D en milímetros con propiedades de capa**. Lo 3D siempre se deriva y nunca se guarda. El JSON queda en decenas de KB, el deshacer es barato y se persiste tal cual en una base de datos el día que haya cuentas.

```ts
// src/pipeline/tipos.ts — YA EXISTE DESDE EL HITO 2
type Pieza = {
  id: string;
  tipo: 'region' | 'texto' | 'forma' | 'agujero' | 'argolla' | 'contorno';
  nombre: string;
  filamentoId: string;
  z: number;              // mm, base de la pieza. Múltiplo de alturaCapa
  altura: number;         // mm. Múltiplo de alturaCapa
  prioridad: number;      // define quién le gana a quién en la cadena de resta
  transform: { x: number; y: number; rotZ: number; sx: number; sy: number };
  geometria:
    | { kind: 'poligonos'; contornos: [number, number][][] }
    | { kind: 'texto'; texto: string; fuente: string; tamano: number; negrita: number }
    | { kind: 'primitiva'; forma: 'rect'|'circulo'|'estrella'|'corazon'; params: Record<string, number> };
  esAgujero: boolean;     // el "Hole" de Tinkercad
  visible: boolean; bloqueada: boolean; grupoId?: string;
};

type Diseno = {
  version: 1; id: string; creadoEn: string; appVersion: string; unidades: 'mm';
  nombre: string;
  impresion: { alturaCapa: number; boquilla: number; modoColor: 'a_ras'|'apilado'; slots: number; impresoraId: string };
  contorno: { activo: boolean; offset: number; filamentoId: string };
  filamentos: { id: string; nombre: string; hex: string; slot: number }[];
  piezas: Pieza[];
  imagenOrigen?: { assetId: string; parametros: ParamsPipeline };  // referencia, NUNCA embebida
};
```

**El MVP crea entre 3 y 6 piezas** (contorno, N regiones, argolla, agujero, texto opcional). El editor de la Fase 4 deja crear 200.

### 6.2 Herramientas concretas (Fase 4)

| Herramienta | Implementación |
|---|---|
| Seleccionar / multi-seleccionar | Raycast con `three-mesh-bvh`, resaltado con `<Outlines>` de drei, marco de selección |
| Mover / rotar / escalar | `<TransformControls>` de drei, **restringido a 2.5D**: traslación XY, rotación solo Z, escala XY. `translationSnap` 0.5 mm, `rotationSnap` 15°. La altura y la Z se editan numéricamente |
| Plano de trabajo y grilla | `<Grid>` de drei + snap propio (0.5 / 1 / 5 mm) |
| Vista superior 2D ↔ órbita 3D | Toggle de cámara + `<GizmoViewcube>` |
| Duplicar (Ctrl+D), borrar, alinear (9 combinaciones), distribuir | Operaciones sobre `transform` del documento |
| Agrupar / desagrupar | `grupoId` compartido; el grupo mueve todo junto |
| Formas básicas | Generadores de `CrossSection`: rectángulo (con esquinas redondeadas vía `offset(-r).offset(+r)`), círculo, estrella, corazón |
| Texto | `opentype.js` → contornos → `CrossSection.ofPolygons('NonZero')` → `offset` para negrita. Fuentes OFL incluidas + subir la propia (con aviso de licencia) |
| Agujero (concepto "Hole") | `esAgujero: true`: se dibuja translúcido y se resta al construir |
| Color y altura por pieza | Panel lateral con la paleta, `z` y `altura` forzados a múltiplos de `alturaCapa` |
| Medidas | Etiquetas `<Html>` con el bounding box en mm |
| Vista explotada por capas | Ya existe en el MVP |

### 6.3 Deshacer / rehacer

- **Dos stores separados** en zustand: `documento` (con `temporal()` de **zundo**) y `ui` (selección, cámara, herramienta) que **no entra al historial**.
- Durante un arrastre: `temporal.pause()` en `pointerdown`, `resume()` + commit en `pointerup`. Un drag = **un** paso de deshacer.
- `limit: 100`.
- **La máscara de la imagen tiene su propio historial** y no entra nunca al del documento: es un asset binario, no parte del JSON.
- **La imagen original tampoco entra**: se referencia por `assetId`.
- Si algún día hay colaboración, el camino es cambiar zundo por patches de `mutative`/`immer` y de ahí a Yjs. No hace falta decidirlo ahora.

### 6.4 Rendimiento del editor

- Booleanas **2D por franjas Z**, no CSG de mallas (doc 01 §4.6). Es más rápido y más robusto.
- **Caché por pieza**: hash de (geometría + transform + z + altura) → `CrossSection` calculada. Solo se recalcula lo que cambió.
- Durante el drag se muestra la pieza "en crudo" y translúcida; al soltar llega la malla recalculada del worker (debounce 150 ms).
- `withScope()` obligatorio y test de fugas en CI.

---

## 7. Exportación

### 7.1 Qué se entrega

Un único ZIP, siempre completo (audit-02 §4 paso 4):

```
llavero-gatito.zip
├─ llavero-gatito_bambu-orca.3mf     ← el recomendado por defecto
├─ llavero-gatito_prusa.3mf
├─ stl/
│  ├─ 1_blanco.stl · 2_rojo.stl · 3_negro.stl        ← mismo sistema de coordenadas
├─ INSTRUCCIONES.txt
└─ proyecto.json                                      ← para reabrirlo acá
```

### 7.2 Perfil A · Bambu Studio / OrcaSlicer

5 archivos dentro del ZIP 3MF (`fflate.zipSync`, sin carpeta raíz):

- `[Content_Types].xml` · `_rels/.rels` (estándar OPC)
- `3D/3dmodel.model`: un `<object>` malla por color + un `<object>` ensamblado con `<components>`; un solo `<item>` en el `<build>` centrado en la cama de la impresora elegida.
- `Metadata/model_settings.config`: `<part id="N" subtype="normal_part">` con `<metadata key="extruder" value="…"/>`.
- `Metadata/project_settings.config`: JSON **mínimo** con `filament_colour`, `filament_type`, `nozzle_diameter`, `layer_height`, `printer_model`.

**Las 6 reglas que no se pueden olvidar** (todas verificadas en código fuente por audit-02):

1. `<metadata name="Application">BambuStudio-02.05.00.00</metadata>` en `3dmodel.model`. **Es el interruptor** que hace que Bambu y Orca traten el archivo como propio, salteen el diálogo roto de la 2.5 (issue #9666) y respeten `model_settings.config`. Sin esto: *"the 3mf is not from Bambu Lab, load geometry data only"*.
2. **`extruder` en `model_settings.config` = índice en `filament_colour` + 1.**
3. **Nada de `<basematerials>` ni `displaycolor`**: ningún slicer objetivo los lee.
4. **Nada de `requiredextensions="p"`**: `three-3mf-exporter` lo declara de forma inválida y puede hacer que un lector estricto rechace el archivo.
5. **Orden topológico de los `<component>`** (algoritmo de Kahn): los hijos definidos antes que los padres, porque PrusaSlicer y derivados lo esperan.
6. `project_settings.config` **mínimo**, no 300 claves: abrir un 3MF de proyecto puede pisarle los presets al usuario (issue #7797).

### 7.3 Perfil B · PrusaSlicer

Cambia todo respecto del A:

- **Una sola malla** con los triángulos de todos los colores concatenados en orden de slot, llevando offsets acumulados de vértices y de triángulos.
- Un solo `<object>` en `3dmodel.model`, con `xmlns:slic3rpe` y `<metadata name="slic3rpe:Version3mf">1</metadata>`.
- `Metadata/Slic3r_PE_model.config` con un `<volume firstid lastid>` por color, cada uno con `volume_type=ModelPart`, `matrix` identidad y `extruder`.
- **No incluir** `model_settings.config` ni `project_settings.config`.

### 7.4 Perfil C · Cambio manual de filamento (modo apilado)

Es el diferenciador #1. Geometría en franjas Z, exportada como A o B **con un solo filamento**, más el XML de cambios:

- Bambu/Orca: `Metadata/custom_gcode_per_layer.xml` → `<layer top_z="2.4" type="0" extruder="1" color="#E53935" extra="" gcode="M600"/>` dentro de `<plate>`, con `<mode value="SingleExtruder"/>`.
- Prusa: `Metadata/Prusa_Slicer_custom_gcode_per_print_z.xml` → `<code print_z="2.4" type="0" …/>`, con y sin `bed_idx="0"` por compatibilidad.
- Enum `type`: **0 = ColorChange**, 1 = PausePrint, 2 = ToolChange.
- **Y siempre, la lista legible en pantalla y en el TXT.** Es lo que salva al usuario cuando el slicer no toma el XML.

### 7.5 `INSTRUCCIONES.txt` (plantilla real)

```
LLAVERO "gatito" — generado en 3dllaveros.com el 11/09/2026

QUÉ ARCHIVO ABRIR
  Bambu Studio u OrcaSlicer .... llavero-gatito_bambu-orca.3mf
  PrusaSlicer .................. llavero-gatito_prusa.3mf
  Cualquier otro slicer ........ importá los 3 STL de la carpeta stl/
                                 y elegí "cargar como un objeto con varias partes"

COLORES (en este orden, del slot 1 en adelante)
  Slot 1 .... Blanco   #FFFFFF
  Slot 2 .... Rojo     #E53935
  Slot 3 .... Negro    #1A1A1A

MEDIDAS
  50.0 x 38.4 x 3.0 mm  ·  agujero Ø4.2 mm  ·  ~5 g de pieza

AJUSTES SUGERIDOS
  Altura de capa 0.20 mm · 3 paredes · relleno 100% · 4 capas arriba y abajo
  Brim de 5 mm si tiene puntas finas
  PLA para exhibición; PETG o ASA si va a estar al sol o en el auto

PURGA (importante)
  Cada cambio de color desperdicia ~2 a 5 g de filamento.
  Este modelo tiene 6 cambios: ~28 g de purga para 5 g de pieza.
  Imprimí 6 a 12 llaveros juntos en la misma placa y activá
  "purgar dentro del objeto" o "purgar en el relleno".

SI TU IMPRESORA TIENE UN SOLO EXTRUSOR
  (esta sección solo aparece en modo apilado)
  Capa 12 (Z = 2.40 mm) .... cambiá a Rojo   #E53935
  Capa 15 (Z = 3.00 mm) .... cambiá a Negro  #1A1A1A
  El archivo ya trae las pausas. Si tu slicer no las toma, agregalas a mano
  en esas alturas.

SI BAMBU STUDIO TE PREGUNTA ALGO AL ABRIR
  Elegí importar solo la geometría. Los colores ya vienen asignados.

Probado con: Bambu Studio 2.5.x · OrcaSlicer 2.3.x · PrusaSlicer 2.9.x
Ver 3dllaveros.com/compatibilidad
```

---

## 8. Modelo de datos y costuras para escalar

### 8.1 La única costura que importa

**El documento `Diseno` es JSON serializable, versionado y sin binarios adentro.** Todo lo demás (cuentas, galería, lote, pedidos) se construye alrededor de ese objeto sin tocar el pipeline.

Tres reglas que el MVP tiene que respetar desde el primer día, aunque no haya base de datos:

1. **`version: 1` y una función `migrarDiseno(json): Diseno`** que hoy es `return json` pero existe y se testea. El día que cambie el esquema, ya hay dónde poner la migración.
2. **La imagen se referencia por `assetId`, nunca se embebe.** Hoy `assetId` apunta a una clave de IndexedDB; mañana a un objeto en R2. `persistencia.ts` es la única que lo sabe.
3. **`construir()` y `empaquetar()` son puras.** Reciben un `Diseno` y devuelven bytes. Se pueden correr en el navegador, en un Worker de Cloudflare o en Node sin cambios. Eso es lo que habilita "procesar en la nube", miniaturas de la galería y la cola de impresión de la tienda.

### 8.2 Esquema que se va a necesitar (NO construir ahora)

Solo para verificar que el `Diseno` alcanza. Vale igual para Postgres (Supabase), D1 (Cloudflare) o MySQL (Laravel):

```
usuarios(id, email, creado_en)
disenos(id uuid, usuario_id, nombre, json jsonb, thumb_url, publico bool, creado_en, actualizado_en)
assets(id uuid, usuario_id, tipo 'imagen_reducida'|'thumb', url, bytes, creado_en)
-- fase lote
lotes(id, usuario_id, diseno_base_id, items jsonb, creado_en)
-- fase tienda
pedidos(id, usuario_id, estado, total, moneda, pago_ref, creado_en)
pedido_items(id, pedido_id, diseno_id, cantidad, colores jsonb, precio_unit)
moderacion(id, diseno_id, estado 'pendiente'|'ok'|'rechazado', motivo, revisado_por, revisado_en)
```

**Estrategia de storage decidida de antemano** (doc 02 §1: guardar de más cuesta 12×): se guardan **solo** `json` + imagen reducida en WebP (≤ 400 KB) + miniatura. **El 3MF no se guarda nunca**: se regenera en el navegador en 1 segundo.

### 8.3 Costuras menores, todas baratas de dejar hoy

| Costura | Qué se hace en el MVP | Qué habilita |
|---|---|---|
| `src/i18n/es.ts` con todos los textos | Ya | Inglés = copiar un archivo |
| `analitica.ts` con 6 eventos nombrados (`subio_imagen`, `eligio_preset`, `mascara_lista`, `colores_listos`, `vio_avisos_drc`, `descargo_zip`) | Ya | Medir el embudo y el abandono en la máscara sin reinstrumentar |
| `datos/impresoras.json` | Ya, con 6 modelos | Perfiles nuevos sin tocar el exportador |
| `datos/filamentos.json` con `marca` y `hex` | Ya | Catálogo de filamentos reales de LatAm (potenciador del diferenciador #1) |
| Flag `modoColor: 'a_ras' | 'apilado'` en el documento | Ya | Ya es el modo cambio manual |
| `banderas.ts` con feature flags booleanos | Ya | Soltar el editor a un % de usuarios |
| Ninguna promesa de privacidad que después haya que romper | Sentry configurado para **no** mandar la imagen ni nada derivado | Evita el problema legal del art. 8 de la Ley 24.240 |

---

## 9. Fases e hitos numerados

**Unidad:** 1 día = una jornada de trabajo de una sola persona (~5 h efectivas). Los días son laborables.

### FASE 1 · El motor (16 días) — todavía no hay producto, hay archivo

#### Hito 0 · Andamio + 3MF escrito a mano — **3 días**
- **Objetivo:** matar el riesgo #1 del proyecto en la primera semana.
- **Tareas:**
  1. `pnpm create vite` (React + TS), Tailwind 4, ESLint, Prettier, `tsconfig` estricto.
  2. Repo privado en GitHub. `wrangler.jsonc` con `not_found_handling: single-page-application`. Conectar Workers Builds. Push → URL pública.
  3. `.github/workflows/ci.yml` con typecheck + lint + test + `scripts/chequear-licencias.mjs` (lista blanca SPDX + **lista negra por nombre de paquete**: `@imgly/*`, `potrace`, `esm-potrace-wasm`, `marchingsquares`, `openscad-wasm`, `heic2any`, `libheif-js`; cualquier SPDX desconocido rompe el build).
  4. `export/3mf/comun.ts` + `bambu.ts` + `prusa.ts` + `stl.ts` + `paquete.ts` con una **malla hardcodeada**: un cubo de 20×20×2.4 mm (slot 1) y otro de 10×10×0.6 mm encima (slot 2).
  5. Una página `/dev/export` con un botón que descarga el ZIP.
  6. Instalar Bambu Studio, OrcaSlicer y PrusaSlicer. Abrir los 3 archivos. **Capturas a `docs/pruebas/`.**
- **Aceptación:** el 3MF Bambu abre en Bambu Studio **y** en Orca con dos colores en los slots 1 y 2, **sin ningún diálogo**. El 3MF Prusa abre en PrusaSlicer con dos volúmenes y sus extrusores. Los 2 STL cargan como objeto multi-parte en los tres. CI en verde. Sitio online.
- **Si esto falla, el plan entero se replantea acá y no en la semana 7.**

#### Hito 1 · Banco de imágenes + imagen → colores — **5 días**
- **Objetivo:** de un PNG a un mapa de etiquetas limpio, medido.
- **Tareas:**
  1. Armar `tests/banco/`: 20 imágenes (5 logos, 5 dibujos, 5 fotos de mascota, 3 capturas, 2 casos horribles a propósito) + `esperados.json`.
  2. `pipeline/normalizar.ts`, `mascara.ts` (flood fill BFS + erosión), `prefiltro.ts`, `cuantizar.ts` (k-means++ OKLab + ΔE2000 a paleta), `limpiar.ts`.
  3. `pipeline/defaults.ts` con **todos** los números de §5.
  4. `datos/filamentos.json` (~24 PLA, con la atribución CC BY a filamentcolors.xyz).
  5. `workers/imagen.worker.ts` + Comlink. Instrumentar con `performance.mark()` por etapa.
  6. Página `/dev/pipeline`: subir imagen, ver máscara y posterizado, ver tiempos por etapa.
  7. **A/B de resolución**: correr el banco a 0.10 / 0.15 / 0.20 mm/px y fijar el valor con evidencia.
- **Aceptación:** las 20 imágenes procesan sin excepciones; ≥ 16 dan una máscara correcta sin intervención; tiempo total del worker ≤ 400 ms en desktop; la tabla de tiempos por etapa queda en `docs/pruebas/tiempos.md`.

#### Hito 2 · Contornos y geometría — **5 días**
- **Objetivo:** del mapa de etiquetas a sólidos manifold, sin costuras.
- **Tareas:**
  1. `contornos.ts`: padding 1 px, `d3-contour`, **corrección de 0.5 px**, RDP, px→mm, centrado.
  2. `geometria/manifold.ts`: carga del wasm, singleton, **`withScope()`** y una regla de ESLint que prohíbe construir objetos de Manifold fuera del wrapper.
  3. `regiones.ts`: **cadena de resta por prioridad con ε = 0.05 mm**.
  4. `llavero.ts`: silueta, contorno, pestaña con fillet, agujero.
  5. `franjas.ts`: franjas Z para `a_ras` y para `apilado`.
  6. `construir.ts` y `drc.ts` con las 7 validaciones.
  7. `workers/geometria.worker.ts`.
  8. Tests: `área(unión) == área(silueta)` ±0.001 mm²; `status() == NoError` y `volume() > 0` en todas las piezas; `intersect()` de a pares = 0.
- **Aceptación:** las 20 imágenes producen piezas manifold, disjuntas, con el test de costuras en verde. `fugas.test.ts`: 500 operaciones de construcción no aumentan el heap de WASM más de un 10%.

#### Hito 3 · Punta a punta sin interfaz — **3 días**
- **Objetivo:** que exista el archivo real, de la imagen real.
- **Tareas:** conectar `convertir → construir → empaquetar`; STL por color; `instrucciones.ts`; `paquete.ts`; golden files de los 3 perfiles con hash de los XML; re-importar en CI con `3MFLoader` de three.
- **Aceptación:** desde `/dev/pipeline`, subir un logo de 4 colores y bajar el ZIP. Los 3 archivos abren correctamente en los 3 slicers (capturas a `docs/pruebas/`). Tests golden en verde.

> **Fin de la Fase 1: hay producto, no hay interfaz.** Si acá se acaba el tiempo, se puede lanzar una página fea de un solo botón y ya es útil.

### FASE 2 · El producto usable (14 días)

#### Hito 4 · El asistente — **6 días**
- **Tareas:** `App.tsx` + los 5 pasos + barra de progreso; `Vista3D.tsx` con three puro (órbita, vista superior, explotar capas); paneles de Colores y Llavero; `PanelAvisos.tsx`; `i18n/es.ts`; `estado/documento.ts` y `ui.ts`; responsive; estados de carga y de error; `persistencia.ts` con autoguardado.
- **Aceptación:** una persona ajena al proyecto sube un PNG y baja el ZIP sin ayuda, en menos de 2 minutos, cronometrado. Refrescar la pestaña no pierde el trabajo.

#### Hito 5 · Máscara interactiva — **4 días**
- **Tareas:** `LienzoMascara.tsx` con zoom/pan; varita (click / Alt+click); pincel borrar/restaurar con tamaño; historial de máscara de 20 pasos; slider de tolerancia en vivo con debounce 80 ms; **preset Foto con clasificación por clusters**; los 3 presets de entrada.
- **Aceptación:** las 5 fotos de mascota del banco quedan con máscara aceptable en **menos de 60 segundos cada una**, cronometrado. Deshacer/rehacer de máscara funciona 20 pasos.

#### Hito 6 · Argolla, texto y ajustes finos — **4 días**
- **Tareas:** arrastrar/escalar/rotar la imagen; arrastrar el agujero con validación en vivo; `texto.ts` con `opentype.js` y 3 fuentes OFL subsetadas; presets de espesor; selector de impresora; los 7 avisos DRC conectados a la vista con "mostrarme dónde"; estimación de gramos y **de purga**.
- **Aceptación:** los 7 avisos aparecen cuando corresponde, verificado con 7 casos de prueba armados a propósito. El texto de 6 mm de alto con trazo ≥ 1 mm sale imprimible en el slicer.

### FASE 3 · El diferenciador y el lanzamiento (7 días)

#### Hito 7 · Modo cambio manual de filamento — **3 días**
- **Objetivo:** el diferenciador #1 (audit-03 §3.2). Es lo único "no mínimo" que dejé adentro del MVP, porque reusa el 90% de lo que ya existe y es la diferencia entre "no lo puedo imprimir" y una descarga usable.
- **Tareas:** el interruptor de slots en el paso 3; generación de franjas Z apiladas; validación de color flotante; `cambiosCapa.ts` con los dos XML; la lista legible en pantalla y en el TXT; tope de 3 cambios con aviso.
- **Aceptación:** un diseño de 3 colores en modo apilado abre en Bambu Studio **con los cambios de color ya cargados en la línea de tiempo de capas**, y en PrusaSlicer igual. La lista del TXT coincide capa por capa con lo que muestra el slicer.

#### Hito 8 · Legal, pulido, impresión real y lanzamiento — **4 días**
- **Tareas:**
  1. Términos, Privacidad, **Compatibilidad**, Licencias (`LICENSES.txt` generado en el build). El aviso de propiedad intelectual **en el cargador**.
  2. Cloudflare Web Analytics + los 6 eventos. Sentry configurado para no mandar imágenes.
  3. Playwright: humo e2e (subir → descargar).
  4. **Las 3 impresiones reales** del checklist de §10.4.
  5. Dominio (opcional), meta tags, OG image, favicon.
- **Aceptación:** las 9 condiciones de §1.3.

**Total MVP: 37 días laborables ≈ 7 a 8 semanas de una persona.**

### Después del MVP (no forman parte del "listo")

| Fase | Qué | Días | Depende de |
|---|---|---|---|
| **4 · Editor 2.5D v1** | R3F + drei + zundo, multi-pieza, TransformControls restringido, formas básicas, agujeros tipo Hole, agrupar/alinear/duplicar, panel de capas, deshacer de 100 pasos | **12–15** | Nada nuevo: el documento ya existe |
| **5 · Cuentas y "Mis diseños"** | Supabase Auth o Cloudflare D1+R2, guardar/abrir, miniaturas, compartir por link. **Dispara el mínimo legal de fase 2: agente DMCA (US$6), notice & takedown, DSA art. 16** | **8–10** | Fase 4 |
| **6 · Modo lote** | Pegar N nombres o CSV, plantilla validada, empaquetado en placa, un solo 3MF | **6–8** | Fase 4 |
| **7 · Tienda** | Pedidos, Mercado Pago, panel admin, **moderación humana obligatoria**, botón de arrepentimiento | 20+ | Fase 5 + consulta legal |

---

## 10. Plan de pruebas

### 10.1 Automáticas en CI (cada push)

| Tipo | Herramienta | Qué verifica |
|---|---|---|
| Tipos y estilo | `tsc --noEmit`, ESLint | Incluye la regla que prohíbe construir objetos de Manifold fuera de `withScope()` |
| **Licencias** | `scripts/chequear-licencias.mjs` | Lista blanca SPDX + **lista negra por nombre** + transitivas. Cualquier `UNKNOWN`/`Custom`/`SEE LICENSE IN…` rompe el build (audit-03 §1.4) |
| Pipeline golden | Vitest sobre `tests/banco/` | Nº de regiones, área total, bounding box y hash del mapa de etiquetas contra `esperados.json` |
| **Anti-costuras** | Vitest | `área(unión de regiones) == área(silueta)` ±0.001 mm² |
| Manifoldness | Vitest | `status() == NoError`, `volume() > 0`, `intersect()` de a pares = 0 |
| **Fugas WASM** | `fugas.test.ts` | 500 construcciones seguidas no aumentan el heap más del 10% |
| 3MF estructura | Vitest + `3MFLoader` de three | Re-importa y compara conteo de triángulos; `extruder` = índice+1; `firstid/lastid` contiguos sin huecos; todos los `objectid` referenciados existen; el ZIP no tiene carpeta raíz; **el orden de componentes es topológico** |
| Humo e2e | Playwright | Subir imagen → 5 pasos → el ZIP descargado pesa > 0 y contiene los 4 elementos |

### 10.2 Manuales por cada release (30 minutos)

Checklist fijo en `docs/pruebas/checklist.md`, ejecutado sobre 3 diseños golden (logo 2 colores · dibujo 4 colores con islas · texto + argolla en modo apilado):

| Slicer | Versiones | Qué se mira |
|---|---|---|
| Bambu Studio | la última **y una 2.4.x** (por el issue #9666) | ¿Aparece algún diálogo? ¿Los colores quedan en los slots correctos? ¿El preview de rebanado muestra los colores bien? ¿Se pisaron los presets? |
| OrcaSlicer | la última estable | Idem |
| PrusaSlicer | la última **y la anterior** (por la reestructuración 2026) | ¿Un objeto con N volúmenes? ¿Cada uno con su extrusor? |

El resultado se publica en la página `/compatibilidad`. Es barato, da confianza y sirve de soporte.

### 10.3 Rendimiento y memoria (Hito 1 y antes de lanzar)

- Tiempos por etapa en 3 equipos: la PC de desarrollo, una notebook vieja y un Android de gama media.
- **Pico de memoria en un iPhone real** con Safari (el simulador no reproduce el límite). Si la pestaña muere, bajar `ladoMaxPxMovil`.
- Verificar que `createImageBitmap` aplique EXIF en Safari (no está verificado en las auditorías).

### 10.4 Impresión real (condición de "listo", Hito 8)

**3 piezas obligatorias**, con foto y anotación en `docs/pruebas/impresiones.md`:

| # | Qué | Qué se valida |
|---|---|---|
| 1 | Logo 2 colores, modo a ras, 50 mm, preset Estándar | Costuras entre colores (mirar a contraluz y con lupa), definición del borde, que el agujero acepte una argolla real |
| 2 | Dibujo 4 colores con islas chicas, modo a ras | Que las islas de ~1 mm² salgan o desaparezcan limpio (no a medias), que el detalle de 0.8 mm sea visible, purga real vs. estimada |
| 3 | 3 colores modo apilado (cambio manual) | Que las pausas caigan en la capa que dice el TXT, que ningún color quede flotando, que las terrazas se vean prolijas |

**Checklist físico por pieza:**
- [ ] No se ve el color de abajo entre dos zonas de color (la prueba de las costuras).
- [ ] La argolla de 1.0–1.2 mm de alambre entra sin forzar.
- [ ] El anillo alrededor del agujero no se rompe apretándolo fuerte con dos dedos.
- [ ] El texto se lee a 30 cm.
- [ ] No hay warping ni despegue de la primera capa.
- [ ] Los gramos reales (pieza + purga) están dentro del ±30% de lo estimado en pantalla.

**Antes de imprimir, siempre:** revisar el preview capa por capa en el slicer buscando huecos. Es gratis y detecta el 90% de los problemas sin gastar filamento.

---

## 11. Costos por fase y riesgos

### 11.1 Costos (tomados de `docs/02-costos-servicios.md`)

| Concepto | MVP (Fases 1–3) | Fase 4 (editor) | Fase 5 (cuentas) | Fase 6 (lote) | Fase 7 (tienda) |
|---|---|---|---|---|---|
| Hosting (Cloudflare Workers static) | **US$0** | US$0 | US$0 | US$0 | US$0 |
| Dominio .com (Cloudflare Registrar) | US$0 (subdominio `.workers.dev`) u **US$0,93/mes** | ~US$0,93 | ~US$0,93 | ~US$0,93 | ~US$0,93 |
| Backend / DB / storage | US$0 | US$0 | **US$0–7/mes** (Workers+D1+R2) o **US$25** (Supabase Pro) | igual | igual |
| Email transaccional | — | — | US$0 (Resend Free 3.000/mes) | US$0 | US$0–20 |
| Analítica + errores | US$0 (CF Analytics + Sentry Developer) | US$0 | US$0 | US$0 | US$0–26 |
| **Agente DMCA** | — | — | **US$6** (+ US$6 cada 3 años) | — | — |
| Pasarela de pago | — | — | — | — | Mercado Pago ~6,3% + IVA (inmediato) o ~1,5% + IVA (a 30 días) |
| **Total recurrente** | **US$0–0,93/mes** | US$0,93 | **US$1–26/mes** | US$1–26 | US$1–30 + comisiones |

**Costos de bolsillo del MVP que no son de servicios:**
- Filamento y horas de impresora para las 3 pruebas: **~US$5–15** (o el costo de un servicio de impresión si no hay impresora a mano).
- Una argolla, una cadena de bolitas y un mosquetón chico para probar los 3 diámetros: **~US$2**.
- Todo el resto es tiempo.

**El .com sube ~7% el 1-nov-2026** (US$10,44 → ~US$11,15). Si se va a comprar, conviene antes de esa fecha.

### 11.2 Riesgos, ordenados por lo que realmente puede hundir el plan

| # | Riesgo | Prob·Impacto | Mitigación **concreta** | Dónde se ataca |
|---|---|---|---|---|
| 1 | **El 3MF no abre bien en algún slicer** o una versión nueva lo rompe | Media · **Muy alto** | Se ataca en el **Hito 0**, día 1. Escritor propio (no librería de terceros). Golden files + re-import en CI. Matriz manual de 30 min por release. **STL por color en el mismo ZIP desde el día 1** como red de seguridad que no se rompe nunca. Página `/compatibilidad` pública | Hito 0, §10.2 |
| 2 | **La máscara en fotos reales decepciona** y el usuario se va | **Alta** · Alto | Preset "Foto" por clasificación de clusters, no por matte. Pincel como herramienta de primera clase, no escondida. Erosión anti-halo. Galería de "qué funciona bien" en el cargador. **Evento `abandono_en_mascara` como métrica #1** | Hito 5 |
| 3 | **Costuras entre capas de color** que solo aparecen impresas | Alta · Alto (barato de evitar si se hace desde el día 1) | Cadena de resta por prioridad con ε=0.05 mm. Test golden de áreas. Vista explotada por capas en el editor. Revisión capa por capa en el slicer antes de imprimir | Hito 2, §10.1, §10.4 |
| 4 | **Fugas de memoria WASM** — Manifold no tiene GC; tras 200 ediciones, crash | Media-alta · Medio-alto | `withScope()` obligatorio + regla de ESLint. `fugas.test.ts` con 500 operaciones. Caché por pieza con hash. Autoguardado para que un crash no pierda trabajo | Hito 2 |
| 5 | **El editor (Fase 4) se come el cronograma** | Alta · Alto | **Ya está mitigado por diseño: el editor está fuera del MVP.** El MVP se lanza y se aprende con usuarios antes de gastar 15 días en gizmos | §1.2 |
| 6 | **Memoria en iOS: la pestaña muere sin error ni log** | Media · Alto | **Cero OpenCV.js en el MVP.** Resolución reducida si `deviceMemory ≤ 4`. `.close()`/`.delete()` sistemáticos. Autoguardado en IndexedDB. Botón "reintentar con menos resolución" | §5.1, Hito 4 |
| 7 | **Trampa de licencia** que entra por una dependencia transitiva | Media · Alto | CI con lista blanca SPDX **+ lista negra por nombre de paquete** (porque `@imgly` declara `"SEE LICENSE IN LICENSE.md"` y un checker por SPDX no lo marca). Auditar a mano los `.wasm`, que no declaran licencia. `LICENSES.txt` generado en cada build | Hito 0 |
| 8 | **El competidor gratis ya hace lo mismo** (son once, no dos) | Alta · Medio | No competir por convertir: el foso es el **modo cambio manual** (Hito 7), el **editor** (Fase 4) y el **lote** (Fase 6). Y español, sin cuenta, sin moderación | Hito 7, Fases 4 y 6 |
| 9 | **Purga**: el usuario imprime y gasta 30 g para una pieza de 5 g | Alta · Medio | Mostrarlo en pantalla antes de descargar. Sugerir orden claro→oscuro. Empujar el modo 2 colores. Es un diferencial honesto que **ningún competidor muestra** | Hito 6 |
| 10 | **Propiedad intelectual** (personajes, escudos, logos) | Alta · Bajo en MVP, **Alto en Fase 7** | En el MVP, aviso en el cargador + términos: no alojás nada, el riesgo es muy bajo. En Fase 5 aparece el agente DMCA. **En Fase 7 sos fabricante: moderación humana obligatoria, sin safe harbor, y el DMCA no cubre marcas** | §1.2, Fases 5 y 7 |
| 11 | Dependencias inmaduras (`image-q` sin releases desde 2022, VTracer alfa, `@jscadui/3mf-export` de 2023) | Media · Medio | Ya están todas afuera del MVP salvo `d3-contour` y `simplify-js`, que son estables y pequeñas. Todo detrás de las 4 interfaces de §3.3 | §3.2 |
| 12 | **Bus factor de 1**: una sola persona, y la matriz de slicers no se puede automatizar | Alta · Medio | `docs/pruebas/checklist.md` escrito para que lo ejecute otra persona. Capturas de cada prueba versionadas. Todo lo demás automatizado en CI | §10.2 |

---

## 12. Supuestos que asumí

Los digo para que se puedan corregir, no para taparlos:

1. **Hay acceso a las tres aplicaciones de slicer** (son descargas gratuitas para Windows) y a **al menos una impresora**, propia o prestada, para las 3 pruebas físicas del Hito 8. Si no hay impresora, el Hito 8 se puede cumplir parcialmente con la revisión capa por capa en el slicer y tercerizando las 3 impresiones (~US$15–30 en LatAm), pero **no se puede saltear**: las costuras y la resistencia de la argolla no se ven en pantalla.
2. **Dedicación de una sola persona, ~5 h efectivas por día.** Con medio tiempo, multiplicar los días por 2.
3. El entorno local ya está (Node 24.16, pnpm, Git — verificado en doc 01 §5.4). **Laragon no hace falta para el MVP.**
4. **No hay presupuesto para diseño gráfico.** La UI es Tailwind + componentes propios, honesta y prolija, no "linda". Se puede mejorar después sin tocar la lógica.
5. `idb-keyval` es MIT según lo que conozco, pero **no lo verifiqué hoy** contra npm: lo verifica el chequeo de licencias del Hito 0 antes de que entre al bundle.
6. Los precios son los de `docs/02-costos-servicios.md` al 2026-09-10 y se movieron varias veces en 2026 (Render, Hetzner, Oracle, Verisign). Conviene re-verificar antes de pagar cualquier cosa.
7. **El valor de `mmPorPixel` (0.15) es una decisión mía para destrabar**, no un dato: las dos auditorías dicen cosas distintas (0.10 vs 0.20). El Hito 1 lo resuelve con evidencia sobre el banco de imágenes.
8. Los 37 días **no incluyen** marketing, SEO, redes ni atención de usuarios.
9. El modo "impresión boca abajo" queda fuera de todo el plan hasta que haya una prueba física propia: no hay fuente oficial y hay reportes en contra (audit-03 C-8).
