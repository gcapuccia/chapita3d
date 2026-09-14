# Fase 2 · Arreglos del pipeline de imagen: prototipos medidos

**Fecha:** 2026-09-14 · **Estado:** 🧪 spike, sin tocar `src/` ni los tests · sigue a `f2-casos-reales.md` (causas raíz) y `f2-auditoria-herramientas.md` (herramientas)

## En una pantalla

- **La Ronda pasa de IoU 0,216 / IoU color 0,057 a 0,772 / 0,757** con la política automática propuesta (y a 0,780 / 0,763 si además la base cuenta como color). Vuelven el círculo (0 → 100 %), «LA RONDA» (0 → 99 %), el contorno del mate (0 → 100 %), la bombilla (0 → 99 %), «TIENDA» (0 → 87 %) y el relleno del mate (0 → 97 %). El degradé de adentro sale como **base rellena**, no como dos grises. Ver `spikes/08-arreglos/salida/la-ronda-lado-a-lado.png` (original | hoy | mejor combinación).
- Ranking por beneficio medido: **① fondo encerrado + degradé** (3 escenas rotas → bien, 0 regresiones con la guarda) · **② engrosar** (5 escenas recuperan todos sus elementos finos; baja la IoU en texto largo, es esperable) · **③ caja sin motas** (sticker: 27,8 → 48,0 mm) · **④ fundir colores intermedios** (−1 a −2 filamentos en 7 escenas, sin pérdida) · **⑤ polaridad de Silueta** · **⑥ modo Líneas** (excelente en line art, inservible fuera de eso).
- **Regresiones en el banco original** con lo recomendado (`politica`): **ninguna** (13/13 de las que andaban siguen andando). `combo` (todo prendido siempre) rompe 1: `dibujo-05-lineas-finas` (los rayos blancos de 0,35 mm se engrosan: era a propósito que se borraran).
- **Costo:** la mediana por imagen de ≤ 1000 px pasa de 255 ms a 384 ms con todo prendido. La política corre el pipeline dos veces cuando engrosa (máx. 1,4 s en el icono lineal, que además pasa a Foto): hay que re-correr **solo la limpieza** (−~250 ms).
- **El gato:** fondo igual de limpio (IoU 0,939 → 0,933), y la cara **aparece**: ojos, nariz y rayas del pelaje quedan como líneas oscuras engrosadas, en vez del camuflaje de manchas de hoy (`salida/gato-lado-a-lado.png`). Los bigotes siguen sin salir (se pierden al reescalar, antes de cualquier arreglo). Sigue en 5 filamentos con 4 colores pedidos.

## Qué se hizo

| Archivo | Qué es |
|---|---|
| `spikes/08-arreglos/pipeline2.ts` | `convertirV2(fuente, params, arreglos)`: la orquestación de `convertir()` copiada (~80 líneas, porque `convertir` es una sola función) con **las etapas originales importadas de `src/`** y cada arreglo como interruptor. `convertirAutomaticoV2` y `convertirConPolitica` (arreglo 5). |
| `spikes/08-arreglos/engrosar.ts` | `limpiarV2`: `limpiar.ts` + criterio de fino elegible + engrosado + guarda anti-halo + pérdida por color antes de limpiar. Copia `rellenar`/`moda`/`islas` porque son privadas en `limpiar.ts`. |
| `spikes/08-arreglos/morfologia2.ts` | `aperturaV2` (criterio isótropo), `dilatar`, `esqueleto` (Zhang-Suen), `componentes`, `encerrados`. Todo sobre `distanciaCuadrada` de `src/pipeline/morfologia.ts`. |
| `spikes/08-arreglos/fondo.ts` | Modelo de fondo cuadrático en OKLab, segunda pasada de fondo encerrado, `cajaSinMotas`, `tintaClara` (polaridad). |
| `spikes/08-arreglos/colores.ts` | k-means sin píxeles de transición, fusión de colores intermedios, `slotsUsados`. |
| `spikes/08-arreglos/medir.ts` | Las métricas de `spikes/07-casos-reales/correr.ts` (no exporta nada: importarlo corre su main), más FP lejos, métricas del modo Líneas y el lado a lado. |
| `spikes/08-arreglos/correr.ts` | El runner: 23 configuraciones × 14 imágenes + 17 configuraciones × 15 escenas del banco. |
| `spikes/08-arreglos/isotropia.ts` | Umbral de «fino» por ángulo y fase, y ancho real de las líneas engrosadas. |

```sh
node spikes/08-arreglos/correr.ts        # todo, ~13 min; --escenas id,id --configs a,b --sin-banco para acotar
node spikes/08-arreglos/isotropia.ts     # ~2 min
```

Salidas en `spikes/08-arreglos/salida/` (ignorado por git): `informe.md` (todas las filas), `resultados.json`, `<escena>/<config>-etiquetas.png` y `-mascara.png` (para La Ronda y el gato, todas las configuraciones), `la-ronda-lado-a-lado.png`, `la-ronda-lado-a-lado-con-lineas.png` y `gato-lado-a-lado.png` (hoy | política | Líneas | Silueta con polaridad). La foto del usuario se lee de `Downloads` y no se copió.

**Control de la copia:** antes de medir, el runner compara `convertirAutomaticoV2(SIN_ARREGLOS)` contra `convertirAutomatico` de `src/`: **etiquetas y paleta idénticas byte a byte en las 14 imágenes**. Toda diferencia de la tabla es del arreglo, no de la copia.

**Métricas:** las de `f2-casos-reales.md` (IoU, recall, IoU color, supervivencia por elemento) con un cambio para todas las configuraciones por igual: un píxel de salida a menos de 0,6 mm del dibujo verdadero no vuelve «espurio» a su color. Sin eso, una línea de 0,4 mm engrosada a 1,5 mm tiene mayoría de píxeles «de fondo» y la métrica le descarta el color entero. Se agrega **FP lejos** = fondo que quedó como dibujo a más de 0,6 mm del dibujo (el FP que no es engrosado). **Ojo:** la IoU castiga el engrosado por diseño (una línea de 0,5 mm que sale de 0,9 mm tiene IoU ~0,55 aunque sea exactamente lo que se quiere); para lo fino, mirar la supervivencia por elemento.

## Tabla general

Camino por defecto de la app (Automático, 4 colores, 50 mm). «Slots» = filamentos con la base blanca aparte (hoy la app avisa «5 colores y tu impresora carga 4» cuando da 5). Tiempos: mediana y máximo sobre las 13 escenas sintéticas (500–1000 px) en la PC de desarrollo; banco: media de 15 escenas de 2000 px.

| Arreglo (config) | Qué gana (medido) | Qué pierde | ms mediana / máx (reales) | ms banco | Regresiones banco |
|---|---|---|---|---|---|
| **hoy** | — | — | 255 / 539 | 406 | — (13/15, las 2 «horribles» fallan por diseño) |
| **1 · engrosar 0,8** (`1-engrosar-0.8`) | Todo lo fino vuelve: La Ronda círculo/texto/contorno/bombilla 0 → 99–100 %, TIENDA 0 → 87 %; icono lineal suelo/sol/rayos 0 → 100 % (IoU 0,519 → 0,651); contornos del perro 0 → 100 %; escalera 0,3/0,5/0,7 mm 0 → 100 % (0,756 → 0,807); texto largo 93 → 100 % | IoU del texto largo 0,798 → 0,693 (letras engordadas); perro IoU color 0,931 → 0,926 (el contorno negro pisa 15 % de las orejas); gato 0,939 → 0,933 | 336 / 665 | 439 | **2**: `dibujo-04-escaneado` (+1 color: una sombra fina de lápiz se engrosa) y `dibujo-05-lineas-finas` (los rayos blancos de 0,35 mm, que el test pide borrar, se engrosan). Por eso va detrás del detector (5). |
| 1 · versión cruda (sin guarda anti-halo ni conservar trazos) | Lo mismo en lo fino | Engrosa los halos de antialias: +1 o +2 colores | 312 / 596 | 415 | **6** (logo-02, logo-03, logo-04, dibujo-04, dibujo-05, sticker-01) |
| **1 · tamaño 80 mm** (`1-hoy-lado80` / `1-engrosar-0.8-lado80`) | Sin engrosar: icono lineal 0,519 → 0,849, escalera 0,756 → 0,899. Con engrosar: perro 0,965 de IoU color (el mejor), La Ronda TIENDA 97 % | Sin engrosar, La Ronda sigue rota (círculo 27 %); sticker pierde el rayo (el 4.º color pasa a la mesa) | 542 / 1027 · 653 / 1241 | — | (no se corrió en el banco: el banco es a 50 mm) |
| **2 · fondo encerrado + degradé** (`2-fondo`) | La Ronda IoU 0,216 → 0,699 (FP lejos 60 → 0 %); degradé fuerte 0,713 → 0,996 y el logo pasa de 28 a 50 mm; aro sobre rojo 0,303 → 0,974 | Nada en las 14 | 349 / 726 | 505 | **0** |
| 2 · sin la guarda de la base | Además aro sobre crema 0,303 → 0,969 | Se come blancos de diseño: vapor del avatar 97 → 0 % | 350 / 661 | 478 | **4** (logo-02, logo-04, sticker-02, sticker-03: «falta el color #FFFFFF») |
| **3 · caja sin motas** (`3-caja`) | Sticker: 568 motas fuera, dibujo de 27,8 → 48,0 mm, IoU color 0,950 → 0,969, rayo 97 → 99 % | Oscuro con textura: la caja se ajusta a la M (el escudo ya lo había comido el flood fill) y el dibujo verdadero mediría 115 mm | 328 / 574 | 432 | **0** |
| 4a · k-means sin transiciones | La Ronda: relleno del mate 0 → 100 %; texto largo +0,016 | Sticker: el rayo amarillo 97 → 0 % (un filamento se va a la mesa) | 319 / 582 | 452 | 0 |
| **4b · fundir intermedios** (`4b-intermedios`) | −1 slot en La Ronda, icono, aro crema, degradé suave, avatar, aro rojo; −2 en texto corto y largo. Sin pérdida de elementos | — | 303 / 557 | 429 | **0** (la variante «o menos de 3 % del dibujo» rompía 2: se descartó) |
| 4c · la base cuenta como color | −1 slot donde hoy hay 5 (La Ronda, sticker, perro, gato) | Sticker: rayo 97 → 0 %; perro: hocico 100 → 0 % (IoU color 0,931 → 0,806) | 301 / 645 | 419 | 0 |
| **combo** (1 + 2 + 3 + 4b, siempre) | La Ronda 0,757 de IoU color; degradé fuerte 0,996; aro rojo 0,974; sticker 0,969 | Texto largo 0,689; perro 0,926 | 384 / 710 | 534 | **1** (`dibujo-05`, por el engrosado) |
| **política** (2 + 3 + 4b siempre, 1 si el detector salta) | Igual que combo en las 14 | Igual que combo | 385 / 1419 | 607 | **0** |
| 8 · Silueta con polaridad | aro rojo 0 → 0,859, degradé fuerte 0,203 → 0,591, sticker 0,201 → 0,576, gato 0,051 → 0,271 | Oscuro con textura 0,161 → 0,055 | 155 / 256 | — | — |
| 6 · modo Líneas | Silueta IoU: La Ronda 0,981, perro 0,993, aro rojo 0,998, sticker 0,993; todas las líneas 96–100 % | Formas rellenas de poco contraste: degradé suave 0,369, avatar 0,142, oscuro 0,080; gato irreconocible | 124 / 167 | — | — |

## 1 · Engrosar en vez de borrar

**Algoritmo (`engrosar.ts › limpiarV2`)**, por color, sobre el mapa de etiquetas después de la moda:

1. `fina = color − apertura(color, r)` con `r = max(anchoMinimoDetalle, grosorMinimoLineas) / 2`. Es lo que hoy se borra.
2. **Línea** = los píxeles de `fina` a más de `r` de la parte gruesa (así las esquinas que la apertura le recorta a un cuadrado no cuentan) y en componentes cuyo esqueleto (Zhang-Suen) mide ≥ 1,5 mm. Si Zhang-Suen evapora la componente (pasa con diagonales de 2 px de ancho, una escalera), el largo sale de la diagonal de su caja y la semilla es la componente misma.
3. **Guarda anti-halo** (`esHalo`): no se engrosa una componente si (a) menos del 10 % de sus píxeles tiene de verdad el color de su etiqueta (ΔOKLab < 0,06), o (b) su color queda en el segmento entre los dos vecinos más frecuentes (o entre uno y el fondo). Sin esto, los anillos de antialias se engrosaban y aparecían colores nuevos: **6 regresiones en el banco → 2**.
4. **Conservar trazos:** hoy la erosión anti-halo de 1 px (`mascara.ts › erosionar`) vacía entero un trazo de 2–3 px; sin interior no hay color y la limpieza lo manda a fondo. Una componente de la máscara sin ningún píxel de interior vuelve entera al interior. Esto solo ya recupera la mitad de «TIENDA» en La Ronda.
5. Esqueleto dilatado con radio `grosor / 2` (con `distanciaCuadrada`, O(píxeles)) ∪ la línea original, pintado con su color **por encima de vecinos y del fondo** (la silueta crece si la línea es el borde). Se pinta de lo más claro a lo más oscuro: si dos líneas se pisan, gana la oscura.
6. Después, islas como hoy.

**Isotropía** (`isotropia.ts`):

*A · máscara binaria a 0,1 mm/px, ancho mínimo que sobrevive a la apertura de 0,8 mm:*

| criterio | 0° f0 | 0° f0,5 | 20° f0 | 20° f0,5 | 45° f0 | 45° f0,5 | rango |
|---|---|---|---|---|---|---|---|
| hoy (`d² > r²`) | 0,88 | 0,82 | 0,78 | 0,78 | 0,72 | 0,75 | 0,15 |
| `d² ≥ r²` | 0,68 | 0,63 | 0,72 | 0,72 | 0,72 | 0,75 | 0,13 |
| `d² ≥ (r + 0,5)²` | 0,88 | 0,82 | 0,90 | 0,90 | 0,85 | 0,88 | **0,08** |

La EDT ya es exacta: la anisotropía es de la grilla (en horizontal no hay centro de píxel para un ancho par) y del `>` estricto. `r + 0,5` es el más isótropo y conservador (todo lo que podría medir menos de 0,8 mm cuenta como fino). **Pero con engrosar el criterio casi no importa**: en las escenas reales `1-engrosar-0.8` y `1-engrosar-0.8-medioPx` dan lo mismo ±0,005, y sin engrosar `medioPx` es desastroso (icono lineal 0,519 → 0,038, texto largo 0,798 → 0,299, porque borra más).

*B · pipeline completo, ancho de SALIDA en mm (engrosar 0,8, criterio de hoy):*

| entrada (mm) | 0° | 20° | 45° |
|---|---|---|---|
| 0,3 | 0,90 | 0,86 | 0,78 |
| 0,5 | 0,90 | 0,85 | 0,78 (f0,5: 1,27) |
| 0,7 | 0,90 | 0,76 | 0,78 |
| 0,8 | 0,90 | 0,87 | 0,85–0,92 |
| 1,0 | 1,00–1,10 | 1,07 | 1,06 |

Hoy 0,3–0,5 mm salen 0 % en todos los ángulos y 0,7 mm sale 0 % en horizontal: **ahora todo sobrevive 100 %** (salvo 0,75 a 45° f0,5, 98 %). El engrosado da 2R + 1 px en horizontal (0,90) pero ~0,78 en diagonal: **para garantizar el mínimo hay que dilatar con `R = grosor/2 + 0,5 px`** (no medido). Las líneas de 0,7 mm a 20° y 45° quedan en 0,76–0,78 porque la apertura de hoy las considera gruesas: con `medioPx` se engrosan a 0,85–0,88. El caso f0,5 a 45° de 0,5 mm sale de 1,27 mm porque cae en el camino de «esqueleto evaporado» (se dilata la componente entera, no el eje): es correcto pero grueso.

**Grosor 0,8 / 1,0 / 1,5 mm:** en La Ronda los tres recuperan todo (TIENDA 87 / 89 / 92 %). En el texto largo la IoU cae 0,693 / 0,574 / 0,392 y a 1,5 mm las letras se funden (17 → 3 piezas). En el perro, el contorno negro se come las orejas (85 / 78 / 59 %). **0,8 por defecto es lo correcto**; el slider arriba de 1,0 es para logos de pocas líneas.

**50 vs 80 mm (`ladoMayorMm`).** Hoy la escala sale siempre de 50 mm y `mmPorPixel` queda fijo en 0,1: pasar 80 mm agranda la imagen de trabajo 1,6 × por lado (2,56 × píxeles) y el tiempo se duplica (mediana 255 → 542 ms, máx 1,0 s; con engrosar 653 ms / 1,24 s). Resultados: sin engrosar, 80 mm arregla el icono lineal (0,849, mejor que engrosar a 50: los trazos quedan con su ancho real) y la escalera, pero **no** La Ronda (círculo 27 %). Con engrosar, 80 mm da el mejor perro (IoU color 0,965: el contorno de 0,58 mm pisa menos las orejas).
**Propuesta:** `ParamsPipeline.ladoMayorMm` = el tamaño elegido en el slider (reprocesa al soltar, audit ⑧), y `mmPorPixel = max(0,1, ladoMayorMm / 600)` para topear la imagen de trabajo en ~600 px de lado (a 80 mm: 0,133 mm/px; F0.8 midió p95 de contorno 0,077 mm a 0,10 y 0,150 a 0,15, así que 0,133 roza el criterio). **El tope no se midió**: es lo primero a medir al portar.

## 2 · Fondo encerrado + degradé

**Algoritmo (`fondo.ts`).** El flood fill de hoy sigue siendo la primera pasada. La segunda:

1. **Modelo del fondo:** superficie cuadrática en OKLab (6 coeficientes por canal sobre u, v normalizados a la fuente), mínimos cuadrados con 4 vueltas de recorte (residuo > max(0,03, 4 × mediana)) sobre un anillo del 1 % del borde de la previa **más** lo que el flood fill ya sacó (submuestreado a 20 000). σ robusta del residuo y «confianza» = fracción que quedó (< 0,5 = el borde es sobre todo dibujo → no se usa).
2. **Tolerancia adaptativa:** `clamp(0,035 + 3σ, 0,05, 0,10)`. Medido: 0,05 en los fondos limpios (σ ≈ 0,001), 0,10 en la madera del sticker (σ = 0,051).
3. Todo píxel de dibujo a menos de la tolerancia del **fondo local** es candidato; las componentes de ≥ 3 mm² pasan a fondo, estén o no conectadas al borde.
4. **Guarda de la base:** si el color medio de la componente se funde con la base (ΔE2000 < 5), se deja. Sin la guarda, el banco pierde 4 escenas (blancos de diseño adentro: el círculo blanco del escudo, el aro blanco del hexágono, el borde de los stickers) y el avatar pierde el vapor. Con la guarda, el aro sobre crema queda como hoy (latente, no se ve en el llavero).
5. Se aplica a la **previa** (así la caja deja de incluir las esquinas del degradé: `real-12` pasa de 28 a 50 mm) y a la imagen de trabajo.
6. Lo sacado que queda **encerrado** por el dibujo se devuelve como `relleno` (1 460 mm² en La Ronda, 1 355 en el aro rojo), más todo hueco que la limpieza deje adentro. **Tiene que llegar a la geometría como región de base** (`RegionTrazada.esBase`, auditoría ④): si se deja como fondo, `cuerpoDelLlavero` (unión de las regiones + offset de 1,5 mm) deja un agujero pasante de 43 mm en La Ronda.

Costo medido: 60–120 ms por imagen (el ajuste y la segunda pasada sobre la previa de 900 px). Se puede bajar ajustando sobre la previa a 300 px.

**No resuelve** el logo oscuro sobre textura (`real-08`): el escudo se va en la primera pasada, con tolerancia fija 0,10. La tolerancia adaptativa solo se usa en la segunda pasada; bajarla también en la primera no se midió.

## 3 · Caja sin motas

Componentes de 8 vecinos de la máscara de la previa; solo cuentan las de ≥ 1 % de la mayor. Sticker: 568 de 569 componentes eran motas, el dibujo pasa de 27,8 a 48,0 mm y la limpieza se hace a la escala correcta (el rayo 97 → 99 %). Gato: 11 motas, sin cambios visibles. **Contra:** en `real-08` la caja se ajusta a la M (1 789 motas fuera), y como el escudo ya se había perdido, la M sola pasa a medir 50 mm. Es consecuente (la caja describe lo que va a imprimirse), pero hace más grave un recorte que ya estaba mal. Costo: ~20 ms.

## 4 · Colores de antialias y de fondo

- **4a (k-means sin transiciones):** marca como transición un píxel cuyo color queda sobre el segmento entre dos vecinos opuestos que difieren ≥ 0,06; ajusta k-means sin ellos y asigna todos. Inestable: en La Ronda aparece el blanco hueso del mate (0 → 100 %), en el sticker desaparece el rayo (97 → 0 %) porque el centroide que quedaba para el amarillo se va a la madera. En el combo no suma nada. **No recomendado.**
- **4b (fundir intermedios):** un color de la paleta que está entre otros dos (o entre uno y el color medio del fondo) en OKLab (suma de distancias ≤ 1,08 × la directa) **y** es fino a escala de impresión (≥ 85 % de sus píxeles desaparece con la apertura de 0,8 mm) es antialias: cada píxel pasa al color de la pareja más parecido. Saca, por ejemplo, `#727271` en La Ronda, `#494949` y `#A8A8A8` en «Lucía», `#A7933C` en el degradé suave, `#B19379` en el avatar. 0 regresiones. **Probado y descartado:** sumar «o menos de 3 % del dibujo» recuperaba TIENDA en La Ronda, pero se comía la nariz rosa de `dibujo-02` y la sombra marrón de `sticker-01` del banco.
- **4c (la base cuenta como color, causa 5):** si ningún color de la paleta se funde con la base, se recuantiza con N − 1. Slots con 4 colores pedidos: hoy 5 en La Ronda, degradé suave, sticker, perro y gato; con 4b quedan en 5 perro y gato; con 4b + 4c ninguno pasa de 4. **Pero** cuesta elementos reales: sticker pierde el rayo, perro el hocico. **Propuesta:** no recuantizar solo. Cambiar el texto del control a «Colores además de la base» o, mejor, avisar con acción: «Tu dibujo usa 5 filamentos contando la base. [Usar 4]».

## 5 · Diagnóstico que ve el problema antes de limpiar

`limpiarV2` devuelve, sin costo extra (la apertura se hace igual):

- **`perdidaPorColor`**: por color, fracción de sus píxeles (después de la moda) que termina con otro color o como fondo. Es la capa roja de la auditoría ②.
- **`fraccionLineas`**: píxeles en partes finas tipo línea (paso 2 del algoritmo, con la guarda anti-halo) / píxeles de dibujo. Medido con 50 mm: La Ronda 31,7 %, icono lineal 88,1 %, texto largo 22,8 %, escalera 21,6 %, gato 9,4 %, perro 5,7 %; el banco da 0 % en 12 escenas, 0,3 % en el escaneo, 2,2 % en `dibujo-05` (los rayos) y 1,7 % en el hexágono chico. **Umbral 4 %**: separa sin errores las 14 + 15 imágenes. El perro (5,7 %) queda cerca del corte.
- **Fondo encerrado:** `zonasSacadas`, `sacadoMm2`, `rellenoMm2` y `zonasRespetadas` (las que se fundían con la base).

**Política medida (`convertirConPolitica`):** primera corrida con 2 + 3 + 4b y sin engrosar; si `fraccionLineas ≥ 4 %`, segunda corrida con engrosar 0,8. Salta en La Ronda, icono lineal, texto largo, perro, escalera y gato; no salta en ninguna escena del banco. Resultado = combo en las reales, 0 regresiones en el banco. Hoy reprocesa todo: portada, la segunda corrida debería empezar en `limpiar` (las etapas anteriores no cambian), lo que la deja en ~+60–130 ms.

**Auto no debería pasar a Foto en line art:** el icono lineal cae en `dibujo-no-encontrado` (tinta < 5 %) y pasa a Foto, que con engrosar da lo mismo (0,651). No se tocó; con `fraccionLineas` alta conviene quedarse en Dibujo o sugerir Líneas.

**Polaridad de Silueta (causa 8, `tintaClara`):** si la mediana de luminancia del borde es menor que el promedio de la imagen, se invierte antes de Bradley-Roth. Aro sobre rojo 0 → 0,859, degradé fuerte 0,203 → 0,591, sticker 0,201 → 0,576, gato 0,051 → 0,271 (deja de salir invertido, pero Silueta no es para una foto). Empeora el logo oscuro sobre textura (0,161 → 0,055): el borde oscuro dispara la inversión y la tinta, que es oscura, queda como fondo.

## 6 · Modo Líneas (auditoría ⑤, solo máscara y etiquetas)

`convertirV2(…, { modoLineas: true })`: tinta = umbral adaptativo con polaridad → engrosada a 1,0 mm con `limpiarV2` → todo lo encerrado por la tinta es base (`encerrados`). Salida: 2 etiquetas (tinta, base). PNG en `salida/<escena>/6-lineas-etiquetas.png` y `la-ronda-lado-a-lado-con-lineas.png`.

| escena | silueta IoU (vs verdad con huecos rellenos) | tinta a > 0,8 mm de la verdad | elementos de tinta |
|---|---|---|---|
| La Ronda | **0,981** | 0 % | círculo, textos, contorno, bombilla 100 %; laureles 96–99 % (motas 0 %) |
| perro | **0,993** | 0 % | contornos 97–100 %, nariz y ojos 99 % |
| aro sobre rojo | **0,998** | 0 % | aro 99 %, estrella 70 % |
| sticker | 0,993 | 10 % | borde 86 % |
| icono lineal | 0,540 | 0 % | todo 100 % (la silueta de un icono abierto es solo la línea) |
| texto largo | 0,590 | 0 % | 99 % |
| degradé suave / avatar / oscuro | 0,369 / 0,142 / 0,080 | — | rellenos de poco contraste: no es line art |
| gato | 0,608 contra la referencia | — | líneas de pelaje sueltas, 13 piezas: no sirve |

Tarda 124 ms de mediana (no hay k-means). Confirma la auditoría: **resultado lindo con un clic en logos de trazo, y solo ahí**. Tiene que ser una opción sugerida (`fraccionLineas` alta y tinta de 1–2 colores), nunca automática.

## La Ronda y el gato

| La Ronda | IoU | IoU color | slots | círculo | LA RONDA | relleno mate | contorno mate | bombilla | TIENDA | tallos | hojas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hoy | 0,216 | 0,057 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 52 | 97 |
| 1 · engrosar | 0,213 | 0,134 | 5 | 100 | 99 | 0 | 100 | 99 | 87 | 99 | 96 |
| 2 · fondo | 0,699 | 0,589 | 5 | 0 | 0 | 100 | 0 | 0 | 5 | 100 | 100 |
| combo / política | **0,772** | **0,757** | 4 | 100 | 99 | 97 | 100 | 99 | 87 | 100 | 100 |
| combo + 4c | 0,780 | 0,763 | 3 | 100 | 94 | 97 | 100 | 99 | 100 | 100 | 100 |
| 6 · Líneas | silueta 0,981 | — | 2 | 100 | 100 | (base) | 100 | 100 | 100 | 99 | 96 |

Se confirma lo que decía el informe de causas: **ningún arreglo solo alcanza** (engrosar sin fondo deja las líneas sobre el disco gris; fondo sin engrosar deja los laureles solos). Las motas del mate (0,43 mm, puntos sueltos) siguen en 0 %: son más cortas que el largo mínimo de línea y se descartan como ruido; engrosar puntos sería otro arreglo. En `la-ronda-lado-a-lado.png` se ven los ojos de las «A» como base rayada (correcto) y el trazo del círculo algo irregular (el esqueleto sigue el antialias).

**Gato** (`gato-lado-a-lado.png`): hoy es una silueta con manchas; con la política, el detector ve 9,4 % de líneas y engrosa: aparecen ojos, nariz, boca y las rayas del pelaje como trazos oscuros. El borde exterior pierde algunos mechones (la guarda anti-halo descarta más de 100 componentes finas de antialias sobre negro). Sigue en 5 filamentos (el marrón oscuro de las rayas no es intermedio). Bigotes: siguen sin aparecer, se pierden al reescalar a 0,1 mm/px antes de llegar a la limpieza. Líneas y Silueta no sirven para esta imagen.

## Recomendación: qué portar a `src/` y en qué orden

1. **Fondo encerrado + degradé con guarda de la base + región `esBase`** (arreglo 2). Mayor beneficio, 0 regresiones, +~80 ms. Sin la región de base el arreglo es peor que hoy (agujero pasante), así que va junto con el cambio de `crearDiseno`.
2. **Caja sin motas** (arreglo 3). 20 líneas, 0 regresiones. Arreglar a la vez el texto del slider de tamaño.
3. **Fundir intermedios** (arreglo 4b). 0 regresiones, menos filamentos.
4. **Engrosar detrás del detector** (arreglos 1 + 5): `conservarTrazos`, guarda anti-halo, `R = grosor/2 + 0,5 px`, y la segunda pasada empezando en `limpiar`. Regenerar a propósito el test `dibujo-05-lineas-finas` solo si se decide engrosar siempre (no recomendado).
5. **El tamaño reprocesa** con tope de resolución de trabajo, midiendo antes el tope (arreglo 1, 80 mm).
6. **Polaridad** para Silueta y **modo Líneas** como tipo de imagen sugerido (juntos, reemplazando Silueta como propone la auditoría).
7. **No portar:** 4a (k-means sin transiciones), 4c automático, `medioPx` sin engrosar, fondo sin guarda.

### Cambios de API propuestos

```ts
// src/pipeline/index.ts
export type ParamsPipeline = {
  // … lo de hoy …
  /** mm. null = borrar lo fino (hoy). Número: lo más fino que esto se engrosa hasta este grosor. */
  grosorMinimoLineasMm: number | null          // default: null; lo decide la política (0,8)
  /** Segunda pasada de fondo: modelo del borde + zonas encerradas. */
  fondoEncerrado: boolean                      // default: true
  /** mm². Zona de fondo encerrado más chica que esto se deja como dibujo. */
  fondoAreaMinimaMm2: number                   // default: 3
  hexBase: string                              // default: '#FFFFFF' (guarda y relleno)
  // ladoMayorMm ya existe: pasa a ser el tamaño elegido (25–80)
}

export type ResultadoConversion = {
  // … lo de hoy …
  diagnostico: {
    // … lo de hoy …
    /** Máscara de relleno de base (fondo encerrado), resolución de trabajo. */
    relleno: Uint8Array
    /** Por color de la paleta: fracción que se pierde en la limpieza (con grosor null). */
    perdidaPorColor: number[]
    /** Fracción del dibujo en líneas finas: > 0,04 = logo de líneas. */
    fraccionLineas: number
    fondo: { zonas: number; sacadoMm2: number; rellenoMm2: number; zonasRespetadas: number }
  }
}
```

- `src/pipeline/tipos.ts`: `RegionTrazada.esBase?: true`; `trazar` emite una región de base con `relleno` (prioridad mínima).
- `src/diseno/crear.ts`: una región `esBase` usa `base.id` sin mirar ΔE.
- `src/pipeline/defaults.ts`: `GROSOR_LINEAS_MM = { minimo: 0.8, porDefecto: 0.8, maximo: 2.0 }`, `LARGO_MINIMO_LINEA_MM = 1.5`, `FRACCION_LINEAS_AUTO = 0.04` (PROVISORIO), `FONDO_AREA_MINIMA_MM2 = 3`, `FONDO_TOLERANCIA = { base: 0.035, sigmas: 3, min: 0.05, max: 0.10 }`, `CAJA_FRACCION_MOTA = 0.01`, `LADO_MAX_PX_TRABAJO = 600` (sin medir).
- `src/pipeline/morfologia.ts`: `dilatar`, `esqueleto` (con el caso de la escalera), `componentes`, `encerrados`.
- `src/pipeline/limpiar.ts`: `ParamsLimpiar.grosorMinimoLineasMm` y `paleta`/`lab` para la guarda; devuelve el informe.
- `src/pipeline/mascara.ts`: `ajustarModeloFondo`, `fondoEncerrado`, `cajaSinMotas`; `presets.ts`: `mascaraPorUmbralAdaptativo(img, { tintaClara })`.
- `src/pipeline/cuantizar.ts` (o nuevo `colores.ts`): `fusionarIntermedios`.
- `convertirAutomatico`: la política (y no pasar a Foto con `fraccionLineas` alta).
- `workers/imagen.worker.ts` y `estado/documento.ts`: `OpcionesImagen.grosorMinimoLineasMm`, `ladoMayorMm`; caché de las etapas hasta `cuantizar` para que mover el grosor re-corra solo `limpiar` + `contornos`.

### Controles de interfaz por arreglo (mapeados a la auditoría)

| Arreglo | Control | Propuesta de la auditoría |
|---|---|---|
| 2 · fondo encerrado | Ninguno obligatorio (automático). Aviso con acción cuando `zonasSacadas > 0`: «Lo de adentro lo rellené con el color de la base. [Agujerearlo] [Deshacer]». | ④ «Tocá lo que es fondo» (el toque sigue haciendo falta para lo que la guarda deja y para `real-08`) |
| 3 · caja | Ninguno. Arreglar el texto del slider para que muestre las medidas reales | ⑧ |
| 4b · intermedios | Ninguno (automático) | ① Acciones por color («Juntar con…») sigue siendo la salida manual |
| 4c · base | Aviso con acción «Usar 4 filamentos», no automático | ① / texto del control Colores |
| 1 · engrosar | Tarjeta cuando `fraccionLineas ≥ 4 %` o algún color pierde > 30 %: «Engrosé las líneas finas para que se impriman. [Dejar que se borren]» + slider «Grosor de las líneas» 0,8–2,0 mm | ③ y ② (capa roja con `perdidaPorColor`) |
| 1 · tamaño | El slider de tamaño reprocesa al soltar | ⑧ |
| 5 · detector | Alimenta las tarjetas de ① y ⑥; sugiere «Líneas» | ②, ⑤ |
| 8 · polaridad | Ninguno (automático dentro de Silueta/Líneas) | ⑤ |
| 6 · Líneas | Opción del tipo de imagen, sugerida por el detector; «A ras / En relieve» en Avanzado | ⑤ |

## Lo que no funcionó (o funcionó a medias)

- **Engrosar «crudo»** engrosaba los halos de antialias: 6 escenas del banco con colores de más. Hicieron falta la guarda y conservar trazos.
- **Zhang-Suen borra diagonales de 2 px enteras**: una barra de 0,5 mm a 45° desaparecía con el engrosado prendido (se vio en `isotropia.ts`). Arreglado con el caso de «esqueleto evaporado», pero esa barra sale de 1,27 mm.
- **El engrosado no garantiza el mínimo en diagonal** (0,78 mm con 0,8 pedido). Falta el medio píxel de radio.
- **`medioPx` sin engrosar** es mucho peor que hoy (icono 0,038, texto largo 0,299). Isótropo no es lo mismo que mejor: sirve solo con engrosar.
- **4a** mueve colores entre elementos de forma poco predecible (gana el mate de La Ronda, pierde el rayo del sticker).
- **4b con criterio de área chica** rompía 2 escenas del banco; se descartó.
- **4c automático** saca elementos reales (hocico, rayo).
- **Fondo sin guarda** rompe 4 escenas del banco: sin un toque del usuario no se puede distinguir un blanco de diseño de fondo blanco que se ve a través.
- **Caja sin motas** empeora el tamaño de `real-08`, porque el problema de esa escena está antes (el flood fill se come el escudo). **`real-08` no mejora con nada** (0,177 → 0,177; Líneas 0,080; Silueta con polaridad 0,055).
- **Texto largo:** engrosar baja la IoU (0,798 → 0,689) y el llavero sigue de 50 × 3,7 mm. Lo arregla el texto de la app (⑦) o el tamaño, no la limpieza.
- **Gato:** los bigotes no llegan a la limpieza; la política mejora la cara pero el diseño sigue en 5 filamentos.
- **La política cuesta el doble** en las imágenes donde engrosa, hasta que la segunda corrida empiece en `limpiar`.

## Limitaciones

- Escenas sintéticas (las de `f2-casos-reales.md`) y una sola foto real. Los umbrales nuevos (4 % de líneas, 3 mm², 1 % de motas, 0,035 + 3σ) salen de estas 29 imágenes: son **PROVISORIOS**.
- No se construyó geometría: la región de base y el agujero pasante se razonaron desde `cuerpoDelLlavero`, no se midieron con `construir()`. Tampoco se midieron los avisos de la DRC con las líneas engrosadas.
- Los tiempos son de la PC de desarrollo en Node, con el runner corriendo en serie; en el worker del navegador hay que volver a medir.
- El tope de resolución a 80 mm (`LADO_MAX_PX_TRABAJO`) y `R = grosor/2 + 0,5 px` son propuestas sin medir.
