# Plan C · Usuario primero: que cualquiera saque un llavero lindo en menos de 2 minutos

> **Qué es este documento.** El tercer ángulo. El plan A ordena el trabajo por "MVP primero" y el plan B por "riesgo primero". Los dos ya resolvieron *qué* construir y *en qué orden técnico*. Ninguno de los dos resolvió **cómo se siente usarlo**: no hay wireframes, no hay estados vacíos ni de error, no hay atajos, no hay criterio explícito para decidir qué control se muestra y cuál no, no hay microcopy escrito, no hay métricas de interfaz, y el editor está listado como tabla de implementación, no como herramienta que alguien usa con el mouse.
>
> Este plan cubre exactamente eso. Reusa sin discutir todos los números de `audit-01`, `audit-02` y `audit-03` (0,8 mm de detalle mínimo, Ø4,2 del agujero, 2,4+0,6 mm de espesor, N=4 colores, 50 mm de lado, ΔE2000 < 5 para avisar colisión de colores). No repite el pipeline ni el formato 3MF: los da por decididos.
>
> **Fecha:** 2026-09-12 · **Ángulo:** arquitectura de producto / experiencia de uso.

---

## Índice

- [0. La apuesta central](#0-la-apuesta-central)
- [1. Quién usa esto y el reloj de 2 minutos](#1-quién-usa-esto-y-el-reloj-de-2-minutos)
- [2. Mapa del flujo y los seis principios](#2-mapa-del-flujo-y-los-seis-principios)
- [3. Pantalla por pantalla, con wireframes](#3-pantalla-por-pantalla-con-wireframes)
- [4. Los defaults: qué decide el sistema solo](#4-los-defaults-qué-decide-el-sistema-solo)
- [5. Los casos feos y cómo los resuelve la interfaz](#5-los-casos-feos-y-cómo-los-resuelve-la-interfaz)
- [6. El editor, en detalle](#6-el-editor-en-detalle)
- [7. Vista previa honesta](#7-vista-previa-honesta)
- [8. Microcopy: los 10 textos que más importan](#8-microcopy-los-10-textos-que-más-importan)
- [9. Qué arquitectura exige esta UX](#9-qué-arquitectura-exige-esta-ux)
- [10. Métricas de interfaz, gratis](#10-métricas-de-interfaz-gratis)
- [11. Fases e hitos](#11-fases-e-hitos)
- [12. Supuestos y las tres decisiones más discutibles](#12-supuestos-y-las-tres-decisiones-más-discutibles)

---

## 0. La apuesta central

**El producto no compite convirtiendo imágenes. Compite en que el resultado se entiende antes de imprimirlo.**

Convertir imagen → 3MF multicolor ya es commodity: cuatro competidores lo hacen gratis y sin cuenta (`audit-03 §2.2`). Lo que ninguno hace es cerrar el círculo de confianza: mostrarte el llavero **como va a salir de la impresora**, avisarte lo que te va a salir mal **antes** de que gastes 40 minutos de máquina, y dejarte arreglarlo sin abrir Tinkercad.

De ahí salen las tres apuestas de este plan:

1. **Cero pantallas en blanco.** En cada paso el usuario llega y **ya hay un resultado hecho**. Nunca "elegí una opción para empezar". El recorte ya está hecho, los colores ya están elegidos, la argolla ya está puesta. Lo único que el usuario hace es **aceptar o corregir**. Esto solo es posible porque el pipeline corre especulativamente y completo mientras el usuario mira la pantalla anterior (§9.1).
2. **Un control visible por pantalla, y ese control es el que decide la calidad.** Fondo → cuánto sacar. Colores → cuántos. Llavero → tamaño. Todo lo demás está a un click pero no ocupa espacio. El criterio para decidir qué sube a "visible" es explícito y verificable (§4.2), para no terminar en el panel de 20 sliders.
3. **La previsualización miente lo menos posible.** Colores de filamento reales, terrazas visibles, ancho mínimo resaltado, gramos de purga a la vista. Preferimos un usuario que abandona en el paso 3 porque vio que su foto no da, antes que uno que imprime y tira la pieza. Ese es el único foso que no se copia en un fin de semana.

**Antipatrón declarado:** el asistente lineal de 5 pasos de los planes A y B es correcto como secuencia, pero **no puede ser un wizard modal**. Acá es un flujo de 3 solapas con el preview 3D presente desde el primer segundo, y el botón "Descargar" habilitado siempre. El usuario tiene que poder saltear.

---

## 1. Quién usa esto y el reloj de 2 minutos

### 1.1 Tres usuarios reales

| # | Quién | Qué trae | Qué quiere | Qué lo frustra | % estimado |
|---|---|---|---|---|---|
| **U1 · El apurado** | Compró una A1 mini hace 3 semanas. Sabe apretar "imprimir" en Bambu Studio y nada más. | Un PNG de un logo bajado de internet, fondo blanco. | Un archivo que abra y salga. | Cualquier palabra que no entienda ("offset", "manifold", "extrusor 2"). Cualquier pantalla que le pida decidir algo antes de haber ganado nada. | **70%** |
| **U2 · El que regala** | Quiere el dibujo de su hija o la cara de su perro en un llavero. | Foto de celular, fondo de cocina, sombras. | Que se reconozca el dibujo o al perro. | Que el recorte le coma media cabeza y no entienda cómo arreglarlo. Que le salga todo gris. | **25%** |
| **U3 · El que vende** | Imprime y vende en ferias. Tiene AMS y le duele la purga. | 30 nombres, un logo de club. | Control fino, repetir el diseño, lote. | No poder mover nada. Tener que rehacer todo para cambiar un color. | **5%**, pero es el que paga |

El producto se diseña para **U1 en el camino feliz** y para **U2 en el camino de rescate**. U3 justifica el editor y el modo lote (fase posterior).

### 1.2 El presupuesto de 2 minutos, repartido

La meta "llavero lindo en menos de 2 minutos" se convierte en un presupuesto por pantalla. Es un **contrato verificable**, no una aspiración: cada número se mide con `performance.mark()` y se reporta como métrica (§10).

| Etapa | Presupuesto | Qué pasa adentro | Qué ve el usuario |
|---|---|---|---|
| Landing → soltar el archivo | 0:00 – 0:15 | Nada | Dropzone + 3 ejemplos |
| Decodificar + pipeline especulativo **completo** | **≤ 1,5 s desktop / ≤ 4 s móvil** | Los 11 pasos de `plan-B §8.1` | Barra con 4 hitos nombrados |
| Fondo: mirar y aceptar | 0:15 – 0:45 | Recálculo de máscara ≤ 200 ms | Se entra con el recorte hecho |
| Colores: mirar y aceptar | 0:45 – 1:10 | k-means ≤ 120 ms por cambio de N | Preview 3D girable |
| Llavero: tamaño y argolla | 1:10 – 1:40 | Booleanas ≤ 400 ms | Vista 3D + avisos |
| Descargar | 1:40 – 2:00 | Escritura del 3MF ≤ 800 ms | Ficha honesta + ZIP |

**Regla dura:** si una interacción tarda más de **100 ms**, hay feedback inmediato (skeleton, spinner inline, o el preview anterior en gris). Si tarda más de **1 s**, hay **progreso nombrado en español** ("Separando los colores…"), nunca un porcentaje inventado.

---

## 2. Mapa del flujo y los seis principios

```
                     ┌──────────────────────────────────────────┐
                     │  /  LANDING                              │
                     │  dropzone grande + 3 ejemplos            │
                     └───────────────┬──────────────────────────┘
                                     │ soltar archivo / click en ejemplo
                                     ▼
                     ┌──────────────────────────────────────────┐
                     │  PROCESANDO (overlay, 0,3–4 s)           │
                     │  no es una ruta: es un estado de /crear   │
                     └───────────────┬──────────────────────────┘
                                     ▼
                      ┌─────────────────────────────────────────┐
                      │  /crear  ← UNA SOLA RUTA, 3 SOLAPAS     │
                      │  [Fondo] [Colores] [Llavero] │ 3D ►     │
                      └───────┬──────────────────────┴─────┬────┘
                              │                            │
            "Descargar" SIEMPRE activo                 "Editar"
                              ▼                            ▼
              ┌───────────────────────────┐   ┌─────────────────────────┐
              │ /descargar                │◄──┤ /editor  (opcional)     │
              │ ficha honesta + ZIP       │   │ lienzo + capas + tools  │
              └───────────────────────────┘   └─────────────────────────┘
```

**Diferencia con los planes A y B:** ellos proponen una ruta por paso (`/nuevo/recorte`, `/nuevo/colores`, `/nuevo/llavero`). Acá es **una sola ruta con tres solapas y el preview 3D siempre presente**. Motivo: el usuario tiene que ver el efecto de lo que toca sobre el objeto final, no sobre una imagen intermedia. Cambiar de solapa no recarga, no pierde la cámara 3D y no se siente como "avanzar sin poder volver". El hash (`#fondo`) mantiene el botón atrás del navegador funcionando y hace las URLs compartibles como "paso".

### Los seis principios (con su consecuencia técnica)

| # | Principio | Consecuencia técnica |
|---|---|---|
| 1 | **Nunca una pantalla vacía.** Todo paso se entra con un resultado ya calculado. | Pipeline especulativo: al soltar el archivo corre entero hasta la malla, no hasta la máscara. |
| 2 | **El objeto final siempre a la vista.** El preview 3D no aparece en el paso 4: está desde el paso 1. | El worker de geometría responde en ≤ 400 ms, con degradación (malla cruda mientras se arrastra). |
| 3 | **Descargar nunca se bloquea por un aviso amarillo.** Solo por uno rojo, y los rojos son 4 y todos tienen arreglo de un click. | La DRC devuelve `{nivel, mensaje, zona, arreglo?}`, no solo texto. |
| 4 | **Nada se pierde.** Cerrar la pestaña, volver mañana, seguir. | Autoguardado del `Diseno` en IndexedDB cada 2 s con debounce. |
| 5 | **Ningún término de impresión 3D en la ruta principal.** "Extrusor", "manifold", "offset", "slicer", "mesh" solo en el panel Avanzado y en la ayuda. | Glosario centralizado en `src/ui/textos.ts` + test de CI que falla si una palabra de la lista negra aparece fuera de los módulos permitidos. |
| 6 | **El celular no es una versión recortada.** Es el mismo producto con otro layout. | El flujo principal es 100% táctil; el editor sí se recorta (§6.8). |

---

## 3. Pantalla por pantalla, con wireframes

> Convención: `▓` botón primario · `░` botón secundario · `◉` opción elegida · `○` no elegida · `▸` desplegable cerrado · `⠿` agarradera de arrastre.

### 3.1 · Landing (`/`)

**Estado normal (desktop ≥ 1024 px)**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  3DLlaveros                                      Ayuda   Compatibilidad   ES │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│      Convertí tu dibujo o logo en un llavero listo para imprimir.            │
│      Funciona también si tu impresora es de un solo color.                   │
│                                                                              │
│      ┌────────────────────────────────────────────────────────────┐          │
│      │                          ⬆                                 │          │
│      │            Arrastrá tu imagen acá, o hacé click             │          │
│      │           PNG · JPG · WEBP · SVG   ·   hasta 25 MB          │          │
│      │                                                             │          │
│      │                  ▓ Elegir una imagen ▓                      │          │
│      └────────────────────────────────────────────────────────────┘          │
│      Tu imagen no se sube a ningún lado: todo pasa en tu navegador.          │
│                                                                              │
│      ¿No tenés una a mano? Probá con estas:                                  │
│      ┌──────┐  ┌──────┐  ┌──────┐                                            │
│      │ logo │  │dibujo│  │silue-│   ← click = arranca el flujo completo       │
│      │3 col.│  │ nene │  │  ta  │                                            │
│      └──────┘  └──────┘  └──────┘                                            │
│                                                                              │
│      ── Qué imágenes funcionan mejor ────────────────────────────────────    │
│      ┌───┐ colores planos   ┌───┐ fondo liso o   ┌───┐ sin líneas más        │
│      │ ✓ │ y bien marcados  │ ✓ │ transparente   │ ✗ │ finas que 1 mm        │
│      └───┘                  └───┘                └───┘                       │
│                                                                              │
│      Subí solo imágenes propias o con permiso. Convertirlas no te da         │
│      derechos sobre personajes, logos o marcas de terceros.                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  Términos · Privacidad · Compatibilidad con slicers · Licencias · Contacto   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Decisión que se aparta de los planes A y B:** ellos ponen el **selector de impresora arriba de todo en la landing** (plan B, P0). Acá **no está**. Preguntarle a U1 "¿Bambu/AMS o Prusa/MMU?" antes de que haya visto nada es la primera oportunidad de que se vaya: no entiende la pregunta y todavía no ganó nada. El selector aparece en la solapa **Colores**, cuando ya vio su llavero en 3D y la pregunta tiene contexto: *"¿Cuántos colores podés cargar a la vez en tu impresora?"*. Default: **4 o más**. Costo de equivocarse: un click en la pantalla de descarga, donde el ZIP trae igual los tres perfiles.

**Estado: arrastre encima (`dragover`)**

```
      ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
      ┃                                                          ┃
      ┃                       Soltá acá                          ┃
      ┃                                                          ┃
      ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
            borde 3 px animado · fondo teñido al 8%
```

**Estado: hay un diseño guardado de antes (vuelve de IndexedDB)**

```
│      ┌──── Seguí donde lo dejaste ─────────────────────────────┐             │
│      │ [thumb]  "logo-club.png"   ayer 19:42   ·  4 colores    │             │
│      │                              ▓ Seguir ▓   ░ Descartar ░ │             │
│      └─────────────────────────────────────────────────────────┘             │
```

**Estado: error de archivo (inline, nunca modal, nunca `alert()`)**

```
│      ┌─────────────────────────────────────────────────────────┐             │
│      │ ⚠ No pude abrir "IMG_4417.HEIC"                         │             │
│      │   Las fotos de iPhone en HEIC no se abren en la web.    │             │
│      │   En el iPhone: Ajustes ▸ Cámara ▸ Formatos ▸ "Más      │             │
│      │   compatible". O mandátela por WhatsApp y usá esa.      │             │
│      │                                        ░ Entendido ░    │             │
│      └─────────────────────────────────────────────────────────┘             │
```

La dropzone **sigue activa** debajo del error. Los textos exactos de los tres errores de entrada están en §8.

**Landing en celular (≤ 640 px)**

```
┌────────────────────────────┐
│ 3DLlaveros            ☰    │
├────────────────────────────┤
│ Convertí tu dibujo en un   │
│ llavero listo para imprimir│
│                            │
│ ┌────────────────────────┐ │
│ │          ⬆             │ │
│ │ ▓ Sacar una foto ▓     │ │  ← capture="environment"
│ │ ░ Elegir de la galería░│ │
│ └────────────────────────┘ │
│ Todo pasa en tu teléfono.  │
│                            │
│ Probá con estas:           │
│ [logo] [dibujo] [silueta]  │
└────────────────────────────┘
```

En móvil el botón primario es **"Sacar una foto"**: U2 con el celular casi siempre tiene el dibujo del chico sobre la mesa. Es un `<input type="file" accept="image/png,image/jpeg,image/webp" capture="environment">`, una línea de HTML.

---

### 3.2 · Procesando (overlay sobre `/crear`)

No es una ruta. Es un overlay que aparece apenas se suelta el archivo y se va solo.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                    ┌──────────────────────┐                                  │
│                    │   [ la imagen del    │  ← su imagen ya, apenas          │
│                    │     usuario, con un  │    decodificada, para que        │
│                    │     barrido de luz   │    sepa que llegó bien           │
│                    │     animado ]        │                                  │
│                    └──────────────────────┘                                  │
│                                                                              │
│                  ●━━━━━━━●━━━━━━━○━━━━━━━○                                   │
│                                                                              │
│                  ✓  Leí tu imagen                                            │
│                  ▸  Sacando el fondo                                         │
│                     Separando los colores                                    │
│                     Armando el llavero                                       │
│                                                                              │
│                                                ░ Cancelar ░                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Cuatro hitos nombrados, no un porcentaje.** El porcentaje sería mentira: el tiempo de cada etapa depende de la imagen.
- A los **3 s**: *"Tu imagen es grande, esto puede tardar unos segundos."* A los **8 s**: *"Está tardando más de lo normal. ¿La proceso más chica?"* con `▓ Procesarla más chica ▓` (baja a 400 px y reintenta).
- **Cancelar** hace `worker.terminate()` y vuelve a la landing **con el archivo todavía cargado**, no perdido.
- **Error del worker:** el overlay se reemplaza por el texto nº 7 de §8, con `▓ Reintentar más chica ▓` y `░ Probar otra imagen ░`.

---

### 3.3 · Solapa Fondo (`/crear#fondo`)

La pantalla que decide si el producto es mágico o frustrante (`audit-01 §1`). Se lleva la mitad del presupuesto de UI.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← 3DLlaveros      [ Fondo ] [ Colores ] [ Llavero ]    ↩ ↪     ▓ Descargar ▓ │
├───────┬────────────────────────────────────────────────┬─────────────────────┤
│       │                                                │   TU LLAVERO        │
│  🪄   │        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░            │  ┌───────────────┐  │
│varita │        ░░░░░░░▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░            │  │               │  │
│       │        ░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░            │  │  (vista 3D    │  │
│  🧽   │        ░░░▓▓▓   ▓▓▓▓▓▓  ▓▓▓▓▓░░░░            │  │   girable, ya │  │
│borrar │        ░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░            │  │   con colores │  │
│       │        ░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░            │  │   y argolla)  │  │
│  ✏️   │        ░░░░░░▓▓▓▓░░░░▓▓▓▓░░░░░░░░            │  │               │  │
│restau-│        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░            │  └───────────────┘  │
│  rar  │                                                │   ⟲ arrastrá        │
│       │        ░ = fondo (damero)   ▓ = tu dibujo      │                     │
│  ✋   │                                                │  ───────────────    │
│mover  │  ┌──────────────────────────────────────────┐  │  ⚠ 1 aviso          │
│       │  │ Cuánto fondo sacar                       │  │  ▸ El texto de      │
│       │  │ menos ──────────●──────────── más        │  │    abajo puede      │
│       │  │ Pincel  ●──────────                      │  │    salir ilegible   │
│       │  └──────────────────────────────────────────┘  │                     │
│       │                                                │                     │
│       │  Tipo de imagen:  ◉ Dibujo  ○ Foto  ○ Silueta  │  ░ Saltear este     │
│       │  ░ Recorte avanzado (descarga 3,5 MB) ░        │    paso ░           │
├───────┴────────────────────────────────────────────────┴─────────────────────┤
│              ░ Atrás ░                        ▓ El fondo está bien → ▓       │
└──────────────────────────────────────────────────────────────────────────────┘
```

Lo que hay que notar:

- **Se entra con el recorte ya hecho.** El estado inicial nunca es "hacé click para empezar a recortar".
- **El preview 3D está a la derecha, ya terminado.** Cada pincelada lo actualiza con 300 ms de debounce. Eso convierte una tarea aburrida (recortar) en una con recompensa inmediata, y es la razón principal de usar solapas en vez de páginas.
- **Un solo slider: "Cuánto fondo sacar".** No se llama "Tolerancia" (término de Photoshop, no de U1) y no muestra el número.
- **Cuatro herramientas y nada más.** Varita, borrar, restaurar, mover. El zoom es un modificador permanente (rueda del mouse), no una herramienta que haya que elegir.
- **"Saltear este paso"** siempre visible y legítimo: acepta la máscara automática. Para U1 es el camino esperado.
- **"Recorte avanzado"** (GrabCut / OpenCV.js) es secundario, con el costo declarado, y se carga diferido. **Nunca se carga solo.**
- El **aviso del panel derecho es clickeable**: resalta la zona problemática en el preview 3D con un pulso naranja.

**Estado: preset "Foto" — la pantalla cambia de forma** (idea de `audit-01 §1.4`, que ninguno de los dos planes dibujó)

```
│       │      [ la imagen ya posterizada a 6 colores ]   │                    │
│       │                                                 │                    │
│       │   Tocá los colores que son fondo:               │                    │
│       │   ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │                    │
│       │   │▓▓▓▓│ │░░░░│ │████│ │▒▒▒▒│ │▓▓▓▓│ │····│    │   ✓ = es fondo     │
│       │   │    │ │ ✓  │ │    │ │    │ │    │ │ ✓  │    │                    │
│       │   └────┘ └────┘ └────┘ └────┘ └────┘ └────┘    │                    │
│       │                                                 │                    │
│       │   ¿Quedó algo de más? Usá el pincel 🧽          │                    │
```

Tres a cinco decisiones discretas ("este gris es fondo") en vez de pelear con un slider continuo. **Nunca deja halo**, porque trabaja sobre polígonos ya cuantizados.

**Solapa Fondo en celular**

```
┌────────────────────────────┐
│ ← [Fondo][Color][Llavero]  │
├────────────────────────────┤
│  ┌──────────────────────┐  │
│  │                      │  │  pinch = zoom
│  │   lienzo (60% alto)  │  │  2 dedos = pan
│  │                      │  │  1 dedo = herramienta activa
│  │             ┌──────┐ │  │
│  │             │ 3D ▸ │ │  │ ← chip flotante: tocar = 3D full screen
│  └─────────────┴──────┴─┘  │
│  🪄   🧽   ✏️   ✋         │
│  Cuánto fondo sacar        │
│  menos ─────●───── más     │
│  ◉Dibujo ○Foto ○Silueta    │
│ ┌────────────────────────┐ │
│ │ ▓ El fondo está bien ▓ │ │ ← barra fija, respeta safe-area-inset
│ └────────────────────────┘ │
└────────────────────────────┘
```

El preview 3D en celular **no va al lado**: es un chip flotante que al tocarlo ocupa toda la pantalla con un botón "volver a editar". En 375 px, dos paneles lado a lado hacen que ninguno sirva.

---

### 3.4 · Solapa Colores (`/crear#colores`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← 3DLlaveros    [ Fondo ✓ ] [ Colores ] [ Llavero ]   ↩ ↪     ▓ Descargar ▓  │
├────────────────────────────────────────────┬─────────────────────────────────┤
│                                            │  ¿CUÁNTOS COLORES?              │
│         ┌────────────────────────┐         │   ○2   ○3   ◉4   ○5   ○6        │
│         │                        │         │                                 │
│         │    vista 3D grande,    │         │  LOS COLORES DE TU LLAVERO      │
│         │    con los colores de  │         │  (arrastrá para reordenar)      │
│         │    filamento REALES    │         │  ┌────────────────────────────┐ │
│         │                        │         │  │⠿ ▉ Blanco   PLA Basic   🔒│ │
│         │                        │         │  ├────────────────────────────┤ │
│         └────────────────────────┘         │  │⠿ ▉ Rojo     PLA Basic   🔓│ │
│           [Arriba] [3D] [Capas]            │  ├────────────────────────────┤ │
│                                            │  │⠿ ▉ Negro    PLA Basic   🔓│ │
│  ⚠ El rojo y el bordó te van a quedar      │  ├────────────────────────────┤ │
│    casi iguales al imprimir.               │  │⠿ ▉ Bordó    PLA Basic   🔓│ │
│                     ▓ Fusionarlos ▓        │  └────────────────────────────┘ │
│                                            │  ░ Ordenar para purgar menos ░  │
│                                            │                                 │
│                                            │  ¿CUÁNTOS COLORES PODÉS CARGAR  │
│                                            │  A LA VEZ EN TU IMPRESORA?      │
│                                            │  ◉ 4 o más (AMS, CFS, ACE, MMU) │
│                                            │  ○ Solo 1 (los cambio a mano)   │
├────────────────────────────────────────────┴─────────────────────────────────┤
│           ░ Atrás ░                           ▓ Los colores están bien → ▓    │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **El preview 3D pasa al centro y crece.** El usuario está juzgando colores: tiene que verlos grandes.
- **Cada fila:** agarradera, muestra, nombre del filamento real, candado. **Click en la muestra** abre la grilla de filamentos con buscador. **Arrastrar una fila sobre otra** = fusionar, con confirmación inline y deshacer.
- **El aviso de ΔE2000 < 5 trae el botón que lo arregla.** Un aviso sin acción es ruido.
- **La pregunta de la impresora está acá**, en castellano de persona y no de manual. Si elige "Solo 1" y hay más de 4 colores: *"Te van a quedar 3 pausas para cambiar el filamento. Te doy la lista exacta."* y el preview cambia a modo terrazas (§7.2).

**Estado: la imagen casi no tiene variedad de color**

```
│  ⚠ Tu imagen casi no tiene variedad de color: te quedó un llavero de        │
│    1 color. Probá con "Silueta", que está pensado para eso.                 │
│                                       ▓ Cambiar a Silueta ▓                 │
```

---

### 3.5 · Solapa Llavero (`/crear#llavero`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← 3DLlaveros   [ Fondo ✓ ] [ Colores ✓ ] [ Llavero ]  ↩ ↪     ▓ Descargar ▓  │
├────────────────────────────────────────────┬─────────────────────────────────┤
│                                            │  TAMAÑO                         │
│         ┌────────────────────────┐         │  ●─────────────   50 mm         │
│         │        ○  ← argolla    │         │  (como una tarjeta SUBE)        │
│         │    ┌─────────────┐     │         │                                 │
│         │    │             │  ⇔  │ ← escala│  ESPESOR                        │
│         │    │  el dibujo  │     │         │  ○ Delgado ◉ Estándar ○ Reforz. │
│         │    │             │     │         │    1,6 mm    3,0 mm     4,0 mm  │
│         │    └─────────────┘     │         │                                 │
│         │                        │         │  ARGOLLA                        │
│         └────────────────────────┘         │  ┌────┐┌────┐┌────┐┌────┐       │
│           [Arriba] [3D] [Capas]            │  │○○○ ││ ◉  ││ ◎  ││ ✗  │       │
│                                            │  │bola││común│gruesa│ sin│       │
│           50,0 × 38,4 × 3,0 mm             │  └────┘└────┘└────┘└────┘       │
│                                            │  Arrastrá el agujero para        │
│                                            │  moverlo.                        │
│                                            │                                  │
│                                            │  BORDE    [✓] activo             │
│                                            │  ●────────   1,5 mm              │
│                                            │                                  │
│                                            │  ░ + Agregar texto ░             │
│                                            │  ▸ Avanzado                      │
├────────────────────────────────────────────┴─────────────────────────────────┤
│ AVISOS (2)                                                                   │
│ 🟡 Las patas del gato miden 0,6 mm: pueden salir frágiles.  ▓ Engordarlas ▓  │
│ 🟡 Vas a gastar unos 28 g de purga.                        ░ Cómo reducirla ░│
├──────────────────────────────────────────────────────────────────────────────┤
│   ░ Atrás ░       ░ Abrir el editor ░            ▓ Descargar mi llavero ▓    │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Cinco controles. Punto.** Tamaño, espesor, argolla, borde, texto. Todo lo demás en `▸ Avanzado`.
- **"50 mm (como una tarjeta SUBE)"**: referencia física, porque nadie tiene intuición de milímetros. Otras: *"como una moneda de $100"* (25 mm), *"como la palma de la mano"* (80 mm). Es una tabla de 6 entradas en `textos.ts`.
- **La franja de avisos vive abajo, fija, siempre visible**, con semáforo, y **cada aviso tiene acción de un click**.
- **Manipulación directa en el lienzo:** arrastrar el dibujo, handle de esquina para escalar, handle de rotación, arrastrar el círculo del agujero. Si el agujero queda a menos de 2 mm del borde se pinta rojo en vivo con el tooltip *"acá se va a romper"*.

**Estado vacío del panel de texto (antes de escribir nada)**

```
│  ┌──────────────────────────────────────────┐                                │
│  │ Tu texto acá…                            │  ← placeholder, no label       │
│  ├──────────────────────────────────────────┤                                │
│  │ Fuente:  ◉ Redonda  ○ Palo  ○ Manuscrita │                                │
│  │ Color:   ▉  ▉  ▉  ▉   (los de tu llavero)│                                │
│  └──────────────────────────────────────────┘                                │
│  Ojo: por debajo de 6 mm de alto las letras no se leen al imprimir.          │
```

---

### 3.6 · Descargar (`/descargar`)

Donde se gana o se pierde la credibilidad.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Volver al llavero                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌────────────┐   TU LLAVERO ESTÁ LISTO                                    │
│    │            │                                                            │
│    │  render 3D │   50,0 × 38,4 × 3,0 mm   ·   4 colores                     │
│    │  del       │   Filamento de la pieza:   ~4,8 g                          │
│    │  resultado │   Purga por cambios de color:  ~28 g  (9 cambios)  ⓘ       │
│    │            │   Tiempo estimado:  ~35 min                                │
│    └────────────┘                                                            │
│                                                                              │
│    💡 Imprimí 6 llaveros juntos en la misma placa: la purga se reparte y     │
│       bajás de 28 g a unos 5 g por pieza.        ░ Cómo hago eso ░           │
│                                                                              │
│    ┌──────────────────────────────────────────────────────────────────────┐  │
│    │             ▓▓  Descargar mi llavero (ZIP · 240 KB)  ▓▓              │  │
│    └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│    ¿Con qué vas a imprimir?  ◉ Bambu/Orca  ○ PrusaSlicer  ○ Otra / No sé     │
│                                                                              │
│    Adentro del ZIP:                                                          │
│    ★ llavero-bambu.3mf       ← este es el tuyo. Doble click y listo.         │
│      llavero-prusa.3mf         Por si algún día usás PrusaSlicer.            │
│      llavero-1color.3mf        Para imprimir con un solo filamento.          │
│      llavero-color-1.stl …     Por si tu programa no abre 3MF.               │
│      INSTRUCCIONES.txt         Los 4 pasos, en texto.                        │
│      proyecto.json             Para volver a editarlo acá.                   │
│                                                                              │
│    ── CÓMO IMPRIMIRLO ────────────────────────────────────────────────────   │
│    1. Abrí llavero-bambu.3mf con Bambu Studio u OrcaSlicer.                  │
│    2. Si te pregunta algo al abrir, elegí importar solo la geometría.        │
│    3. Fijate que los 4 colores hayan quedado en los slots 1 a 4.             │
│    4. Activá "purgar dentro del objeto" y mandá a imprimir.                  │
│                                                                              │
│    ░ Empezar otro ░    ░ Guardar el proyecto ░    ░ Algo salió mal ░         │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Un solo botón grande.** El selector de slicer **no cambia qué se descarga**: el ZIP trae todo siempre. Solo cambia cuál lleva ★ y qué instrucciones se muestran. Eso elimina la ansiedad de "elegí mal el formato", que es la causa nº 1 de soporte en este rubro.
- **La caja de gramos de purga es el diferenciador de honestidad**: ningún competidor la muestra (`audit-02 §6.6`).

**En modo un solo extrusor aparece además:**

```
│    ── CUÁNDO CAMBIAR EL FILAMENTO ───────────────────────────────────────    │
│    Capa 12  (Z = 2,4 mm)  →  poné ROJO        ░ copiar lista ░               │
│    Capa 15  (Z = 3,0 mm)  →  poné NEGRO                                      │
│    La impresora se va a pausar sola. No apagues nada.                        │
```

**Estado: la descarga falló (el navegador la bloqueó, o no hubo memoria)**

```
│    ⚠ El navegador no dejó bajar el archivo. Probá de nuevo, o bajá los       │
│      archivos de a uno:                                                      │
│      ░ llavero-bambu.3mf ░   ░ INSTRUCCIONES.txt ░   ░ proyecto.json ░       │
```

---

## 4. Los defaults: qué decide el sistema solo

### 4.1 Todo lo que el sistema decide sin preguntar

| Qué | Cómo lo decide | De dónde sale |
|---|---|---|
| **Preset de entrada** | ≤ 12 colores dominantes **o** canal alfa útil → `Dibujo`. Entropía de color alta y sin alfa → `Foto`. Imagen casi binaria (≥ 85% de píxeles en 2 clusters) → `Silueta`. | `audit-01 §6.5` |
| **Método de máscara** | Alfa si existe; si no, flood fill desde los 4 bordes; preset Foto → clasificación por cluster. | `audit-01 §1.4` |
| **N de colores** | 4. Si el preset es Silueta → 2. Si la imagen tiene < 3 clusters con ≥ 2% de área → baja a esa cantidad. | `audit-02 §6.5` |
| **Paleta de filamentos** | Los N centroides se mapean por ΔE2000 contra `filamentos.json` (PLA Basic de Bambu como set inicial). | `audit-01 §2.3` |
| **Orden de slots** | Claro → oscuro (purga menos). | `audit-02 §6.5` |
| **Tamaño** | 50 mm de lado mayor. | `audit-02 §6.1` |
| **Espesor** | 2,4 base + 0,6 color = 3,0 mm. | `audit-02 §6.2` |
| **Borde** | Activo, 1,5 mm. | `audit-02 §6.2` |
| **Argolla** | Ø4,2 mm, borde superior, centrada en X, anillo de 3,0 mm, fillet r=2,0 mm, color de la base. | `audit-02 §6.4` |
| **Modo de color** | `a_ras` (AMS). | `audit-02 §4` |
| **Resolución de trabajo** | 0,20 mm/px, tope 900 px desktop / 640 px móvil (o si `deviceMemory ≤ 4`). | `audit-02 §6.1`, `audit-01 §4.4` |
| **Limpieza** | Islas < 1,0 mm² se funden, apertura r=0,4 mm, erosión anti-halo 1 px, RDP 0,05 mm. | `audit-02 §6.3` |
| **Posición y escala del dibujo** | Centrado, escalado para que el lado mayor de la silueta + borde = tamaño elegido. | — |

**Doce decisiones. El usuario ve cinco controles.** Esa es la relación que define el producto.

### 4.2 El criterio explícito para no terminar en 20 sliders

Un parámetro **sube a visible** solo si pasa las **tres preguntas**, todas con "sí":

1. **¿El usuario puede juzgar el resultado mirando la pantalla?** (Si para evaluarlo necesita imprimir, no va.)
2. **¿Cambiarlo mejora el resultado en al menos 1 de cada 5 imágenes reales del banco de pruebas?** (Si es un caso de 1 en 100, va a Avanzado.)
3. **¿Se puede explicar en menos de 8 palabras sin usar jerga de impresión 3D?**

Si falla la 3 pero pasa 1 y 2 → **Avanzado** (panel cerrado).
Si falla la 1 → **Oculto**, constante en `src/pipeline/defaults.ts`.

**Presupuesto duro de controles, verificable en CI:**

| Pantalla | Máximo de controles visibles | Los que hay |
|---|---|---|
| Fondo | **4** | slider de fondo, tamaño de pincel, tipo de imagen, herramienta activa |
| Colores | **3** | cantidad de colores, lista de filamentos, slots de impresora |
| Llavero | **5** | tamaño, espesor, argolla, borde, texto |
| Descargar | **1** | slicer |

> **Test de CI (`tests/ui/presupuesto-controles.spec.ts`, Playwright):** cuenta los elementos con `[data-control]` visibles fuera de `[data-avanzado]` en cada ruta y **falla si supera el número de la tabla**. Es la única defensa real contra la deriva hacia el panel de 20 sliders: sin el test, en seis meses hay 20 sliders. Agregar un control obliga a sacar otro o a cambiar el número del test a propósito, con un commit que lo diga.

### 4.3 Qué pasa cuando el default es malo

El default malo no se corrige pidiéndole al usuario que toque un slider. Se corrige con un **aviso con acción**, que es lo mismo que un default en dos tiempos:

```
🟡 Las patas del gato miden 0,6 mm: pueden salir frágiles.   ▓ Engordarlas ▓
```

`▓ Engordarlas ▓` aplica `offset(+0,1).offset(-0,1)` sobre esa región y vuelve a correr la DRC. **Un click, resultado visible, deshacible.** Así el sistema puede tener defaults conservadores sin dejar al usuario atrapado.

---

## 5. Los casos feos y cómo los resuelve la interfaz

Los seis que importan. Cada uno: **cómo se detecta** (sin IA, con una métrica calculable), **qué se muestra**, **qué botón lo arregla**.

### 5.1 Foto con fondo complejo (la cocina, el sillón, la vereda)

- **Detección:** después del flood fill desde los bordes, el área de la máscara de fondo es **< 15%** o **> 85%** del total, o la varianza de color en el borde de 10 px supera un umbral.
- **Qué se muestra:** el preset salta solo a **Foto** y la solapa Fondo cambia a la vista de **clusters clickeables** (§3.3). No se le ofrece un slider que no va a funcionar.
- **Rescate, en orden de esfuerzo:** (1) tocar clusters → (2) pincel borrar → (3) `░ Recorte avanzado ░` (GrabCut, 3,5 MB declarados) → (4) *"Si no sale, sacale una foto sobre una hoja blanca: sale en 5 segundos y queda mucho mejor."* **La cuarta opción es la más honesta y la que más gente salva.** Va con una miniatura de ejemplo.
- **Lo que NO se hace:** cargar OpenCV.js automáticamente. Son 3,5 MB y en un celular de gama media puede matar la pestaña (`audit-01 §4.4`).

### 5.2 Imagen chica o borrosa

- **Detección, dos métricas calculables:** lado mayor < 200 px, **o** varianza del laplaciano < umbral (medida sobre el gris, 3 líneas de TS).
- **Qué se muestra, en la landing, antes de procesar:**

```
│  ⚠ Tu imagen es chica (180 × 140 px). Al agrandarla a 50 mm los bordes van  │
│    a quedar escalonados.                                                     │
│    ▓ Probar igual ▓    ░ Elegir otra ░                                       │
│    Consejo: buscá la misma imagen más grande, o sacale una captura de        │
│    pantalla con zoom.                                                        │
```

- **No bloquea.** Deja pasar, pero avisa antes, no después. El usuario que igual quiere probar, prueba.
- **Mitigación automática:** con imágenes < 300 px se sube el radio del filtro mediana a 2 y la tolerancia RDP a 0,08 mm, para que el escalonado se suavice en vez de trazarse fiel.

### 5.3 Demasiados colores

- **Detección:** con N=6 todavía quedan clusters con ≥ 5% de área cuyo ΔE2000 al centroide asignado es > 15 (o sea: 6 colores no alcanzan a describir la imagen).
- **Qué se muestra:**

```
│  Tu imagen tiene muchos colores. Con 4 filamentos queda así 👇              │
│  [preview 4 colores]   [preview 6 colores]   ← comparación lado a lado      │
│  Más colores = más lindo, pero también más purga y más tiempo.              │
│     ○ 4 colores (~28 g de purga)      ◉ 6 colores (~52 g de purga)          │
```

- **La decisión se presenta con su costo en gramos**, no como una preferencia estética abstracta. Esa es la diferencia entre un slider y una decisión informada.
- Si el usuario eligió "Solo 1 filamento" y hay > 4 colores, la comparación cambia a *"con un solo filamento te conviene bajar a 3: son 2 pausas en vez de 5"*.

### 5.4 Detalle más fino que la boquilla

- **Detección:** apertura morfológica vectorial `offset(-0,4).offset(+0,4)`; si el área perdida es > 2% del total o alguna región desaparece, hay detalle fino. Se guardan las **coordenadas** de las zonas perdidas, no solo el área.
- **Qué se muestra:** aviso 🟡 con **botón "mostrarme dónde"** que pinta esas zonas en el preview 3D con un pulso naranja, y tres arreglos:

| Arreglo | Qué hace | Cuándo se ofrece |
|---|---|---|
| `▓ Engordarlas ▓` | `offset(+0,1)` en esa región | Siempre |
| `▓ Hacerlo más grande ▓` | sube el tamaño al mínimo que hace que todo pase los 0,8 mm, y lo dice: *"pasaría a 62 mm"* | Si el tamaño < 80 mm |
| `░ Dejarlo así ░` | marca el aviso como aceptado, no vuelve a aparecer | Siempre |

- **Nunca bloquea.** 0,45 mm (una línea de extrusión) es el piso absoluto; por debajo de eso la región **se elimina sola** y el aviso pasa de 🟡 a informativo: *"saqué 3 detalles que no se podían imprimir"*.

### 5.5 Texto que va a salir ilegible

- **Detección:** para el texto que agrega el usuario, alto < 6 mm **o** grosor de trazo estimado < 1,0 mm (`audit-02 §6.3`). Para texto que viene **adentro de la imagen**: componentes conexos alargados (relación de aspecto > 4) y de ancho < 1,0 mm, en cantidad ≥ 5 → probable texto chico.
- **Qué se muestra, y esto es lo importante: una comparación, no un párrafo.**

```
┌─────────────────────────────────────────────────────────────┐
│  Así lo ves ahora        Así va a salir impreso             │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │  Club Atlét. │        │  ▓▓▓▓ ▓▓▓▓▓  │  ← simulación con  │
│  │  Fundado 1932│        │  ▓▓▓▓▓▓ ▓▓▓▓ │    el ancho real   │
│  └──────────────┘        └──────────────┘    de la boquilla  │
│  El texto chico se va a empastar.                           │
│  ▓ Hacerlo más grande ▓   ░ Sacar el texto ░   ░ Dejarlo ░  │
└─────────────────────────────────────────────────────────────┘
```

- La simulación de la derecha es el mismo render del modo "vista honesta" (§7), recortado al bounding box del texto. **Es el argumento más convincente que tiene el producto y cuesta muy poco: ya está el render.**

### 5.6 El recorte salió mal (el caso más frecuente de abandono)

Tres subcasos, cada uno con su detección y su salida:

| Subcaso | Detección | Qué se muestra |
|---|---|---|
| **Se comió todo** | máscara de objeto < 5% del área | *"Me llevé casi todo. Probá bajando 'cuánto fondo sacar', o usá el pincel ✏️ para traer de vuelta lo que falta."* + el slider **se resalta con un pulso** y el preset salta a `Silueta` |
| **No sacó nada** | máscara de fondo < 5% | *"No encontré fondo para sacar. Si tu imagen ya viene recortada, está perfecto: seguí. Si no, tocá con la varita 🪄 sobre el fondo."* |
| **Quedó con agujeros / picoteado** | > 30 componentes conexos de fondo adentro del bounding box del objeto | *"Quedaron huecos adentro del dibujo."* + `▓ Rellenar los huecos ▓` (cierre morfológico r=2 px sobre la máscara) |

**Regla transversal:** en los tres casos el botón **`▓ Volver al recorte automático ▓`** está disponible y restaura la máscara original. Nadie tiene que poder quedar atrapado en un estado peor que el inicial. Es un `Ctrl+Z` con nombre propio.

---

## 6. El editor, en detalle

El editor es el diferenciador nº 2 de `audit-03 §3.2`: **ninguno de los once competidores deja tocar nada después de convertir.** Pero es también la trampa más grande del proyecto: "un Tinkercad" es infinito. Acá la lista es **cerrada**.

### 6.1 Lo que SÍ hace (lista cerrada, 14 herramientas)

| # | Herramienta | Atajo | Implementación |
|---|---|---|---|
| 1 | Seleccionar / multiseleccionar (click, Shift+click, marco) | `V` | raycast con `three-mesh-bvh`, `<Outlines>` de drei |
| 2 | Mover (XY) | `G` o arrastrar | `<TransformControls>` de drei, `translationSnap 0,5 mm` |
| 3 | Rotar (solo Z) | `R` | `rotationSnap 15°`, Shift = libre |
| 4 | Escalar (XY, con y sin proporción) | `S` | handles de esquina = proporcional; de lado = un eje |
| 5 | Duplicar | `Ctrl+D` | offset de +2 mm en X e Y |
| 6 | Borrar | `Supr` | |
| 7 | Agrupar / desagrupar | `Ctrl+G` / `Ctrl+Shift+G` | `grupoId` compartido |
| 8 | Alinear (9 combinaciones) y distribuir | — | barra contextual sobre la selección múltiple |
| 9 | Agregar texto | `T` | `opentype.js` → contornos → `CrossSection`; 4 fuentes OFL incluidas |
| 10 | Agregar forma básica | `F` | rectángulo (esquinas redondeadas), círculo, estrella, corazón, triángulo |
| 11 | Marcar como agujero (el "Hole" de Tinkercad) | `H` | `esAgujero: true`, se dibuja translúcido a rayas |
| 12 | Cambiar color de una pieza | click en la muestra | elige uno de los slots existentes |
| 13 | Cambiar altura de una pieza (Z y espesor) | panel | forzado a múltiplos de 0,2 mm |
| 14 | Bloquear / ocultar una pieza | `Ctrl+L` / `Ctrl+H` | |

### 6.2 Lo que NO hace, y por qué (esto es tan importante como lo anterior)

| No hace | Por qué |
|---|---|
| **Formas 3D reales** (esfera, cono, cilindro arbitrario) | El documento es 2.5D. Una esfera obliga a CSG de mallas, que rompe el modelo de datos, el undo barato y las booleanas 2D por franjas Z. **Es la línea que no se cruza.** |
| **Rotar en X o Y** | Un llavero no se imprime parado. Rotar en X produce voladizos, soportes y piezas que no se pegan a la cama. |
| **Esculpir, deformar, curvar** | Fuera de alcance para siempre. Es otro producto. |
| **Dibujo libre a mano alzada** | El vector resultante casi nunca respeta el ancho mínimo de 0,8 mm. Si se pide mucho, se agrega después con un offset forzado. |
| **Importar STL/OBJ de terceros** | Abre el problema de mallas rotas, no-manifold y licencias de contenido. Fuera del MVP y de la fase 2. |
| **Capas de altura arbitrarias (estilo HueForge)** | Es un producto distinto, con otra curva de aprendizaje, y HueForge ya lo hace mejor. |
| **Colaboración en tiempo real** | Cero demanda a este tamaño. El modelo de datos (JSON plano) deja la puerta abierta a Yjs sin decidir nada hoy. |
| **Capas de transparencia / filamentos translúcidos** | El cálculo de color por transmisión es el núcleo de HueForge. No competimos ahí. |

### 6.3 Wireframe del editor

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Volver      V  G  R  S │ T  F  H │ ⧉ ⌫ │ ⊞ ⊟ │  ↩ ↪  │ 👁 Vista honesta   │
├──────────────┬────────────────────────────────────────────┬──────────────────┤
│ CAPAS        │                                            │ PROPIEDADES      │
│              │                          ┌───┐             │                  │
│ 👁🔒 ▉ Borde │          ┌──────────┐    │▣▣▣│ ← viewcube  │ Texto "MATÍAS"   │
│ 👁🔓 ▉ Negro │          │          │    └───┘             │                  │
│ 👁🔓 ▉ Rojo  │          │  ◯───────┼──┐                   │ X  12,4 mm       │
│ 👁🔓 ▉ Blanco│          │  │ dibujo│  │  ← gizmo de       │ Y   8,0 mm       │
│ 👁🔓 T MATÍAS│          │  └───────┼──┘     mover/escalar │ Giro  0°         │
│ 👁🔓 ⊘ agujer│          │          │                      │ Ancho 30,0 mm    │
│              │          └──────────┘                      │ Alto  11,2 mm    │
│ ░+ Forma ░   │                                            │ ─────────────    │
│ ░+ Texto ░   │   ┌──┬──┬──┐                               │ Color  ▉ ▉ ▉ ▉  │
│              │   │2D│3D│⛰ │  ← vistas                    │ Base Z  2,4 mm   │
│              │   └──┴──┴──┘                               │ Espesor 0,6 mm   │
│              │   Snap: ◉0,5mm ○1mm ○5mm ○off              │ ☐ Es un agujero  │
├──────────────┴────────────────────────────────────────────┴──────────────────┤
│ 🟡 "MATÍAS" mide 4,2 mm de alto: por debajo de 6 mm no se lee. ▓ Agrandar ▓  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                              ▓ Descargar mi llavero ▓        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Gizmos: las reglas exactas

- **Un solo gizmo combinado**, estilo Figma, no tres modos separados como Blender: la caja de selección trae **4 handles de esquina** (escala proporcional), **4 handles de lado** (escala en un eje) y **un handle de rotación** que aparece al pasar el mouse justo afuera de una esquina. Arrastrar el interior mueve.
- **Nunca gizmo de eje Z.** La altura se edita **numéricamente** en el panel derecho. Motivo: en una vista cenital un gizmo Z es invisible y en una vista 3D el usuario lo arrastra sin querer y no entiende qué pasó.
- **Modificadores:** `Shift` = mantener proporción / rotación libre · `Alt` = escalar desde el centro · `Ctrl` (durante el drag) = desactivar el snap momentáneamente.
- **Durante el arrastre** se muestra la pieza en crudo y translúcida; al soltar llega la malla recalculada del worker (debounce 150 ms). Un arrastre = **un** paso de deshacer (`temporal.pause()` en `pointerdown`, `resume()` + commit en `pointerup`).
- **Cota en vivo:** mientras se escala aparece `30,0 × 11,2 mm` pegado al cursor. Mientras se mueve, `X 12,4 · Y 8,0`. Sin eso, escalar en milímetros es adivinar.

### 6.5 Snapping

| Tipo | Valor | Cómo se ve |
|---|---|---|
| **Grilla** | 0,5 mm (default) · 1 mm · 5 mm · sin snap | grilla tenue en la vista cenital |
| **Rotación** | 15° | el ángulo aparece junto al cursor |
| **Guías inteligentes** | centro con centro, borde con borde, entre piezas | línea magenta de 1 px + un tic háptico en móvil |
| **Snap al agujero** | el texto se alinea al eje de la argolla | línea vertical magenta |
| **Altura** | siempre múltiplo de 0,2 mm, **no se puede desactivar** | el campo redondea al perder el foco |

Las guías inteligentes son la diferencia entre "parece un llavero hecho a mano" y "parece un llavero hecho a ojo". Son ~60 líneas: comparar los 9 puntos notables del bounding box de la selección contra los de las demás piezas, con tolerancia de 0,8 mm en pantalla.

### 6.6 Panel de capas y colores

- **Una fila por pieza**, en orden de prioridad (la de arriba gana en la cadena de resta). **Arrastrar reordena y cambia la prioridad**: es la misma acción y el mismo concepto, no dos.
- Cada fila: `👁` visible, `🔒` bloqueada, muestra de color, nombre editable (doble click), y el ícono del tipo (`▉` región · `T` texto · `⬠` forma · `⊘` agujero).
- **Hover en la fila → la pieza se resalta en el lienzo.** Hover en el lienzo → la fila se resalta. Bidireccional, sin excepción.
- **Arriba del todo, la tira de filamentos** (los mismos 4 de la solapa Colores). Cambiar un filamento ahí cambia **todas** las piezas que lo usan, en vivo. Esto es lo que permite probar combinaciones de color en 3 segundos, que es el momento "wow" del editor.
- **Vista "Capas" (`⛰`)**: separa las piezas en Z, tipo despiece. Sirve para entender qué color está encima de cuál y para detectar costuras.

### 6.7 Deshacer / rehacer y atajos

- **Dos historiales separados:** el del **documento** (zustand + `zundo`, límite 100) y el de la **máscara** de la imagen (propio, límite 20, porque es un asset binario y no entra al JSON). El usuario no percibe la diferencia porque `Ctrl+Z` aplica al historial de la pantalla en la que está.
- **Cada acción deshacible tiene nombre**, y el tooltip del botón lo muestra: *"Deshacer: mover MATÍAS"*. Sin nombre, el undo da miedo.
- **Toast con deshacer** en las acciones destructivas: *"Borraste 'Rojo'. ░ Deshacer ░"* (7 s).

| Atajo | Acción | | Atajo | Acción |
|---|---|---|---|---|
| `Ctrl+Z` / `Ctrl+Shift+Z` | Deshacer / rehacer | | `V G R S` | Herramientas |
| `Ctrl+D` | Duplicar | | `T` / `F` / `H` | Texto / forma / agujero |
| `Supr` / `Retroceso` | Borrar | | `Ctrl+G` / `Ctrl+Shift+G` | Agrupar / desagrupar |
| `Ctrl+A` | Seleccionar todo | | `Ctrl+L` / `Ctrl+H` | Bloquear / ocultar |
| `Espacio` (mantener) | Pan | | `[` / `]` | Pincel más chico / más grande |
| `Rueda` | Zoom | | `1` / `2` / `3` | Vista 2D / 3D / Capas |
| `F` con selección | Encuadrar la selección | | `Ctrl+S` | Descargar |
| `Esc` | Deseleccionar / cancelar el drag | | `?` | Hoja de atajos |

**`?` abre una hoja de atajos** en un panel lateral. Es lo más barato que existe para que el editor se sienta profesional.

### 6.8 Qué pasa en celular

Es la pregunta que ninguno de los dos planes anteriores contesta. **Respuesta: el flujo principal es completo en celular; el editor es reducido y honesto al respecto.**

| En celular SÍ | En celular NO |
|---|---|
| Todo el flujo de 3 solapas + descargar | Multiselección con marco |
| Seleccionar tocando | Alinear / distribuir |
| Mover con el dedo, con snap y guías | Agrupar / desagrupar |
| Escalar y rotar con dos dedos (pinch + twist) | Atajos de teclado (no hay teclado) |
| Agregar y editar texto | Marcar como agujero |
| Cambiar color de una pieza | Editar Z / espesor por pieza |
| Deshacer / rehacer (dos botones grandes, 44×44 px) | Formas más allá de rectángulo y círculo |
| Panel de capas (hoja deslizante desde abajo) | |

```
┌────────────────────────────┐
│ ←   MATÍAS         ↩  ↪   │
├────────────────────────────┤
│                            │
│      ┌──────────────┐      │
│      │              │      │
│      │   lienzo     │      │  1 dedo = mover la selección
│      │              │      │  2 dedos = zoom y pan del lienzo
│      │              │      │  pinch sobre la selección = escalar
│      └──────────────┘      │
│                            │
│   [2D] [3D] [Capas]        │
├────────────────────────────┤
│  ▉ ▉ ▉ ▉     ← filamentos  │
│  ⌃ Capas (5)  ← hoja       │
├────────────────────────────┤
│    ▓ Descargar ▓           │
└────────────────────────────┘
```

**Regla de toque:** todo control interactivo mide **44 × 44 px** como mínimo. Los handles del gizmo en móvil miden **32 px** con un área de toque de 44. Sin eso, el editor táctil es inusable y hay que rehacerlo.

**Si la pantalla mide menos de 380 px o `deviceMemory ≤ 2`**, el botón "Abrir el editor" se reemplaza por: *"El editor necesita una pantalla más grande. Guardá el proyecto y abrilo en una computadora."* con `▓ Guardar proyecto ▓`. **Es mejor negar el acceso que ofrecer algo que frustra.**

---

## 7. Vista previa honesta

El preview 3D que hace todo el mundo es un render bonito con luces suaves y colores saturados. **Miente en cuatro cosas a la vez**: el color no es el del filamento, no hay terrazas, no se ve el ancho mínimo y no se ve dónde se va a romper. Este producto muestra las cuatro.

### 7.1 Dos modos, un interruptor

```
  ┌──────────────────┬──────────────────┐
  │  🎨  Lindo       │  👁 Como va a    │
  │      (default)   │     salir        │
  └──────────────────┴──────────────────┘
```

| | **Lindo** (default) | **Como va a salir** |
|---|---|---|
| Color | color del filamento, iluminación suave | color del filamento **medido**, del JSON de paleta, con iluminación plana |
| Bordes | suavizados | **terrazas de 0,2 mm** visibles en Z |
| Detalle fino | se ve tal cual | zonas < 0,8 mm **pintadas de naranja** |
| Superficie | lisa | textura de líneas de extrusión de 0,42 mm (normal map procedural, no geometría) |
| Agujero | círculo perfecto | círculo con la compensación real de 0,2 mm |
| Para qué | compartir, decidir "me gusta" | decidir "lo imprimo" |

**Por qué el default es "Lindo":** el modo honesto en la primera impresión desmotiva. El usuario necesita primero ver algo lindo (motivación) y después ver la verdad (decisión). El interruptor está **siempre visible**, no escondido, y la pantalla de Descargar **usa el modo honesto por defecto** — que es exactamente donde hace falta.

### 7.2 Terrazas: cómo se muestran sin costo

- **Modo a ras (AMS):** las terrazas casi no existen (las capas de color son planas). Lo que sí se muestra es el **escalón de 0,6 mm** entre el color y la base, con una sombra propia marcada. Es lo que hace que el llavero se vea "de verdad".
- **Modo apilado (un solo extrusor):** acá las terrazas **son** el producto. El render muestra explícitamente las franjas de 0,6 mm, con sombra entre franja y franja, y un eje de altura al costado con marcas de 0,2 mm. Sin esto, el usuario que elige "un solo filamento" no entiende por qué su llavero tiene escalones.

**Implementación:** un `ShaderMaterial` con `fract(vWorldPos.z / 0.2)` para dibujar la línea de capa, y `dFdx/dFdy` para que el ancho de línea sea constante en pantalla. **~40 líneas de GLSL, cero geometría extra.** No es un render físicamente correcto y no hace falta que lo sea.

### 7.3 Lo que se resalta

| Marca | Qué significa | Cuándo aparece |
|---|---|---|
| **Naranja pulsante** | detalle < 0,8 mm: frágil | modo honesto, y en modo lindo si se toca el aviso |
| **Rojo fijo** | error bloqueante (agujero muy al borde, pieza flotando, color fuera de slots) | siempre, en los dos modos |
| **Contorno punteado azul** | la pieza seleccionada en el editor | siempre |
| **Sombra de purga** | en la ficha de descarga, una barra que compara el volumen de la pieza contra el volumen de la purga | pantalla de descarga |

### 7.4 La comparación lado a lado

Se usa en dos lugares (caso del texto, §5.5, y caso de demasiados colores, §5.3) y es el componente más persuasivo del producto:

```
┌─────────────────────────────┬─────────────────────────────┐
│      Tu imagen              │      Tu llavero             │
│  ┌───────────────────┐      │  ┌───────────────────┐      │
│  │                   │      │  │                   │      │
│  │   [ original ]    │      │  │  [ honesto ]      │      │
│  │                   │      │  │                   │      │
│  └───────────────────┘      │  └───────────────────┘      │
└─────────────────────────────┴─────────────────────────────┘
         ◄────────── ⇕ arrastrá el divisor ──────────►
```

Un divisor arrastrable (`<input type="range">` estilizado sobre dos capas con `clip-path`). **~30 líneas.** Es lo que convierte "no me gustó cómo quedó" en "ah, claro, es por la resolución de la foto".

---

## 8. Microcopy: los 10 textos que más importan

Todos viven en `src/ui/textos.ts`, un solo archivo, como objeto plano. **Regla:** ningún texto en español de España (nada de "pulsa", "fichero", "ordenador", "vale"); nada de voseo forzado en textos de sistema, pero sí trato de vos en todo lo que le habla al usuario. Nada de signos de exclamación en errores.

| # | Dónde | Texto | Por qué así |
|---|---|---|---|
| **1** | Botón principal de la landing | **"Elegir una imagen"** | No "Empezar" (no dice qué pasa), no "Subir" (mentira: no sube nada), no "Convertir" (todavía no hay qué convertir). Dice exactamente la próxima acción. |
| **2** | Promesa de la landing | **"Convertí tu dibujo o logo en un llavero listo para imprimir. Funciona también si tu impresora es de un solo color."** | Dos frases. La primera dice qué es. La segunda es el diferenciador nº 1 de `audit-03 §3.2` y elimina la objeción principal del 60% de las impresoras del mercado. |
| **3** | Bajo la dropzone | **"Tu imagen no se sube a ningún lado: todo pasa en tu navegador."** | Presente afirmativo, no "no almacenamos tus datos" (que suena a política legal y genera la duda que quiere resolver). |
| **4** | Error de formato | **"No pude abrir «IMG_4417.HEIC». Las fotos de iPhone en HEIC no se abren en la web. En el iPhone: Ajustes ▸ Cámara ▸ Formatos ▸ «Más compatible». O mandátela por WhatsApp y usá esa."** | Nombra el archivo, explica la causa en una línea y da **dos** salidas, una de ellas de 5 segundos. El error que da una sola salida no sirve. |
| **5** | Error de tamaño | **"«foto.jpg» pesa 38 MB y el máximo es 25 MB. Sacale una captura de pantalla o mandátela por WhatsApp: eso la achica sola."** | El truco de WhatsApp es real, universal en Latinoamérica y resuelve el problema sin pedir instalar nada. |
| **6** | Recorte que se comió todo | **"Me llevé casi todo el dibujo. Bajá «cuánto fondo sacar», o traé de vuelta lo que falta con el pincel ✏️."** | Primera persona para el error del sistema ("me llevé"), segunda para la solución ("bajá"). El sistema se hace cargo; el usuario no siente que se equivocó. |
| **7** | Falla del worker / memoria | **"Algo se me trabó procesando la imagen. Suele pasar con imágenes muy grandes. ¿La proceso más chica?"** | No "Error inesperado", no un código. Da una causa probable y **una acción concreta**, que es el 90% del valor de un mensaje de error. |
| **8** | Aviso de detalle fino | **"Las patas del gato miden 0,6 mm: pueden salir frágiles y romperse."** | Nombra **qué** parte (usando la etiqueta de la pieza), da el número, y dice la **consecuencia física**, no la técnica. Nunca "ancho de pared por debajo del mínimo de extrusión". |
| **9** | Aviso de purga | **"Vas a gastar unos 28 g de filamento en purga: más que el llavero, que pesa 5 g. Imprimí 6 juntos y bajás a ~5 g por pieza."** | El número solo asusta; el número con la comparación y la salida informa. Es la frase que ningún competidor dice. |
| **10** | Botón de descarga | **"Descargar mi llavero (ZIP · 240 KB)"** | "Mi" porque ya es suyo. El formato y el peso entre paréntesis eliminan la duda de "¿qué me va a bajar?", que frena clicks. |

**Tres reglas transversales de redacción:**

1. **Nunca "Error".** Siempre qué pasó + qué hacer. La palabra "error" no aparece en ninguna pantalla.
2. **Nunca jerga sin traducir.** Si hay que decir "slot", se dice *"espacio de filamento (slot)"* la primera vez y "slot" después. La lista negra con test de CI: `extrusor`, `manifold`, `offset`, `mesh`, `render`, `buffer`, `worker`, `polígono`, `vértice`, `boolean`.
3. **Nunca un aviso sin acción.** Si no hay nada que hacer, no es un aviso: es información y va en gris chico.

---

## 9. Qué arquitectura exige esta UX

Esta sección es la que convierte el plan de experiencia en requisitos de ingeniería. **La UX de arriba no se puede construir sobre cualquier arquitectura**; estos son los cinco requisitos que impone.

### 9.1 Especulación: el pipeline corre completo, no por pasos

Los planes A y B describen el pipeline como una secuencia que avanza con el usuario. **Para que no haya nunca una pantalla vacía, el pipeline tiene que correr entero apenas se suelta el archivo**, con los defaults, hasta la malla y el 3MF.

```
soltar archivo
   ├─ hilo principal:  decodificar, mostrar la imagen, animar el overlay
   └─ worker-imagen:   pasos 1–9  ──►  worker-geometria: pasos 10–11
                                            │
                       al terminar cada paso emite un evento;
                       la UI de la solapa correspondiente ya tiene datos
```

Consecuencias concretas:

- **Los dos workers (`worker-imagen`, `worker-geometria`) arrancan en la landing**, no en `/crear`. Se instancian con `new Worker(new URL('./worker-imagen.ts', import.meta.url), {type:'module'})` en cuanto la landing monta, para que el costo de arranque quede escondido detrás de la elección del archivo.
- **Cada etapa emite un evento con su resultado parcial.** Comlink con callbacks, o un `MessageChannel` propio. La UI se suscribe a `mascaraLista`, `coloresListos`, `mallaLista`.
- **Toda etapa es cancelable.** Si el usuario mueve el slider de fondo mientras corre la geometría, se descarta el trabajo en vuelo (token de generación monotónico: los resultados con token viejo se ignoran).

### 9.2 Los tres presupuestos de latencia

| Presupuesto | Qué entra | Cómo se logra |
|---|---|---|
| **Instantáneo (< 100 ms)** | cambiar de solapa, seleccionar una pieza, mover/rotar/escalar (feedback), hover de capas, cambiar filamento en la tira, deshacer/rehacer, abrir Avanzado, escribir texto | Todo en el hilo principal, sobre estado ya calculado. **Cambiar de filamento no recalcula geometría: solo cambia un material de three.** Esto vale oro y hay que diseñarlo así desde el día 1. |
| **Rápido, con feedback (100 ms – 1 s)** | mover el slider de fondo, cambiar N de colores, cambiar tamaño/espesor/argolla, soltar un drag en el editor | Worker + debounce (80 ms el slider, 150 ms el drag) + el resultado anterior en gris mientras llega el nuevo. **Nunca un spinner que tape el lienzo.** |
| **Lento, con progreso nombrado (> 1 s)** | pipeline completo inicial, GrabCut, escritura del 3MF y del ZIP | Overlay con 4 hitos (§3.2). Cancelable. |

### 9.3 Qué se guarda y dónde

| Qué | Dónde | Cuándo | Por qué |
|---|---|---|---|
| `Diseno` (el JSON, decenas de KB) | **IndexedDB**, store `disenos`, vía `idb-keyval` | autoguardado con debounce de 2 s | Es lo único irreemplazable. `localStorage` no alcanza (5 MB y síncrono). |
| Imagen original | **IndexedDB**, store `assets`, como `Blob` | una vez, al cargarla | Para poder reprocesar sin pedirla de nuevo |
| Máscara editada | **IndexedDB**, store `assets`, como `Blob` PNG de 1 canal | al salir de la solapa Fondo | Rehacerla es lo que más duele perder |
| Preferencias (slicer, snap, modo de vista, idioma) | `localStorage` | al cambiar | Chicas, no críticas |
| Historial de deshacer | **memoria** | — | No sobrevive a la recarga a propósito: un historial persistido confunde más de lo que ayuda |
| Nada más | — | — | **Cero servidor en el MVP.** Es la promesa de privacidad y también el costo de $0. |

**Cuota y desalojo:** IndexedDB puede desalojarse. Antes de guardar se llama a `navigator.storage.persist()` (silencioso; si dice que no, no pasa nada) y se limita a **los últimos 5 diseños**, borrando el más viejo. Si `estimate()` devuelve menos de 50 MB libres, se avisa: *"Te queda poco espacio: guardá el proyecto en tu compu."*

### 9.4 Qué se comparte (y qué no, todavía)

| Fase | Qué se comparte | Cómo |
|---|---|---|
| **MVP** | Nada por link. Se comparte **el archivo**: el ZIP y el `proyecto.json`. | El `proyecto.json` se puede arrastrar de vuelta a la landing y se abre. **Esto es "compartir" a costo cero y hay que soportarlo desde el día 1.** |
| **Fase 2** | Link a un diseño (`/d/<id>`) | El `Diseno` (sin la imagen original) sube a un KV/R2 de Cloudflare. Pesa decenas de KB. **Regla de privacidad: la imagen original NUNCA sube, ni siquiera al compartir.** El link abre el diseño ya vectorizado. |
| **Fase 2** | Imagen para redes | `canvas.toBlob()` del render "Lindo" con marca discreta. Es el motor de crecimiento más barato que existe. |

**La costura que hay que dejar hoy:** el `Diseno` ya tiene `id`, `version` y `appVersion`, y **nunca embebe la imagen** (la referencia por `assetId`). Con eso, compartir en la fase 2 es un `PUT` y un `GET`, sin migración.

### 9.5 Accesibilidad e i18n, lo mínimo que no se puede postergar

- **Teclado:** todo el flujo principal navegable con Tab/Enter. El lienzo 3D tiene `tabindex="0"` y con foco acepta flechas para mover la selección de a 0,5 mm (Shift = 0,1 mm).
- **Contraste:** AA (4,5:1) en todo texto. Los avisos **nunca** se codifican solo por color: 🟡/🔴 llevan ícono y texto.
- **`prefers-reduced-motion`:** desactiva el barrido del overlay, las transiciones de solapa y el pulso de los avisos (el resaltado pasa a un contorno fijo).
- **i18n:** `textos.ts` exporta un objeto plano con claves; el idioma se elige por `navigator.language` con fallback a `es`. **No se instala una librería de i18n en el MVP**, pero la forma del archivo permite migrar a una sin tocar componentes. Español primero; inglés en la fase 2 (es el mercado más grande y el español es donde no hay competencia, `audit-03 §2.2`).

---

## 10. Métricas de interfaz, gratis

**Herramientas:** Cloudflare Web Analytics (gratis, sin cookies, sin banner de consentimiento) para páginas vistas, y **Umami Cloud Hobby** (100.000 eventos/mes gratis, `02-costos §8.4`) para los eventos propios. Sentry Developer (5.000 errores/mes) para los errores. **Costo total: $0/mes** hasta bastante volumen.

**Regla de privacidad, que además evita el banner de cookies:** ningún evento lleva la imagen, el nombre del archivo, ni nada del contenido. Solo números y categorías. Eso mantiene el sitio sin consentimiento previo bajo el criterio de `audit-03 §5`.

### 10.1 Los 8 eventos (lista cerrada)

| Evento | Propiedades | Qué responde |
|---|---|---|
| `imagen_cargada` | `origen` (drop/click/ejemplo/pegar), `preset_auto`, `ancho`, `alto`, `ms_pipeline` | ¿De dónde vienen? ¿Cuánto tarda de verdad? |
| `paso_visto` | `paso` (fondo/colores/llavero/descargar), `ms_desde_carga` | El **embudo**. La métrica madre. |
| `paso_modificado` | `paso`, `control` (slider/pincel/varita/N/filamento/…) | ¿Qué defaults son malos? Un control que nadie toca sobra; uno que todos tocan tiene mal default. |
| `aviso_mostrado` | `codigo` (detalle_fino/texto_chico/purga_alta/…), `nivel` | ¿Qué casos feos son frecuentes de verdad? |
| `aviso_resuelto` | `codigo`, `accion` (arreglo/ignorar/salir) | ¿Los arreglos de un click sirven? |
| `editor_abierto` | `desde`, `piezas` | ¿Cuánta gente usa el diferenciador nº 2? |
| `descarga` | `ms_total`, `colores`, `modo` (a_ras/apilado), `slicer`, `paso_editor` (bool) | La **conversión**. |
| `abandono` | `paso`, `ms_en_paso` | Dónde se cae la gente. |

### 10.2 Los 6 números que se miran

| # | Métrica | Fórmula | Meta inicial |
|---|---|---|---|
| 1 | **Tasa de descarga** | `descarga / imagen_cargada` | **> 50%** |
| 2 | **Tiempo hasta la descarga (mediana)** | mediana de `descarga.ms_total` | **< 120 s** |
| 3 | **Abandono en Fondo** | `abandono[paso=fondo] / paso_visto[paso=fondo]` | **< 20%** — es el riesgo nº 1 de todo el proyecto |
| 4 | **Tasa de "no tocó nada"** | `descarga` sin ningún `paso_modificado` | **> 40%** — mide si los defaults son buenos de verdad |
| 5 | **Avisos que se arreglan** | `aviso_resuelto[accion=arreglo] / aviso_mostrado` | **> 60%** — mide si los arreglos de un click sirven |
| 6 | **p95 del pipeline en móvil** | p95 de `imagen_cargada.ms_pipeline` filtrado por móvil | **< 6 s** |

### 10.3 Lo que no se mide con analítica y hay que hacer a mano

- **5 pruebas de pasillo antes de lanzar.** Una persona que nunca usó el producto, un dibujo suyo, una computadora, sin ayuda, cronómetro corriendo. Se anota **dónde duda más de 5 segundos**. Cinco personas encuentran el ~85% de los problemas de usabilidad y cuesta una tarde.
- **Una impresión real de cada caso feo.** La foto del llavero impreso al lado del preview honesto es la única validación de que la vista previa no miente. Va como test de aceptación del Hito U6.

---

## 11. Fases e hitos

Numeración `U` (de usuario) para no chocar con la de los planes A y B. **Este plan asume que el motor existe**: los hitos de pipeline, 3MF y validación son los de plan A (Fase 1, hitos 0–3) o los spikes del Hito 0 de plan B. **Lo que sigue es el trabajo de interfaz, y corre en paralelo o después.**

Esfuerzo en **días de una sola persona**, a jornada real, incluyendo el retrabajo.

---

### Hito U0 · El esqueleto de UI y el contrato de textos — **3 días**

**Objetivo:** que exista la cáscara navegable con datos falsos, para poder probar el flujo antes de que el motor funcione.

**Tareas**
1. Proyecto Vite + React + TypeScript. Rutas con `wouter` (1,5 KB; React Router es sobrado acá).
2. `src/ui/textos.ts` con las 10 claves de §8 y el glosario de referencias físicas de tamaño.
3. Layout de `/crear` con las 3 solapas y el panel 3D, alimentado por un `Diseno` **de mentira** en un JSON fijo.
4. Sistema de diseño mínimo: tokens CSS (8 colores, 4 tamaños de texto, 4 espaciados), y **4 componentes**: `Boton`, `Slider`, `TarjetaOpcion`, `Aviso`. Nada de librería de componentes.
5. Test de CI de la lista negra de jerga (`tests/ui/jerga.spec.ts`).

**Aceptación:** se navega el flujo entero con el teclado y con el mouse, en desktop y en 375 px, con datos falsos. `npm run test` falla si alguien escribe "extrusor" en un componente de `/crear`.

---

### Hito U1 · Landing, carga y el overlay de progreso — **3 días**

**Objetivo:** que soltar una imagen sea infalible.

**Tareas**
1. Dropzone con drag & drop, click, **pegar del portapapeles** (`paste` en `window`) y `capture="environment"` en móvil.
2. Validaciones previas a decodificar: extensión, tamaño ≤ 25 MB, detección de HEIC por firma (`ftypheic` en los bytes 4–12).
3. Los 3 errores de entrada con su microcopy exacto, inline.
4. Overlay de progreso con 4 hitos nombrados, escaleras de 3 s y 8 s, y botón Cancelar que hace `terminate()`.
5. Las 3 imágenes de ejemplo (una por preset), como assets del bundle.
6. Restauración desde IndexedDB con la tarjeta "Seguí donde lo dejaste".

**Aceptación:** con el pipeline real conectado, soltar cada una de las 3 imágenes de ejemplo lleva a `/crear#fondo` con resultado visible, en **< 1,5 s** en un i5 y **< 4 s** en un Android de gama media. Un `.heic`, un archivo de 38 MB y un `.txt` renombrado a `.png` muestran los 3 mensajes correctos sin romper nada.

---

### Hito U2 · Solapa Fondo completa, incluido el rescate — **5 días**

**Objetivo:** que el caso feo más frecuente tenga salida. Es la mitad del riesgo de UX del proyecto.

**Tareas**
1. Lienzo con zoom/pan (rueda + espacio + pinch), damero de fondo y máscara pintada.
2. Las 4 herramientas: varita (click / Shift+click / Alt+click), pincel borrar, pincel restaurar, mover. Tamaño de pincel con `[` `]` y con rueda+Alt.
3. Slider "cuánto fondo sacar" con debounce de 80 ms y recálculo en vivo.
4. Historial de máscara propio (20 pasos), `Ctrl+Z`.
5. **Vista de clusters clickeables** del preset Foto.
6. Detección y microcopy de los 3 subcasos de §5.6 + botón "volver al recorte automático".
7. Layout móvil con chip flotante de 3D.
8. Eventos `paso_modificado` y `abandono`.

**Aceptación:** sobre el banco de 20 imágenes reales, **al menos 16 llegan a una máscara aceptable en ≤ 3 interacciones** (contadas a mano, con un criterio escrito de "aceptable" acordado antes de medir). Los 3 subcasos de recorte malo disparan su mensaje en las imágenes preparadas para eso.

---

### Hito U3 · Solapas Colores y Llavero + franja de avisos — **4 días**

**Objetivo:** que las decisiones de color y forma se tomen mirando el objeto, no un panel.

**Tareas**
1. Lista de filamentos: arrastrar para reordenar (`@dnd-kit/core`), fusionar arrastrando uno sobre otro, candado, selector de filamento con buscador.
2. Botones 2–6 colores, con re-corrida de k-means y el preview actualizado.
3. Aviso de ΔE2000 < 5 con botón "fusionarlos".
4. Los 5 controles de la solapa Llavero, con las referencias físicas de tamaño.
5. Manipulación directa: arrastrar el dibujo, escalar por esquina, arrastrar el agujero con validación de borde en vivo.
6. **Franja de avisos** con semáforo, "mostrame dónde" (resalta en 3D) y arreglo de un click en los 4 casos que lo tienen.
7. Selector de slots de impresora con el mensaje de pausas.

**Aceptación:** cambiar de filamento en la tira actualiza el 3D en **< 100 ms medidos** (no recalcula geometría). Cambiar N de colores, en < 400 ms. Los 4 avisos con arreglo se disparan y se resuelven con un click en las imágenes de prueba correspondientes.

---

### Hito U4 · Vista previa honesta — **3 días**

**Objetivo:** el diferenciador que no se copia en un fin de semana.

**Tareas**
1. `ShaderMaterial` con líneas de capa cada 0,2 mm (`fract` + `dFdx`), y variante para modo apilado con sombra entre franjas.
2. Interruptor Lindo / Como va a salir, con el modo honesto por defecto en `/descargar`.
3. Resaltado naranja de zonas < 0,8 mm (con las coordenadas que ya devuelve la apertura morfológica) y rojo de errores bloqueantes.
4. Componente de comparación con divisor arrastrable.
5. Colores de filamento reales tomados del JSON de paleta, con iluminación plana en modo honesto.

**Aceptación:** con la misma pieza, el modo honesto muestra terrazas visibles y las patas de 0,6 mm del gato de prueba en naranja. **Validación física:** imprimir esa pieza y comparar la foto con la captura del render; las terrazas y el ancho tienen que coincidir a ojo.

---

### Hito U5 · Pantalla de descarga y estimaciones — **2 días**

**Objetivo:** que nadie se sorprenda después de imprimir.

**Tareas**
1. Ficha: dimensiones reales, gramos de la pieza (volumen × 1,24 g/cm³ para PLA), gramos de purga (nº de cambios × 400 mm³ × densidad), tiempo estimado (regresión simple sobre 5 impresiones reales medidas).
2. Botón único de ZIP con `fflate`, listado del contenido con el archivo del usuario marcado ★.
3. Selector de slicer que solo cambia el ★ y las instrucciones (no el contenido del ZIP).
4. Instrucciones de 4 pasos por perfil, incluida la advertencia del diálogo de Bambu Studio.
5. Lista de pausas copiable en modo apilado.
6. Fallback de descarga archivo por archivo.

**Aceptación:** el gramaje estimado cae dentro de **±20%** de lo que reporta Bambu Studio al rebanar los 3 diseños patrón. El ZIP abre bien en Windows, macOS y Android sin carpeta raíz.

---

### Hito U6 · Casos feos, de punta a punta — **4 días**

**Objetivo:** que el 30% de usuarios con imágenes difíciles no se vaya con las manos vacías.

**Tareas**
1. Implementar las 6 detecciones de §5 con sus métricas (laplaciano, área de máscara, componentes conexos, ΔE residual, aspecto de componentes para texto).
2. Escribir los 6 mensajes y sus acciones.
3. Banco de **12 imágenes trampa**: foto de cocina, dibujo a lápiz claro, JPG de 180 px, logo de 14 colores, imagen con letra chica, PNG con halo de antialias, silueta negra sobre negro, foto a contraluz, captura de pantalla con texto, imagen con transparencia parcial, SVG con trazos de 0,3 mm, foto con marca de agua.
4. Test de Playwright por imagen trampa que verifica que aparece el aviso correcto.

**Aceptación:** las 12 imágenes trampa producen el aviso esperado, y **ninguna termina en una pantalla sin salida**: en todas hay al menos un botón que mejora el resultado.

---

### Hito U7 · El editor, versión completa de escritorio — **8 días**

**Objetivo:** el diferenciador nº 2, con la lista cerrada de §6.1.

**Tareas**
1. Las 14 herramientas de §6.1 sobre el `Diseno` (ninguna toca la malla directamente).
2. Gizmo combinado estilo Figma con cotas en vivo y modificadores Shift/Alt/Ctrl.
3. Snapping: grilla 0,5/1/5, rotación 15°, **guías inteligentes** de 9 puntos con tolerancia de 0,8 mm.
4. Panel de capas con arrastre = prioridad, resaltado bidireccional, renombrar.
5. `zundo` con `pause/resume` en el drag, acciones con nombre, toasts con deshacer.
6. Tabla de atajos + hoja `?`.
7. Caché por pieza (hash de geometría+transform+z+altura) y render en crudo durante el drag.

**Aceptación:** una tarea guionada — *"agregá el nombre MATÍAS, centralo bajo el dibujo, hacelo rojo, ponelo a 8 mm de alto y descargá"* — la completa una persona que nunca vio el editor **en menos de 90 segundos, sin ayuda**, en 4 de 5 intentos. Deshacer 20 pasos seguidos vuelve exactamente al estado inicial (test automático de igualdad del JSON).

---

### Hito U8 · El editor en celular — **3 días**

**Objetivo:** que el editor en celular sea útil o que se niegue con elegancia.

**Tareas**
1. Layout móvil del editor con hoja deslizante de capas.
2. Gestos: 1 dedo mueve la selección, 2 dedos zoom/pan, pinch sobre la selección escala, twist rota.
3. Áreas de toque de 44 px, handles de 32 px visibles.
4. Deshabilitar las 7 funciones de la columna "NO" de §6.8 sin dejar botones muertos.
5. Pantalla de negación por debajo de 380 px o `deviceMemory ≤ 2`, con "guardar proyecto".

**Aceptación:** la misma tarea guionada del Hito U7, en su versión reducida (agregar texto, moverlo, cambiarle el color), se completa en un Android de gama media en menos de 2 minutos. Ningún control queda por debajo de 44 px (test automático con Playwright midiendo bounding boxes).

---

### Hito U9 · Métrica, accesibilidad y pruebas con gente — **3 días**

**Tareas**
1. Umami + Cloudflare Web Analytics + Sentry conectados, con los 8 eventos de §10.1 y **cero datos de contenido**.
2. Tablero con los 6 números (una página de Umami con eventos guardados).
3. Pasada de accesibilidad: foco visible, orden de tab, contraste AA, `prefers-reduced-motion`, `aria-live` en la franja de avisos.
4. **5 pruebas de pasillo**, grabadas, con planilla de dudas > 5 s.
5. Arreglar los 3 problemas más votados de esas pruebas.

**Aceptación:** los 6 números aparecen en el tablero con datos reales de las pruebas. Axe DevTools sin violaciones serias en las 5 pantallas. Las 5 personas completan la tarea; se documentan sus tiempos.

---

### Resumen de esfuerzo

| Hito | Días |
|---|---|
| U0 Esqueleto y textos | 3 |
| U1 Landing y carga | 3 |
| U2 Solapa Fondo + rescate | 5 |
| U3 Colores y Llavero + avisos | 4 |
| U4 Vista previa honesta | 3 |
| U5 Descarga y estimaciones | 2 |
| U6 Casos feos punta a punta | 4 |
| **Subtotal hasta lanzar** | **24 días** |
| U7 Editor escritorio | 8 |
| U8 Editor celular | 3 |
| U9 Métrica, a11y, pruebas | 3 |
| **Total** | **38 días** |

**Orden recomendado de lanzamiento:** U0 → U1 → U2 → U3 → U5 → U6 → U4 → **lanzar** → U9 → U7 → U8.

El editor (U7/U8, 11 días) **no entra en el primer lanzamiento**, coincidiendo con los planes A y B. La diferencia es que acá **U4 (vista honesta) sí entra**, aun costando 3 días: es lo que separa el producto del commodity, y sin ella el lanzamiento es "otro conversor más".

---

## 12. Supuestos y las tres decisiones más discutibles

### 12.1 Supuestos declarados

1. **Asumo que el motor funciona** (pipeline, 3MF, DRC) según los planes A/B. Si el 3MF de Bambu no anda, ninguna de estas pantallas importa.
2. **Asumo la distribución de usuarios 70/25/5** por analogía con herramientas parecidas. No está medida y define casi todas las decisiones de este plan. **Es lo primero que hay que verificar con los datos del Hito U9.**
3. **Asumo que el preview 3D responde en < 400 ms** en desktop. Si no, el modelo de "tres solapas con 3D siempre presente" se cae y hay que volver al wizard por páginas de los planes A y B.
4. **Asumo que una persona sola hace esto.** Con dos, U2 y U7 corren en paralelo y el calendario baja a ~25 días.
5. **Asumo que el tiempo de impresión estimado se calibra con 5 impresiones reales.** Sin esa calibración, mejor no mostrar el número que mostrarlo mal: la honestidad es el producto.
6. **No verifiqué** el costo de las guías inteligentes ni del shader de terrazas en un celular de gama media. Son las dos cosas de este plan con más riesgo de rendimiento no medido.

### 12.2 Las tres decisiones más discutibles

**1. Sacar el selector de impresora de la landing.**
Los dos planes anteriores lo ponen arriba de todo y tienen un argumento fuerte: la elección cambia el `modoColor` y por lo tanto **toda la geometría**; preguntarlo tarde obliga a recalcular. Yo lo saco igual, porque es una pregunta que U1 no entiende y llega antes de que haya ganado nada, y porque el costo de recalcular está cubierto (la geometría se rehace en < 400 ms y el ZIP trae los tres perfiles de todos modos). **Riesgo:** si resulta que más del 40% de los usuarios son de un solo extrusor, el default "AMS" es el equivocado y muchos ven un preview que no corresponde a su realidad hasta el paso 2. **Cómo se decide:** medir la distribución de `descarga.modo` en las primeras 200 descargas; si un solo extrusor supera el 40%, el selector vuelve a la landing.

**2. Tres solapas en una ruta, en vez de un wizard de páginas.**
Es una apuesta a que ver el objeto final durante todo el proceso vale más que la simplicidad de un paso por vez. Cuesta más: obliga al preview de 400 ms, a mantener dos historiales coordinados y a un layout que aguante desde 375 px hasta 1920. Un wizard clásico sería más barato y más difícil de romper. **El contraargumento honesto:** la gente sin conocimiento previo suele rendir mejor con pasos secuenciales estrictos, y el preview permanente puede leerse como ruido. **Cómo se decide:** prueba de pasillo del Hito U9 con las dos variantes (el wizard es un cambio de layout, no de lógica, porque los datos son los mismos).

**3. Meter la vista previa honesta antes de lanzar (3 días) y el editor después (11 días).**
Discutible porque el editor es el hueco de mercado verificado (`audit-03 §2.2`: once competidores y ninguno deja editar) y la vista honesta es un detalle de render que nadie está pidiendo. Elijo la vista honesta porque el editor sirve al 5% de usuarios que quiere retocar, y la vista honesta sirve al 100% en el momento exacto en que decide si confía o no. Es también lo que más baja el soporte ("me salió mal"). **Riesgo real:** que la vista honesta sea invisible como argumento de marketing, mientras que "el único que te deja editar" es un titular. **Mitigación:** el componente de comparación lado a lado (§7.4) se usa como imagen principal de la landing y de las redes; eso le da la visibilidad que el render solo no tiene.

---

*Fin del plan C. Documentos hermanos: `plan-A-mvp-first.md` (orden de construcción), `plan-B-riesgo-first.md` (mapa de riesgos y spikes), `audit-01/02/03` (los números).*
