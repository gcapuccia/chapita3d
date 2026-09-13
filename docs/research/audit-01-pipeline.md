# Auditoría 01 · ¿Es viable el pipeline SIN IA 100% en el navegador?

> **Rol:** auditor técnico. No repito la investigación previa: la verifico, la corrijo y la completo.
> **Fecha:** 2026-09-11 · **Insumos:** `docs/01-stack-tecnologico.md`, `docs/02-costos-servicios.md`
> **Método:** inspección directa de paquetes npm/jsDelivr (tamaños y licencias medidos hoy con `curl`), lectura de los `.d.ts` publicados, READMEs oficiales y búsqueda web. Lo que no pude confirmar va marcado **(no verificado)**.
> **Aclaración honesta:** no instalé nada ni corrí benchmarks locales. Todos los tiempos de ejecución son **estimaciones razonadas**, no mediciones. En §9 dejo el plan concreto para medirlos.

---

## 0. Veredictos en una tabla

| # | Punto auditado | Veredicto | Resumen en una línea |
|---|---|---|---|
| 1 | Quitar fondo sin IA | 🟡 **VIABLE CON RESERVAS** | Logos y dibujos: excelente. Fotos reales: el recorte automático no alcanza → el pincel manual **no es opcional, es parte del producto**. |
| 2 | Cuantización a N filamentos | ✅ **VIABLE** | k-means en OKLab para elegir N, ΔE2000 solo para mapear los N centroides a filamentos. **Dithering: NO** (confirmado). |
| 3 | Vectorización | ✅ **VIABLE** | `d3-contour` + RDP + `CrossSection` cubre el MVP con licencia limpia. VTracer 1.0 es mejor pero **su npm es solo Node** (verificado hoy). Potrace descartado por GPL. |
| 4 | Rendimiento en el navegador | 🟡 **VIABLE CON RESERVAS** | Desktop: 0,3–1,1 s. Celular gama media: 1–3,3 s. **No requiere SharedArrayBuffer ni COOP/COEP** (verificado). El riesgo es OpenCV.js en iOS. |
| 5 | Booleanas de malla | ✅ **VIABLE** | `manifold-3d` es la elección correcta y no tiene competencia. `three-bvh-csg` es experimental, **no corre en Worker** y no garantiza salida manifold. |

**Veredicto global: VIABLE CON RESERVAS.** El pipeline sin IA en el navegador funciona y es la decisión correcta de costo y de arquitectura. La reserva **no es técnica, es de expectativa de producto**: "subí la foto de tu perro y te doy un llavero" va a decepcionar a una parte de los usuarios si no viene acompañado de herramientas manuales buenas y de un mensaje honesto sobre qué imágenes funcionan bien.

---

## 1. Quitar fondo sin IA — 🟡 VIABLE CON RESERVAS

### 1.1 Qué tan bien anda cada técnica, por tipo de imagen

| Tipo de imagen | Técnica que corresponde | Éxito "a la primera" (estimación propia, **no verificado**) | Dónde falla |
|---|---|---|---|
| PNG/SVG con alfa (logo exportado) | Usar el canal alfa | ~99% | Alfa premultiplicado, halo de borde |
| Logo o dibujo plano, fondo liso | Flood fill desde los 4 bordes con tolerancia | ~90–95% | Fondo con degradado, sombra proyectada, marco del mismo color que el objeto |
| Escaneo o foto de un dibujo en papel | Umbral adaptativo (Bradley-Roth) + flood fill | ~80% | Iluminación despareja (lo arregla el umbral adaptativo), papel amarillento |
| Captura de pantalla, sticker | Flood fill + varita mágica | ~85% | Fondo a cuadros de transparencia, antialias fuerte |
| **Foto real** (mascota, persona), fondo simple y contrastado | GrabCut con rectángulo | ~60–70% | Pelo, bigotes, pasto, sombras |
| **Foto real**, fondo complejo (living, jardín, ropa) | GrabCut + trazos de corrección | ~30–50% sin retoque manual | Todo: objeto y fondo comparten colores |

**Lo que hay que asumir.** GrabCut no "entiende" qué es un perro: separa regiones por color y contraste, así que con fondos texturados o cuando el sujeto se mezcla con el entorno la segmentación queda incompleta o se come partes del objeto ([OpenCV blog](https://opencv.org/blog/remove-backgrounds-from-images-using-opencv/)). La documentación oficial de OpenCV.js dice textualmente que en algunos casos la segmentación no va a quedar bien y **el usuario tiene que hacer retoques finos** ([tutorial GrabCut js](https://docs.opencv.org/4.13.0/dd/dfc/tutorial_js_grabcut.html)). O sea: el retoque manual está previsto *por el propio algoritmo*, no es un parche nuestro.

**El límite honesto, sin vueltas:** sin IA, el recorte de una foto de mascota con fondo real **no se resuelve solo**. Lo que sí se puede prometer es: (a) logos, dibujos, stickers y capturas salen bien casi siempre; (b) para fotos, la herramienta deja el 70% hecho y el usuario termina el 30% con el pincel en 20–40 segundos.

### 1.2 Verificado sobre OpenCV.js (`@techstark/opencv-js@5.0.0-release.1`, medido el 2026-09-11)

- `dist/opencv.js`: **13.298.869 bytes** sin comprimir · **3.752.997 bytes gzip** · **3.500.927 bytes brotli**.
- **0 ocurrencias de `SharedArrayBuffer`** en el bundle → el build por defecto es **de un solo hilo**: **no hace falta COOP/COEP**.
- Funciones confirmadas dentro del bundle: `grabCut`, `floodFill`, `watershed`, `connectedComponentsWithStats`. Está todo lo que el pipeline podría necesitar.
- `grabCut` figura en la whitelist oficial `platforms/js/opencv_js.config.py`, así que también viene en el build oficial de OpenCV.

**Costo de GrabCut (estimación).** Una implementación nativa optimizada resuelve 512×409 px con 5 iteraciones en ~165 ms; un paper más viejo reporta 3,81 s para 512×512 con otra implementación. WASM de un hilo suele ir 2–4× más lento que nativo → **a 500 px de lado mayor y 3 iteraciones: 0,5–2 s en desktop y 2–6 s en celular de gama media (no verificado)**. Escala peor que lineal con los píxeles, así que **siempre bajar a ≤600 px antes de GrabCut** y después escalar la máscara.

### 1.3 La UX de rescate que hace falta (esto no es opcional)

1. **Tolerancia ajustable en vivo con slider**, con la máscara pintada encima (damero o color flúor) y recálculo con debounce de ~80 ms. Sin feedback inmediato, el slider no sirve para nada.
2. **Varita mágica** (click = flood fill desde ese punto) con modificadores: click = reemplazar, Shift+click = sumar, Alt+click = restar. Es la interacción que todo el mundo ya conoce.
3. **Pincel borrar / restaurar** con tamaño ajustable, más zoom y pan. Este es el que salva las fotos difíciles.
4. **Deshacer propio de la máscara**, separado del historial del documento (la máscara es un asset, no entra al JSON del historial).
5. **Rectángulo de GrabCut + trazos "esto es objeto" / "esto es fondo"** (`cv.GC_FGD` / `cv.GC_BGD` con `GC_INIT_WITH_MASK`). Ahí es donde GrabCut realmente rinde: la segunda pasada con 2 o 3 trazos mejora muchísimo.
6. **Defringe obligatorio.** Los píxeles de borde con antialias arrastran color del fondo y generan un halo ([Adobe: fringe pixels](https://helpx.adobe.com/photoshop/desktop/make-selections/refine-modify-selections/fringe-pixels-around-a-selection.html)). Como el llavero es de colores planos, ese halo se convierte en **una franja de un 5º color alrededor de toda la silueta**. Mitigación: **erosionar la máscara 1–2 px** después de recortar. Como después se agrega el contorno de 2 mm, visualmente no se pierde nada.

### 1.4 Una idea que falta en la investigación previa: no recortar, *clasificar*

El pipeline ya cuantiza a N colores. Entonces, **para fotos conviene invertir el orden**: cuantizar primero y después dejar que el usuario **marque qué clusters o regiones son fondo** con un click sobre el preview ya posterizado.

Ventajas: el usuario toma 3–5 decisiones discretas ("este gris es fondo") en vez de pelear con una máscara continua; el resultado nunca tiene halo porque ya son polígonos; y se combina naturalmente con "descartar islas menores a X mm²". Para fotos con fondo medianamente uniforme **suele ser mejor y más rápido que GrabCut**, y cuesta ~50 líneas de TS en lugar de 3,5 MB de WASM.

**Recomendación: que este sea el camino por defecto del preset "Foto", y dejar GrabCut como botón "recorte avanzado" con carga diferida.**

---

## 2. Cuantización de color a N filamentos — ✅ VIABLE

### 2.1 Qué algoritmo

| Algoritmo | Velocidad | Calidad con N chico (2–6) | Veredicto |
|---|---|---|---|
| **k-means / k-means++ en OKLab o CIELAB** | Media (sobre muestra: rápida) | **La mejor**: minimiza el error real y respeta la percepción | ✅ **Por defecto** |
| **Wu** (`image-q`; es median-cut basado en momentos) | Muy rápida | Buena; a veces devuelve colores que no están en la imagen | ✅ Alternativa / fallback |
| **Median cut** clásico (`quantize`) | Muy rápida | Aceptable, sesgado hacia las zonas grandes | 🟡 Solo prototipo |
| **Octree** | Muy rápida, O(N), poca memoria | Aceptable | 🟡 No aporta sobre Wu |
| NeuQuant / RGBQuant (`image-q`) | Media | Pensados para 256 colores, no para 4 | 🟡 No usar acá |

La literatura confirma la división: los métodos de partición (median cut, octree, Wu) son rápidos pero "a menudo producen colores sustancialmente distintos a los de la imagen original", mientras que los de clustering tipo k-means dan mejor calidad ([survey de cuantización de color](https://dl.acm.org/doi/abs/10.1007/s10462-023-10406-6), [Celebi 2011](https://faculty.uca.edu/ecelebi/documents/IMAVIS_2011.pdf)). Con N = 4 la diferencia se nota bastante.

**Truco de rendimiento importante:** correr k-means sobre **una muestra aleatoria de 20k–50k píxeles** y después asignar todos los píxeles al centroide más cercano. Con 250k píxeles y k=4 son ~10–30 ms de clustering + ~10 ms de asignación. Correr k-means sobre todos los píxeles es tirar CPU a la basura.

### 2.2 Dithering: **NO**, confirmado

**Confirmado y sin matices: nunca activar dithering antes de vectorizar.** La regla está escrita textualmente en las guías de vectorización: el dithering rompe el banding esparciendo micro-puntos y, sobre áreas planas, genera "un enjambre de micro-puntos", es decir miles de paths inmanejables ([guía de vectorización](https://vectosolve.com/guides/en/vectorize-a-painting)).

Traducido a nuestro caso: un píxel aislado del color B dentro de una zona del color A se convierte en **una isla de 0,1 × 0,1 mm**. En el mejor caso el filtro de área mínima la borra; en el peor, aparecen **miles** de islas que hacen explotar el tiempo de las booleanas y el peso del 3MF, y que en el slicer se traducen en un cambio de filamento por cada una (purga infinita).

En `image-q` esto se controla con `imageQuantization: 'nearest'` (verificado en `basicAPI.d.ts`: las otras 10 opciones son todas de difusión de error). **Dejarlo fijo en `'nearest'` y ni siquiera exponerlo en la UI.**

Única excepción legítima: si algún día se hace un modo tipo litofanía/HueForge con capas translúcidas. No es nuestro caso.

### 2.3 Mapeo a la paleta real de filamentos

Verificado en los typings de `image-q@4.0.0`:
- La clase `Palette` expone `add(color)` y `getNearestColor(distanceCalculator, color)` → **sí se puede armar una paleta fija de filamentos** y aplicarla con `applyPaletteSync(image, palette, { colorDistanceFormula: 'ciede2000', imageQuantization: 'nearest' })`.
- Fórmulas disponibles: `ciede2000`, `cie94-textiles`, `cie94-graphic-arts`, `euclidean`, `manhattan`, `pngquant`, etc.
- **Advertencia del propio README: CIEDE2000 es "very slow".**

**Recomendación concreta: no usar ΔE2000 por píxel.** El orden correcto es:

1. k-means en **OKLab** sobre la muestra → N centroides (rápido, sin ΔE2000).
2. Asignar cada píxel al centroide más cercano con distancia euclídea en OKLab (OKLab ya es perceptualmente uniforme; no hace falta más).
3. **Recién ahí**, mapear los **N centroides** (4 comparaciones, no 250.000) contra la paleta de filamentos con `differenceCiede2000` de `culori`. A esa escala ΔE2000 no cuesta nada y da el mejor resultado.
4. Detectar colisiones: si dos centroides caen en el mismo filamento, avisar "estos dos colores te van a quedar iguales, ¿los fusionamos?".

Además, la paleta de filamentos tiene que ser **editable por el usuario** (tiene los rollos que tiene) y permitir **fijar** un color ("el fondo va en negro sí o sí") para que k-means trabaje sobre el resto.

---

## 3. Vectorización — ✅ VIABLE (con una corrección importante)

### 3.1 Estado real de cada opción (verificado hoy en npm/jsDelivr)

| Opción | Licencia | Versión / fecha | ¿Navegador? | Peso real | Veredicto |
|---|---|---|---|---|---|
| **`d3-contour` + `simplify-js` + `CrossSection`** | ISC + BSD-2 + Apache-2.0 | 4.0.2 (2023-01) / 1.2.4 (2020) | ✅ Sí, JS puro | ~55 KB | ✅ **Camino por defecto del MVP** |
| **`@visioncortex/vtracer`** | MIT OR Apache-2.0 | 1.0.0-alpha.4 (2026-08-29) | ❌ **NO** (ver abajo) | wasm 668 KB · **278 KB gz** | 🟡 Necesita build propio |
| **`vectortracer`** (bindings WASM de terceros) | MIT | 0.1.2 (**2023-08-17**) | ✅ Sí (ESM, `wasm-pack`, compatible con Workers) | wasm **126 KB** | 🟡 **Hallazgo nuevo**, pero congelado en `visioncortex 0.8` |
| `imagetracerjs` | Unlicense | 1.2.6 (2020-05-18) | ✅ Sí | ~3 MB el paquete | 🟡 Solo prototipo |
| `esm-potrace-wasm` / `potrace` | **GPL-2.0** | 0.5.1 (2026-08-14) | ✅ Sí | — | ❌ **Descartado por licencia** |

**Verificado: `@visioncortex/vtracer` NO corre en el navegador.** Doc 01 lo daba como "no verificado"; lo confirmé inspeccionando el paquete publicado:

- `index.js` arranca con `'use strict'` y hace `const fs = require('fs')` → CommonJS puro.
- `pkg/vtracer_wasm.js` termina con:
  ```js
  const wasmPath = `${__dirname}/vtracer_wasm_bg.wasm`;
  const wasmBytes = require('fs').readFileSync(wasmPath);
  ```
  Es un build `wasm-pack --target nodejs`. **En el navegador falla en el import**; no hay forma de usarlo tal cual.
- Para usarlo habría que **recompilar el crate con `wasm-pack build --target web`** (toolchain Rust en CI) o parchear el glue a mano. Es factible, pero no es gratis.

**Qué se pierde por eso** (vale la pena saberlo, porque VTracer 1.0 tiene justo lo que necesitamos; verificado en su `index.d.ts`):

```ts
preset?: 'bw' | 'poster' | 'photo';
clustering?: 'color-cluster' | 'bw' | 'watershed';
hierarchical?: 'stacked' | 'cutout';   // 'cutout' = mosaico sin costuras, bordes compartidos
palette?: string[];                    // ¡paleta fija de filamentos!
maxColors?: number;                    // auto-cuantización
mode?: 'pixel' | 'polygon' | 'spline';
filterSpeckle, colorPrecision, layerDifference, cornerThreshold, simplify, pathPrecision,
adaptive (Bradley-Roth), adaptiveWindow, adaptiveT, watershedDetail
```

El modo `cutout` está documentado como "a true seam-free mosaic (a gapless tessellation with shared boundaries)": **resuelve por diseño el problema de las costuras entre colores** (§3.3). Y `palette` + `maxColors` hacen en una llamada lo que nuestro pipeline hace en tres pasos.

**Recomendación:** arrancar con `d3-contour` (cero riesgo, control total, licencia limpia, sin toolchain extra) **detrás de una interfaz `Tracer`**, y reevaluar VTracer 1.0 cuando salga de alfa, compilándolo a `--target web` en CI. `vectortracer` sirve como prueba de concepto inmediata (MIT, 126 KB, con API `tick()`/`progress()` ideal para barra de progreso), pero está en `visioncortex 0.8`, sin `palette` ni `cutout`, así que hoy no aporta sobre d3-contour.

### 3.2 Calidad de curvas y huecos internos

- **Huecos internos** (donas, la letra "o", el ojo de un personaje): `d3-contour` devuelve un MultiPolygon GeoJSON con anillos interiores, y `CrossSection.ofPolygons(contornos, 'EvenOdd')` los interpreta como agujeros. Verificado en el `.d.ts` de `manifold-3d@3.5.3`: existe `ofPolygons(contours, fillRule)` y la clase documenta que garantiza **cero auto-intersecciones y cero solapes "from construction onwards"**. ✅ Resuelto.
- **Calidad de curvas:** `d3-contour` + RDP da **polilíneas, no Béziers**. A 0,1 mm/px con tolerancia RDP de 0,05 mm los segmentos quedan de ~0,1–0,5 mm: **invisible en una pieza impresa con boquilla de 0,4 mm**. Para un llavero alcanza y sobra. Se notaría en corte láser o en piezas grandes; no es nuestro caso.
  - Si algún día se quiere Bézier real sin GPL: VTracer con `mode: 'spline'`, o un ajuste de curvas propio (algoritmo de Schneider) sobre las polilíneas. **No hace falta para el MVP.**
- **Gotcha de `d3-contour` que falta en doc 01:** las coordenadas están **desplazadas 0,5 px** (la posición ⟨i+0.5, j+0.5⟩ corresponde al índice `i + j*n`) y `smooth` viene en `true` por defecto ([docs oficiales](https://d3js.org/d3-contour/contour)). Hay que restar ese medio píxel al pasar a mm; si no, la pieza queda corrida 0,05 mm (irrelevante) **pero el agujero de la argolla y los textos quedan desalineados respecto de la imagen** (sí importa). Además conviene **rellenar la grilla con 1 px de fondo en todo el borde** antes de contornear, para que las formas que tocan el borde de la imagen cierren limpio (el comportamiento exacto de d3 en el borde **no lo verifiqué**; el padding lo vuelve irrelevante).

### 3.3 El problema real que nadie nombró: **costuras entre capas de color**

A mi juicio, **el riesgo técnico más subestimado de toda la investigación previa.**

Si se traza cada máscara de color por separado y después se simplifica cada polígono por separado con RDP, **los bordes compartidos entre dos colores dejan de coincidir**: donde había un borde común, quedan dos polilíneas parecidas pero distintas. Resultado: micro-huecos de 0,01–0,05 mm entre regiones. En pantalla no se ven; en la impresión aparecen como **líneas del color de abajo** entre zonas, y en el slicer generan paredes finísimas absurdas.

Con marching squares sobre máscaras binarias complementarias los bordes **sí** coinciden exactamente (la interpolación en 0,5 es simétrica). **El que rompe la coincidencia es el RDP aplicado por separado.**

**Solución recomendada (barata y robusta), en este orden:**

1. Definir una **prioridad** de colores (por área, o la que elija el usuario).
2. Trazar y simplificar cada color por separado (RDP como estaba previsto).
3. Hacer crecer cada región un **ε = 0,05 mm** (`offset(+0.05, 'Miter')`).
4. Restar en cadena: `region_i_final = region_i − ∪(region_j_final)` para todo `j` de mayor prioridad. Como la resta la hace el kernel de Clipper dentro de Manifold, **los bordes compartidos quedan matemáticamente idénticos**. Cero huecos.
5. La **silueta** es la unión de todo, y el contorno de 2 mm se calcula sobre la silueta, no sobre cada color.

Es el equivalente del modo `cutout` de VTracer, implementado con las herramientas que ya están en el stack. **Conviene un test golden que verifique `área(unión de colores) == área(silueta)` con tolerancia de 0,001 mm².**

---

## 4. Rendimiento real en el navegador — 🟡 VIABLE CON RESERVAS

### 4.1 Resolución de trabajo recomendada

Manda la física: con boquilla de 0,4 mm nada por debajo de ~0,45 mm se puede imprimir. Trabajar a 0,1 mm/px da **4 píxeles por ancho de boquilla**, suficiente para que el antialias y el suavizado tengan material. Ir más fino no agrega nada imprimible y el costo crece con el **cuadrado** de la resolución.

| Parámetro | Valor recomendado | Por qué |
|---|---|---|
| Resolución de trabajo | **0,10 mm/px**, con tope duro de **900 px** en el lado mayor (desktop) y **640 px** (celular) | 50 mm → 500 px. Doc 01 propone 0,08–0,12 mm/px; MakerTools3D recomienda 0,15–0,25 mm/px para piezas chicas, o sea que estamos **del lado conservador** (bien), pero cuesta ~4× más CPU que 0,2. |
| Tamaño máximo de archivo de entrada | 25 MB (igual que MakerTools3D) | Rechazar antes de decodificar |
| Lado máximo de la imagen original | 8000 px; si es mayor, downscale en 2 pasos | `createImageBitmap` con `resizeWidth` + `resizeQuality: 'high'` lo hace gratis |

### 4.2 Presupuesto de tiempo por etapa (estimación, **no verificado**, a 500×500 px)

| Etapa | Desktop (i5 moderno) | Celular gama media | Nota |
|---|---|---|---|
| Decodificar + reescalar (`createImageBitmap`) | 30–80 ms | 100–300 ms | Nativo, casi gratis |
| Flood fill desde bordes | 5–15 ms | 20–50 ms | TS puro, O(píxeles) |
| Filtro mediana 3×3 | 10–30 ms | 40–120 ms | |
| k-means (muestra 30k, k=4, 20 iter) + asignación | 30–80 ms | 100–300 ms | |
| Limpieza: moda + componentes conexos + morfología | 30–80 ms | 100–300 ms | |
| `d3-contour` × 4 colores | 40–120 ms | 150–400 ms | |
| RDP + conversión a mm | 5–20 ms | 20–60 ms | |
| Booleanas 2D + offsets (Manifold) | 100–400 ms | 300–1200 ms | Depende de la cantidad de vértices |
| Extrusión + `getMesh()` × 4 | 50–200 ms | 200–600 ms | |
| **Total sin OpenCV** | **~0,3–1,1 s** | **~1,0–3,3 s** | ✅ Perfectamente usable |
| **+ GrabCut (opcional, 500 px, 3 iter)** | +0,5–2 s | +2–6 s | ⚠️ Además hay que bajar 3,5 MB |
| **+ Descarga inicial de OpenCV.js** | +2–10 s en 4G | +5–30 s en 4G | ⚠️ Solo la primera vez (después queda en caché) |

**Conclusión:** el pipeline base es rápido en todos lados. **El único problema de rendimiento serio es OpenCV.js**, y es un problema de peso de descarga y de memoria, no de CPU.

### 4.3 Web Workers, SharedArrayBuffer y COOP/COEP

**Verificado: NO hace falta SharedArrayBuffer ni las cabeceras COOP/COEP.**

- `manifold-3d@3.5.3`: `manifold.js` tiene **0 referencias a `SharedArrayBuffer` y 0 a `pthread`**. En Emscripten el soporte paralelo (TBB) está deshabilitado justamente porque requeriría pthreads y, por lo tanto, COOP/COEP. `manifold.wasm`: 541.470 bytes raw · **204.506 gzip** · 196.527 brotli.
- `@techstark/opencv-js@5.0.0-release.1`: **0 referencias a `SharedArrayBuffer`**. Build de un solo hilo.

Es una **muy buena noticia arquitectónica**: sin COOP/COEP se puede desplegar en GitHub Pages o en cualquier CDN, y no se rompen embeds ni recursos cross-origin. **El `public/_headers` con COOP/COEP que propone doc 01 §6.1 no hay que ponerlo**; si se pone "por las dudas", rompe cosas gratis (bloquea imágenes y scripts cross-origin que no manden CORP).

Sobre Workers:

- **`OffscreenCanvas` es Baseline "widely available" desde marzo de 2023** (Safari 16.4+) y `createImageBitmap` está disponible en Workers y es Baseline desde septiembre de 2021. El pipeline puede correr entero fuera del hilo principal sin fallbacks raros.
- **Dato útil que falta en doc 01:** `createImageBitmap` aplica la orientación EXIF **por defecto** (`imageOrientation: 'from-image'` es el valor por defecto según MDN). O sea que "normalizar orientación EXIF" del paso 1 sale gratis. (Comportamiento exacto en Safari: **no verificado**.)
- Arquitectura recomendada: **2 workers** (imagen y geometría) con Comlink, y **transferibles** (`ImageBitmap`, `ArrayBuffer`) para no copiar buffers. Nunca pasar `ImageData` por clonado estructurado si se puede transferir el buffer.

### 4.4 Celular de gama media: el riesgo concreto

- **iOS Safari mata la pestaña sin aviso** al pasarse del presupuesto de memoria (del orden de 300–500 MB, sin swap y sin evento de error que se pueda capturar). Sumar OpenCV.js (13 MB de JS parseado + heap WASM) + three.js + WebGL + los buffers de imagen **acerca peligrosamente a ese techo**.
- **HEIC:** las fotos del iPhone son HEIC y **ningún navegador salvo Safari las decodifica**. En iOS, al subir desde el selector de fotos, el sistema suele convertir a JPEG, pero un `.heic` compartido a un Chrome de escritorio **no se puede abrir**. ⚠️ **Trampa de licencia nueva, que no está en ninguno de los dos documentos:** la solución habitual (`heic2any`, `libheif-js`) es **LGPL-3.0**, se incluye estáticamente en el JS que se manda al navegador y obliga a permitir la relinkeo; `heic2any` además tiene un [issue abierto por violar la licencia de libheif](https://github.com/alexcorvi/heic2any/issues/59). **Recomendación: no soportar HEIC en el MVP.** Detectar el fallo de decodificación y mostrar "convertí la foto a JPG o PNG": 1 línea de código y 0 riesgo legal.

**Mitigaciones para móvil (todas baratas):**

1. **No cargar OpenCV.js nunca por defecto.** Solo si el usuario toca "recorte avanzado", y avisando que descarga ~3,5 MB.
2. Bajar la resolución de trabajo a 640 px de lado mayor cuando `navigator.deviceMemory <= 4` o `navigator.hardwareConcurrency <= 4`.
3. Liberar todo: `imageBitmap.close()`, `mat.delete()`, `manifoldObj.delete()`.
4. Límite duro de vértices por región (ej. 2.000) y de piezas por documento (ej. 200), con aviso al usuario.
5. Botón de escape "procesar en la nube" para más adelante (doc 02 §4 ya lo contempla y cuesta centavos).

---

## 5. Booleanas de malla: `manifold-3d` vs `three-bvh-csg` — ✅ VIABLE

| Criterio | **manifold-3d 3.5.3** | **three-bvh-csg 0.0.18** |
|---|---|---|
| Licencia | Apache-2.0 ✅ | MIT ✅ |
| Fecha | 2026-09-07 | 2026-02-17 |
| Madurez | Producción. Lo usan OpenSCAD y Blender. 2,3k★ | **"experimental, in progress"** (textual en su README) |
| Robustez | **Salida manifold garantizada.** `status()`, `genus()`, `volume()`, `surfaceArea()`, `isEmpty()` verificados en el `.d.ts` | Exige entrada **two-manifold** y advierte: "due to numerical precision and corner cases resulting geometry may not be correctly completely two-manifold". Su propio README **recomienda Manifold** para casos que necesiten robustez numérica |
| Web Worker | ✅ WASM, sin dependencias del DOM | ❌ **No soportado** (está en "Roadmap / Help Wanted"; `EvaluatorWorker` figura comentado) |
| Peso real | `manifold.wasm` **204 KB gz** + glue 75 KB | `build/index.module.js` **163.575 bytes** raw (≈40 KB gz, **no verificado**) |
| 2D (`CrossSection`) | ✅ `offset`, `simplify`, `union/difference/intersect`, `decompose`, `hull`, `extrude`, `ofPolygons(fillRule)` — todo verificado en el `.d.ts` | ❌ No tiene 2D |
| Velocidad | Buena; single-thread en el navegador | Muy rápida para preview interactivo (dicen >100× vs CSG basados en BSP) |
| Memoria | ⚠️ **Sin GC: hay que llamar `.delete()` a mano** | GC normal de JS |

**Veredicto: `manifold-3d` es el núcleo, sin discusión.** Y el argumento decisivo no es la robustez sino que **`CrossSection` cubre el 2D**: con el truco 2.5D de doc 01 §4.6 (booleanas 2D por franjas Z en lugar de CSG de mallas), las booleanas 3D casi no existen en este proyecto. La CSG de mallas quedaría solo para un futuro "importar un STL".

`three-bvh-csg` **no se justifica hoy**: no corre en Worker (o sea que congelaría la UI, que es justo lo que se quería evitar), es 0.0.x experimental y no aporta nada que `CrossSection` no haga mejor. **Recomendación: sacarlo del stack del MVP** y dejarlo anotado como opción futura.

**Dos hallazgos extra, inspeccionando el paquete de manifold-3d:**

1. Trae `lib/export-3mf.js` (Apache-2.0) que usa `@jscadui/3mf-export` + `fflate`: es un **esqueleto listo** para el escritor 3MF propio.
2. En ese mismo archivo hay un comentario que vale oro: *"Some 3MF parsers (like PrusaSlicer and descendants) expect child nodes to be defined before their parents"*, y por eso ordenan los componentes topológicamente con el algoritmo de Kahn. **Esto no está en doc 01 §3.2 y es exactamente el tipo de detalle que hace que un 3MF no abra en un slicer.**

---

## 6. Parámetros por defecto recomendados

Valores para arrancar. Todos deberían vivir en **un solo archivo de constantes** (`src/pipeline/defaults.ts`) para poder calibrarlos con las imágenes golden sin tocar la lógica.

### 6.1 Entrada y resolución

| Parámetro | Por defecto | Rango | Nota |
|---|---|---|---|
| `mmPorPixel` | **0,10** | 0,08–0,25 | Se deriva del tamaño final; ver tope de px |
| `ladoMaxPxDesktop` | **900** | 512–1400 | Tope duro |
| `ladoMaxPxMovil` | **640** | 400–900 | Si `deviceMemory ≤ 4` o `hardwareConcurrency ≤ 4` |
| `tamanoMaxArchivo` | **25 MB** | — | Rechazar antes de decodificar |
| `formatos` | PNG, JPG, WebP, SVG | — | **HEIC no** (ver §4.4) |

### 6.2 Máscara de fondo

| Parámetro | Por defecto | Rango | Nota |
|---|---|---|---|
| `umbralAlfa` | **128** | 1–254 | Cuando hay canal alfa |
| `toleranciaFloodFill` | **10** (distancia OKLab × 100) | 2–40 | Slider con preview en vivo |
| `erosionAntiHalo` | **1 px** | 0–3 px | Defringe obligatorio (§1.3) |
| `grabcutIteraciones` | **3** | 1–8 | Solo modo avanzado |
| `grabcutLadoMaxPx` | **512** | 320–800 | Downscale antes, upscale la máscara después |
| `radioPincelDefecto` | **12 px** de pantalla | 2–100 | Tamaño en pantalla, no en imagen |

### 6.3 Color

| Parámetro | Por defecto | Rango | Nota |
|---|---|---|---|
| `N` (colores) | **4** | 2–6 (tope duro 8) | 4 = un AMS |
| `espacioColor` | **OKLab** | OKLab / CIELAB | Para k-means |
| `muestraKmeans` | **30.000 px** | 10k–60k | Muestra aleatoria |
| `iteracionesKmeans` | **20**, con corte por convergencia 1e-4 | 10–50 | k-means++ para inicializar |
| `dithering` | **`'nearest'` (desactivado)** | — | **No exponer en la UI** |
| `mapeoPaleta` | ΔE2000 (`culori`) sobre los N centroides | — | Nunca por píxel |
| `avisoColisionPaleta` | ΔE2000 < 5 entre dos centroides mapeados | — | "Estos dos colores te van a quedar iguales" |
| `prefiltro` | mediana radio 1 px (preset Logo) · radio 2 px (preset Foto) | 0–3 | Bilateral solo si OpenCV ya está cargado |

### 6.4 Limpieza y geometría

| Parámetro | Por defecto | Rango | Nota |
|---|---|---|---|
| `areaMinimaIsla` | **1,0 mm²** (= 100 px a 0,1 mm/px) | 0,25–4 mm² | Islas menores se fusionan con el vecino dominante |
| `anchoMinimoDetalle` | **0,8 mm** | 0,45–1,5 mm | Apertura con radio `r = ancho/2 = 0,4 mm` |
| `toleranciaRDP` | **0,05 mm** | 0,02–0,10 mm | A 0,1 mm/px son 0,5 px |
| `epsilonSolapeCapas` | **0,05 mm** | 0,02–0,10 mm | **Clave contra costuras** (§3.3) |
| `paddingGrilla` | **1 px de fondo** en todo el borde | — | Antes de `d3-contour` |
| `correccionMedioPixel` | **restar 0,5 px** a las coordenadas | — | Gotcha de d3-contour |
| `offsetContorno` | **2,0 mm** | 0–4 mm | Borde de la silueta |
| `diametroAgujero` | **4,2 mm** (4,0 + 0,2 de compensación) | 3,5–5,5 mm | |
| `margenAgujero` | **≥ 3,0 mm** de material alrededor | ≥ 2,0 mm | Validación bloqueante si es < 2 mm |
| `alturaBase` | **2,4 mm** | 1,6–3,0 mm | Múltiplo de 0,2 |
| `alturaColor` | **0,6 mm** (3 capas) | 0,4–1,0 mm | Múltiplo de la altura de capa |
| `debounceRecalculo` | **150 ms** | 80–300 ms | |
| `maxVerticesPorRegion` | **2.000** | 500–5.000 | Corte de seguridad |

### 6.5 Presets de entrada (esto es lo que decide la calidad percibida)

| Preset | Fondo | Prefiltro | N | Área mín. isla | Para qué sirve |
|---|---|---|---|---|---|
| **Logo / Dibujo** | Alfa si existe, si no flood fill tol. 8 | Mediana r=1 | 3 | 0,5 mm² | Logos, vectores rasterizados, stickers |
| **Foto** | Clasificación por cluster (§1.4) + pincel | Mediana r=2 | 4 | 1,5 mm² | Mascotas, personas, objetos |
| **Silueta (1 color)** | Umbral adaptativo Bradley-Roth | Mediana r=1 | 2 | 1,0 mm² | Dibujos a lápiz, firmas, escaneos |

---

## 7. Los 5 riesgos técnicos más probables

| # | Riesgo | Probabilidad · Impacto | Mitigación concreta |
|---|---|---|---|
| **1** | **La máscara de fondo en fotos reales decepciona.** El usuario sube la foto del perro sobre el sillón, el recorte sale mal, se va. | **Alta · Alto** | (a) Preset "Foto" con **clasificación por cluster** en vez de matte (§1.4). (b) Pincel borrar/restaurar como herramienta de primera clase, no escondida. (c) Erosión anti-halo por defecto. (d) Galería de "imágenes que funcionan bien" en el propio uploader, como hace MakerLab. (e) Medir la tasa de abandono en el paso de máscara (métrica #1 del producto). |
| **2** | **Costuras y huecos entre capas de color** que no se ven en pantalla y aparecen recién en la impresión. | **Alta · Alto** (pero barata de evitar si se hace desde el día 1) | Cadena de resta por prioridad con **ε = 0,05 mm** dentro de `CrossSection` (§3.3). Test golden `área(unión de colores) == área(silueta)`. Validación visual con vista explotada por capas en el editor. |
| **3** | **Memoria en celular (sobre todo iOS): la pestaña muere sin error.** OpenCV.js + three.js + buffers. | **Media-alta · Alto** (pierde al usuario y no queda ni un log) | (a) OpenCV.js **solo bajo demanda**. (b) Resolución de trabajo reducida en móvil. (c) `.delete()` / `.close()` sistemáticos con un helper tipo `scope()`. (d) Contador de objetos WASM vivos en modo dev y test de fugas en CI. (e) Guardar el estado en IndexedDB con autosave, para que si la pestaña muere el usuario no pierda nada. |
| **4** | **Fugas de memoria WASM en el editor.** Manifold no tiene GC; cada drag crea `CrossSection` y `Manifold` temporales. Tras 200 ediciones, crash. | **Media-alta · Medio-alto** | Helper obligatorio `withScope(() => {...})` que trackea y borra todo lo creado. Prohibir por lint el uso directo de constructores de Manifold fuera del wrapper. Test que hace 500 operaciones y compara `HEAP.byteLength`. Caché por pieza con hash (geometría + transform) para no recalcular lo que no cambió. |
| **5** | **Dependencias inmaduras o con trampa de licencia.** `@visioncortex/vtracer` es alfa y solo Node; `vectortracer` está congelado en 2023; `image-q` sin releases desde 2022; `three-bvh-csg` es 0.0.x; y aparecen trampas nuevas como **libheif/heic2any (LGPL-3.0)**. | **Media · Medio** | (a) Todo detrás de interfaces propias (`Tracer`, `Quantizer`, `Matter`) para poder cambiar el motor sin tocar el resto. (b) `d3-contour` como camino por defecto: ISC, estable, sin WASM. (c) CI con chequeo de licencias **incluyendo transitivas y binarios WASM** (los `.wasm` no declaran licencia en npm: hay que auditarlos a mano). (d) Lista negra explícita: GPL, AGPL, **LGPL**, "no comercial", "sin licencia". (e) No soportar HEIC. |

**Riesgos secundarios que también conviene anotar:** (6) la compatibilidad del 3MF con cada versión de slicer — incluido el orden topológico de los `components` que exige PrusaSlicer (§5); (7) el alcance del editor tipo Tinkercad, que es el mayor riesgo de cronograma; (8) la propiedad intelectual de las imágenes que sube el usuario, sobre todo si después se venden impresas.

---

## 8. Correcciones a la investigación previa

Ordenadas de más a menos importante.

1. **[doc 01 §6.1 — corrección] El bloque COOP/COEP de `public/_headers` no hay que ponerlo.** Doc 01 dice que "solo hace falta si se habilitan hilos WASM" y que Manifold no lo necesita; lo confirmo y lo refuerzo: **ni Manifold ni OpenCV.js referencian `SharedArrayBuffer`** (verificado hoy: 0 ocurrencias en ambos bundles). Poner esas cabeceras "por las dudas" **rompe** la carga de recursos cross-origin sin CORP. Recomendación: dejar el archivo `_headers` sin COOP/COEP y documentar por qué.

2. **[doc 02 §1 — dato incorrecto] "OpenCV.js completo ~8–10 MB (no verificado)".** El valor real, medido hoy: **13.298.869 bytes sin comprimir, 3.752.997 gzip, 3.500.927 brotli**. Doc 01 (13,3 MB / ~3,8 MB gz) está bien; doc 02 hay que corregirlo. Es relevante porque doc 02 calcula el ancho de banda del hosting con ese número.

3. **[doc 01 §1.4 y §2.2 — ahora verificado] `@visioncortex/vtracer` NO funciona en el navegador.** Doc 01 lo marcaba "(no verificado en navegador)". Confirmado: el paquete publicado es `wasm-pack --target nodejs`, con `require('fs').readFileSync(__dirname + ...)` en el glue. Y **doc 02 §5.1 y §7 lo presentan directamente como opción de vectorización en el navegador junto a imagetracerjs, lo cual es incorrecto tal como está publicado hoy.** Novedad que compensa: existe **`vectortracer`** (npm, MIT, 0.1.2 de 2023-08-17), un build `wasm-pack` para navegador, compatible con Workers, wasm de 126 KB — pero envuelve `visioncortex 0.8`, sin `palette` ni `cutout`.

4. **[doc 01 §2.4 — dato engañoso] `three-bvh-csg` "1.4 MB".** Ese es el tarball de npm (con sourcemaps y `src/`). El build que realmente se importa pesa **163.575 bytes** (`build/index.module.js`). La corrección importante no es el peso sino los dos motivos reales para descartarlo: **no soporta Web Workers** (está en su roadmap) y **no garantiza salida two-manifold**, cosa que su propio README admite recomendando Manifold.

5. **[doc 01 §1.2 paso 4 — matiz de rendimiento] ΔE2000 por píxel es un error de performance.** `image-q` documenta que CIEDE2000 es "very slow". Correcto: k-means/asignación en **OKLab con euclídea** (250k operaciones baratas) y ΔE2000 **solo para mapear los N centroides** a la paleta de filamentos (4 operaciones). También vale aclarar en doc 01 que **`image-q` no tiene k-means** (tiene NeuQuant, RGBQuant y Wu); el k-means viene de `ml-kmeans`.

6. **[doc 01 §1.2 paso 7 — falta un detalle que rompe alineación] `d3-contour` devuelve coordenadas desplazadas 0,5 px** y conviene **padear la grilla con 1 px de fondo**. Sin la corrección del medio píxel, la geometría queda corrida respecto de la imagen de referencia y el agujero de la argolla y los textos posicionados sobre la imagen quedan desalineados.

7. **[doc 01 §1.2 paso 1 — se puede simplificar] La orientación EXIF ya viene resuelta**: `createImageBitmap` usa `imageOrientation: 'from-image'` por defecto (MDN). No hace falta parsear EXIF a mano. (Comportamiento exacto en Safari: **no verificado**.)

8. **[doc 01 §3.2 — falta un requisito real del formato] Orden topológico de los `components` en el 3MF.** El exportador oficial de manifold-3d ordena los componentes con el algoritmo de Kahn porque *"algunos parsers 3MF (como PrusaSlicer y sus derivados) esperan que los nodos hijo estén definidos antes que los padres"*. Hay que incorporarlo al escritor 3MF propio o el archivo puede no abrir en PrusaSlicer/Orca.

9. **[ambos docs — trampa de licencia nueva] HEIC.** Ni doc 01 ni doc 02 mencionan que **`libheif-js` es LGPL-3.0** y que `heic2any` (MIT en apariencia) tiene un issue abierto por violar esa licencia. Es la misma clase de trampa que potrace/imgly y hay que sumarla a la lista negra. Doc 01 §7 riesgo 9 menciona "HEIC de iPhone en Chrome" como problema de compatibilidad, pero no como problema de licencia.

10. **[doc 02 §5.1 — imprecisión conceptual] "GrabCut... funciona muy bien con logos y dibujos de fondo liso".** Mezcla dos cosas: para logos y fondos lisos lo que funciona es el **flood fill / umbral** (y GrabCut sería matar una mosca con un cañón de 3,5 MB); GrabCut es para **fotos**, que es justo donde peor anda. Conviene reescribir esa fila.

11. **[doc 01 §1.2 paso 1 — calibración] 0,08–0,12 mm/px es fino.** MakerTools3D, que es el competidor directo más parecido al MVP, recomienda **0,15–0,25 mm/px** para piezas chicas, y acepta archivos de hasta 25 MB. No es un error de doc 01 (más resolución = más detalle), pero como el costo crece al cuadrado, conviene dejar **0,10 mm/px con tope duro de píxeles** y exponer la resolución como parámetro avanzado.

12. **[doc 02 §0.8 — dato competitivo que suma] MakerTools3D no documenta ninguna función de quitar fondo, ni varita, ni pincel.** Sus parámetros son ancho final, espesor total, "piel visible" (mantiene 0,4 mm del color visible), mm/px y modo relieve/plano. Eso deja un **hueco competitivo claro**: la máscara de fondo bien resuelta + el editor tipo Tinkercad son la diferencia real, no la conversión en sí (que ya es commodity, como bien dice doc 02).

---

## 9. Lo que NO pude verificar y hay que medir antes de comprometerse

Ninguna de estas cosas bloquea el arranque, pero todas deberían medirse en la **semana 1** del MVP, con un banco de 15–20 imágenes reales (5 logos, 5 dibujos, 5 fotos de mascota, 3 capturas, 2 casos horribles a propósito):

1. **Tiempos reales por etapa** en 3 equipos: desktop, notebook vieja y un Android de gama media. Instrumentar con `performance.mark()` por etapa y loguear a consola en modo dev. Los números de §4.2 son estimaciones mías.
2. **Tasa de éxito real del recorte** por tipo de imagen (§1.1). Es la métrica que decide si el producto es "mágico" o "frustrante".
3. **Pico de memoria** en iOS Safari con y sin OpenCV.js cargado (probar en un iPhone real; el simulador no reproduce los límites).
4. **Costuras entre capas**: imprimir (o al menos rebanar en Bambu Studio/Orca) una pieza de 4 colores y mirar la vista previa capa por capa buscando huecos.
5. **Compatibilidad del 3MF** con las versiones actuales de Bambu Studio, OrcaSlicer y PrusaSlicer, incluido el orden topológico de componentes.
6. **VTracer 1.0 compilado a `--target web`**: ¿cuánto pesa, cuánto tarda, y el modo `cutout` resuelve realmente las costuras? Si la respuesta es sí, simplifica varias etapas del pipeline.
7. **Comportamiento de `d3-contour` en el borde de la grilla** (con y sin padding).
8. **`createImageBitmap` + EXIF en Safari** (iOS y macOS).

---

## 10. Fuentes consultadas

**Medición directa de paquetes (2026-09-11, vía `registry.npmjs.org`, `data.jsdelivr.com` y `cdn.jsdelivr.net`):** `manifold-3d@3.5.3` (tamaños, `.d.ts` de `CrossSection` y `Manifold`, `lib/export-3mf.js`), `@techstark/opencv-js@5.0.0-release.1` (tamaño gzip/brotli, búsqueda de `SharedArrayBuffer`/`pthread`/`grabCut`/`floodFill`/`watershed`), `@visioncortex/vtracer@1.0.0-alpha.4` (`index.js`, `index.d.ts`, glue `pkg/vtracer_wasm.js`), `vectortracer@0.1.2` (`package.json`, `Cargo.toml`, `.d.ts`), `image-q@4.0.0` (`basicAPI.d.ts`, `utils/palette.d.ts`), `three-bvh-csg@0.0.18`, `ml-kmeans@7.0.1`, `culori@4.0.2`, `d3-contour@4.0.2`, `simplify-js@1.2.4`, `imagetracerjs@1.2.6`, `esm-potrace-wasm@0.5.1`.

**Segmentación y quitar fondo**
- [OpenCV.js: Foreground Extraction using GrabCut](https://docs.opencv.org/4.13.0/dd/dfc/tutorial_js_grabcut.html)
- [OpenCV blog: Removing background using OpenCV](https://opencv.org/blog/remove-backgrounds-from-images-using-opencv/)
- [opencv_js.config.py (whitelist de OpenCV.js)](https://github.com/opencv/opencv/blob/master/platforms/js/opencv_js.config.py)
- [Adobe: remove fringe pixels from selections](https://helpx.adobe.com/photoshop/desktop/make-selections/refine-modify-selections/fringe-pixels-around-a-selection.html)
- [luiscarlosgph/grabcut (tiempos de referencia)](https://github.com/luiscarlosgph/grabcut)

**Cuantización y dithering**
- [Forty years of color quantization: a modern, algorithmic survey](https://dl.acm.org/doi/abs/10.1007/s10462-023-10406-6)
- [Celebi: Improving the performance of k-means for color quantization (PDF)](https://faculty.uca.edu/ecelebi/documents/IMAVIS_2011.pdf)
- [Guía de vectorización: "never enable dithering before a vector trace"](https://vectosolve.com/guides/en/vectorize-a-painting)
- [ImageMagick: Color Quantization and Dithering](https://usage.imagemagick.org/quantize/)
- [image-q (image-quantization)](https://github.com/ibezkrovnyi/image-quantization)

**Vectorización**
- [visioncortex/vtracer (README y parámetros)](https://github.com/visioncortex/vtracer)
- [AlansCodeLog/vectortracer (bindings WASM para navegador)](https://github.com/AlansCodeLog/vectortracer)
- [jankovicsandras/imagetracerjs](https://github.com/jankovicsandras/imagetracerjs)
- [d3-contour: documentación oficial](https://d3js.org/d3-contour/contour) · [repo](https://github.com/d3/d3-contour)

**Geometría**
- [elalish/manifold](https://github.com/elalish/manifold)
- [gkjohnson/three-bvh-csg (README: "experimental, in progress")](https://github.com/gkjohnson/three-bvh-csg)
- [Emscripten: Pthreads support (por qué TBB/paralelo exige COOP/COEP)](https://emscripten.org/docs/porting/pthreads.html)

**Navegador, plataforma y formatos**
- [MDN: createImageBitmap (opciones e `imageOrientation`)](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap)
- [MDN: OffscreenCanvas (Baseline desde marzo 2023)](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [Mobile Safari web pages are severely limited by memory](https://lapcatsoftware.com/articles/2026/1/7.html)
- [heic2any issue #59: violates libheif license (LGPL)](https://github.com/alexcorvi/heic2any/issues/59) · [libheif](https://github.com/strukturag/libheif)

**Competencia**
- [MakerTools3D: Image to 3MF (parámetros y recomendaciones)](https://makertools3d.com/image-to-3mf)
