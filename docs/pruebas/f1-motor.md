# Fase 1 · El motor: de imagen a ZIP

**Fecha:** 2026-09-13 · **Estado:** ✅ motor completo sin interfaz, verificado sobre todo el banco y en el navegador · ⏳ falta el texto (F1.2) y abrir un ZIP real en Bambu Studio

> "Fin de la Fase 1: hay producto, no hay interfaz." (plan §10)

## Qué quedó hecho

| Tarea | Archivos | Estado |
|---|---|---|
| **F1.1** Pipeline terminado | `pipeline/diagnostico.ts` (casos feos), `pipeline/presets.ts` (Dibujo, Foto, Silueta, con umbral adaptativo y clusters), `convertirAutomatico()`, `workers/imagen.worker.ts` con token de generación | ✅ |
| **F1.2** Geometría | `diseno/` (el documento `Diseno`), `geometria/llavero.ts`, `geometria/franjas.ts` (a ras y apilado con la fórmula del paso 12b), `regiones.ts` (de F0.6) | ✅ salvo `texto.ts` |
| **F1.3** Validaciones y material | `geometria/drc.ts` (las 7 validaciones, con zonas), `geometria/estimar.ts` | ✅ |
| **F1.4** Construir y empaquetar | `geometria/construir.ts`, `export/paquete.ts`, `export/instrucciones.ts`, `construirLlavero` en el worker de geometría, tests golden | ✅ |
| **F1.5** Página de punta a punta | `/#/dev/pipeline`: subir imagen → máscara, colores, casos feos y tiempos → llavero → ZIP | ✅ |

## Criterios de aceptación del plan

| Criterio | Resultado |
|---|---|
| Las imágenes del banco producen piezas manifold y disjuntas | ✅ **28/28** (14 imágenes × 2 modos). Disjuntas **en 3D**: la suma de volúmenes por color es el volumen de la pieza fusionada (error < 0,1 %) |
| Invariante `área(unión) == área(silueta)` | ✅ `tests/regiones.test.ts` (de F0.6) |
| 500 construcciones no hacen crecer el heap más de 10 % | ✅ `tests/construir.test.ts` |
| Tests golden de los perfiles | ✅ a ras y apilado (el perfil Prusa está pospuesto, §2-bis E3) |
| Desde `/dev/pipeline`, subir un logo y bajar el ZIP | ✅ en el navegador: **1,7 s** de la imagen al ZIP, incluido el arranque de los workers |
| Los archivos abren en los slicers | ⏳ **usuario**: abrir un ZIP generado en Bambu Studio |
| **Compuerta del layout:** mediana de recalcular el preview ≤ 400 ms | ✅ **56 ms** (p90 109 ms, máx 167 ms) → **se mantienen las tres solapas** |

Medición completa: `node spikes/06-construir/correr.ts`.

## Hallazgos: lo que el plan decía y se cambió con datos

1. **Modo a ras = cara plana.** La pieza P2 del spike tenía los colores sobresaliendo del borde. El plan dice "a ras" y "pestaña del mismo espesor que el cuerpo", así que en el motor los colores van **incrustados al ras**: la base es el cuerpo entero menos el hueco de los colores, lo que además los hace disjuntos por construcción.
2. **Validación #2 rediseñada.** El plan la definía como "anillo alrededor del agujero < 2 mm", pero la pestaña se construye centrada en el agujero, así que el anillo mide 3 mm siempre y esa validación nunca podía fallar. Donde se rompe un llavero de verdad es en **la unión de la pestaña con el cuerpo**. La #2 ahora mide eso también (`argolla-suelta`): si el agujero se arrastra lejos, la descarga se bloquea.
3. **El fillet de la pestaña quedó limitado a su zona.** Aplicado a todo el contorno, rellenaba cualquier entrante del dibujo más angosto que 4 mm, como el espacio entre las orejas de un gato. Tiene test.
4. **La regla automática del plan para elegir preset acierta 8 de 15.** "≥ 85 % en 2 clusters → Silueta" manda ahí a cualquier logo sobre fondo blanco, y Silueta falla en todos. Se reemplazó por una **cascada medida**: Dibujo y, si no encuentra el dibujo, Foto. Con eso elige el mejor preset disponible en 14 de 15.
5. **Foto rescata los casos horribles; Silueta no.** "Fondo igual al sujeto" pasa de IoU 0,23 a **éxito completo**, y la foto oscura de 0,00 a 0,98. El plan sugería Silueta para el caso 6a.
6. **La purga del plan tiene números inconsistentes.** Dice "400 mm³ ≈ 2–5 g", pero 400 mm³ de PLA pesan 0,5 g. Se usa el volumen, marcado PROVISORIO, y se calibra con lo que reporte Bambu Studio al rebanar P2.
7. **Nombres de color legibles.** Las instrucciones dicen "Slot 2 .... Amarillo" en vez de "Color 2".

## Bugs encontrados al probar en el navegador

- **Vite re-optimizaba en caliente las dependencias de los workers** y los dejaba colgados. Ahora están declaradas en `optimizeDeps.include`.
- **StrictMode mataba los workers de la página.** Se creaban con `useMemo`, y la limpieza del montaje de prueba los terminaba. Ahora se crean en el efecto. En producción no habría pasado.

## Tiempos (PC de desarrollo)

| Qué | Node | Navegador (modo desarrollo, sin optimizar) |
|---|---|---|
| Pipeline de imagen | ~350 ms | 643 ms |
| Construir el llavero | 11–167 ms (mediana 56) | 146 ms |
| Empaquetar el ZIP | 34–60 ms | 88 ms |

## Pendiente

| Qué | Por qué | Quién |
|---|---|---|
| `texto.ts` (texto con 3 fuentes) | Hacen falta fuentes con licencia OFL: hay que decidir de dónde salen y agregar OFL-1.1 a la lista blanca de licencias | Decisión del usuario |
| Abrir en Bambu Studio un ZIP de `/dev/pipeline` | Cierra el criterio "los archivos abren en los slicers" | Usuario |
| Re-importar el 3MF con `3MFLoader` en CI | Necesita `DOMParser`, que Node no trae (sumaría jsdom). Mientras tanto, `tests/export.test.ts` relee la malla del 3MF y verifica volumen y orientación | Más adelante |
| Calibrar `DESPLAZAMIENTO_TOP_Z` | Lo decide la prueba de las variantes A y B de P3 | Usuario (F0.5) |
