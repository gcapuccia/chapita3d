# Fase 2 · Casos reales: por qué "La Ronda" salió inservible y qué otras imágenes rompen el pipeline

**Fecha:** 2026-09-13 · **Estado:** 🔍 medición, sin arreglos (no se tocó `src/` ni los tests) · 13 réplicas sintéticas + 1 imagen real del usuario

## Qué se hizo

Un usuario subió el logo "La Ronda · Tienda" (degradado gris, círculo de línea fina, texto curvo, mate de líneas, laureles) y el resultado fue inservible. Para no arreglar a ciegas, se armó un banco nuevo de **categorías de imagen que la gente sube de verdad y que el banco de F0.7 no cubría**, cada una con la verdad **por elemento** (el círculo, el texto, el mate…), y se corrió el pipeline de hoy con **todas** las combinaciones que la app permite.

| Archivo | Qué es |
|---|---|
| `spikes/07-casos-reales/escenas.ts` | Las escenas. Exporta `ESCENAS_REALES` (lista con la verdad por elemento y el ancho mínimo de cada uno), `renderizarReal()` (imagen RGBA + etiquetas + elemento por píxel), `salidaEnFuente()` (lleva el mapa de etiquetas del pipeline a la grilla de la fuente) y `decodificarJpeg()`. Polígonos NonZero con cobertura exacta; el texto son glifos de Nunito (OFL, `@fontsource/nunito`) vía opentype.js; el "JPEG" de las fotos es JPEG de verdad con `jpeg-js` (ya estaba en `node_modules` como dependencia transitiva; si falta, se simula con bloques). |
| `spikes/07-casos-reales/generar.ts` | Escribe `salida/escenas/<id>.png` y `<id>-verdad.png` para mirarlas. |
| `spikes/07-casos-reales/correr.ts` | La matriz de corridas, las métricas, las vistas PNG, los avisos de `construir()` a 25/50/80 mm, `salida/informe.md` (las 22 corridas de cada caso) y `salida/resultados.json`. |
| `spikes/07-casos-reales/umbral.ts` | Calibración del umbral de detalle fino por ancho, ángulo y fase de subpíxel. |

```sh
node spikes/07-casos-reales/generar.ts            # escenas y verdad en PNG (~5 s)
node spikes/07-casos-reales/correr.ts             # todo (~2 min); con ids (real-01-la-ronda gato) reescribe informe.md y resultados.json solo con esos
node spikes/07-casos-reales/umbral.ts             # tabla del umbral (~1 min)
```

Todo sale en `spikes/07-casos-reales/salida/` (ignorado por git). La imagen real del usuario (`C:\Users\guido\Downloads\prueba.jpg`) se lee de ahí y **no se copió al repo**: solo hay salidas en `salida/usuario-gato/`.

### Cómo se mide

- **Corridas (20 disponibles hoy):** tipo de imagen `auto | dibujo | foto | silueta` × colores `2..6`. Más dos **contrafácticos que la app NO permite**: `X-auto-4-lado80` (el pipeline limpia como si el dibujo midiera 80 mm) y `X-dibujo-4-sin-apertura` (sin el borrado de detalle fino), para separar causas.
- **Métricas, en píxeles de la fuente:** IoU y recall de la máscara; **FP %** = de todo lo que salió como dibujo, cuánto era fondo; **IoU color** = IoU exigiendo además el color correcto (un color de la paleta cuya mayoría de píxeles es fondo cuenta como espurio, aunque se parezca a un color del dibujo); **supervivencia por elemento** = % de sus píxeles que salieron con su color; los `casos` de `diagnostico.ts`; y los avisos reales de `construir()` con auto-4 a 25, 50 y 80 mm.
- **Vistas:** `salida/<id>/<corrida>-mascara.png` (verde = dibujo bien, **rojo = fondo que quedó como dibujo**, **azul = dibujo perdido**) y `<corrida>-etiquetas.png` (colores de la paleta; damero = fondo). Hay vistas de auto-4, de cada preset a 3/4/6 colores y de los contrafácticos.

## Primero: el tamaño del llavero no llega al pipeline

- El slider de tamaño (25–80 mm) **no reprocesa**: `escalar()` en `src/crear/SolapaLlavero.tsx:16-27` multiplica las regiones ya trazadas. `procesar()` solo le pasa al worker `{ preset, colores }` (`src/estado/documento.ts:153`).
- El pipeline siempre limpia con `ladoMayorMm = LADO_MAYOR_MM = 50` (`src/pipeline/defaults.ts:39`, `index.ts:67`) y la escala sale de la caja del dibujo: `mmFuente = 50 / lado mayor de la caja` (`index.ts:173`). **La resolución de la imagen no importa**: un trazo de 3 px en un dibujo de 300 px mide 0,5 mm aunque la imagen se agrande.
- Consecuencias medidas: (1) lo que se borró por fino a 50 mm **no vuelve** al subir a 80; (2) lo que quedó a 50 mm se avisa como fino al bajar a 25 (La Ronda: sin avisos a 50 mm, "Gris … 37 %" a 25 mm; probablemente es el aviso que vio el usuario); (3) el slider muestra `sx × 50` (`SolapaLlavero.tsx:34-36`) suponiendo que el dibujo mide 50 mm, y eso es falso cuando la caja se infla (causa 3 del ranking: el sticker de la foto sale de **28,9 mm** con el slider en "50 mm"; la pantalla de descarga sí muestra las medidas reales).
- Ni siquiera el contrafáctico ayuda a La Ronda: limpiando a 80 mm el círculo sobrevive 27 % (3 px en 304 px = 0,79 mm a 80 mm: sigue abajo del umbral).

## El umbral real de "detalle fino": todo o nada, y depende del ángulo

`node spikes/07-casos-reales/umbral.ts` (una barra sola sobre blanco, dibujo a 50 mm, preset Dibujo):

| ancho (mm) | 0° fase 0 | 0° fase 0,5 | 20° fase 0 | 20° fase 0,5 | 45° fase 0 | 45° fase 0,5 |
|---|---|---|---|---|---|---|
| 0,5 | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % |
| 0,6 | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % |
| 0,65 | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % |
| 0,7 | 0 % | 0 % | 100 % | 100 % | 100 % | 100 % |
| 0,75 | 0 % | 0 % | 100 % | 100 % | 100 % | 98 % |
| 0,8 | 0 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| 0,85 | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| 1 | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |

- **Todo o nada:** una línea más fina que el umbral **desaparece entera**; nunca se engrosa hasta lo imprimible. Causa: `limpiar.ts:119-129` abre cada color con un disco de radio `0,8 / 2 / 0,1 = 4 px` y lo borrado se rellena con el vecino o pasa a fondo.
- **Anisótropo:** en diagonal sobrevive desde 0,7 mm; horizontal o vertical necesita 0,8–0,85 mm según cómo caiga en la grilla. En el icono lineal (real-02) el zigzag de la montaña (diagonal, 0,5 mm + halo) sobrevive 100 % y la línea del suelo (horizontal, el mismo ancho) 0 %. Causa: la erosión discreta con `aFuera > r²` estricto (`morfologia.ts:93`) y que la máscara del flood fill incluye el halo de antialias (`mascara.ts:76` compara contra la semilla: todo píxel a más de 0,10 del fondo es dibujo), que engorda ~1 px cada borde.

## Resumen

"Por defecto" = lo que ve el usuario sin tocar nada (Automático, 4 colores). "¿Controles?" = si alguna de las 20 combinaciones de hoy lo deja bien.

| Caso | Categoría | Qué sale por defecto | IoU · IoU color (auto-4) | Mejor combinación hoy | ¿Controles? |
|---|---|---|---|---|---|
| real-01 La Ronda | logo lineal sobre degradado | El degradado adentro del círculo como 2–3 grises; círculo, textos, mate y bombilla desaparecen; quedan los laureles. **Reproduce exactamente lo que vio el usuario.** | 0,22 · 0,06 | silueta-4: 0,36 (solo laureles, contorno del mate y bombilla, inestable según colores) | ❌ |
| real-02 icono lineal | trazos de 0,5 mm sobre blanco | Auto pasa a Foto sin ganar nada; sobreviven las diagonales y el texto a medias; suelo, sol y rayos desaparecen | 0,52 · 0,52 | auto-2: 0,52 | ❌ |
| real-03 aro sobre crema | fondo encerrado, fondo claro | El interior crema queda como dibujo, pero `crearDiseno` lo funde con la base blanca: **el llavero se ve bien** | 0,30 · 0,30 | foto-*: 0,97 | ✅ en la práctica |
| real-04 degradado suave | logo relleno sobre degradado gris | Bien | 0,99 · 0,99 | auto-4 | ✅ |
| real-05 foto de sticker | foto de celular sobre madera | Máscara bien, pero el dibujo sale de **28,9 mm** (caja inflada), la madera suma un 4.º color marrón y parte de la sombra | 0,96 · 0,95 | auto-4 | ⚠️ tamaño a medias con el slider |
| real-06 texto corto | "Lucía" grueso | Bien (los ojos de las letras quedan blancos y se funden con la base) | 0,94 · 0,94 | silueta-2: 0,98 | ✅ |
| real-07 texto largo | "Panadería San Martín" | Legible en pantalla, pero llavero de **50 × 3,7 mm** con aviso de detalle fino 42 % | 0,80 · 0,76 | foto-2: 0,85 | ❌ (la altura no tiene control) |
| real-08 oscuro con textura | bajo contraste | El flood fill se come el escudo (0 %): queda solo la M, de **15,9 mm** | 0,18 · 0,18 | foto-3: 0,50 (escudo y M, pero con manchas de la textura) | ❌ |
| real-09 avatar circular | captura de foto de perfil | Bien | 1,00 · 0,99 | auto-3 | ✅ |
| real-10 mascota caricatura | contornos negros de 0,36 mm | Rellenos, ojos y nariz bien; **los contornos desaparecen** (el dibujo pierde la línea); con 4 colores se va la lengua; aviso "5 colores y tu impresora carga 4" | 1,00 · 0,93 | auto-5: 0,94 | ⚠️ contornos ❌ |
| real-11 escalera | calibración | Barras de 0,3/0,5/0,7 mm: 0 %; de 0,8 en adelante: 100 % | — | — | (por diseño) |
| real-12 degradado fuerte | logo blanco sobre degradado de color | Dos esquinas del degradado quedan como filamentos beige y azul; la caja es la imagen entera y el logo ocupa ~28 mm del llavero de 50 | 0,71 · 0,71 | auto-2: 0,71 | ❌ |
| real-13 aro sobre rojo | fondo encerrado, fondo de color | El interior rojo se imprime como un disco rojo (+ un color de antialias). **Ningún aviso** | 0,30 · 0,30 | foto-*: 0,97 | ⚠️ solo si el usuario adivina "Foto" |
| usuario-gato | ilustración de gato sobre negro (real) | Fondo negro sacado limpio, 1 pieza, silueta reconocible; cara irreconocible, sin bigotes | ≈0,94 (contra umbral de luminancia) | auto-4 / dibujo-6 | ⚠️ |

## Detalle por caso

Números completos (las 22 corridas) en `spikes/07-casos-reales/salida/informe.md`. Acá: por defecto, auto a 2 y 6, cada preset a 3/4/6 y los contrafácticos. Las columnas de elementos son el % de sus píxeles que salió con su color.

### real-01 · La Ronda (logo lineal fino + degradado + contorno cerrado)

Ancho mínimo por elemento con el dibujo a 50 mm: circulo 0,49 mm · texto-la-ronda 0,41 mm · mate-relleno 6,58 mm · mate-motas 0,43 mm · mate-contorno 0,49 mm · bombilla 0,49 mm · texto-tienda 0,36 mm · laurel-tallos 0,49 mm · laurel-hojas 1,15 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | circulo | texto-la-ronda | mate-relleno | mate-motas | mate-contorno | bombilla | texto-tienda | laurel-tallos | laurel-hojas | casos |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 4 | 0,22 | 1,00 | 78 | 0,06 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 52 | 97 | — |
| auto-2 | floodFill (dibujo) | 2 | 0,22 | 1,00 | 78 | 0,06 | 0 | 3 | 0 | 0 | 0 | 7 | 0 | 61 | 98 | — |
| auto-6 | floodFill (dibujo) | 5 | 0,22 | 1,00 | 78 | 0,13 | 0 | 0 | 100 | 0 | 0 | 0 | 0 | 56 | 97 | — |
| dibujo-3 | floodFill | 3 | 0,22 | 1,00 | 78 | 0,06 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 65 | 99 | — |
| dibujo-6 | floodFill | 5 | 0,22 | 1,00 | 78 | 0,13 | 0 | 0 | 100 | 0 | 0 | 0 | 0 | 56 | 97 | — |
| foto-3 | clusters | 2 | 0,10 | 0,64 | 89 | 0,04 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 91 | 73 | huecos-en-dibujo |
| foto-4 | clusters | 2 | 0,10 | 0,64 | 89 | 0,04 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 91 | 73 | huecos-en-dibujo |
| foto-6 | clusters | 3 | 0,10 | 0,64 | 89 | 0,04 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 90 | 73 | huecos-en-dibujo |
| silueta-3 | umbral | 2 | 0,28 | 0,28 | 1 | 0,28 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 91 | 96 | dibujo-no-encontrado |
| silueta-4 | umbral | 2 | 0,36 | 0,37 | 3 | 0,36 | 0 | 16 | 0 | 0 | 100 | 99 | 0 | 91 | 96 | dibujo-no-encontrado |
| silueta-6 | umbral | 3 | 0,28 | 0,28 | 1 | 0,28 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 91 | 96 | dibujo-no-encontrado |
| *X-auto-4-lado80* (no disponible) | floodFill | 4 | 0,22 | 1,00 | 78 | 0,07 | 27 | 4 | 0 | 0 | 2 | 18 | 0 | 49 | 99 | — |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 0,22 | 1,00 | 78 | 0,12 | 94 | 86 | 0 | 0 | 83 | 90 | 59 | 93 | 94 | texto-chico |

Mejor combinación con los controles de hoy: **silueta-4** (IoU color 0,36, IoU 0,36).

Avisos de construir() con auto-4: 25 mm → Gris claro 2 %; Gris claro 2 3 %; Gris 37 % · 50 mm → ninguno · 80 mm → ninguno

**Qué pasa.** Es exactamente el resultado del usuario (`salida/real-01-la-ronda/auto-4-etiquetas.png`): el interior del círculo es un disco de dos grises partidos en vertical, y del logo solo quedan los laureles.

1. **El degradado de afuera se saca bien; el de adentro no.** El flood fill arranca en el borde de la imagen (`mascara.ts:39-66`) y avanza por vecinos (`mascara.ts:69-80`): el círculo de 3 px es una pared cerrada y el interior nunca se visita, así que queda todo como dibujo (`mascara.ts:83`). FP 78 %. El degradado en sí no es el problema (ver real-04: el mismo degradado sin contorno cerrado sale con IoU 0,99).
2. **k-means reparte el degradado encerrado** en 2–3 grises (`#BBBBBB`, `#D7D7D6`, más uno de antialias): de ahí la división vertical. El relleno blanco hueso del mate (`#EEEAE4`) queda dentro del gris claro y se pierde (0 %); solo con 5–6 colores aparece como color propio.
3. **Todo lo de 0,36–0,49 mm desaparece:** círculo, "LA RONDA", "TIENDA", contorno del mate, bombilla, motas (`limpiar.ts:119-129`). Las hojas del laurel (1,15 mm) son lo único más ancho que el umbral. El contrafáctico sin apertura recupera círculo 94 %, texto curvo 86 %, contorno del mate 83 %, bombilla 90 % y TIENDA 59 %: **la línea fina es la causa de la desaparición, el fondo encerrado es la causa del disco gris**.
4. **El diagnóstico no dice nada** (0 casos en auto): no hay huecos en la máscara (el fondo encerrado no es un hueco, es "dibujo") y la tinta supera el 5 %. Auto no cambia de preset (`index.ts:278`).
5. **Ninguna combinación sirve:** Foto (clusters que tocan el borde, `presets.ts:121-122`) se lleva el degradado entero como dibujo (FP 89 %). Silueta (umbral adaptativo) no ve el degradado, pero la apertura igual borra casi todo; con 4 colores sobreviven contorno del mate y bombilla, con 3 o 6 no (inestable).

### real-02 · Icono lineal sobre blanco (solo líneas finas)

Ancho mínimo por elemento con el dibujo a 50 mm: montania 0,50 mm · suelo 0,50 mm · sol 0,50 mm · rayos 0,50 mm · texto 0,50 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | montania | suelo | sol | rayos | texto | casos |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | clusters (foto) | 2 | 0,52 | 0,60 | 20 | 0,52 | 100 | 0 | 0 | 0 | 83 | dibujo-no-encontrado |
| auto-2 | clusters (foto) | 1 | 0,52 | 0,60 | 20 | 0,52 | 100 | 0 | 0 | 0 | 83 | dibujo-no-encontrado |
| auto-6 | clusters (foto) | 2 | 0,52 | 0,60 | 20 | 0,52 | 100 | 0 | 0 | 0 | 83 | dibujo-no-encontrado |
| dibujo-3 | floodFill | 3 | 0,52 | 0,64 | 26 | 0,42 | 100 | 0 | 0 | 0 | 57 | dibujo-no-encontrado |
| dibujo-6 | floodFill | 6 | 0,52 | 0,64 | 26 | 0,42 | 100 | 0 | 0 | 0 | 55 | dibujo-no-encontrado |
| foto-3 | clusters | 2 | 0,52 | 0,60 | 20 | 0,52 | 100 | 0 | 0 | 0 | 83 | dibujo-no-encontrado |
| foto-4 | clusters | 2 | 0,52 | 0,60 | 20 | 0,52 | 100 | 0 | 0 | 0 | 83 | dibujo-no-encontrado |
| foto-6 | clusters | 2 | 0,52 | 0,60 | 20 | 0,52 | 100 | 0 | 0 | 0 | 83 | dibujo-no-encontrado |
| silueta-3 | umbral | 2 | 0,51 | 0,55 | 11 | 0,51 | 99 | 0 | 0 | 0 | 69 | dibujo-no-encontrado |
| silueta-4 | umbral | 2 | 0,51 | 0,55 | 11 | 0,51 | 99 | 0 | 0 | 0 | 69 | dibujo-no-encontrado |
| silueta-6 | umbral | 2 | 0,51 | 0,55 | 11 | 0,51 | 99 | 0 | 0 | 0 | 69 | dibujo-no-encontrado |
| *X-auto-4-lado80* (no disponible) | clusters | 3 | 0,85 | 1,00 | 15 | 0,85 | 100 | 100 | 100 | 100 | 100 | dibujo-no-encontrado, demasiados-colores |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 0,78 | 1,00 | 22 | 0,78 | 100 | 100 | 100 | 100 | 100 | dibujo-no-encontrado |

Mejor combinación con los controles de hoy: **auto-2** (IoU color 0,52, IoU 0,52).

Avisos de construir() con auto-4: 25 mm → Negro 100 %; El llavero quedó en 2 partes separadas · 50 mm → Negro 87 %; El llavero quedó en 3 partes separadas · 80 mm → El llavero quedó en 3 partes separadas

**Qué pasa.** Todos los trazos miden 0,5 mm con el dibujo a 50 mm. Sobreviven los que van en diagonal (la montaña) y parte del texto; desaparecen la línea del suelo, el sol y los rayos (horizontales o curvas cerradas sobre sí). Ver `dibujo-4-etiquetas.png`: además, los ojos de la "o" y la "a" quedan blancos (fondo encerrado, invisible en el llavero porque se funde con la base) y la tilde de la ñ se pierde.

- **Causa principal:** apertura de 0,8 mm (`limpiar.ts:119-129`) + anisotropía (`morfologia.ts:93`). Sin apertura, todo sobrevive (IoU 0,78; lo que falta hasta 1 es el halo y los ojos de las letras).
- **Auto elige mal:** la tinta ocupa menos del 5 % de la imagen → `dibujo-no-encontrado` (`diagnostico.ts:124`) → `convertirAutomatico` pasa a Foto sola (`index.ts:278`), que no mejora nada. En una ilustración de líneas es normal tener poca tinta.
- **Avisos a 50 mm:** "Negro tiene partes más finas que 0.8 mm (87 %)" y "El llavero quedó en 3 partes separadas".
- Con los controles de hoy no hay salida: el mejor IoU es 0,52 en todas las combinaciones. Limpiando a 80 mm (contrafáctico) sobrevive todo: esta es la única escena donde el tamaño, si llegara al pipeline, lo resolvería.

### real-03 · Aro cerrado sobre fondo crema plano (solo fondo encerrado)

Ancho mínimo por elemento con el dibujo a 50 mm: aro 2,27 mm · estrella 4,55 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | aro | estrella | casos |
|---|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 4 | 0,30 | 1,00 | 70 | 0,30 | 99 | 99 | — |
| auto-2 | floodFill (dibujo) | 2 | 0,30 | 1,00 | 70 | 0,00 | 0 | 0 | demasiados-colores |
| auto-6 | floodFill (dibujo) | 6 | 0,30 | 1,00 | 70 | 0,30 | 99 | 99 | — |
| dibujo-3 | floodFill | 3 | 0,30 | 1,00 | 70 | 0,30 | 99 | 99 | — |
| dibujo-6 | floodFill | 6 | 0,30 | 1,00 | 70 | 0,30 | 99 | 99 | — |
| foto-3 | clusters | 2 | 0,97 | 1,00 | 3 | 0,97 | 100 | 100 | — |
| foto-4 | clusters | 2 | 0,97 | 1,00 | 3 | 0,97 | 100 | 100 | — |
| foto-6 | clusters | 2 | 0,97 | 1,00 | 3 | 0,97 | 100 | 100 | — |
| silueta-3 | umbral | 2 | 0,86 | 0,86 | 1 | 0,86 | 99 | 70 | — |
| silueta-4 | umbral | 2 | 0,86 | 0,86 | 1 | 0,86 | 99 | 70 | — |
| silueta-6 | umbral | 2 | 0,86 | 0,86 | 1 | 0,86 | 99 | 70 | — |
| *X-auto-4-lado80* (no disponible) | floodFill | 4 | 0,30 | 1,00 | 70 | 0,30 | 100 | 100 | — |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 0,30 | 1,00 | 70 | 0,30 | 99 | 99 | — |

Mejor combinación con los controles de hoy: **foto-2** (IoU color 0,97, IoU 0,97).

Avisos de construir() con auto-4: 25 mm → ninguno · 50 mm → ninguno · 80 mm → ninguno

**Qué pasa.** El interior del aro queda como dibujo (FP 70 %), igual que en La Ronda. **Pero el llavero sale bien**: `crearDiseno` funde el crema `#F7F5F0` con la base blanca (ΔE2000 < 5, `src/diseno/crear.ts:70-80`) y el cuerpo del llavero es de base de todas formas. Resultado visual: disco blanco con aro verde y estrella roja. Es un error de máscara que hoy **no se ve** porque el fondo es casi blanco.

- Foto lo resuelve (IoU 0,97): los clusters son globales, no dependen de la conectividad desde el borde.
- Con 2 colores el verde y el rojo se funden en un marrón (`#8E6930`): esperable, pero sin aviso más que "demasiados colores".

### real-04 · Formas rellenas sobre el mismo degradado de La Ronda, sin contornos cerrados

Ancho mínimo por elemento con el dibujo a 50 mm: hoja 15,87 mm · circulo 21,83 mm · barra 6,94 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | hoja | circulo | barra | casos |
|---|---|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 4 | 0,99 | 1,00 | 1 | 0,99 | 100 | 100 | 100 | — |
| auto-2 | floodFill (dibujo) | 2 | 0,99 | 1,00 | 1 | 0,28 | 0 | 0 | 100 | demasiados-colores |
| auto-6 | floodFill (dibujo) | 5 | 0,99 | 1,00 | 1 | 0,99 | 100 | 100 | 100 | — |
| dibujo-3 | floodFill | 3 | 0,99 | 1,00 | 1 | 0,99 | 100 | 100 | 100 | — |
| dibujo-6 | floodFill | 5 | 0,99 | 1,00 | 1 | 0,99 | 100 | 100 | 100 | — |
| foto-3 | clusters | 3 | 0,53 | 1,00 | 47 | 0,37 | 100 | 0 | 100 | huecos-en-dibujo, demasiados-colores |
| foto-4 | clusters | 4 | 0,53 | 1,00 | 47 | 0,53 | 100 | 100 | 100 | huecos-en-dibujo |
| foto-6 | clusters | 4 | 0,53 | 1,00 | 47 | 0,53 | 100 | 100 | 100 | huecos-en-dibujo |
| silueta-3 | umbral | 3 | 0,32 | 0,32 | 0 | 0,32 | 18 | 0 | 86 | — |
| silueta-4 | umbral | 3 | 0,32 | 0,32 | 0 | 0,32 | 18 | 0 | 86 | — |
| silueta-6 | umbral | 3 | 0,32 | 0,32 | 0 | 0,32 | 18 | 0 | 86 | — |
| *X-auto-4-lado80* (no disponible) | floodFill | 4 | 1,00 | 1,00 | 0 | 1,00 | 100 | 100 | 100 | — |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 0,99 | 1,00 | 1 | 0,99 | 100 | 100 | 100 | — |

Mejor combinación con los controles de hoy: **auto-4** (IoU color 0,99, IoU 0,99).

Avisos de construir() con auto-4: 25 mm → El llavero quedó en 2 partes separadas · 50 mm → El llavero quedó en 2 partes separadas · 80 mm → El llavero quedó en 2 partes separadas

**Funciona.** IoU 0,99 con Dibujo a 3–6 colores. El flood fill compara cada píxel con **su** semilla y hay semillas a lo largo de todo el borde de arriba y de abajo (que recorren el degradado entero): cada columna se vacía desde su propia semilla. Un degradado de ΔOKLab 0,275 se saca completo.

- Con 2 colores el verde y el naranja se funden en oliva (esperable).
- Foto es peor (FP 47 %: toma un gris del degradado como dibujo) y Silueta pierde el círculo naranja (claro sobre claro).
- Aparece un 4.º color de antialias (`#A7933C`) donde la hoja toca el círculo.

### real-05 · Foto de celular de un sticker sobre una mesa (luz despareja, sombra, desenfoque, JPEG 55)

Ancho mínimo por elemento con el dibujo a 50 mm: sombra 38,46 mm · borde-blanco 3,85 mm · circulo-azul 28,85 mm · rayo 3,85 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | sombra | borde-blanco | circulo-azul | rayo | casos |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 4 | 0,96 | 1,00 | 4 | 0,95 | — | 100 | 99 | 97 | — |
| auto-2 | floodFill (dibujo) | 2 | 0,96 | 1,00 | 4 | 0,89 | — | 100 | 100 | 0 | demasiados-colores |
| auto-6 | floodFill (dibujo) | 6 | 0,96 | 1,00 | 4 | 0,95 | — | 100 | 99 | 97 | — |
| dibujo-3 | floodFill | 3 | 0,96 | 1,00 | 4 | 0,90 | — | 100 | 100 | 0 | demasiados-colores |
| dibujo-6 | floodFill | 6 | 0,96 | 1,00 | 4 | 0,95 | — | 100 | 99 | 97 | — |
| foto-3 | clusters | 3 | 0,61 | 1,00 | 39 | 0,57 | — | 100 | 99 | 0 | huecos-en-dibujo |
| foto-4 | clusters | 4 | 0,61 | 1,00 | 39 | 0,61 | — | 100 | 99 | 96 | huecos-en-dibujo |
| foto-6 | clusters | 5 | 0,61 | 1,00 | 39 | 0,61 | — | 99 | 100 | 96 | huecos-en-dibujo |
| silueta-3 | umbral | 3 | 0,20 | 0,32 | 65 | 0,20 | — | 0 | 94 | 0 | huecos-en-dibujo |
| silueta-4 | umbral | 4 | 0,20 | 0,32 | 65 | 0,20 | — | 0 | 94 | 0 | huecos-en-dibujo |
| silueta-6 | umbral | 4 | 0,20 | 0,32 | 65 | 0,20 | — | 0 | 94 | 0 | huecos-en-dibujo |
| *X-auto-4-lado80* (no disponible) | floodFill | 4 | 0,94 | 1,00 | 6 | 0,88 | — | 100 | 100 | 0 | demasiados-colores |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 0,96 | 1,00 | 4 | 0,95 | — | 100 | 99 | 98 | — |

Mejor combinación con los controles de hoy: **auto-4** (IoU color 0,95, IoU 0,96).

Avisos de construir() con auto-4: 25 mm → 5 colores > 4 slots; Amarillo 10 %; Negro 76 % · 50 mm → 5 colores > 4 slots; Negro 6 % · 80 mm → 5 colores > 4 slots; Negro 2 %

**Funciona a medias.** La máscara es buena (IoU 0,96, FP 4 %: parte de la sombra de abajo), los tres colores salen bien con 4 colores. Pero:

1. **El dibujo mide 28,9 × 23,8 mm, no 50.** La caja se calcula sobre la máscara de la previa (`index.ts:157-170`) con `cajaDeMascara`, que toma **cualquier** píxel marcado (`mascara.ts:123-138`): la veta de la madera y las esquinas oscuras dejan 616 motas sueltas en la previa (la mayor, el sticker, tiene 181 488 px; la siguiente, 472) y la caja pasa de 520 × 420 a 937 × 723 px. Después, sobre el recorte, el flood fill sí saca esas motas, pero la escala ya salió de la caja inflada (`index.ts:173`). El slider dice "50 mm". Moverlo a 80 da ~46 mm reales, pero la limpieza ya se hizo a la escala equivocada (los detalles se midieron como si fueran un 45 % más finos).
2. **La madera se cuela como color:** un marrón `#3A2718` (restos de la sombra y del borde) ocupa un slot. Con 3 colores eso le gana al rayo amarillo, que desaparece (0 %). Aviso: "El diseño usa 5 colores y tu impresora carga 4" (la base blanca cuenta aparte, ver causa 5).
3. Foto se lleva media mesa (FP 39 %) y Silueta pierde el borde blanco del sticker.

### real-06 · "Lucía" en sans gruesa

Ancho mínimo por elemento con el dibujo a 50 mm: texto 3,22 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | texto | casos |
|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 4 | 0,94 | 1,00 | 6 | 0,94 | 100 | — |
| auto-2 | floodFill (dibujo) | 2 | 0,94 | 1,00 | 6 | 0,94 | 100 | — |
| auto-6 | floodFill (dibujo) | 6 | 0,94 | 1,00 | 6 | 0,94 | 100 | — |
| dibujo-3 | floodFill | 3 | 0,94 | 1,00 | 6 | 0,94 | 100 | — |
| dibujo-6 | floodFill | 6 | 0,94 | 1,00 | 6 | 0,94 | 100 | — |
| foto-3 | clusters | 1 | 0,96 | 1,00 | 4 | 0,96 | 100 | — |
| foto-4 | clusters | 1 | 0,96 | 1,00 | 4 | 0,96 | 100 | — |
| foto-6 | clusters | 1 | 0,96 | 1,00 | 4 | 0,96 | 100 | — |
| silueta-3 | umbral | 1 | 0,98 | 0,99 | 1 | 0,98 | 99 | — |
| silueta-4 | umbral | 1 | 0,98 | 0,99 | 1 | 0,98 | 99 | — |
| silueta-6 | umbral | 1 | 0,98 | 0,99 | 1 | 0,98 | 99 | — |
| *X-auto-4-lado80* (no disponible) | floodFill | 4 | 0,95 | 1,00 | 5 | 0,95 | 100 | — |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 0,94 | 1,00 | 6 | 0,94 | 100 | — |

Mejor combinación con los controles de hoy: **silueta-2** (IoU color 0,98, IoU 0,98).

Avisos de construir() con auto-4: 25 mm → ninguno · 50 mm → ninguno · 80 mm → El llavero quedó en 2 partes separadas

**Funciona.** Palos de 3,2 mm, texto 100 %. El FP de 6 % son los ojos de la "a" (fondo encerrado) que salen blancos y se funden con la base: no se ven. Silueta y Foto dan 1 color y un poco mejor IoU (0,96–0,98). Con Auto aparecen colores de antialias (`#494949`, `#A8A8A8`) que ocupan slots sin aportar.

### real-07 · "Panadería San Martín" en una línea

Ancho mínimo por elemento con el dibujo a 50 mm: texto 0,60 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | texto | casos |
|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 4 | 0,80 | 0,98 | 19 | 0,76 | 93 | fondo-complejo |
| auto-2 | floodFill (dibujo) | 2 | 0,80 | 0,98 | 19 | 0,76 | 93 | fondo-complejo |
| auto-6 | floodFill (dibujo) | 5 | 0,80 | 0,98 | 19 | 0,76 | 93 | fondo-complejo |
| dibujo-3 | floodFill | 3 | 0,80 | 0,98 | 19 | 0,76 | 93 | fondo-complejo |
| dibujo-6 | floodFill | 5 | 0,80 | 0,98 | 19 | 0,76 | 93 | fondo-complejo |
| foto-3 | clusters | 1 | 0,85 | 0,98 | 14 | 0,85 | 98 | — |
| foto-4 | clusters | 1 | 0,85 | 0,98 | 14 | 0,85 | 98 | — |
| foto-6 | clusters | 1 | 0,85 | 0,98 | 14 | 0,85 | 98 | — |
| silueta-3 | umbral | 2 | 0,42 | 0,43 | 5 | 0,42 | 43 | — |
| silueta-4 | umbral | 2 | 0,42 | 0,43 | 5 | 0,42 | 43 | — |
| silueta-6 | umbral | 2 | 0,42 | 0,43 | 5 | 0,42 | 43 | — |
| *X-auto-4-lado80* (no disponible) | floodFill | 4 | 0,82 | 1,00 | 18 | 0,79 | 97 | fondo-complejo |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 0,81 | 1,00 | 19 | 0,81 | 100 | fondo-complejo |

Mejor combinación con los controles de hoy: **foto-2** (IoU color 0,85, IoU 0,85).

Avisos de construir() con auto-4: 25 mm → Negro 78 %; Negro tiene 6 parte(s) de menos de 1 mm² · 50 mm → Negro 42 % · 80 mm → El llavero quedó en 2 partes separadas

**Qué pasa.** Las letras se leen (93 %: los palos, estimados en ~0,6–0,75 mm, sobreviven gracias al halo y a las curvas), pero el llavero sale de **50 × 3,7 mm**: la escala pone el lado mayor en 50 mm (`index.ts:173`) y un nombre largo en una línea queda con letras de menos de 4 mm. `construir()` avisa "Negro tiene partes más finas que 0.8 mm (42 %)". La regla de texto mínimo (6 mm de alto, `defaults.ts:174` `ALTURA_MIN_TEXTO_MM`) solo se aplica a los textos agregados en la app (`drcTexto`), no al texto que viene en la imagen, y `texto-chico` no salta porque las letras no son "alargadas" (`diagnostico.ts:214`).

- Acá sí aparece un caso: `fondo-complejo` (sugiere Foto), y Foto mejora un poco (IoU 0,85, 1 color). La altura de 3,7 mm no se arregla con nada: el slider llega a 80 mm → 5,9 mm de alto, y la limpieza ya se hizo a 50.

### real-08 · Logo oscuro sobre fondo oscuro con textura (JPEG 70)

Ancho mínimo por elemento con el dibujo a 50 mm: escudo 28,36 mm · letra-m 4,25 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | escudo | letra-m | casos |
|---|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 2 | 0,18 | 0,18 | 0 | 0,18 | 0 | 100 | fondo-complejo |
| auto-2 | floodFill (dibujo) | 2 | 0,18 | 0,18 | 0 | 0,18 | 0 | 100 | fondo-complejo |
| auto-6 | floodFill (dibujo) | 2 | 0,18 | 0,18 | 0 | 0,18 | 0 | 100 | fondo-complejo |
| dibujo-3 | floodFill | 2 | 0,18 | 0,18 | 0 | 0,18 | 0 | 100 | fondo-complejo |
| dibujo-6 | floodFill | 2 | 0,18 | 0,18 | 0 | 0,18 | 0 | 100 | fondo-complejo |
| foto-3 | clusters | 3 | 0,50 | 1,00 | 50 | 0,50 | 99 | 99 | huecos-en-dibujo |
| foto-4 | clusters | 3 | 0,50 | 1,00 | 50 | 0,50 | 99 | 99 | huecos-en-dibujo |
| foto-6 | clusters | 4 | 0,50 | 1,00 | 50 | 0,50 | 99 | 99 | huecos-en-dibujo |
| silueta-3 | umbral | 2 | 0,16 | 0,18 | 35 | 0,16 | 21 | 0 | huecos-en-dibujo |
| silueta-4 | umbral | 2 | 0,16 | 0,18 | 35 | 0,16 | 21 | 0 | huecos-en-dibujo |
| silueta-6 | umbral | 2 | 0,16 | 0,18 | 35 | 0,16 | 21 | 0 | huecos-en-dibujo |
| *X-auto-4-lado80* (no disponible) | floodFill | 3 | 0,18 | 0,18 | 0 | 0,18 | 0 | 100 | fondo-complejo |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 2 | 0,18 | 0,18 | 0 | 0,18 | 0 | 100 | fondo-complejo |

Mejor combinación con los controles de hoy: **foto-3** (IoU color 0,50, IoU 0,50).

Avisos de construir() con auto-4: 25 mm → ninguno · 50 mm → ninguno · 80 mm → ninguno

**Qué pasa.** El escudo (ΔOKLab 0,094 contra el fondo, apenas por debajo de la tolerancia 0,10 de `defaults.ts:65`) se lo come el flood fill: queda solo la M, y el llavero mide 15,9 mm porque la caja (inflada por 1 957 motas de textura en la previa) es mucho más grande que la M.

- Foto recupera escudo y M (99 %), pero se lleva también manchas de la textura (FP 50 %, 17 piezas): inservible sin poder tocar qué clusters son fondo (eso llega en el incremento 2).
- Silueta asume tinta oscura sobre papel claro (`presets.ts:82`) y marca como tinta las vetas oscuras del fondo.
- El caso `fondo-complejo` sí aparece y sugiere Foto, que es "menos malo".

### real-09 · Captura de foto de perfil circular (esquinas blancas)

Ancho mínimo por elemento con el dibujo a 50 mm: disco 50,00 mm · taza 1,93 mm · vapor 1,05 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | disco | taza | vapor | casos |
|---|---|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 4 | 1,00 | 1,00 | 0 | 0,99 | 99 | 99 | 97 | — |
| auto-2 | floodFill (dibujo) | 2 | 1,00 | 1,00 | 0 | 0,86 | 99 | 0 | 100 | demasiados-colores |
| auto-6 | floodFill (dibujo) | 6 | 1,00 | 1,00 | 0 | 0,99 | 99 | 99 | 96 | — |
| dibujo-3 | floodFill | 3 | 1,00 | 1,00 | 0 | 0,99 | 99 | 99 | 97 | — |
| dibujo-6 | floodFill | 6 | 1,00 | 1,00 | 0 | 0,99 | 99 | 99 | 96 | — |
| foto-3 | clusters | 3 | 0,98 | 0,98 | 0 | 0,98 | 100 | 99 | 0 | — |
| foto-4 | clusters | 4 | 0,98 | 0,98 | 0 | 0,98 | 100 | 99 | 0 | — |
| foto-6 | clusters | 6 | 0,98 | 0,98 | 0 | 0,98 | 100 | 99 | 0 | — |
| silueta-3 | umbral | 1 | 0,04 | 0,04 | 0 | 0,04 | 0 | 32 | 0 | — |
| silueta-4 | umbral | 1 | 0,04 | 0,04 | 0 | 0,04 | 0 | 32 | 0 | — |
| silueta-6 | umbral | 1 | 0,04 | 0,04 | 0 | 0,04 | 0 | 32 | 0 | — |
| *X-auto-4-lado80* (no disponible) | floodFill | 4 | 1,00 | 1,00 | 0 | 1,00 | 100 | 100 | 99 | imagen-borrosa |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 1,00 | 1,00 | 0 | 0,99 | 99 | 99 | 98 | — |

Mejor combinación con los controles de hoy: **auto-3** (IoU color 0,99, IoU 1,00).

Avisos de construir() con auto-4: 25 mm → ninguno · 50 mm → ninguno · 80 mm → ninguno

**Funciona.** IoU 1,00 con Dibujo/Auto a 3–6 colores: el disco se recorta limpio, el vapor blanco encerrado se conserva (es dibujo y es > 0,8 mm). Con 2 colores se pierde la taza. Foto pierde el vapor (lo toma como el blanco del borde); **Silueta es catastrófico** (4 %: solo ve la taza).

### real-10 · Perro de caricatura con contorno negro de 4 px

Ancho mínimo por elemento con el dibujo a 50 mm: orejas 8,12 mm · orejas-contorno 0,36 mm · cabeza 27,08 mm · cabeza-contorno 0,36 mm · lengua 3,61 mm · hocico 10,83 mm · hocico-contorno 0,36 mm · nariz 3,61 mm · ojos 3,97 mm · brillos 0,90 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | orejas | orejas-contorno | cabeza | cabeza-contorno | lengua | hocico | hocico-contorno | nariz | ojos | brillos | casos |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 4 | 1,00 | 1,00 | 0 | 0,93 | 100 | 0 | 100 | 0 | 0 | 100 | 0 | 99 | 98 | 0 | — |
| auto-2 | floodFill (dibujo) | 2 | 1,00 | 1,00 | 0 | 0,77 | 100 | 0 | 100 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | demasiados-colores |
| auto-6 | floodFill (dibujo) | 6 | 1,00 | 1,00 | 0 | 0,94 | 100 | 0 | 100 | 0 | 99 | 100 | 0 | 98 | 97 | 0 | — |
| dibujo-3 | floodFill | 3 | 1,00 | 1,00 | 0 | 0,81 | 100 | 0 | 100 | 0 | 0 | 0 | 0 | 98 | 98 | 0 | demasiados-colores |
| dibujo-6 | floodFill | 6 | 1,00 | 1,00 | 0 | 0,94 | 100 | 0 | 100 | 0 | 99 | 100 | 0 | 98 | 97 | 0 | — |
| foto-3 | clusters | 3 | 0,87 | 0,88 | 0 | 0,81 | 100 | 0 | 100 | 0 | 0 | 0 | 0 | 100 | 98 | 0 | — |
| foto-4 | clusters | 4 | 0,87 | 0,88 | 0 | 0,81 | 100 | 0 | 100 | 0 | 0 | 0 | 0 | 100 | 99 | 0 | — |
| foto-6 | clusters | 6 | 0,87 | 0,88 | 0 | 0,82 | 100 | 0 | 100 | 0 | 99 | 0 | 0 | 100 | 98 | 0 | — |
| silueta-3 | umbral | 3 | 0,19 | 0,19 | 1 | 0,13 | 100 | 0 | 0 | 0 | 0 | 0 | 0 | 99 | 99 | 0 | demasiados-colores |
| silueta-4 | umbral | 4 | 0,19 | 0,19 | 1 | 0,13 | 100 | 0 | 1 | 0 | 0 | 0 | 0 | 99 | 99 | 0 | — |
| silueta-6 | umbral | 6 | 0,19 | 0,19 | 1 | 0,13 | 100 | 0 | 1 | 0 | 0 | 0 | 0 | 99 | 99 | 0 | — |
| *X-auto-4-lado80* (no disponible) | floodFill | 4 | 1,00 | 1,00 | 0 | 0,93 | 100 | 2 | 100 | 1 | 0 | 100 | 0 | 99 | 99 | 0 | — |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 1,00 | 1,00 | 0 | 0,98 | 99 | 97 | 100 | 92 | 0 | 100 | 87 | 98 | 98 | 0 | — |

Mejor combinación con los controles de hoy: **auto-5** (IoU color 0,94, IoU 1,00).

Avisos de construir() con auto-4: 25 mm → 5 colores > 4 slots; Negro 7 %; Beige tiene 2 parte(s) de menos de 1 mm² · 50 mm → 5 colores > 4 slots; Beige tiene 2 parte(s) de menos de 1 mm² · 80 mm → 5 colores > 4 slots

**Funciona a medias.** Rellenos, nariz y ojos salen bien (IoU 1,00), pero **los contornos negros (0,36 mm) desaparecen** (`limpiar.ts:119-129`): el dibujo pierde la línea que separa cabeza, orejas y hocico, y queda "plano". Sin apertura sobrevivirían (87–97 %), pero serían más finos que lo imprimible: acá la política de borrar es discutible, **engrosar** a 0,8 mm sería lo que el usuario espera.

- El dibujo tiene 6 colores: con 4 se va la lengua (y los brillos de 0,9 mm siempre, por área mínima). Con 5–6 aparece la lengua.
- Aviso a cualquier tamaño: "El diseño usa 5 colores y tu impresora carga 4" con 4 colores pedidos (la base blanca cuenta aparte).

### real-12 · Logo blanco sobre degradado de color de mucho recorrido (#FFD89B → #19547B)

Ancho mínimo por elemento con el dibujo a 50 mm: gota 22,27 mm · barra 6,68 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | gota | barra | casos |
|---|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 4 | 0,71 | 1,00 | 29 | 0,71 | 100 | 100 | — |
| auto-2 | floodFill (dibujo) | 2 | 0,71 | 1,00 | 29 | 0,71 | 100 | 100 | demasiados-colores |
| auto-6 | floodFill (dibujo) | 4 | 0,71 | 1,00 | 29 | 0,71 | 100 | 100 | — |
| dibujo-3 | floodFill | 3 | 0,71 | 1,00 | 29 | 0,71 | 100 | 100 | demasiados-colores |
| dibujo-6 | floodFill | 4 | 0,71 | 1,00 | 29 | 0,71 | 100 | 100 | — |
| foto-3 | clusters | 3 | 0,19 | 0,99 | 81 | 0,19 | 99 | 98 | huecos-en-dibujo |
| foto-4 | clusters | 4 | 0,19 | 0,99 | 81 | 0,19 | 99 | 98 | huecos-en-dibujo |
| foto-6 | clusters | 6 | 0,19 | 0,99 | 81 | 0,19 | 99 | 98 | huecos-en-dibujo |
| silueta-3 | umbral | 3 | 0,20 | 0,23 | 38 | 0,20 | 0 | 86 | — |
| silueta-4 | umbral | 4 | 0,20 | 0,23 | 38 | 0,20 | 0 | 86 | — |
| silueta-6 | umbral | 4 | 0,20 | 0,23 | 38 | 0,20 | 0 | 86 | — |
| *X-auto-4-lado80* (no disponible) | floodFill | 4 | 0,72 | 1,00 | 28 | 0,72 | 100 | 100 | — |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 0,71 | 1,00 | 29 | 0,71 | 100 | 100 | — |

Mejor combinación con los controles de hoy: **auto-2** (IoU color 0,71, IoU 0,71).

Avisos de construir() con auto-4: 25 mm → Beige 4 %; Azul 4 %; El llavero quedó en 2 partes separadas · 50 mm → El llavero quedó en 3 partes separadas · 80 mm → El llavero quedó en 4 partes separadas

**Qué pasa.** Las dos esquinas del degradado (la más clara y la más oscura) quedan como dibujo: se imprimen como triángulos beige y azul (FP 29 %, dos filamentos de más). Las semillas del flood fill son solo los píxeles del borde a menos de 0,10 de la **mediana** del borde (`mascara.ts:43-66`) y cada píxel se compara contra su semilla (`mascara.ts:76`): con ΔOKLab 0,5 de punta a punta, los extremos quedan fuera de alcance. La caja pasa a ser la imagen entera y el logo ocupa ~28 mm del llavero.

- Foto es mucho peor (FP 81 %) y Silueta pierde la gota blanca. No hay combinación que lo arregle; ningún caso de diagnóstico salta.

### real-13 · Aro cerrado sobre fondo rojo plano (fondo encerrado que no se funde con la base)

Ancho mínimo por elemento con el dibujo a 50 mm: aro 2,27 mm · estrella 4,55 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | aro | estrella | casos |
|---|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 4 | 0,30 | 1,00 | 70 | 0,30 | 99 | 99 | — |
| auto-2 | floodFill (dibujo) | 2 | 0,30 | 1,00 | 70 | 0,00 | 0 | 0 | demasiados-colores |
| auto-6 | floodFill (dibujo) | 6 | 0,30 | 1,00 | 70 | 0,30 | 99 | 99 | — |
| dibujo-3 | floodFill | 3 | 0,30 | 1,00 | 70 | 0,30 | 99 | 99 | — |
| dibujo-6 | floodFill | 6 | 0,30 | 1,00 | 70 | 0,30 | 99 | 99 | — |
| foto-3 | clusters | 2 | 0,97 | 1,00 | 3 | 0,97 | 100 | 100 | — |
| foto-4 | clusters | 2 | 0,97 | 1,00 | 3 | 0,97 | 100 | 100 | — |
| foto-6 | clusters | 2 | 0,97 | 1,00 | 3 | 0,97 | 100 | 100 | — |
| silueta-3 | umbral | 1 | 0,00 | 0,00 | 100 | 0,00 | 0 | 0 | — |
| silueta-4 | umbral | 1 | 0,00 | 0,00 | 100 | 0,00 | 0 | 0 | — |
| silueta-6 | umbral | 1 | 0,00 | 0,00 | 100 | 0,00 | 0 | 0 | — |
| *X-auto-4-lado80* (no disponible) | floodFill | 4 | 0,30 | 1,00 | 70 | 0,30 | 100 | 99 | — |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 0,30 | 1,00 | 70 | 0,30 | 99 | 99 | — |

Mejor combinación con los controles de hoy: **foto-2** (IoU color 0,97, IoU 0,97).

Avisos de construir() con auto-4: 25 mm → ninguno · 50 mm → ninguno · 80 mm → ninguno

**Qué pasa.** Lo mismo que real-03, pero ahora se ve: el rojo de adentro del aro se imprime como un disco rojo, más un color de antialias (`#E18A66`) en los bordes. El aro blanco se funde con la base. **Cero casos de diagnóstico**, así que nadie le sugiere al usuario probar Foto, que lo deja perfecto (IoU 0,97). Silueta: 0 (asume tinta oscura sobre fondo claro, y el logo es claro sobre oscuro).

### real-11 · Escalera de grosores (calibración)

Ancho mínimo por elemento con el dibujo a 50 mm: barra-0,3mm 0,30 mm · barra-0,5mm 0,50 mm · barra-0,7mm 0,70 mm · barra-0,8mm 0,80 mm · barra-0,9mm 0,90 mm · barra-1,0mm 1,00 mm · barra-1,2mm 1,20 mm · barra-1,5mm 1,50 mm

| corrida | máscara | col | IoU | recall | FP % | IoU color | barra-0,3mm | barra-0,5mm | barra-0,7mm | barra-0,8mm | barra-0,9mm | barra-1,0mm | barra-1,2mm | barra-1,5mm | casos |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 1 | 0,76 | 0,79 | 6 | 0,76 | 0 | 0 | 0 | 100 | 100 | 100 | 100 | 100 | fondo-complejo |
| auto-2 | floodFill (dibujo) | 1 | 0,76 | 0,79 | 6 | 0,76 | 0 | 0 | 0 | 100 | 100 | 100 | 100 | 100 | fondo-complejo |
| auto-6 | floodFill (dibujo) | 1 | 0,76 | 0,79 | 6 | 0,76 | 0 | 0 | 0 | 100 | 100 | 100 | 100 | 100 | fondo-complejo |
| dibujo-3 | floodFill | 1 | 0,76 | 0,79 | 6 | 0,76 | 0 | 0 | 0 | 100 | 100 | 100 | 100 | 100 | fondo-complejo |
| dibujo-6 | floodFill | 1 | 0,76 | 0,79 | 6 | 0,76 | 0 | 0 | 0 | 100 | 100 | 100 | 100 | 100 | fondo-complejo |
| foto-3 | clusters | 2 | 0,74 | 0,79 | 8 | 0,74 | 0 | 0 | 0 | 100 | 100 | 100 | 100 | 100 | — |
| foto-4 | clusters | 2 | 0,74 | 0,79 | 8 | 0,74 | 0 | 0 | 0 | 100 | 100 | 100 | 100 | 100 | — |
| foto-6 | clusters | 2 | 0,74 | 0,79 | 8 | 0,74 | 0 | 0 | 0 | 100 | 100 | 100 | 100 | 100 | — |
| silueta-3 | umbral | 1 | 0,76 | 0,79 | 5 | 0,76 | 0 | 0 | 0 | 100 | 100 | 100 | 100 | 100 | — |
| silueta-4 | umbral | 1 | 0,76 | 0,79 | 5 | 0,76 | 0 | 0 | 0 | 100 | 100 | 100 | 100 | 100 | — |
| silueta-6 | umbral | 1 | 0,76 | 0,79 | 5 | 0,76 | 0 | 0 | 0 | 100 | 100 | 100 | 100 | 100 | — |
| *X-auto-4-lado80* (no disponible) | floodFill | 3 | 0,90 | 0,96 | 6 | 0,90 | 0 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | fondo-complejo |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 1 | 0,94 | 1,00 | 6 | 0,94 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | fondo-complejo |

Mejor combinación con los controles de hoy: **silueta-2** (IoU color 0,76, IoU 0,76).

Avisos de construir() con auto-4: 25 mm → Negro 76 % · 50 mm → El llavero quedó en 3 partes separadas · 80 mm → El llavero quedó en 5 partes separadas

Hace lo que dice la constante: 0,3 / 0,5 / 0,7 mm desaparecen enteras, 0,8 mm en adelante quedan al 100 %. El dibujo final mide 30 mm porque las tres barras finas de la izquierda desaparecen (la caja se calculó con ellas). Limpiando a 80 mm sobreviven desde 0,5 mm (0,8 mm reales).

### Imagen real del usuario · gato ilustrado sobre negro (`prueba.jpg`, 1024 × 1536)

| corrida | máscara | col | IoU | recall | FP % | IoU color |  | casos |
|---|---|---|---|---|---|---|---|
| **auto-4 (por defecto)** | floodFill (dibujo) | 4 | 0,94 | 0,35 | — | — |  | — |
| auto-2 | floodFill (dibujo) | 2 | 0,94 | 0,35 | — | — |  | demasiados-colores |
| auto-6 | floodFill (dibujo) | 6 | 0,94 | 0,35 | — | — |  | — |
| dibujo-3 | floodFill | 3 | 0,94 | 0,35 | — | — |  | demasiados-colores |
| dibujo-6 | floodFill | 6 | 0,94 | 0,35 | — | — |  | — |
| foto-3 | clusters | 3 | 0,97 | 0,34 | — | — |  | huecos-en-dibujo, demasiados-colores |
| foto-4 | clusters | 4 | 0,97 | 0,34 | — | — |  | huecos-en-dibujo, demasiados-colores |
| foto-6 | clusters | 6 | 0,97 | 0,34 | — | — |  | huecos-en-dibujo |
| silueta-3 | umbral | 3 | 0,05 | 0,71 | — | — |  | huecos-en-dibujo |
| silueta-4 | umbral | 3 | 0,05 | 0,71 | — | — |  | huecos-en-dibujo |
| silueta-6 | umbral | 4 | 0,05 | 0,71 | — | — |  | huecos-en-dibujo |
| *X-auto-4-lado80* (no disponible) | floodFill | 4 | 0,94 | 0,35 | — | — |  | — |
| *X-dibujo-4-sin-apertura* (no disponible) | floodFill | 4 | 0,94 | 0,35 | — | — |  | — |

Mejor combinación con los controles de hoy: **auto-2** (IoU color —, IoU 0,94).

Avisos de construir() con auto-4: 25 mm → 5 colores > 4 slots; Beige 13 %; Naranja 30 %; Marrón 22 %; Negro 31 %; Beige tiene 5 parte(s) de menos de 1 mm²; Naranja tiene 11 parte(s) de menos de 1 mm²; Marrón tiene 9 parte(s) de menos de 1 mm²; Negro tiene 6 parte(s) de menos de 1 mm² · 50 mm → 5 colores > 4 slots; Beige 3 %; Naranja 6 %; Marrón 5 %; Negro 6 %; Naranja tiene 2 parte(s) de menos de 1 mm²; Marrón tiene 3 parte(s) de menos de 1 mm² · 80 mm → 5 colores > 4 slots; Naranja 2 %; Marrón 2 %; Negro 3 %

Sin verdad: se compara contra una referencia aproximada (todo lo que no es casi negro, máximo de canal > 40) y se juzga mirando `salida/usuario-gato/*-etiquetas.png` y `*-mascara.png`.

- **Fondo:** Auto/Dibujo lo saca limpio (IoU 0,94 contra la referencia; la diferencia son los pelos sueltos y los bigotes sobre negro). Sale **1 sola pieza**, sin islas. La sombra del piso entra como parte del cuerpo (el borde de abajo queda recto). Foto da lo mismo (0,97). **Silueta invierte todo**: se queda con el fondo negro y el gato como agujero (`presets.ts:82` asume tinta oscura sobre papel claro).
- **Bordes del pelo:** el contorno queda con puntas (mechones de la cola, del cachete izquierdo y de las orejas), sin ruido suelto: la apertura se come los pelos finos y las islas se funden.
- **Bigotes:** desaparecen siempre (blancos y finísimos; afuera del cuerpo ni siquiera entran en la máscara).
- **¿Se reconoce?** La **silueta** sí (orejas, cola, patas, postura). **La cara no**, a ningún número de colores: a 3 y 4 colores el interior es un camuflaje de manchas marrones y beige sin ojos ni nariz; a 6 los ojos aparecen como dos manchas oscuras, pero sin el amarillo de los ojos ni el rosa de la nariz (son demasiado chicos para ganarse un color). El k-means reparte los colores entre los tonos del pelaje, que ocupan casi toda el área.
- **Avisos a 50 mm con 4 colores:** "El diseño usa 5 colores y tu impresora carga 4", detalle fino 3–6 % en cada color y 2–3 islas chicas por color. A 25 mm: detalle fino 13–31 % y 5–11 islas por color.


## Causas raíz, ordenadas por cuántas categorías reales rompen

Se cuenta una categoría como "rota" si lo que sale por defecto es visiblemente incorrecto o no imprimible por esa causa. No se cuenta la escalera (calibración). "Latente" = el error de máscara está, pero hoy no se ve en el llavero.

| # | Causa | Dónde (código) | Categorías rotas | ¿Algún control de hoy la arregla? |
|---|---|---|---|---|
| 1 | **El detalle fino se borra entero en vez de engrosarse**, medido siempre con el dibujo a 50 mm y con umbral anisótropo (0,7 mm en diagonal, 0,8–0,85 mm en horizontal/vertical) | `src/pipeline/limpiar.ts:119-129` (apertura por color) · `src/pipeline/morfologia.ts:93` (`>` estricto) · `src/pipeline/defaults.ts:98` (`ANCHO_MINIMO_DETALLE_MM`) · `defaults.ts:39` + `index.ts:173` (escala fija por lado mayor) | **5**: logo lineal (La Ronda), icono lineal, mascota con contorno, texto largo (aviso 42 %), ilustración real (bigotes y pelo) | ❌ Ninguno. El tamaño no reprocesa (`SolapaLlavero.tsx:16-27`, `documento.ts:153`) |
| 2 | **Auto y el diagnóstico no ven los fallos**: auto solo cambia de preset si la tinta es < 5 % de la imagen (y ahí elige Foto aunque no ayude); no hay ningún chequeo de "fondo encerrado" ni de "degradado que quedó como dibujo" | `src/pipeline/index.ts:278` · `src/pipeline/diagnostico.ts:124-150` (`recorteVacio`, `fondo-complejo`) · `diagnostico.ts:156-170` (los huecos se miden sobre la máscara, que no ve el fondo encerrado) | **4**: La Ronda (0 casos), icono lineal (pasa a Foto sin mejorar), aro sobre color (0 casos; Foto lo arreglaría), degradado fuerte (0 casos) | ⚠️ Solo si el usuario adivina el preset (aro sobre color → Foto) |
| 3 | **La caja del dibujo es la de cualquier píxel de la máscara previa**, sin descartar motas: la escala sale mal, el dibujo queda más chico que 50 mm y el slider muestra un tamaño que no es | `src/pipeline/mascara.ts:123-138` (`cajaDeMascara`) · `src/pipeline/index.ts:157-173` · `src/crear/SolapaLlavero.tsx:34-36` | **3**: foto de sticker (28,9 mm), oscuro con textura (15,9 mm), degradado fuerte (~28 mm). Agrava la causa 1 (todo se mide más fino) | ⚠️ El tamaño se compensa a ojo con el slider, pero la limpieza ya se hizo a la escala equivocada |
| 4 | **Colores de antialias y de fondo ocupan slots** (el k-means no distingue un tono de borde de un color de diseño) | `src/pipeline/cuantizar.ts:146-172` (la fusión ΔE < 5 no alcanza) | **3**: La Ronda (gris de antialias), aro sobre rojo (`#E18A66`), foto (marrón de la mesa → se pierde el rayo con 3 colores) | ⚠️ Subir colores, a costa de purga |
| 5 | **La base blanca se suma a los N colores pedidos**: con 4 colores y ninguno blanco sale "El diseño usa 5 colores y tu impresora carga 4" | `src/diseno/crear.ts:58` y `:126` · `src/geometria/construir.ts:156` (`drcSlots`) | **3** (solo aviso): foto de sticker, mascota, gato real | ✅ Bajando a 3 colores (a costa de perder detalles de color) |
| 6 | **El flood fill arranca solo desde el borde de la imagen**: el fondo encerrado por un contorno (círculos, aros, ojos de letras) queda como dibujo | `src/pipeline/mascara.ts:39-66` (semillas en el borde) · `mascara.ts:69-80` (propagación por vecinos) · `mascara.ts:83` | **2 visibles**: La Ronda (degradado encerrado → discos grises), aro sobre color (disco rojo). **Latente en 4**: aro sobre crema, texto corto, texto largo, icono lineal (se funde con la base blanca) | ⚠️ Foto lo arregla cuando el fondo es plano (0,97); con degradado encerrado, no |
| 7 | **Tolerancia fija de 0,10 OKLab contra la semilla y semillas solo cerca de la mediana del borde**: los degradados de mucho recorrido y los logos de bajo contraste fallan | `src/pipeline/mascara.ts:43-66` y `:76` · `src/pipeline/defaults.ts:65` (`TOLERANCIA_FLOOD_FILL`, sin slider en la UI de hoy) | **2**: degradado fuerte (esquinas como filamentos), oscuro con textura (se come el escudo). Nota: un degradado de 0,275 OKLab sin contornos cerrados **funciona** (real-04) | ❌ Foto es peor en ambos |
| 8 | **Silueta asume tinta oscura sobre papel claro** | `src/pipeline/presets.ts:82` (Bradley-Roth) · `index.ts:135` | **4 si el usuario lo elige** (gato real invertido, aro sobre rojo 0, avatar 0,04, degradado fuerte): nunca es el camino por defecto | — (es el control el que rompe) |

**La Ronda junta tres de estas causas:** la 6 (fondo encerrado → disco de grises), la 1 (círculo, textos, mate y bombilla borrados) y la 2 (ningún aviso ni cambio de preset). Arreglar solo una no alcanza: sin apertura, el círculo y los textos vuelven, pero sobre el disco gris; con el fondo encerrado resuelto, el llavero quedaría con laureles solos.

### Lo que ninguna combinación de los controles de hoy arregla

- **La Ronda** (mejor IoU color 0,36): fondo encerrado con degradado + líneas finas. Ningún preset resuelve las dos cosas y el tamaño no llega al pipeline.
- **Cualquier línea de menos de ~0,8 mm con el dibujo a 50 mm** (icono lineal, contornos de caricatura, círculos y textos finos): desaparece entera; ni el tamaño ni los colores la traen de vuelta.
- **Degradados de mucho recorrido** (IoU 0,71 en el mejor caso, dos filamentos de fondo).
- **Logo de bajo contraste sobre textura** (0,18 por defecto, 0,50 con Foto y manchas).
- **La altura de un nombre largo en una línea** (3,7 mm de alto).
- **El tamaño real cuando la caja se infla** (se corrige a ojo con el slider, pero la limpieza no).

### Lo que funciona (dicho con la misma honestidad)

- Degradado suave **sin** contornos cerrados (IoU 0,99), foto de celular de un sticker con luz despareja y JPEG (máscara 0,96 y colores bien con 4), texto grueso (0,94–0,98), avatar circular con esquinas blancas (1,00), rellenos planos de una caricatura (1,00 en máscara).
- En la ilustración real del usuario, el fondo negro se saca limpio y sale una sola pieza con la silueta reconocible.
- El fondo encerrado de color casi blanco no se nota en el llavero, porque se funde con la base.

## Limitaciones

- Las escenas son sintéticas: la "foto" tiene luz, sombra, ruido y JPEG, pero no perspectiva, reflejos ni desenfoque de movimiento. Los umbrales del diagnóstico están marcados PROVISORIO en el código y siguen sin calibrar con fotos reales.
- El texto usa Nunito (sans redondeada) porque es la única fuente OFL instalada con pesos finos; La Ronda original tiene un texto con serifas, que tendría remates todavía más finos.
- La IoU del gato es contra una referencia de umbral de luminancia, no una verdad: sirve para ver si el fondo negro se sacó, no para medir la calidad del recorte del pelo.
- Los avisos de `construir()` se midieron solo con auto-4 y el modo a ras.
