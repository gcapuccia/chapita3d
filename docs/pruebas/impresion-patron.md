# Prueba F0.5 · Las tres piezas patrón: impresas y medidas con calibre

**Estado:** ✅ piezas generadas y verificadas por software · ⏳ **falta abrirlas, imprimirlas y medirlas (lo hace el usuario)**

> El spike más importante del proyecto (plan §10). Es lo único que calibra el **ancho mínimo de detalle**, el **margen del agujero** y la **purga real**. Esos tres números alimentan todas las validaciones de la web.

## Los archivos

Se generan con `node spikes/03-impresion/generar.ts` y quedan en `spikes/03-impresion/salida/`:

| Archivo | Qué es |
|---|---|
| `P1-regla-de-detalle.3mf` | Placa blanca de 60×30 mm con barras negras de 0,4 a 2,0 mm y una zona de costura negro/rojo |
| `P2-llavero-completo.3mf` | Llavero de 41×50 mm con 4 colores, argolla, contorno e isla de 1 mm² |
| `P3-apilado-A-cambio-en-z-de-inicio.3mf` | El mismo dibujo en franjas, 1 filamento con cambios M600 en z = 2,4 y 3,0 |
| `P3-apilado-B-cambio-en-primera-capa.3mf` | Idéntico a A, pero con los cambios una capa más arriba: z = 2,6 y 3,2 |
| `stl/…` | Los STL por color y de la pieza entera de P1 y P2 (plan B si el 3MF falla) |
| `INFORME.txt` | Medidas, posición de cada barra y gramos estimados |

> **Los archivos de `spikes/3mf/` (F0.2) ya no hacen falta.** P1 y P2 prueban el mismo formato con piezas reales.

**Ya verificado por software:** el volumen de cada malla escrita en el 3MF y en el STL coincide con el del sólido de Manifold (`tests/export.test.ts`), así que coordenadas y orientación de caras están bien. Las 6 reglas del formato Bambu se chequean en cada build. La costura de P1 da 1 contorno sin hueco, la isla de P2 mide 1,00 mm² y P3 no tiene partes flotantes.

**Lo que solo puede decir tu impresora:** todo lo de abajo.

---

## Paso 1 · Abrir en Bambu Studio (sin gastar filamento)

Abrí `P1` y `P2`. **Esto también cierra la prueba F0.3** (el formato del 3MF).

- [ ] Abre **sin** el cartel *"the 3mf is not from Bambu Lab, load geometry data only"*.
- [ ] Si pregunta si cargar la configuración del proyecto, elegí **solo la geometría** y anotalo.
- [ ] Entra como **un objeto con varias partes**. P1 tiene 3 partes (base, negro, rojo) y P2 tiene 4 (base, negro, rojo, amarillo).
- [ ] Cada parte ya tiene su filamento: base → 1, negro → 2, rojo → 3, amarillo → 4.
- [ ] Asigná tus filamentos reales del AMS a los slots 1–4: **blanco, negro, rojo, amarillo**. Si no tenés esos colores, usá los que más contrasten; lo importante es ver las costuras.

## Paso 2 · Rebanar y mirar capa por capa (sin gastar filamento)

Rebanar con **PLA, capa de 0,2 mm y boquilla de 0,4**. Sin soportes y apoyado plano.

Revisar la vista previa capa por capa **antes de imprimir**. Es gratis y detecta la mayoría de los problemas:

- [ ] **P1, zona de costura** (a la derecha): en las capas de 2,4 a 3,0 mm, entre el negro y el rojo **no aparece ninguna línea blanca**.
- [ ] **P1, barras** (a la izquierda): anotar a partir de qué barra el slicer genera extrusión. Las de 0,4 y 0,6 mm pueden no aparecer, y eso ya es un dato.
- [ ] **P2:** las capas de color no tienen huecos blancos entre colores vecinos, y la isla chica de arriba (rojo) aparece.

### P3: cuál de las dos variantes es la correcta

La base termina en **z = 2,4 mm**, así que la primera capa amarilla es la que va de 2,4 a 2,6. Abrí **las dos variantes**, rebanalas y mirá con el deslizador de capas dónde queda la marca de cambio de color:

- [ ] ¿El slicer **insertó las pausas solo**, sin agregarlas a mano? (criterio de aceptación del plan)
- [ ] ¿En qué variante la **última capa blanca** es la de 2,2–2,4 y la **primera amarilla** la de 2,4–2,6?

| Variante | ¿Tomó las pausas? | Última capa blanca | Primera capa amarilla | ¿Correcta? |
|---|---|---|---|---|
| A (z = 2,4 / 3,0) | | | | |
| B (z = 2,6 / 3,2) | | | | |

La variante correcta define cómo se escribe `top_z` para siempre.

## Paso 3 · Imprimir

Imprimir **P1 y P2**. P3 es opcional: su valor está en el paso 2, y en una impresora con AMS la pausa M600 pide cambiar el filamento a mano.

Anotar lo que reporta el slicer:

| Pieza | Gramos de pieza | Gramos de purga / torre | Tiempo | Cambios de filamento |
|---|---|---|---|---|
| P1 (estimado por software: 5,81 g sin purga) | | | | |
| P2 (estimado por software: 5,00 g sin purga) | | | | |

## Paso 4 · Medir

### P1 · Regla de detalle

Las barras van de la más fina (izquierda) a la más gruesa. Hay un **punto negro arriba de la barra de 0,8 mm**, que es el umbral provisorio.

| Barra (nominal) | ¿Salió completa y pareja? | Ancho medido con calibre |
|---|---|---|
| 0,4 mm | | |
| 0,6 mm | | |
| 0,8 mm ● | | |
| 1,0 mm | | |
| 1,5 mm | | |
| 2,0 mm | | |

- [ ] **Costura:** mirando con lupa y a contraluz, ¿se ve una línea blanca entre el negro y el rojo?

### P2 · Llavero completo

- [ ] **Tirón firme de mano** en la argolla: no se fisura.
- [ ] **Colgado de un llavero real con 5 llaves**, sacudiéndolo: no se fisura.
- [ ] La **isla de 1 mm²** (el punto rojo arriba de la cara) se imprimió y se ve.
- [ ] El diámetro del **agujero medido** (nominal 4,2 mm): ______ mm. ¿Entra la argolla?

## Qué se hace con los resultados (reglas del plan)

| Si… | Entonces |
|---|---|
| La barra de **0,8 mm no sale completa y pareja** | `anchoMinimoDetalle` sube al primer ancho que sí sale |
| Hay **línea blanca** en la costura | `EPSILON_SOLAPE_XY` sube de a 0,01 mm (hoy 0,05) y se reimprime P1 |
| La **argolla se fisura** | 1º `margenAgujero` de 3,0 → 4,0 mm · 2º `radioFilletPestana` de 2,0 → 3,0 · 3º pestaña más gruesa que el cuerpo. En ese orden, de menor a mayor costo de material |
| El agujero sale **chico** para la argolla | Se ajusta la compensación de `diametroAgujero` (hoy +0,2 mm) |
| La **purga real** difiere del estimado en más de 20 % | Se ajusta el coeficiente de estimación (plan §9.5) |

## Resultados

> Completar después de imprimir. Con fotos si se puede.

**Impresora / AMS:**
**Versión de Bambu Studio:**
**Filamentos usados:**
