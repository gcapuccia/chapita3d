# Prueba F0.2 · ¿Bambu Studio acepta nuestro 3MF con los colores ya asignados?

**Fecha:** 2026-09-12
**Generador:** `spikes/3mf/generar.mjs` (sin dependencias, `node generar.mjs`)
**Archivos:** `spikes/3mf/salida/A-completo.3mf` y `B-sin-project-settings.3mf`

## Qué es la pieza de prueba

Base blanca de 40 × 25 × 2,4 mm, con dos barras encima de 0,6 mm: una roja y una negra.
Son cajas a propósito: **esta prueba valida el formato del archivo, no la geometría.** El agujero de la argolla y los contornos reales llegan en la Fase 1, con `manifold-3d`.

| Pieza | Slot esperado | Color |
|---|---|---|
| base | 1 | blanco `#FFFFFF` |
| rojo | 2 | rojo `#E53935` |
| negro | 3 | negro `#1C1C1C` |

## Por qué son dos archivos

| Variante | Qué lleva | Qué aísla |
|---|---|---|
| **A-completo** | Los 5 archivos, incluido `project_settings.config` | El caso completo: extrusores + colores de muestra declarados |
| **B-sin-project-settings** | Los 4 archivos sin `project_settings.config` | Si los extrusores **igual** llegan asignados, entonces ese archivo solo aporta las muestras de color y conviene omitirlo: es el que puede pisarle los presets de impresora al usuario (issue #7797) |

## Qué mirar, en orden

- [ ] **1. Abre sin el cartel de "no es de Bambu Lab".** Si aparece *"the 3mf is not from Bambu Lab, load geometry data only"*, falló la regla 1 (el metadato `Application`) y el resto de la prueba no vale.
- [ ] **2. Entra como UN objeto con TRES partes**, no como tres objetos sueltos ni como uno solo fusionado. Se ve en el panel de objetos, desplegando el ítem.
- [ ] **3. Cada parte tiene su filamento asignado:** base → 1, rojo → 2, negro → 3. Sin tocar nada.
- [ ] **4. La vista previa muestra los colores** (blanco, rojo, negro) en vez de todo gris.
- [ ] **5. Rebana sin errores** y en la previsualización se ven los cambios de filamento en las capas de arriba.
- [ ] **6. La pieza cae centrada en la cama** y apoyada en z = 0 (no flotando ni hundida).
- [ ] **7. Nada raro con los presets:** que no te haya cambiado la impresora ni los filamentos que tenías configurados.
- [ ] **8. Lo mismo en OrcaSlicer** (mismo lector, debería comportarse igual).

## Resultado

> Completar después de probar.

| # | A-completo | B-sin-project-settings | Notas |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |

**Versión de Bambu Studio probada:**
**Versión de OrcaSlicer probada:**
**Impresora / AMS:**

## La decisión que depende de esto

- **Si los puntos 1 a 5 dan verde:** el riesgo #1 del proyecto está muerto. Se sigue con la Fase 1 (el motor de geometría) con la confianza de que el archivo de salida funciona.
- **Si falla el punto 3 o 4:** se ajusta el perfil (primer sospechoso: la versión declarada en `Application`, segundo: el preset de `filament_settings_id`) y se vuelve a probar. Son minutos, no días.
- **Si falla el punto 1 incluso cambiando la versión:** se activa el plan B del plan (§9.3) — el producto pasa a "STL por color + instrucciones" y el calendario se recorta acá, no en la semana 8.

## Ajustes rápidos si algo falla

Todo está en las constantes del encabezado de `spikes/3mf/generar.mjs`:

| Constante | Valor actual | Cuándo tocarla |
|---|---|---|
| `APLICACION` | `BambuStudio-02.05.00.00` | Si no reconoce el archivo: poner la versión exacta de tu Bambu Studio |
| `PRESET_FILAMENTO` | `Bambu PLA Basic @BBL A1` | Si se queja del filamento: usar el preset de tu impresora (P1S, X1C…) |
| `SLOTS` | `4` | Si tenés AMS 2 Pro, CFS o varios AMS |
| `CENTRO_CAMA` | `128` | Si tu cama no es de 256 mm |
