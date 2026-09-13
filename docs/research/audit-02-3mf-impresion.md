# Auditoría 02 · Export 3MF multicolor desde JavaScript y reglas de impresión

> **Rol:** auditor técnico. Fecha: **2026-09-11**.
> **Alcance:** verificar el punto de falla más crítico del proyecto — que un 3MF generado en el navegador abra en **Bambu Studio / OrcaSlicer / PrusaSlicer** con los colores ya asignados, sin que el usuario tenga que pintar a mano.
> **Insumos auditados:** `docs/01-stack-tecnologico.md` (§3 y §2.6) y `docs/02-costos-servicios.md`.
> **Método:** lectura del **código fuente real** de los slicers (`bbs_3mf.cpp` de Bambu Studio y de OrcaSlicer, `3mf_legacy.cpp` y `Biz/Format/3mf.cpp` de PrusaSlicer, ramas `master`/`main` al 2026-09-11), inspección del **bundle publicado en npm** de las librerías JS, registro de npm, especificaciones del 3MF Consortium y documentación/foros de los fabricantes.
> **Lo que NO hice:** no instalé ningún slicer ni me registré en ningún servicio. Por eso **todo lo que dependa de ver la aplicación corriendo está marcado `(no verificado en la app real)`**.

---

## 0. Veredicto

# ✅ **VIABLE CON RESERVAS**

| Objetivo | Veredicto | Confianza |
|---|---|---|
| 3MF multicolor desde JS que abra **en Bambu Studio y OrcaSlicer** con colores y extrusores ya asignados, sin pintar a mano | ✅ **VIABLE** | Alta. Hay una librería MIT que ya lo hace y el código fuente del slicer confirma la ruta. |
| Lo mismo **en PrusaSlicer** | 🟡 **VIABLE CON RESERVAS** | Media. Hay que escribir un **segundo perfil** (formato legacy `Slic3r_PE_model.config`). No hay librería JS que lo haga; es código propio. Prusa está reestructurando su lector de 3MF en 2026. |
| Lo mismo en **Cura y slicers genéricos** | ❌ **NO VIABLE de forma confiable hoy** | Alta. Ningún slicer de los tres objetivo lee `<basematerials>`/`displaycolor`. Ver §1. |
| **Un solo archivo** que sirva para los tres con colores | ❌ **NO** | Hay que exportar **por perfil**. Es la misma decisión que tomó HueForge. |
| Plan B (STL por color + instrucciones) | ✅ **VIABLE** | Alta. Los tres slicers ofrecen "cargar como un objeto con varias partes". |
| Modo un solo extrusor (cambio de filamento por altura) | ✅ **VIABLE** | Alta. Los formatos XML están confirmados en el código fuente de los tres. |

**La reserva principal, en una línea:** el 3MF multicolor **no es un formato, son tres formatos propietarios distintos** disfrazados de estándar. El proyecto es perfectamente factible, pero exige **escritor propio con tres perfiles + una matriz de pruebas manual por versión de slicer** (§9). Nadie te va a salvar de esa matriz de pruebas.

---

## 1. Qué variante de 3MF entiende cada slicer (verificado en código fuente)

### 1.1 El hallazgo más importante de toda la auditoría

> **Ni Bambu Studio, ni OrcaSlicer, ni PrusaSlicer leen `<basematerials>` con `displaycolor`.**

Grep case-insensitive sobre `src/libslic3r/Format/bbs_3mf.cpp` (Bambu Studio, 9.854 líneas) y sobre los dos módulos de 3MF de PrusaSlicer `master`: **cero coincidencias** de `basematerials` / `displaycolor`.

Esto **invalida el "perfil 3MF genérico"** que propone el doc 01 §3.2 y **también invalida el snippet XML de ejemplo del perfil Bambu** que aparece ahí (usa `<basematerials>` + `pid`/`pindex` apuntando a basematerials). Ver §8, corrección **C1**.

### 1.2 Bambu Studio / OrcaSlicer

**Archivos que leen** (constantes literales de `bbs_3mf.cpp`, líneas 153–190):

| Archivo | Contenido | ¿Obligatorio? |
|---|---|---|
| `[Content_Types].xml`, `_rels/.rels` | OPC estándar | Sí |
| `3D/3dmodel.model` | Mallas, objetos, `components`, `build` | Sí |
| `Metadata/model_settings.config` | XML: **extrusor por objeto y por parte** | Sí, para el color |
| `Metadata/project_settings.config` | JSON: `filament_colour`, `filament_type`, bed, etc. | Sí, para que los colores se vean |
| `Metadata/custom_gcode_per_layer.xml` | Cambios de color/pausas por capa | Solo modo apilado |
| `Metadata/plate_1.png` | Miniatura | No |
| `Metadata/_rels/model_settings.config.rels` | Relación OPC | No (Bambu lo escribe, pero no lo exige al leer) |

**El interruptor oculto — `m_is_bbl_3mf`.** Verificado en `bbs_3mf.cpp:4234-4238` y en OrcaSlicer `bbs_3mf.cpp:3989-4004`:

```cpp
} else if (m_curr_metadata_name == BBL_APPLICATION_TAG) {   // BBL_APPLICATION_TAG = "Application"
    if (boost::starts_with(m_curr_characters, "BambuStudio-")) {
        m_is_bbl_3mf = true;
        ...
    }
    else if (boost::starts_with(m_curr_characters, "OrcaSlicer-")) {   // solo en OrcaSlicer
        m_is_bbl_3mf = true;
```

Es decir: **el slicer decide si tu archivo es "suyo" mirando un único metadato de texto** dentro de `3D/3dmodel.model`:

```xml
<metadata name="Application">BambuStudio-02.05.00.00</metadata>
```

Consecuencias, todas verificadas en el código:

- Con ese metadato → `m_is_bbl_3mf = true` → **se salta por completo** la ruta de "3MF estándar": no parsea `m:colorgroup` (`bbs_3mf.cpp:4089`, `5399`), **no aparece el diálogo "Standard 3MF Color Parsing"**, y respeta los extrusores de `model_settings.config`.
- Sin ese metadato → el usuario ve el mensaje *"The 3mf is not from Bambu Lab, load geometry data only"* y entra por la ruta de parseo de color estándar, que en **Bambu Studio 2.5 está rota** (issue [#9666](https://github.com/bambulab/BambuStudio/issues/9666), **abierta** al 2026-02-04: convierte el color por objeto en *color painting* y todas las partes quedan del mismo filamento).
- **OrcaSlicer acepta los dos prefijos** (`BambuStudio-` y `OrcaSlicer-`), así que **un solo archivo con `BambuStudio-…` sirve nativo para los dos**.
- `Metadata/model_settings.config` se parsea **siempre**, con `m_is_bbl_3mf` o sin él (`bbs_3mf.cpp:1669` y `2055`) — pero sin el metadato el diálogo de color estándar puede pisar la asignación.

**La ruta "3MF estándar" que sí existe en Bambu** (por si algún día se quiere un archivo no-propietario): lee `<m:colorgroup>` / `<m:color color="#RRGGBBAA">` de la **Materials & Properties Extension**, namespace `http://schemas.microsoft.com/3dmanufacturing/material/2015/02`. Dos niveles:

- **Por objeto**: `<object pid="2" pindex="0">` → asigna extrusor al objeto entero (`bbs_3mf.cpp:2275-2286`). **Esto funciona y es lo que querríamos.**
- **Por triángulo**: `p1`/`p2`/`p3` → se convierte en *mmu_segmentation* (pintura por cara).

El mapeo color→extrusor es **por orden de primera aparición del color**, no por hex (`bbs_3mf.cpp:2156-2174`): el primer color distinto que aparece → extrusor 1, el segundo → extrusor 2, etc. **Confirma lo que dice el doc 01.** Pero como Bambu 2.5 rompe esta ruta (issue #9666), **no es la estrategia principal**.

**`project_settings.config`** (JSON plano): arrays paralelos **base 0** (`filament_colour`, `filament_type`, `filament_settings_id`…). **`model_settings.config`** usa índices de extrusor **base 1**. Regla: `extruder = índice_del_array + 1`.

### 1.3 PrusaSlicer

Verificado sobre `master` al 2026-09-11. **La reestructuración que menciona el doc 01 es real**: el archivo `src/libslic3r/Format/3mf.cpp` **ya no existe** (HTTP 404); hoy son dos módulos:

- `src/slic3r-shared/src/Slic3r/Biz/Format/3mf.cpp` (nuevo, 934 líneas): solo `3D/3dmodel.model` + `3D/Metadata/BuildTicket.mbt`. **Cero manejo de color** (grep sin coincidencias de `basematerial`, `displaycolor`, `colorgroup`, `pid`, `pindex`).
- `src/slic3r-shared/src/Slic3r/Biz/Config/Legacy/3mf_legacy.cpp` (legacy, 4.837 líneas): sigue vivo en `master` y es el que lee el formato de color. **Tampoco maneja color genérico.**

**Único camino para que PrusaSlicer abra con extrusores asignados** (constantes verificadas en `3mf_legacy.cpp:127-133, 157, 181-185` y el escritor en `:4095-4195`):

`Metadata/Slic3r_PE_model.config`, con **un objeto y N volúmenes**, cada volumen definido por un **rango de índices de triángulo**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<config>
 <object id="1" instancescount="1">
  <metadata type="object" key="name" value="llavero"/>
  <volume firstid="0" lastid="1199">
   <metadata type="volume" key="name" value="base"/>
   <metadata type="volume" key="volume_type" value="ModelPart"/>
   <metadata type="volume" key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
   <metadata type="volume" key="extruder" value="1"/>
  </volume>
  <volume firstid="1200" lastid="1799">
   <metadata type="volume" key="name" value="rojo"/>
   <metadata type="volume" key="volume_type" value="ModelPart"/>
   <metadata type="volume" key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
   <metadata type="volume" key="extruder" value="2"/>
  </volume>
 </object>
</config>
```

Más `<metadata name="slic3rpe:Version3mf">1</metadata>` y el namespace `xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06"` en `3dmodel.model`. Ojo: `firstid`/`lastid` son **índices de triángulo dentro de la malla única del objeto**, así que en el `.model` hay que **concatenar los triángulos de todos los colores en una sola malla, en orden**, y llevar la cuenta.

Cambios de color por altura: `Metadata/Prusa_Slicer_custom_gcode_per_print_z.xml` (nombre distinto al de Bambu).

### 1.4 Tabla resumen

| Mecanismo | Bambu Studio | OrcaSlicer | PrusaSlicer | Cura / genérico |
|---|---|---|---|---|
| `<basematerials>` + `displaycolor` | ❌ **no lo lee** | ❌ | ❌ | 🟡 (no verificado) |
| `<m:colorgroup>` + `object pid/pindex` | 🟡 sí, pero solo si NO es "archivo Bambu"; roto en 2.5 (#9666) | 🟡 idem | ❌ | 🟡 (no verificado) |
| `<m:colorgroup>` por triángulo (`p1/p2/p3`) | 🟡 → lo convierte en *color painting* | 🟡 | ❌ | ❌ |
| `Metadata/model_settings.config` (extrusor por parte) | ✅ **sí** | ✅ **sí** | ❌ | ❌ |
| `Metadata/Slic3r_PE_model.config` (extrusor por volumen) | ❌ (comentado en el código) | ❌ | ✅ **sí** | ❌ |
| `Metadata/project_settings.config` (`filament_colour`) | ✅ | ✅ | ❌ | ❌ |

---

## 2. Estrategia: ¿un objeto por color o pintado por caras?

**Ganador claro: un objeto por color, agrupados como ensamblado (multi-part / assembly), con extrusor asignado por parte.**

| Criterio | Objeto/parte por color | Pintado por caras (`paint_color` / `mmu_segmentation`) |
|---|---|---|
| Sobrevive al import | ✅ es el mecanismo nativo de los 3 slicers | ❌ formato binario propietario, versionado (`BBS_MMU_SEGMENTATION_VERSION`, `slic3rpe:MmPaintingVersion`); PrusaSlicer directamente rechaza versiones nuevas |
| Cambiar un color después | ✅ un desplegable por parte | ❌ hay que repintar |
| Nuestra geometría | ✅ el pipeline ya produce sólidos disjuntos por color (Manifold) | ❌ habría que fusionar todo y después clasificar cada triángulo |
| Precisión del borde de color | ✅ exacta (es geometría) | 🟡 depende de la resolución del triangulado |
| Modo apilado (un extrusor) | ✅ sirve igual | ❌ no aplica |
| Riesgo de que un cambio de versión lo rompa | Bajo | **Alto** |

**No usar pintado por caras.** El único lugar donde aparece es como *efecto colateral indeseado* del diálogo de Bambu 2.5, que es justamente lo que queremos evitar.

**Requisito duro de geometría** (confirmado por el análisis de ModelRift y por el propio doc 01): las piezas por color deben ser **disjuntas, sin solapes y sin caras coplanares ambiguas**. Manifold ya lo garantiza si se hacen las booleanas antes de exportar. Si igual aparecen artefactos en el slicer, la mitigación conocida es un **épsilon de ~0.01–0.05 mm** de separación en la frontera compartida — pero **empezar sin épsilon**: con volúmenes apilados en Z (que es nuestro caso) el contacto cara-a-cara es lo normal y no suele dar problemas.

---

## 3. Librerías JS: qué soporta cada una *de verdad*

Inspeccioné el bundle publicado en npm, no el README.

| Paquete | Versión (fecha) | Lic. | dl/sem | Qué escribe **realmente** | Veredicto |
|---|---|---|---|---|---|
| [`three-3mf-exporter`](https://www.npmjs.com/package/three-3mf-exporter) | 45.2.0 (2026-03-16) | MIT | 714 | `3dmodel.model` con `components` + `model_settings.config` con `<part subtype="normal_part">` y `extruder` + `project_settings.config` con `filament_colour`. **Escribe `Application: "BambuStudio-02.04.00.70"`.** Deps: `jszip`, `fast-xml-parser`. | 🟢 **La referencia canónica.** Ver limitaciones abajo. |
| [`@jscadui/3mf-export`](https://www.npmjs.com/package/@jscadui/3mf-export) | 0.5.0 (2023-11-22) | MIT | 55.468 | **Cero color**: grep del bundle no encuentra `material`, `color`, `basematerials`, `extruder`. Solo core: objetos, componentes, build, `[Content_Types].xml`. | 🟡 Solo estructura OPC |
| `bambu-3mf` | 0.1.0 (2026-06-20) | MIT | 70 | Declara catálogo de parámetros de proceso/filamento/impresora, multicolor, modificadores y pintura por triángulo. **Dep única: `fflate`.** Sin repo público declarado, una sola release. | 🟡 **No verificado**, pero vale la pena leerlo |
| `threejs-exporter-pc` | 1.0.2 (2025-11-27) | MIT | — | Fork "enhanced" de un exportador three con multicolor para Bambu. Deps: `jszip`, `three`, `fast-xml-parser`. | 🟡 no verificado |
| `three-mf` | 1.1.2 (2026-07-01) | MIT | 22 | Librería TS de **parseo** de 3MF | 🟡 útil para tests |
| `parse3mf` | 1.1.0 (2026-02-10) | MIT | 42 | Parser + visor multicolor React, "slicer-accurate" para Bambu y Prusa, **sin dependencias** | 🟡 útil para tests |
| [`@lib3mf-rs/lib3mf-wasm`](https://www.npmjs.com/package/@lib3mf-rs/lib3mf-wasm) | 0.4.0 (2026-03-04) | BSD-2 | 4 | Bindings WASM de lib3mf para **validar** el core en CI | 🟡 validación |
| `three/addons/loaders/3MFLoader.js` | r186 | MIT | — | Lee core 3MF; no entiende los metadatos propietarios | ✅ smoke test de CI |

### Limitaciones reales de `three-3mf-exporter` (verificadas leyendo `dist/index.mjs`)

1. **No escribe ningún color en `3dmodel.model`.** Ni `basematerials`, ni `colorgroup`. El color vive **solo** en `project_settings.config`. → Abrirlo en PrusaSlicer o Cura da **gris, sin colores**.
2. **No escribe `Slic3r_PE_model.config`** → inútil para PrusaSlicer.
3. **No escribe `custom_gcode_per_layer.xml`** → no sirve para el modo apilado / M600.
4. **Declara `requiredextensions="p"`** (Production Extension) en el `<model>` **sin usar `p:UUID` en ningún lado**. Eso es **inválido según la spec** y puede hacer que un lector estricto (lib3mf, Cura) rechace el archivo. **No copiar esa línea.**
5. El extrusor se deriva del **color del material de three**, en orden de primera aparición. No hay control explícito de "esta parte va al slot 3".
6. Arrastra `jszip` (~100 KB) en vez de `fflate` (~8 KB).
7. `filament_settings_id` se rellena con un **único preset** repetido (`"Bambu PLA Basic @BBL A1"`) para todos los slots.

**Conclusión de §3: la recomendación del doc 01 de escribir el 3MF a mano con `fflate` es correcta.** Pero hay que corregir la justificación: no es "ninguna librería cubre bien el 3MF multicolor" en abstracto — es que **`three-3mf-exporter` cubre el 60% del caso Bambu/Orca y 0% de Prusa y del modo apilado**. Son ~300–450 líneas de XML y JSON, sin algoritmos. El riesgo no está en escribirlo, está en **probarlo**.

---

## 4. Receta técnica recomendada, paso a paso

### Paso 0 — Modelo de datos de salida del pipeline

```ts
type PiezaExport = {
  nombre: string;        // "base", "rojo", "blanco"...
  slot: number;          // 1..N  (índice de filamento, base 1)
  hex: string;           // "#E53935"
  vertices: Float32Array; // xyz en mm, ya centrado en el origen XY, z>=0
  indices: Uint32Array;   // triángulos, orientación CCW hacia afuera
};
type Export = { piezas: PiezaExport[]; nombre: string; alturaCapa: number; boquilla: number };
```

Invariantes que el exportador debe **asumir garantizadas** por Manifold: mallas *manifold*, cerradas, **disjuntas entre sí**, normales hacia afuera, `z >= 0`, y **orden de `piezas` = orden de slots** (crítico, §1.2).

### Paso 1 — Perfil A: **Bambu Studio / OrcaSlicer** (el principal)

ZIP con DEFLATE (`fflate.zipSync`), sin carpeta raíz, con estos 5 archivos:

```
[Content_Types].xml
_rels/.rels
3D/3dmodel.model
Metadata/model_settings.config
Metadata/project_settings.config
```

**`[Content_Types].xml`**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="png" ContentType="image/png"/>
</Types>
```

**`_rels/.rels`**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel-1" Target="/3D/3dmodel.model"
    Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
```

**`3D/3dmodel.model`** — un `<object>` malla por color + un `<object>` ensamblado con `<components>`; un solo `<item>` en el `<build>`.
```xml
<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
       xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Application">BambuStudio-02.05.00.00</metadata>
  <metadata name="ApplicationTitle">3dllaveros</metadata>
  <metadata name="CreationDate">2026-09-11</metadata>
  <resources>
    <object id="1" type="model" name="base">
      <mesh>
        <vertices><vertex x="0.00000" y="0.00000" z="0.00000"/>…</vertices>
        <triangles><triangle v1="0" v2="1" v3="2"/>…</triangles>
      </mesh>
    </object>
    <object id="2" type="model" name="rojo"><mesh>…</mesh></object>

    <object id="99" type="model" name="llavero">
      <components>
        <component objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
        <component objectid="2" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
      </components>
    </object>
  </resources>
  <build>
    <item objectid="99" transform="1 0 0 0 1 0 0 0 1 128 128 0" printable="1"/>
  </build>
</model>
```
Notas: `transform` son **12 números** (matriz 4×3, traslación al final). El `<item>` centra la pieza en la cama (128,128 para una A1/P1S de 256 mm). **No declarar `requiredextensions`** (§3, limitación 4).

**`Metadata/model_settings.config`** — acá vive la asignación de color. `<part id>` referencia el `objectid` del componente:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="99">
    <metadata key="name" value="llavero"/>
    <metadata key="extruder" value="1"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="base"/>
      <metadata key="extruder" value="1"/>
      <mesh_stat edges_fixed="0" degenerate_facets="0" facets_removed="0"
                 facets_reversed="0" backwards_edges="0"/>
    </part>
    <part id="2" subtype="normal_part">
      <metadata key="name" value="rojo"/>
      <metadata key="extruder" value="2"/>
      <mesh_stat edges_fixed="0" degenerate_facets="0" facets_removed="0"
                 facets_reversed="0" backwards_edges="0"/>
    </part>
  </object>
</config>
```

**`Metadata/project_settings.config`** — JSON plano, arrays **base 0**, todos los valores como **strings**:
```json
{
  "filament_colour":      ["#FFFFFF", "#E53935"],
  "filament_type":        ["PLA", "PLA"],
  "filament_settings_id": ["Bambu PLA Basic @BBL A1", "Bambu PLA Basic @BBL A1"],
  "filament_diameter":    ["1.75", "1.75"],
  "filament_is_support":  ["0", "0"],
  "printable_area":       ["0x0", "256x0", "256x256", "0x256"],
  "printable_height":     "256",
  "printer_model":        "Bambu Lab A1",
  "printer_settings_id":  "Bambu Lab A1 0.4 nozzle",
  "print_settings_id":    "0.20mm Standard @BBL A1",
  "nozzle_diameter":      ["0.4"],
  "layer_height":         "0.2",
  "first_layer_height":   "0.2"
}
```

> **Regla de oro:** `extruder` en `model_settings.config` = índice en `filament_colour` **+ 1**.

> **Trampa de UX a avisarle al usuario:** abrir un 3MF "de proyecto" en Bambu Studio **puede pisar los presets de impresora/filamento del usuario** (foro Bambu, issue [#7797](https://github.com/bambulab/BambuStudio/issues/7797)). Mitigaciones: (a) escribir el `project_settings.config` **mínimo** (solo lo de arriba, no volcar 300 claves); (b) ofrecer un selector de impresora en la UI (A1/A1 mini/P1S/X1C/genérica) para que los valores calcen; (c) poner en la página de descarga: *"si Bambu Studio te pregunta, elegí importar solo la geometría y después asigná los colores"*.

### Paso 2 — Perfil B: **PrusaSlicer**

Cambia todo respecto del perfil A:

1. **Una sola malla**: concatenar los triángulos de todos los colores **en orden de slot**, llevando `offset` acumulado tanto en vértices como en el contador de triángulos.
2. **Un solo `<object>`** en `3dmodel.model` (sin `components`), con `xmlns:slic3rpe` y `<metadata name="slic3rpe:Version3mf">1</metadata>`.
3. **`Metadata/Slic3r_PE_model.config`** con un `<volume firstid lastid>` por color (XML exacto en §1.3).
4. **No incluir** `model_settings.config` ni `project_settings.config` (los metadatos de Bambu pueden confundir al parser — es lo que hace HueForge y el doc 01 lo dice bien).
5. Pseudocódigo del contador:

```ts
let triOffset = 0, vtxOffset = 0;
for (const p of piezas) {
  const first = triOffset, last = triOffset + p.indices.length / 3 - 1;
  volumes.push({ first, last, extruder: p.slot, name: p.nombre });
  // los índices se reescriben sumando vtxOffset
  triOffset = last + 1; vtxOffset += p.vertices.length / 3;
}
```

### Paso 3 — Perfil C: **un solo extrusor (modo apilado, M600 / pausa)**

Geometría: cada color en **su propia franja Z** (doc 01 §1.3, correcto). Se exporta como perfil A o B **con un solo filamento**, más el XML de cambios de color.

**Bambu / Orca — `Metadata/custom_gcode_per_layer.xml`** (formato verificado en `bbs_3mf.cpp:8954-8990`):
```xml
<custom_gcodes_per_layer>
  <plate>
    <plate_info id="1"/>
    <layer top_z="2.4" type="0" extruder="1" color="#E53935" extra="" gcode="M600"/>
    <layer top_z="3.0" type="0" extruder="1" color="#1E88E5" extra="" gcode="M600"/>
    <mode value="SingleExtruder"/>
  </plate>
</custom_gcodes_per_layer>
```

**PrusaSlicer — `Metadata/Prusa_Slicer_custom_gcode_per_print_z.xml`** (verificado en `3mf_legacy.cpp:4232-4295`):
```xml
<custom_gcodes_per_print_z bed_idx="0">
  <code print_z="2.4" type="0" extruder="1" color="#E53935" extra="" gcode="M600"/>
  <code print_z="3.0" type="0" extruder="1" color="#1E88E5" extra="" gcode="M600"/>
  <mode value="SingleExtruder"/>
</custom_gcodes_per_print_z>
```

**Valores del enum `type`** (verificado en `CustomGCode.hpp`): `0` = ColorChange, `1` = PausePrint, `2` = ToolChange, `3` = Template, `4` = Custom.
**Valores de `mode`**: `SingleExtruder` · `MultiAsSingle` · `MultiExtruder`.
El atributo `bed_idx` de Prusa es **nuevo (2026)**; para compatibilidad con versiones viejas conviene escribir el nodo también sin él **(no verificado con PrusaSlicer 2.8/2.9 reales)**.

**Además, siempre**: generar una **lista legible** ("cambiar a rojo en Z = 2.4 mm, capa 12") en un `INSTRUCCIONES.txt` dentro del ZIP y mostrarla en pantalla. Es lo que hacen Kromacut y HueForge y es lo que salva al usuario cuando el XML no lo toma el slicer.

### Paso 4 — Qué exportar por defecto

Un **único botón "Descargar"** que entrega un **ZIP** con todo, para no obligar al usuario a elegir un formato que no entiende:

```
llavero-gatito.zip
├── llavero-gatito_bambu-orca.3mf     ← recomendado, destacado en la UI
├── llavero-gatito_prusa.3mf
├── stl/  llavero_1_blanco.stl, llavero_2_rojo.stl, …
└── INSTRUCCIONES.txt
```

Con un selector arriba ("¿Qué impresora usás?": Bambu/Orca · Prusa · Un solo color / manual · No sé) que solo **resalta** el archivo correcto, sin esconder los demás.

---

## 5. Plan B

### B1 — STL por color (fallback universal) ✅

Un `.stl` **binario** por color, numerados por slot, **todos en el mismo sistema de coordenadas** (no centrar cada uno por separado — si se centran individualmente, se desarman al importar).

Comportamiento verificado por documentación y foros de los tres slicers:
- **Bambu Studio / OrcaSlicer**: al soltar varios STL pregunta si cargarlos como objetos separados o como **un objeto multi-parte**; eligiendo multi-parte conserva las posiciones relativas y después se asigna un filamento por parte. OrcaSlicer expone además una opción de *split* en el import.
- **PrusaSlicer**: mismo diálogo, *"Import as a single object with multiple parts"*, y luego extrusor por parte.

Costo para el usuario: 3 clics y elegir N colores. **Es un fallback aceptable y hay que tenerlo desde el día 1**, porque es lo único que no se rompe cuando un slicer cambia de versión.

### B2 — Cambio de filamento por altura ✅

Ya cubierto en §4 paso 3. Vale para cualquier impresora de un extrusor. **Limitar a 3–4 cambios**: cada pausa es una intervención manual y el llavero queda en terrazas visibles.

### B3 — Lo que **no** es plan B

- **OBJ + MTL**: los slicers lo importan de forma inconsistente. Sirve para previsualizar en otro software, no para imprimir.
- **GLB**: solo para compartir/preview web.
- **3MF "genérico" con `basematerials`**: como probó §1.1, **ninguno de los tres slicers lo lee**. Si igual se quiere escribir (por si aparece otro consumidor), que sea **decorativo y opcional**, nunca la vía principal.

---

## 6. Parámetros por defecto del generador (con valores numéricos)

Base: **boquilla 0.4 mm, altura de capa 0.2 mm, PLA**. Todas las alturas son **múltiplos exactos de 0.2 mm** — el generador debe redondear siempre y avisar si el usuario mete un valor que no lo es.

### 6.1 Tamaño y resolución

| Parámetro | **Por defecto** | Rango permitido | Por qué |
|---|---|---|---|
| Lado mayor | **50 mm** | 25 – 80 mm | Tamaño típico de llavero; por debajo de 25 mm el detalle se pierde con boquilla 0.4 |
| Resolución de trabajo | **0.20 mm/px** | 0.15 – 0.30 | MakerTools3D recomienda 0.15–0.25 mm/px. A 50 mm da 250 px: suficiente y barato de procesar. **Corrige** el 0.08–0.12 mm/px del doc 01, que multiplica por 4–9 el trabajo sin ganar detalle imprimible |
| Tolerancia de simplificación (RDP) | **0.05 mm** | 0.02 – 0.10 | Por debajo de 0.05 se generan vértices que el slicer no puede resolver |

### 6.2 Espesores (modo a ras / AMS)

| Parámetro | **Por defecto** | Rango | Nota |
|---|---|---|---|
| Espesor de base (color de fondo) | **2.4 mm** (12 capas) | 1.2 – 3.6 | Rigidez. Preset "delgado" 1.2 mm; "reforzado" 3.4 mm |
| Espesor de la capa de color | **0.6 mm** (3 capas) | 0.4 – 1.0 | 2 capas (0.4 mm) ya tapan el color de abajo con filamentos opacos; 3 capas dan margen con colores claros sobre oscuros |
| **Espesor total** | **3.0 mm** | 1.6 – 4.5 | 15 capas. Presets: Delgado 1.6 · **Estándar 3.0** · Reforzado 4.0 |
| Borde / contorno (offset de la silueta) | **1.5 mm** | 0 – 3.0 | Une piezas finas y evita que se despeguen puntas; es el "look" MakerLab |
| Franja por color (modo apilado) | **0.6 mm** (3 capas) | 0.4 – 1.2 | Múltiplo exacto de la altura de capa |
| Nº máximo de cambios (modo apilado) | **3** | 1 – 5 | Cada uno es una pausa manual |

> ⚠️ **Corrección al doc 01 (§3.3)**: MakerWorld *Image to Keychain* trae por defecto **plancha 1.0 mm + imagen 0.5 mm = 1.5 mm total**, y MakerTools3D sugiere **0.8–1.2 mm** de "piel" visible. Es decir, **la competencia usa llaveros bastante más finos** que los 3.0–4.5 mm que propone el doc 01. 3.0 mm es una buena elección por durabilidad, pero hay que **ofrecer el preset delgado** o el llavero sale caro en filamento y tiempo.

### 6.3 Detalle mínimo

| Parámetro | **Por defecto** | Nota |
|---|---|---|
| **Ancho mínimo de detalle** | **0.8 mm** | 2 líneas de extrusión (~0.42 mm c/u con boquilla 0.4). Es el umbral de la apertura morfológica: `offset(-0.4).offset(+0.4)` |
| Ancho mínimo absoluto (permitir con advertencia) | **0.45 mm** | 1 línea. Frágil |
| Ancho mínimo para texto legible | **1.0 mm** de trazo | ≥ 1.5× boquilla para legibilidad; JLC3DP pide 1.0 mm de ancho **y** 1.0 mm de profundidad para relieve/grabado |
| Altura mínima de texto | **6 mm** | Por debajo el trazo no llega a 1 mm |
| Separación mínima entre regiones del mismo color | **0.8 mm** | Si no, se fusionan al imprimir |
| Área mínima de isla | **1.0 mm²** | Islas menores se fusionan con el color vecino dominante |
| Radio de apertura vectorial | **0.4 mm** | = ancho mínimo / 2 |

### 6.4 Agujero de la argolla

| Parámetro | **Por defecto** | Nota |
|---|---|---|
| Diámetro modelado | **Ø 4.2 mm** | = Ø4.0 nominal **+ 0.2 mm** de compensación de agujero (los agujeros FDM salen sub-dimensionados). Presets: **3.7 mm** (cadena de bolitas, nominal 3.5) · **4.2 mm** (argolla estándar, alambre 1.0–1.2 mm: las dos vueltas necesitan ~2.4 mm + juego) · **5.2 mm** (argolla gruesa / mosquetón chico) |
| **Anillo de material alrededor** | **3.0 mm** (mínimo absoluto 2.0 mm) | Es el parámetro que más roturas evita. Con Ø4.2 → la pestaña mide al menos **Ø 10.2 mm** |
| Distancia del centro del agujero al borde de la silueta | **≥ Ø/2 + 3.0 mm** | Validación automática; si no da, el generador agrega pestaña |
| Espesor de la pestaña | **= espesor total** (3.0 mm) | Nunca más fina que el cuerpo |
| Color de la pestaña | **el de la base** | No ponerle capa de color encima: es la zona que más se manipula |
| Posición por defecto | **borde superior de la silueta, centrada en X** | Fusionada con la silueta con un fillet de **r = 2.0 mm** para evitar la concentración de tensión |
| Orientación del agujero | **eje Z** (perpendicular a la cara) | Sin soportes |

### 6.5 Color y filamentos

| Parámetro | **Por defecto** | Nota |
|---|---|---|
| Nº de colores | **4** | Un AMS/CFS lleno. MakerLab y el doc 02 coinciden en ≤ 4 |
| Máximo | **6** | Más que eso, la purga come el proyecto |
| Mínimo | **2** | |
| Orden de los slots | **de más claro a más oscuro** | Reduce la purga: Bambu calcula el *flush* por contraste, y claro→claro purga poco |
| Ajuste a paleta real | **activado**, ΔE2000 | Contra un JSON de filamentos reales |

### 6.6 Ajustes de impresión sugeridos (van en el `INSTRUCCIONES.txt`, no en el 3MF)

| Parámetro | Valor |
|---|---|
| Altura de capa | 0.20 mm (0.10 mm con boquilla 0.2 para preset "detalle") |
| Paredes / perímetros | **3** |
| Relleno | **100%** si el espesor total ≤ 3.0 mm; **40% gyroid** si es mayor |
| Capas sólidas arriba/abajo | 4 / 4 |
| Brim | **5 mm**, activado si la silueta tiene puntas o el área de contacto es < 300 mm² |
| Material | PLA para exhibición; **PETG o ASA** si va al sol o al auto |
| Purga (AMS) | Activar **"flush into objects" / "flush into infill"**; imprimir **6–12 llaveros por placa** |

> ⚠️ **Advertencia económica que falta en los dos docs previos**: Bambu purga por defecto **~400 mm³ por cambio de filamento** (≈ 2–5 g y 30–60 s). En modelos con muchas transiciones la torre de purga se lleva **20–40% del filamento total**. Un llavero de 50 mm × 3 mm pesa ~4–6 g; con 4 colores a ras y 3 capas de color puede haber **9–12 cambios**, o sea **20–50 g de purga para 5 g de pieza**. Para un negocio de llaveros impresos (fase 3 del doc 02) esto **es el costo dominante**, no el filamento de la pieza. Mitigación obligatoria: llenar la placa, ordenar claro→oscuro, y ofrecer un modo "2 colores" bien visible.

### 6.7 Validaciones automáticas antes de exportar (DRC)

Además de las del doc 01 §3.4 (que son correctas), agregar:

- [ ] Todas las alturas (`z`, `altura`, `z+altura`) son **múltiplos exactos** de la altura de capa.
- [ ] `nº de colores ≤ slots configurados`.
- [ ] El anillo alrededor del agujero mide **≥ 2.0 mm** en todas las direcciones.
- [ ] Cada pieza de color **apoya** sobre algo (no flota) — obligatorio en modo apilado.
- [ ] Las mallas por color son **disjuntas** (`intersect()` de a pares → volumen 0).
- [ ] Ninguna malla tiene volumen ≤ 0 ni queda vacía tras las booleanas.
- [ ] El orden de `piezas` coincide con el orden de `filament_colour`.

---

## 7. Matriz de pruebas obligatoria (esto no es opcional)

Como el formato es propietario y cambia entre versiones, hace falta un procedimiento fijo. **Automatizable en CI**:

1. **Golden files**: 3 diseños fijos (logo 2 colores, dibujo 4 colores con islas, texto + argolla) → generar los 3 perfiles → guardar hashes de los XML/JSON.
2. **Re-import en CI**: `3MFLoader` de three (geometría) + `@lib3mf-rs/lib3mf-wasm` o `parse3mf` (validez del core y de los colores).
3. **Tests de invariantes**: `extruder` = índice + 1 · `firstid/lastid` contiguos y sin huecos · todos los `objectid` referenciados existen · el ZIP no tiene carpeta raíz.
4. **Prueba manual por versión** (la que no se puede automatizar), con checklist: ¿aparece algún diálogo? ¿los colores quedan asignados solos? ¿el preview de rebanado muestra los colores correctos? ¿se pisaron los presets del usuario?

| Slicer | Versiones a probar | Frecuencia |
|---|---|---|
| Bambu Studio | la última **y** una 2.4.x (por el issue #9666) | en cada release mayor |
| OrcaSlicer | la última estable | en cada release mayor |
| PrusaSlicer | la última **y** la anterior (por la reestructuración 2026) | en cada release mayor |

Y una **página pública de compatibilidad** ("probado con Bambu Studio X.Y, Orca A.B, PrusaSlicer C.D") — es barato, da confianza y sirve de soporte.

---

## 8. Correcciones a la investigación previa

### Doc 01 — `01-stack-tecnologico.md`

| # | Dónde | Qué dice | Corrección | Gravedad |
|---|---|---|---|---|
| **C1** | §3.2, snippet XML del perfil Bambu | Usa `<basematerials>` con `displaycolor` y `pid`/`pindex` apuntando ahí | **Incorrecto.** `bbs_3mf.cpp` no contiene ni una sola referencia a `basematerials` ni a `displaycolor`. Ese XML no le daría color a nada. La ruta estándar de Bambu es `<m:colorgroup>` (Materials Extension); la ruta que hay que usar es `model_settings.config` | 🔴 **Alta** |
| **C2** | §3.1 y §3.2, perfil "3MF genérico" | *"objetos separados con `basematerials` y `displaycolor`, solo spec core (Cura y otros)"* | **Inútil para los 3 slicers objetivo.** Ninguno lo lee. Degradar a "decorativo/opcional", no a perfil de primera clase | 🔴 **Alta** |
| **C3** | §3.2, toda la sección | No menciona el metadato `Application` | **Falta el dato decisivo.** `<metadata name="Application">BambuStudio-…</metadata>` es lo que hace que Bambu/Orca traten el archivo como propio, salteen el diálogo de color roto de 2.5 y respeten `model_settings.config`. Sin eso, sale *"the 3mf is not from Bambu Lab, load geometry data only"* | 🔴 **Alta** |
| **C4** | §2.6, `three-3mf-exporter` | *"Exporta escenas three a 3MF **con `model_settings.config`, extrusor por parte y `filament_colour`**"* | **Correcto**, verificado en el bundle. Pero **faltan las limitaciones**: no escribe ningún color en `3dmodel.model`, no soporta Prusa, no escribe el XML de cambios por capa, declara `requiredextensions="p"` de forma inválida, y arrastra `jszip` | 🟡 Media |
| **C5** | §2.6, `@jscadui/3mf-export` | *"MVP sin colores ni materiales"* | **Confirmado** (grep del bundle: cero `material`/`color`). Bien evaluado | ✅ OK |
| **C6** | §3.2, hallazgo sobre Bambu 2.5 y orden vs hex | *"Asigna los grupos de color a los slots del AMS por orden, no por valor hex"* | **Confirmado en el código** (`bbs_3mf.cpp:2156-2174`). Bien investigado | ✅ OK |
| **C7** | §3.2, perfil PrusaSlicer | *"un único objeto malla con triángulos concatenados por color + `Slic3r_PE_model.config` con `volume firstid/lastid` y extrusor"* | **Correcto y confirmado** en `3mf_legacy.cpp`. Agrego el XML exacto en §1.3 | ✅ OK |
| **C8** | §3.2, reestructuración de PrusaSlicer | *"PrusaSlicer está reestructurando su código 3MF en 2026"* | **Confirmado**: `src/libslic3r/Format/3mf.cpp` ya no existe; el legacy sigue vivo. Buen hallazgo | ✅ OK |
| **C9** | §3.1, tabla de formatos | *"STL por color… el slicer pregunta si cargarlo como un objeto con varias partes (**verificar**)"* | **Verificado: es correcto** en Bambu Studio, OrcaSlicer y PrusaSlicer | ✅ OK |
| **C10** | §3.3 | Espesor de base 2.0–3.0 mm, total 3.0–4.5 mm | **Muy por encima de la competencia**: MakerWorld usa 1.0 + 0.5 = 1.5 mm; MakerTools3D sugiere 0.8–1.2 mm de piel. Mantener 3.0 mm como default pero **agregar preset delgado** | 🟡 Media |
| **C11** | §1.2, paso 1 | Resolución de trabajo 0.08–0.12 mm/px | **Innecesariamente fina** para boquilla 0.4: 4–9× más píxeles sin detalle imprimible extra. Recomiendo **0.20 mm/px** (MakerTools3D: 0.15–0.25) | 🟡 Media |
| **C12** | §3.3 y §3.4 | No cuantifica la purga | **Falta**: ~400 mm³ por cambio, 2–5 g, 20–40% del filamento en la torre. Para un llavero de 5 g es el costo dominante | 🟡 Media |
| **C13** | §2.6 | Lista solo `three-3mf-exporter`, `@jscadui/3mf-export`, `@jscad/*` y lib3mf | **Faltan** paquetes nuevos y relevantes: `bambu-3mf` 0.1.0 (MIT, **solo dep `fflate`**, multicolor + modificadores), `threejs-exporter-pc`, y para validar en CI **`@lib3mf-rs/lib3mf-wasm` 0.4.0 (BSD-2)** y `parse3mf` 1.1.0 (MIT, sin deps) | 🟢 Baja |
| **C14** | §2.6, lib3mf | *"nombre exacto del paquete npm (no verificado)"* | **Sigue sin verificarse** que exista un npm oficial del consorcio. Sí existe `@lib3mf-rs/lib3mf-wasm` (bindings de terceros, BSD-2) | 🟢 Baja |
| **C15** | §7, riesgo #3 | Lo califica de impacto **Alto** | **Confirmado, y es el riesgo #1 del proyecto.** Debería tener presupuesto de tiempo explícito (matriz de pruebas §7) y no depender de una sola persona para probarlo | 🟡 Media |

### Doc 02 — `02-costos-servicios.md`

| # | Dónde | Qué dice | Corrección | Gravedad |
|---|---|---|---|---|
| **C16** | §1, fila del 3MF | *"Extruir capas y exportar 3MF/STL — three.js + ZIP en JS — $0"* | **Optimista en esfuerzo, no en plata.** El costo es $0 pero el **trabajo** es un escritor propio de 3 perfiles + matriz de pruebas manual recurrente por cada versión de slicer. Es el ítem de mayor riesgo de cronograma del proyecto | 🟡 Media |
| **C17** | §8 (competencia) | MakerTools3D descrito como *"competidor directo casi idéntico al MVP"* | **Confirmado y agravado**: soporta AMS, AMS Lite, AMS 2 Pro, IFS, CFS, ACE, CANVAS, SnapSwap y Prusa XL multi-toolhead, gratis y sin cuenta. Refuerza la conclusión del doc 02: **no se puede cobrar por convertir**; el valor diferencial tiene que estar en el **editor** y en **vender el llavero impreso** | ✅ OK, reforzado |
| **C18** | §7, riesgo legal | Términos de uso y moderación | **Correcto**, sin cambios | ✅ OK |

---

## 9. Resumen accionable para el MVP

1. **Escritor propio con `fflate`**, no librería de terceros. Leer `three-3mf-exporter` (MIT) y `bambu-3mf` (MIT) como referencia, **sin copiar** el `requiredextensions="p"`.
2. **Perfil A (Bambu/Orca) primero.** Es el 80% del mercado objetivo y el que mejor funciona. Escribir `Application = BambuStudio-02.05.00.00`.
3. **Perfil B (Prusa) después**, en la misma fase del MVP o inmediatamente después — es el que más código propio requiere.
4. **STL por color desde el día 1** como red de seguridad, dentro del mismo ZIP.
5. **Modo apilado / M600** en fase 2: abre el mercado de impresoras de un extrusor, que es grande en Latinoamérica.
6. **Nunca pintado por caras.**
7. **Golden files + re-import en CI + matriz manual por versión.** Sin esto, el producto se rompe solo cuando sale un slicer nuevo.
8. Presupuestar la purga en la UI: un aviso de "esto va a usar ~X g de filamento, de los cuales ~Y g son purga" es un diferencial honesto que ningún competidor muestra.

---

## 10. Fuentes

**Código fuente (leído directamente, ramas `master`/`main` al 2026-09-11)**
- Bambu Studio — [`src/libslic3r/Format/bbs_3mf.cpp`](https://github.com/bambulab/BambuStudio/blob/master/src/libslic3r/Format/bbs_3mf.cpp) · [`src/libslic3r/CustomGCode.hpp`](https://github.com/bambulab/BambuStudio/blob/master/src/libslic3r/CustomGCode.hpp)
- OrcaSlicer — [`src/libslic3r/Format/bbs_3mf.cpp`](https://github.com/SoftFever/OrcaSlicer/blob/main/src/libslic3r/Format/bbs_3mf.cpp)
- PrusaSlicer — [`Biz/Config/Legacy/3mf_legacy.cpp`](https://github.com/prusa3d/PrusaSlicer/blob/master/src/slic3r-shared/src/Slic3r/Biz/Config/Legacy/3mf_legacy.cpp) · [`Biz/Format/3mf.cpp`](https://github.com/prusa3d/PrusaSlicer/blob/master/src/slic3r-shared/src/Slic3r/Biz/Format/3mf.cpp)

**Bundles npm inspeccionados vía jsDelivr**
- `three-3mf-exporter@45.2.0/dist/index.mjs` · `@jscadui/3mf-export@0.5.0/esm/index.js`
- Metadatos y descargas: `registry.npmjs.org` y `api.npmjs.org` (2026-09-11)

**Especificaciones**
- [3MF Core Specification](https://github.com/3MFConsortium/spec_core/blob/master/3MF%20Core%20Specification.md) · [3MF Materials & Properties Extension](https://github.com/3MFConsortium/spec_materials/blob/master/3MF%20Materials%20Extension.md)

**Documentación y comunidad**
- [Bambu Lab Wiki — Standard 3MF File Color Parsing](https://wiki.bambulab.com/en/bambu-studio/Standard-3MF-File-Color-Parsing) · [multi color printing](https://wiki.bambulab.com/en/software/bambu-studio/multi-color-printing) · [Reduce Waste during Filament Change](https://wiki.bambulab.com/en/software/bambu-studio/reduce-wasting-during-filament-change) · [split to objects/parts](https://wiki.bambulab.com/en/software/bambu-studio/split-to-objects-parts)
- Issues de Bambu Studio: [#9666 (color por objeto → color painting, abierta)](https://github.com/bambulab/BambuStudio/issues/9666) · [#7797 (importar sin pisar presets)](https://github.com/bambulab/BambuStudio/issues/7797) · [#11927 (geometry-only 3MF)](https://github.com/bambulab/BambuStudio/issues/11927) · [#3057](https://github.com/bambulab/BambuStudio/issues/3057)
- [Printago — 3MF File Format: How Bambu Studio and Orca Slicer Structure Your Prints](https://printago.io/blog/3mf-file-format)
- [DeepWiki — OrcaSlicer 3MF Project Format](https://deepwiki.com/SoftFever/OrcaSlicer/7.1-3mf-project-format) · [OrcaSlicer Wiki — Import and Export](https://www.orcaslicer.com/wiki/general_settings/import_export)
- [ModelRift — How we added multicolor 3MF export](https://modelrift.com/blog/multicolor-3mf-export/) · [Layerpaint — Bambu Studio Standard 3MF color parsing](https://layerpaint.app/blog/bambu-studio-standard-3mf-color-parsing-fix)
- [Prusa KB — Importing Multi Material model](https://help.prusa3d.com/article/importing-multi-material-model_121191) · [Multi material painting](https://help.prusa3d.com/article/multi-material-painting_262620)
- [Ghostkeeper/Blender3mfFormat PR #58 (colorgroup + Production Extension)](https://github.com/Ghostkeeper/Blender3mfFormat/pull/58/files) · [Anson Liu — Blender Color Groups for Printables](https://ansonliu.com/2023/12/adding-blender-color-groups-support-for-printables/)

**Reglas de impresión**
- [JLC3DP — 3D Printing Design Guidelines](https://jlc3dp.com/help/article/3d-printing-design-guideline) (relieve/grabado ≥ 1.0 mm ancho y profundidad; pared mín. 1.6 mm para piezas de 50×50)
- [QIDI — Add hole to 3D model keychain](https://qidi3d.com/blogs/guides/add-hole-to-3d-model-keychain) · [Siraya Tech — 3D printed keychains](https://siraya.tech/blogs/news/3d-printed-keychain) · [JLC3DP — 3D printed keychains tips](https://jlc3dp.com/blog/3d-printed-keychains-tips)
- [Prusa — Everything about nozzles with a different diameter](https://blog.prusa3d.com/everything-about-nozzles-with-a-different-diameter_8344/)
- [Sovol — Reduce filament waste in multi-color printing](https://www.sovol3d.com/blogs/news/reduce-filament-waste-multi-color-3d-printing-9-practical-moves)

**Competencia (parámetros por defecto)**
- [MakerWorld MakerLab — Image to Keychain](https://makerworld.com/makerlab/imageToKeychain) · [Guía en Busy Momma's Nook](https://www.busymommasnook.com/post/how-to-make-a-3d-printed-keychain-from-an-image-using-makerworld-s-makerlab)
- [MakerTools3D — Image to 3MF](https://makertools3d.com/image-to-3mf)
- [pgp00/beadrelief (MIT)](https://github.com/pgp00/beadrelief) · [SamiSalah221/3mf-to-glb (MIT)](https://github.com/SamiSalah221/3mf-to-glb)
