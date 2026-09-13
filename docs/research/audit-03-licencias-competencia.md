# 03 · Auditoría: licencias, competencia y riesgo legal

> **Rol:** auditor técnico externo. No repito la investigación de los docs 01 y 02: la **verifico, corrijo y completo**.
> **Fecha de verificación:** 2026-09-11. Todo lo de esta auditoría se re-consultó hoy contra la fuente original.
> **Marcas:** **[V]** verificado hoy contra la fuente primaria (registro npm, API de GitHub, sitio oficial) · **[FS]** fuente secundaria (blog, foro, buscador) · **(no verificado)** no lo pude confirmar.
> **Aclaración:** esto es análisis técnico y de negocio, **no es asesoramiento legal**. Antes de vender impresiones conviene una consulta con un abogado de propiedad intelectual.

---

## Índice

0. [Veredictos en una página](#0-veredictos-en-una-página)
1. [Licencias: lista blanca y lista negra definitivas](#1-licencias-lista-blanca-y-lista-negra-definitivas)
2. [Competencia real](#2-competencia-real)
3. [Diferenciación: qué sirve y qué no](#3-diferenciación-qué-sirve-y-qué-no)
4. [Riesgo de contenido con copyright](#4-riesgo-de-contenido-con-copyright)
5. [El mínimo legal necesario, por fase](#5-el-mínimo-legal-necesario-por-fase)
6. [Correcciones a la investigación previa](#6-correcciones-a-la-investigación-previa)
7. [Fuentes](#7-fuentes)

---

## 0. Veredictos en una página

| Tema | Veredicto |
|---|---|
| **Licencias del stack del doc 01** | **Aprobado sin cambios.** Verifiqué 22 paquetes hoy: todos los del núcleo recomendado son MIT / ISC / BSD-2 / Apache-2.0 / BSL-1.0. No hay una sola trampa copyleft en la ruta recomendada. |
| **Riesgo copyleft residual** | Bajo, pero **hay un agujero operativo**: `@imgly/background-removal` declara en npm `"SEE LICENSE IN LICENSE.md"`, **no** "AGPL-3.0". Un `license-checker` automático **no lo va a marcar**. Hace falta lista negra por nombre de paquete, no solo por campo de licencia. |
| **Diferenciación vs. lo gratis** | La conversión imagen→llavero multicolor **ya es gratis en al menos ocho herramientas**. Competir por "convertir" es perder. El hueco real está en (1) **impresoras de un solo extrusor**, (2) **edición post-conversión**, (3) **producción en lote para quien vende**. |
| **Los 3 diferenciadores elegidos** | 1) Modo **cambio manual de filamento** bien resuelto y gratis. 2) **Editor 2.5D post-conversión** (nadie lo tiene). 3) **Modo lote/packs** para quien vende llaveros. |
| **Privacidad como diferenciador** | **Degradado a argumento de apoyo.** Ya hay al menos dos competidores que dicen procesar en el navegador sin subir nada. Sigue siendo cierto y gratis de comunicar, pero no es un foso. |
| **"Listo para AMS" como diferenciador** | **Descartado.** Es requisito de entrada: lo hacen MakerWorld, MakerTools3D, Layerpaint, Mesh Minter, Meshcast y 3DModelTools. |
| **Riesgo legal fase MVP** | **Muy bajo.** Si todo corre en el navegador y no se aloja nada, no hay contenido de usuario que moderar ni agente DMCA que registrar. |
| **Riesgo legal fase tienda** | **Alto y de otra naturaleza.** Al imprimir y vender pasás de intermediario a **fabricante**: no hay safe harbor que te cubra, y el DMCA **no cubre marcas ni patentes**. |

---

## 1. Licencias: lista blanca y lista negra definitivas

### 1.1 Lista blanca (seguras para producto comercial de código cerrado)

Verificado hoy en `registry.npmjs.org/<paquete>/latest` (campo `license`) y en la API de GitHub (`/repos/<owner>/<repo>/license`).

| Paquete / proyecto | Licencia **[V]** | Versión verificada | Obligación práctica |
|---|---|---|---|
| `three` | **MIT** | 0.186.0 | Conservar aviso de copyright |
| `manifold-3d` | **Apache-2.0** | 3.5.3 | Aviso + archivo NOTICE si existe + mención de cambios si lo modificás |
| `opentype.js` | **MIT** | 2.0.0 | Aviso |
| `earcut` | **ISC** | 3.2.3 | Aviso |
| `fflate` | **MIT** | 0.8.3 | Aviso |
| `d3-contour` | **ISC** | 4.0.2 | Aviso |
| `simplify-js` | **BSD-2-Clause** | 1.2.4 | Aviso |
| `image-q` | **MIT** | 4.0.0 | Aviso |
| `culori` | **MIT** | 4.0.2 | Aviso |
| `@techstark/opencv-js` | **Apache-2.0** | 5.0.0-release.1 | Aviso + NOTICE |
| OpenCV (upstream, rama actual) | **Apache-2.0** | repo `opencv/opencv` | Confirma que OpenCV 5 sigue Apache-2.0 |
| `clipper2-ts` | **BSL-1.0** (Boost) | 2.0.1-18 | **Sin obligación en distribución binaria.** La más cómoda de todas |
| `@visioncortex/vtracer` | **MIT OR Apache-2.0** (npm) / **MIT** (LICENSE del repo) | 1.0.0-alpha.4 | Elegir MIT y guardar el texto del repo |
| `imagetracerjs` | **Unlicense** (dominio público) | 1.2.6 | Ninguna |
| `three-3mf-exporter` | **MIT** | 45.2.0 | Aviso |
| `@jscadui/3mf-export` | **MIT** | 0.5.0 | Aviso |
| `lib3mf` (3MF Consortium) | **BSD-2-Clause** | repo oficial | Aviso (solo se usa en CI, no se distribuye) |
| `jszip` | **MIT OR GPL-3.0-or-later** | 3.10.2 | **Elegir MIT explícitamente** y dejarlo escrito en el registro de licencias |

Complementos ya conocidos y confirmados por el doc 01, sin novedades: `ml-kmeans` (MIT), `zustand`, `zundo`, `immer`, `react`, `vite`, `tailwindcss`, `@react-three/fiber`, `@react-three/drei`, `three-mesh-bvh`, `three-bvh-csg` (todos MIT), `comlink` (Apache-2.0), `wrangler` (MIT OR Apache-2.0).

**Regla de oro para este proyecto:** todo lo que se sirve al navegador es **distribución**. MIT, ISC, BSD-2, Apache-2.0, BSL-1.0 y Unlicense se distribuyen sin contaminar. Lo único que hay que hacer es mantener un `LICENSES.txt` (o una página `/licencias`) con los avisos de copyright, generado en el build. Es una línea de script, no un trámite.

### 1.2 Lista negra (nunca, ni una línea copiada)

| Paquete / proyecto | Licencia **[V]** | Por qué es fatal acá |
|---|---|---|
| `esm-potrace-wasm` | **GPL-2.0** | Servir el bundle al navegador **es distribuir**: toda la obra combinada quedaría bajo GPL |
| `potrace` (npm) | **GPL-2.0** | Igual que arriba. Ojo: `bekuto3d` es MIT pero **depende de potrace** |
| `marchingsquares` (npm) | **AGPL-3.0** | Trampa clásica: `d3-contour` (ISC) hace lo mismo |
| `@imgly/background-removal` | **AGPL-3.0** (en `LICENSE.md`; npm declara `"SEE LICENSE IN LICENSE.md"`) | AGPL + SaaS = el peor caso. Ver 1.4 |
| Kromacut (`vycdev/Kromacut`) | **AGPL-3.0** | Solo mirar la UX. No copiar código ni archivos de datos |
| Chili3D (`xiangechen/chili3d`) | **AGPL-3.0** | Idem |
| `openscad-wasm` / OpenSCAD Playground | **GPL** | Idem |
| `three.cad` | **GPL-3.0** | Idem |
| AutoForge (`hvoss-tech/AutoForge`) | **Sin licencia** — la API de GitHub devuelve **404** en `/license` **[V]** | Peor que GPL: sin licencia = **todos los derechos reservados**. No se puede copiar ni un snippet, ni siquiera para un proyecto abierto |
| Modelo RMBG-1.4 (BRIA) | No comercial | Aunque el runtime sea MIT, el **modelo** te bloquea |

### 1.3 Zona gris (permisivas, pero con asterisco)

| Caso | Asterisco |
|---|---|
| `imagetracerjs` (Unlicense) | La licencia es impecable, aunque algunos departamentos legales corporativos rechazan Unlicense por falta de renuncia de garantía explícita. Irrelevante para un proyecto propio. **El problema real es técnico:** sin mantenimiento desde 2020 y sin control de ancho mínimo, islas ni prioridad de color. Ver corrección C-2 |
| `@visioncortex/vtracer` | Licencia OK, pero el paquete npm se compila con `--target nodejs` (`engines: node >=16`, sin campo `browser`) **[V]**. Usarlo en el navegador exige compilar el crate de Rust vos mismo |
| `jszip` | Dual MIT/GPL-3.0. Elegir MIT es válido, pero **dejalo documentado**: si no elegís, el ambiguo sos vos |
| Apache-2.0 (`manifold-3d`, OpenCV, `comlink`) | Trae **cláusula de patentes** (a favor tuyo) y obliga a propagar el `NOTICE`. No contamina, pero sí obliga a un archivo de avisos |
| Fuentes OFL 1.1 (Google Fonts) | Permite **empaquetar, embeber, redistribuir y vender** la fuente junto con software **[FS]**. Dos condiciones: no vender la fuente sola, y no usar los *Reserved Font Names* en derivados. Convertir glifos a contornos y extruirlos **no** contamina el modelo resultante |
| Datos de paletas de filamento | Los colores no son obra protegible, pero **una base de datos compilada sí puede tener derecho sui generis en la UE** y los nombres son **marcas**. Ver 1.5 |

### 1.4 El agujero operativo que hay que tapar

`@imgly/background-removal` es **AGPL-3.0** (verificado leyendo su `LICENSE.md` hoy), pero el campo `license` de su `package.json` dice literalmente `"SEE LICENSE IN LICENSE.md"` **[V]**.

Consecuencia: `license-checker` y similares lo van a reportar como `Custom` o `UNKNOWN`, **no** como copyleft. Si el CI solo tiene una lista blanca de identificadores SPDX, este paquete pasa el filtro.

Reglas concretas para el CI (`pnpm licenses list --json` + script propio):

1. **Lista blanca de SPDX**: `MIT`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `BSL-1.0`, `0BSD`, `Unlicense`, `CC0-1.0`, `MIT OR Apache-2.0`, `(MIT OR GPL-3.0-or-later)`.
2. **Lista negra explícita por nombre de paquete** (además del SPDX): `@imgly/*`, `potrace`, `esm-potrace-wasm`, `marchingsquares`, `openscad-wasm`.
3. **Cualquier licencia que no sea un SPDX conocido** (`UNKNOWN`, `Custom`, `SEE LICENSE IN…`) **rompe el build** y se revisa a mano.
4. Correr el chequeo sobre **dependencias transitivas**, no solo directas.
5. Generar `dist/LICENSES.txt` en cada build y publicarlo en una ruta `/licencias`.

### 1.5 Paletas de filamento: cómo hacerlo sin problemas

`filamentcolors.xyz` indexa **3.396 filamentos de 243 fabricantes**, medidos con colorímetro, y publica bajo **Creative Commons Attribution 4.0**, con el código fuente en GitHub **[V]**.

- **Se puede usar comercialmente** con atribución visible ("Datos de color por filamentcolors.xyz, CC BY 4.0") y enlace.
- **No** hace falta liberar tu código: CC BY no es copyleft de software.
- Los nombres de marca (`Bambu PLA Basic`, `Prusament`, `Sunlu`) son **marcas registradas**: uso descriptivo o nominativo únicamente ("compatible con", "equivalente a"), sin logos, sin sugerir aval ni asociación, y **nunca** en el nombre del producto ni del dominio.
- Lo mismo aplica a "AMS", "Bambu Lab", "Prusa", "MMU", "Tinkercad": son marcas de terceros. "Editor estilo Tinkercad" sirve como descripción interna; **no** conviene como eslogan público.

---

## 2. Competencia real

El panorama es **peor** de lo que dice el doc 02: no son dos competidores, son al menos ocho relevantes, y aparecieron tres que ninguno de los dos documentos menciona (**Layerpaint**, **PrintPal**, **3d-editor.com**). También hay ahora precios verificados de Mesh Minter, que es la mejor referencia de monetización del rubro.

### 2.1 Tabla de competencia

| Herramienta | Qué hace | Dónde procesa | Precio | **Qué le falta** |
|---|---|---|---|---|
| **MakerWorld MakerLab · Image to Keychain** (Bambu Lab) | Imagen→llavero/señalador multicolor. Controles: mantener fondo, redimensionar, espesor, respaldo, **gancho o agujero**. Exporta 3MF. Recomienda ≤4 colores **[FS]** | Servidor; cuenta obligatoria **[FS]** | Gratis con cuenta MakerWorld | **Cuenta obligatoria y moderación de contenido**: hay usuarios que buscan alternativas offline por miedo a que el moderador rechace su arte **[FS]**. Sin editor libre: solo sliders. Errores recurrentes de malla no-manifold, delaminación en doble cara y "la imagen se imprime en todas las capas" **[FS]**. Sin modo cambio manual |
| **MakerTools3D · Image to 3MF / Image to Keychain** | PNG/JPG (hasta 25 MB) → 3MF multicolor. Paleta automática con colores fijables, ancho final, espesor total, profundidad de "skin", mm/px, modo relieve o plano, "unified core". Soporta AMS, CFS, IFS, ACE y Prusa XL **[V]** | **Servidor.** Su política dice: *"Uploaded images are processed temporarily for the current request; MakerTools3D does not store user uploads…on the server"* **[V]** | Gratis, sin cuenta. Monetiza con **publicidad y analytics** (su política nombra socios publicitarios) **[V]** | **Cero edición**: no hay mover, rotar, escalar, texto ni formas **[V]**. El agujero de la argolla depende de que vos dejes transparencia en el PNG. Solo inglés. Sin modo cambio manual. Sin guardado de proyecto |
| **Layerpaint** *(no figura en 01 ni 02 como competidor)* | "Filament painter" en navegador: describís o soltás una foto, arma el modelo y lo pintás con IA o con pincel. Exporta **3MF estándar** que mapea colores a slots en Bambu Studio, Orca y **PrusaSlicer** **[V]** | Navegador; el pincel es *"fully on-device… nothing uploads"* **[V]** | Primer export gratis; packs **US$6,97 / 10 modelos** o **US$39,97 ilimitado** (pago único); créditos de IA aparte (US$5,97–44,97) **[V]** | Está orientado a *pintar* modelos, no a **generar el llavero** (silueta, borde, argolla, validaciones de imprimibilidad). Usa IA. Sin editor paramétrico 2.5D. Sin español |
| **Mesh Minter** | 21 "studios" en navegador, incluido **Keychain Studio** con "aro dimensionado para una argolla real". 3MF multicolor con cada color ya en su slot **[V]** | Navegador **[V]** | **Free**: todos los studios, 1 proyecto guardado, 1 export premium, **marca "MM" grabada abajo**, uso personal. **Maker US$10/mes**: 100 exports, sin marca, 30 proyectos, sigue siendo uso personal. **Merchant US$30/mes**: derechos comerciales para vender prints **y archivos**, 50 proyectos; lo licenciado mientras el plan está activo queda licenciado de por vida **[V]** | **La marca de agua física y el "uso personal" en los dos planes de abajo** empujan al plan de US$30. Editor por studio, no un lienzo libre. Sin español. Sin modo cambio manual documentado |
| **ImageToStl.com** | Imagen→STL/OBJ/3MF por heightmap o extrusión, con color; **"Keyring Loop"** como extra; quitar fondo por tolerancia; bordes flat/fillet/chamfer **[V]** | **Servidor.** *"All our conversion tools process your PNG file on our dedicated conversion servers"*. Archivos guardados 4 h (opcional 24 h) **[V]** | Gratis con anuncios; con bloqueador de anuncios **limita conversiones y esconde opciones** **[V]** | Máximo 1200×1200 px **[V]**. Multicolor por textura, no por partes limpias por color. Sin editor. Sube tu imagen a un servidor de terceros |
| **HueForge** (escritorio) | "Filament painting" por capas. Referencia de calidad del rubro | Escritorio | **Software US$24 (oferta) / US$30 regular** **[V]**. **La exportación 3MF es un plugin aparte de US$20** (Additive Atom), que agrega *Height Range Modifiers* y **pausas automáticas cuando los colores superan los slots físicos** del perfil de impresora **[V/FS]**. Licencias: Personal (no vender nada), Limited Commercial anual (vender prints, no archivos), Professional anual (prints + archivos), Lifetime Professional. Las anuales **revierten a Personal si no renovás** **[V]**. Precios exactos de las comerciales: la tienda no los publica **(no verificado)** | Escritorio | No es web, no es gratis, no genera **la geometría del llavero** (silueta, borde, argolla). Cobra aparte por exportar a 3MF. Sin español |
| **3d-editor.com · Keychain Generator** *(no figura en 01 ni 02)* | Imagen→llavero de placa con relieve. Formas: rectángulo redondeado o redondo. Ancho (35 mm por defecto), espesor de placa y de relieve, agujero fijo de **4 mm** con mínimo 1,5 mm de material alrededor **[V]** | **Navegador.** *"The image is traced in your browser, never uploaded"* **[V]** | **Gratis, sin cuenta, sin marca de agua** **[V]** | **Solo 2 colores**, y por inserción de capa a 3 mm (cambio manual), no AMS. Exporta **STL y SVG, no 3MF** **[V]**. Sin editor. Sin texto propio: hay que traerlo ya renderizado como PNG |
| **Meshcast · Keychain** *(no figura en 01 ni 02)* | Texto o **SVG** → chapa con texto. 12+ fuentes, tamaño, profundidad de relieve, forma, borde, radio, espesor, redondeo de canto, agujero. **Arrastrás el texto o el agujero sobre el preview** **[V]** | Web (el preview 3D lo renderiza el servidor) **[V]** | Gratis aparente **[V]** | No acepta imágenes raster. **Dos colores** (chapa + texto). Sin capas ni alturas por color |
| **3DModelTools · Keychain** | Texto (máx. 20 caracteres) → 3MF multicolor con borde y texto en colores distintos **[V]** | No declarado **[V]** | Gratis; login opcional **[V]** | No acepta imágenes. Dos colores. Paramétrico muy básico |
| **Obloid · Keychain & Pet Tag** | Texto → chapa (rect. redondeado, círculo, hueso, corazón), fuentes incl. **TTF propio**, texto en relieve (+1,2 mm) o grabado (−1,2 mm), espesor, Ø del agujero. Exporta **3MF Bambu/Orca de dos colores**, 3MF genérico y STL **[V]** | Navegador ("Loading the geometry engine") **[V]** | **3 exports gratis**, después hay que iniciar sesión **[V]** | No acepta imágenes. Dos colores. Sin capas por altura |
| **3dkeychain.net** | Llaveros de texto, **SVG**, QR, laberinto, código de Spotify, forma de onda de audio, iconos Material. Google Fonts + fuente propia. STL y 3MF **[V]** | Nube **[V]** | Cuenta para el panel y guardar; precio no publicado **[V]** | **No convierte imágenes raster a multicolor** **[V]**. El multicolor no aparece documentado. Sin editor libre |
| **PrintPal** *(no figura en 01 ni 02)* | Generador 3D con **IA** (texto o imagen→STL/OBJ/GLB en <60 s) + herramienta **Filament Painter** para multicolor **[V]** | Servidor (IA) | **Free**: 10 generaciones/mes, **solo uso personal**. **Pro US$10/mes** (200 gen., derechos comerciales). **Studio US$25/mes** (500 gen.) **[V]** | Es IA: no determinista, no controla espesores mínimos ni geometría imprimible. El plan gratis **prohíbe uso comercial**. Sin editor paramétrico |

### 2.2 Lectura de la tabla

1. **"Convertir imagen a 3MF multicolor" es commodity.** Cuatro herramientas lo hacen gratis y sin cuenta. Cobrarlo es inviable.
2. **Todas cortan en el mismo lugar: después de convertir no se puede tocar nada.** Ninguna de las once ofrece un lienzo donde mover, rotar, escalar, sumar texto, sumar formas, cambiar la altura de una capa y deshacer. El mejor caso es "arrastrar el texto o el agujero" (Meshcast) o un studio con sliders (Mesh Minter). **Ese hueco es real y es grande.**
3. **El mercado del extrusor único está desatendido y validado en precio.** El único que resuelve bien "tengo más colores que slots, ponéme pausas" es HueForge, y **cobra US$20 aparte** por el plugin que lo hace. MakerWorld y MakerTools3D apuntan a AMS. Es el hueco con mejor relación valor/esfuerzo, porque el doc 01 ya lo tiene diseñado (modo apilado + `custom_gcode_per_layer.xml`).
4. **La privacidad ya no es tuya sola.** 3d-editor.com dice explícitamente "se traza en tu navegador, nunca se sube" y Layerpaint dice "fully on-device, nothing uploads". Sigue sirviendo contra MakerTools3D, ImageToStl y MakerWorld (los tres suben la foto), pero no es un foso.
5. **Referencia de precio del rubro:** US$10/mes para quitar marca de agua y US$30/mes para derechos comerciales (Mesh Minter); US$6,97 por 10 exports o US$39,97 de por vida (Layerpaint); US$4,99 pago único (Text3D Maker, según doc 02). El techo de este mercado son unos **US$10/mes o US$20–40 de pago único**.
6. **El español está libre.** MakerWorld sí tiene interfaz en español (inglés, chino, alemán, francés, italiano y español, con autotraducción) **[FS]**, pero MakerTools3D, Layerpaint, Mesh Minter, ImageToStl, Meshcast, Obloid y 3d-editor.com son solo inglés. Y las guías en español que se rankean hoy siguen enseñando el camino largo: "convertí a SVG y armalo en Tinkercad o Fusion" **[FS]**.

---

## 3. Diferenciación: qué sirve y qué no

### 3.1 Evaluación de los siete candidatos

| Candidato | Valor | Esfuerzo | ¿Lo tiene alguien? | Veredicto |
|---|---|---|---|---|
| **Control fino de capas/alturas + cambio manual de filamento** | Muy alto | Medio (ya diseñado en doc 01 §1.3 modo apilado) | Solo HueForge, **pagando US$20 aparte** | **#1** |
| **Editor tipo Tinkercad post-conversión** | Muy alto | Alto | **Nadie** | **#2** |
| **Packs / lotes para vender** | Alto (es lo único por lo que alguien paga) | Medio | **Nadie** | **#3** |
| **Catálogo de paletas de filamento reales** | Medio-alto | **Bajo** (datos CC BY ya medidos) | MakerTools3D tiene paleta editable; nadie tiene filamentos reales de LatAm | **Potenciador, va con el #1** |
| **Plantillas de llavero (formas, bordes, argollas)** | Medio | Bajo | Parcial (formas en Obloid, Meshcast) | **Higiene de UX, no diferenciador** |
| **Multi-idioma español** | Medio | Muy bajo si se hace desde el día 1 | MakerWorld sí; el resto no | **Posicionamiento, no producto** |
| **Privacidad (todo local)** | Bajo-medio | Cero (ya es la arquitectura) | 3d-editor.com y Layerpaint también lo dicen | **Argumento de apoyo** |
| **Exportar listo para AMS** | — | — | **Todos** | **Requisito de entrada, no diferenciador** |

### 3.2 Los tres diferenciadores, ordenados por valor/esfuerzo

#### 1. "Funciona con tu impresora de un solo extrusor" — gratis, guiado y sin sorpresas

**Qué es:** el modo apilado del doc 01 §1.3, pero tratado como **producto**, no como opción escondida. La web pregunta primero "¿cuántos colores podés cargar a la vez?" y, si son menos que los colores del diseño, arma las franjas Z, inserta los cambios en `Metadata/custom_gcode_per_layer.xml` (Bambu/Orca) y `Prusa_Slicer_custom_gcode_per_print_z.xml` (Prusa), y además da una **lista imprimible**: "capa 7 (Z = 1,4 mm): cambiá a rojo". Más la validación de que ningún color quede flotando sin soporte.

**Por qué gana:** es el segmento más grande y peor atendido (la mayoría de las impresoras en Latinoamérica son de un extrusor), el competidor que lo resuelve **cobra US$20 por ese plugin específico**, y el trabajo técnico ya está especificado en el doc 01. Además es la diferencia entre "qué lindo, no lo puedo imprimir" y una descarga que funciona: convierte visitas en usuarios.

**Esfuerzo:** medio. Reusa el pipeline de franjas Z, `CrossSection` y el escritor 3MF que hay que escribir igual.

#### 2. El editor 2.5D post-conversión

**Qué es:** exactamente lo del doc 01 §4, acotado. Mover, rotar, escalar en XY; texto con fuentes OFL; formas básicas; agujero y argolla como piezas; color y altura por pieza; deshacer/rehacer; validación de ancho mínimo en vivo.

**Por qué gana:** es el único foso real. Las once herramientas relevadas cortan después de convertir. Es también lo que permite cobrar algo alguna vez (guardar proyectos, plantillas, fuentes) sin tener que cobrar por convertir.

**Por qué es el #2 y no el #1:** es el ítem de mayor riesgo de plazo de todo el proyecto (el propio doc 01 §7 lo marca como riesgo alto en plazos). El #1 entrega valor en una fracción del tiempo. **Recomendación de secuencia:** MVP = conversión sólida + modo cambio manual + edición mínima (mover/escalar la imagen, argolla, texto). El editor completo, después.

#### 3. Modo lote: "30 llaveros con 30 nombres en una placa"

**Qué es:** pegás una lista de nombres (o subís un CSV), elegís una plantilla ya validada y la web genera N llaveros con el nombre cambiado, los acomoda en la placa de tu impresora y exporta **un solo 3MF** con los colores asignados. Variante: el mismo diseño en 6 combinaciones de color.

**Por qué gana:** es el único punto donde hay **disposición real a pagar**, porque el que lo usa está vendiendo. Cubre el caso concreto del emprendedor de feria, del club, del jardín y del regalo empresarial. Nadie de los once lo ofrece. Y técnicamente es barato: reusa el documento JSON 2.5D (doc 01 §4.2) con sustitución de una pieza de texto más un empaquetado en la placa.

**Esfuerzo:** medio, y casi todo es interfaz, no geometría nueva.

### 3.3 Cómo se comunica (una sola frase para la home)

> "Convertí tu logo o dibujo en un llavero listo para imprimir, **aunque tengas una impresora de un solo color**. Editalo como quieras. Todo en tu navegador, sin cuenta y sin subir la foto."

Ahí adentro están el #1 (extrusor único), el #2 (editalo), la privacidad y "sin cuenta" — que es el punto débil concreto de MakerWorld, el competidor más fuerte.

---

## 4. Riesgo de contenido con copyright

### 4.1 El riesgo cambia por completo según la fase

| Fase | Qué hacés | Tu rol legal | Riesgo |
|---|---|---|---|
| **MVP** — todo en el navegador, sin cuentas, sin galería | Le das una herramienta al usuario. La imagen **nunca llega a tu servidor** | Proveedor de herramienta | **Muy bajo.** No alojás nada, no hay contenido que moderar, no hay nada que bajar. Análogo a un editor de imágenes de escritorio |
| **Fase 2** — cuentas, "mis diseños", compartir por link, galería | Alojás archivos y (si hay galería) los publicás | **Proveedor de alojamiento / plataforma en línea** | **Medio.** Acá sí aparecen notice & takedown, agente DMCA, reincidentes y, si hay usuarios en la UE, el art. 16 del DSA |
| **Fase 3** — imprimís y vendés el llavero | Fabricás y vendés un objeto físico | **Fabricante y vendedor** | **Alto.** No hay safe harbor que te cubra: la responsabilidad por infracción es **directa**, no de intermediario |

**El punto más importante de toda esta auditoría en materia legal:** el safe harbor del DMCA protege a quien **aloja** contenido de terceros. **No protege a quien imprime y vende.** Y además el DMCA **solo cubre copyright: no hay equivalente legal para marcas ni patentes** **[FS]**. O sea que ni un procedimiento DMCA impecable te salva de una carta documento de un titular de marca por vender un llavero con un escudo de fútbol.

### 4.2 Qué sube realmente la gente

Personajes (Disney, Pokémon, anime), escudos de clubes, logos de marcas y fotos de mascotas. Los tres primeros son infracción si se venden; el cuarto no tiene problema salvo que la foto sea de un fotógrafo profesional (la foto tiene su propio derecho de autor, distinto del de la mascota).

Hechos verificados que conviene tener presentes:

- Los **personajes individuales** tienen protección propia, separada de la obra en la que aparecen, y copiarlos con poca alteración no califica como uso legítimo ni siquiera con fin satírico **[FS]** (*Walt Disney Productions v. Air Pirates*).
- Las plataformas de modelos 3D **bajan modelos activamente** ante reclamos, con Disney entre las más agresivas **[FS]**.
- En el propio foro de Bambu Lab, la comunidad concluye lo mismo: podés usar MakerLab para vender **si la imagen es tuya**; los logos y el contenido protegido siguen prohibidos aunque el archivo lo hayas generado vos **[FS]**.
- Regla práctica que hay que dejar clarísima en la interfaz: **generar el archivo no te da ningún derecho sobre lo que está dibujado adentro**. HueForge lo dice con todas las letras en sus términos: *"A Commercial license cannot and does not give you the rights to use someone else's IP"* **[V]**.

### 4.3 Riesgo de marca por cómo te presentás

Separado del contenido del usuario: no uses "Bambu", "AMS", "Prusa" ni "Tinkercad", ni sus logos, en tu marca, dominio, favicon o títulos. Uso **nominativo** dentro del texto ("exporta un 3MF compatible con Bambu Studio y OrcaSlicer") es lo correcto y es lo que hacen todos los competidores.

---

## 5. El mínimo legal necesario, por fase

### Fase 0 — MVP (todo local, sin cuentas, sin ventas)

Esto es lo verdaderamente **mínimo**. Cinco cosas:

1. **Términos de uso.** Corto y en español. Tiene que decir: (a) el usuario declara que es titular de los derechos de la imagen o que tiene permiso; (b) el sitio se entrega "como está", sin garantías de imprimibilidad ni de resultado; (c) prohibido usarlo para contenido ilegal; (d) limitación de responsabilidad; (e) ley aplicable y jurisdicción.
2. **Política de privacidad.** Sí, hace falta **aunque la foto no se suba**: igual procesás IP, logs del CDN, analytics y guardás datos en `IndexedDB`/`localStorage`. Tiene que decir qué se guarda, dónde (navegador del usuario), por cuánto y quién es el responsable con domicilio de contacto. Si algún día hay usuarios en México, el aviso de privacidad debe cumplir la **nueva LFPDPPP publicada el 20-mar-2025 y vigente desde el 21-mar-2025** (autoridad: **Secretaría Anticorrupción y Buen Gobierno**, que reemplazó al INAI), que ahora exige enumerar los datos tratados, distinguir finalidades necesarias de voluntarias e identificar al responsable con domicilio **[FS]**.
3. **Cookies/analytics.** Usar **Cloudflare Web Analytics**, que no usa cookies ni datos personales, evita el banner de consentimiento. Si algún día metés Google Analytics o píxeles publicitarios, necesitás banner y base legal.
4. **Aviso de propiedad intelectual en el momento de subir la imagen** — no escondido en los términos, sino en el propio cargador: *"Subí solo imágenes propias o con permiso. Convertirlas no te da derechos sobre personajes, logos o marcas de terceros."* Esto vale más que diez páginas de términos, porque prueba que no inducís a infringir (la inducción sí genera responsabilidad, y para marcas y patentes también **[FS]**).
5. **No prometas de más.** Si decís "tu foto no se sube", **tiene que ser cierto siempre** (incluido el reporte de errores: configurá Sentry para no mandar la imagen ni nada derivado). En Argentina la publicidad obliga como parte del contrato (Ley 24.240, art. 8) y la información tiene que ser cierta y detallada (art. 4).

**Lo que NO hace falta en fase 0:** agente DMCA, mecanismo de notice & takedown, política de reincidentes, punto de contacto DSA, moderación. No alojás nada.

### Fase 2 — cuentas, diseños guardados, galería o links compartidos

Ahora sí alojás contenido de terceros:

6. **Agente DMCA registrado** en la US Copyright Office: **US$6 por designación**, hay que **publicar los datos del agente en un lugar accesible del sitio**, y **re-registrar cada 3 años** (cada enmienda o reenvío cuesta otros US$6 y cumple la renovación) **[FS]**. Es el trámite legal más barato y de mejor relación costo/beneficio de todo el proyecto: sin agente designado no hay safe harbor.
7. **Procedimiento de notificación y bajada** publicado: formulario o email, plazos, contranotificación y **política de infractores reincidentes** (es requisito legal del safe harbor, no un extra).
8. **Si hay usuarios en la UE:** mecanismo de notificación y acción del **art. 16 del DSA** (electrónico, fácil, con acuse de recibo y decisión motivada) y un punto de contacto. Micro y pequeñas empresas están exentas de la Sección 3 (obligaciones de plataformas en línea) pero **no del art. 16 en general** **[FS]**; como es apenas un formulario y un email, conviene tenerlo igual.
9. **Política de privacidad completa y acuerdos con encargados** (Supabase, Cloudflare), retención, borrado de cuenta y exportación de datos.
10. **Moderación mínima**: nada de revisar todo, pero sí un botón "reportar" y la facultad de bajar contenido.

### Fase 3 — vender impresiones

11. **Moderación humana antes de imprimir.** No es opcional: acá sos el fabricante. Lista negra de marcas y personajes, y derecho contractual explícito a rechazar o cancelar un pedido.
12. **Términos de venta con declaración de titularidad e indemnidad del cliente.** Útil para recuperar del cliente, pero **no te protege frente al titular del derecho**: a vos te pueden reclamar igual.
13. **Argentina, si vendés online:** **botón de arrepentimiento** obligatorio (Res. 424/2020 de la Secretaría de Comercio Interior): enlace directo, visible y destacado **en la página principal**, sin exigir registro ni trámite previo; 10 días corridos desde la recepción; hay que dar un **código de identificación de la revocación dentro de las 24 horas** por el mismo medio **[FS]**. Sumado a lo de siempre: datos del vendedor, precio final en pesos, plazos de entrega, garantía legal y libro de quejas.
14. **México, si vendés ahí:** aviso de privacidad conforme a la nueva LFPDPPP y las reglas de comercio electrónico de la LFPC.
15. **Consulta legal real** antes de la primera venta, y considerar la figura societaria/fiscal (monotributo, SRL) y el seguro.

### 5.1 Resumen de costo del "mínimo legal"

| Ítem | Fase | Costo |
|---|---|---|
| Términos de uso + política de privacidad | 0 | US$0 (redacción propia) a unos cientos de dólares con abogado |
| Aviso de IP en el cargador | 0 | US$0 |
| Analytics sin cookies | 0 | US$0 |
| Agente DMCA | 2 | **US$6**, más US$6 cada 3 años |
| Formulario de notificación y bajada + DSA art. 16 | 2 | US$0 (es un formulario y un email) |
| Moderación previa a imprimir | 3 | Tiempo propio |
| Consulta legal previa a vender | 3 | Variable |

**El mínimo legal del MVP cuesta US$0 y cabe en tres páginas.** El proyecto no tiene un problema legal hoy; lo va a tener el día que aloje o imprima.

---

## 6. Correcciones a la investigación previa

### 6.1 Correcciones al doc 01 (stack tecnológico)

**C-1 · `@imgly/background-removal`: la licencia es AGPL, pero npm no lo dice.**
El doc 01 §2.1 lo lista como "**AGPL-3.0**". El `LICENSE.md` del repo efectivamente es AGPL-3.0 **[V]**, pero el campo `license` del paquete publicado dice `"SEE LICENSE IN LICENSE.md"` **[V]**. El veredicto no cambia (evitarlo), pero la **mitigación del §7 riesgo 1 sí cambia**: una lista blanca de SPDX en CI no lo detecta. Ver 1.4 de este documento.

**C-2 · Contradicción no resuelta entre los dos documentos sobre `imagetracerjs`.**
El doc 01 §1.4 lo desaconseja ("poco control sobre ancho mínimo, islas y prioridad de colores", sin actualizaciones desde 2020). El doc 02 §5.1 y §6 lo recomiendan como vectorizador del stack "$0/mes" y §10.10 lo llama "alternativa segura". **Gana el doc 01**: la licencia es segura, pero como pieza de producción no sirve para este pipeline. El doc 02 confunde "licencia segura" con "técnicamente adecuado".

**C-3 · VTracer: licencia inconsistente en el propio proyecto.**
El doc 01 dice "MIT OR Apache-2.0", el doc 02 dice "MIT". Los dos tienen razón a medias: el **package.json de npm** declara `"MIT OR Apache-2.0"` y el **LICENSE del repo en GitHub** es **MIT** a secas **[V]**. Ambas permisivas, sin consecuencia práctica; pero en el registro de licencias hay que archivar el texto del LICENSE del repo, no el campo de npm. Se confirma además que el paquete npm se compila con `engines: node >=16` y sin campo `browser` **[V]**: la advertencia del doc 01 sobre que requiere build propio para el navegador queda **confirmada**.

**C-4 · AutoForge: confirmado que no tiene licencia, y es peor de lo que sugiere la tabla.**
`GET /repos/hvoss-tech/AutoForge/license` devuelve **404** **[V]**. El doc 01 lo marca "No reutilizar", correcto, pero conviene explicitar el motivo: sin licencia significa **todos los derechos reservados**, ni siquiera se puede copiar un fragmento para un proyecto abierto. Es una restricción más fuerte que la de GPL.

**C-5 · HueForge: falta el dato más importante del competidor.**
El doc 01 §8.1 dice que HueForge "exporta 3MF con cambios de filamento por capa". **La exportación 3MF no viene con el programa: es un plugin aparte de US$20** desarrollado por Additive Atom **[V/FS]**, que agrega Height Range Modifiers y **pausas automáticas cuando la cantidad de colores supera los slots físicos** del perfil de impresora, con soporte para Bambu Studio, Orca, PrusaSlicer, Creality, Anycubic, Elegoo, QIDI, FlashForge y otros **[FS]**. Esto es doblemente relevante: valida el precio del rubro y **es exactamente la función que propongo como diferenciador #1**.

**C-6 · Faltan cinco competidores en §8.1.**
No figuran **Layerpaint** (navegador, pincel on-device, 3MF estándar para Bambu/Orca/Prusa, US$6,97 por 10 exports o US$39,97 ilimitado), **PrintPal** (IA, US$10/mes, gratis solo uso personal), **3d-editor.com Keychain Generator** (traza en el navegador, sin cuenta, sin marca de agua, gratis), **Meshcast** y **3DModelTools**. `layerpaint.app` aparece en las fuentes del doc 01 solo como blog sobre parseo de color en 3MF, no como competidor — y es de los más directos.

**C-7 · Mesh Minter estaba sin precios y es la mejor referencia del mercado.**
El doc 01 §8.1 dice "plan pago para descargas premium y sin marca". Verificado hoy: **Free** (1 export premium, marca "MM" grabada abajo, uso personal), **Maker US$10/mes** (100 exports, sin marca, sigue siendo uso personal), **Merchant US$30/mes** (derechos comerciales para vender prints y archivos; lo licenciado mientras el plan está activo queda licenciado de por vida) **[V]**.

**C-8 · §3.3 "impresión boca abajo": sigue sin verificar, y hay señal en contra.**
No encontré fuente oficial. Sí encontré reportes de usuarios de MakerWorld de que, al imprimir boca abajo, **el gancho no está disponible** y de problemas de delaminación en llaveros de doble cara **[FS]**. Conviene tratarlo como "modo experimental" y validarlo con impresiones reales antes de ofrecerlo como preset.

**C-9 · §7 riesgo 1: completar la mitigación.**
"Consultar a un abogado antes de vender" es correcto pero incompleto. Falta: **el DMCA solo cubre copyright, no marcas ni patentes**, y **el safe harbor no aplica a quien fabrica y vende** **[FS]**. La mitigación real de la fase tienda es moderación previa, no términos de uso.

### 6.2 Correcciones al doc 02 (costos y servicios)

**C-10 · Error de hecho: MakerTools3D no procesa en el navegador.**
El doc 02 §0.8 y §9 afirman "**En el navegador**" y lo marcan **[OF]**. Su propia política de privacidad dice: *"Uploaded images are processed temporarily for the current request; MakerTools3D does not store user uploads or generated files on the server as part of normal operation"* **[V]**. O sea: **la imagen sí se sube a su servidor**, aunque no se almacene. Esto cambia dos cosas: el diferenciador de privacidad **sí es real** frente a MakerTools3D (y frente a ImageToStl, que lo dice abiertamente), y el doc 01 §8.1 repite el mismo error al describirlo como "Gratis, sin cuenta, en navegador".

**C-11 · MakerTools3D sí tiene modelo de negocio: publicidad.**
El doc 02 §9 dice "No encontré plan pago". Es cierto que no hay plan pago, pero su política de privacidad menciona explícitamente **socios de publicidad y analytics (Google, Cloudflare u otros) con cookies e identificadores de dispositivo** **[V]**. No es un proyecto sin monetizar: monetiza con anuncios.

**C-12 · El ecosistema de MakerLab es menos cerrado de lo que sugiere el doc 02.**
El doc 02 §9 dice "Ecosistema cerrado de Bambu". La política de MakerWorld indica que, **para la mayoría de las herramientas de MakerLab, lo producido pertenece al usuario y sin restricciones comerciales**, con dos excepciones: el *Parametric Model Maker* (queda sujeto a la licencia del modelo original) y los **generadores de terceros integrados** (cada proveedor pone sus condiciones) **[FS — makerworld.com bloquea el acceso automatizado; el dato viene del índice de buscador sobre su FAQ]**. Conclusión práctica: **no podés diferenciarte por "acá sí podés vender lo que generás"**, porque en MakerWorld también podés. Sí podés diferenciarte por **"acá no necesitás cuenta y nadie modera tu dibujo"**, que es la queja documentada de sus usuarios **[FS]**.

**C-13 · Precios de HueForge desactualizados.**
El doc 02 §9 cita precios de 2024 (US$45/año, US$100/año, US$250) marcándolos como no verificados. Siguen sin poder verificarse: la tienda no publica el precio de las licencias comerciales **(no verificado)**. Lo que sí se verificó hoy: **software base US$24 en oferta, US$30 regular**, licencias comerciales anuales que **revierten a Personal si no se renuevan**, y el **plugin de exportación 3MF a US$20 aparte** **[V]**.

**C-14 · §10.10 "alternativas seguras" mezcla dos criterios.**
Listar `imagetracerjs`, `vtracer` y OpenCV como "alternativas seguras" es correcto **en licencia** pero engañoso **en aptitud**: `imagetracerjs` está abandonado, `vtracer` no corre en el navegador sin build propio de Rust, y OpenCV.js pesa ~3,8 MB gzip. La alternativa realmente segura **y** apta es la del doc 01: `d3-contour` (ISC) + código propio + `manifold-3d` (Apache-2.0).

**C-15 · §5.2, redacción de la AGPL.**
"AGPL: obliga a publicar el código de toda la app" es una simplificación. La AGPL obliga a ofrecer el **código fuente correspondiente de la obra combinada** a quien la ejecuta o interactúa con ella por red. En una SPA el efecto práctico es el mismo (el bundle se distribuye al navegador), así que el veredicto no cambia; pero la formulación precisa importa si alguna vez se evalúa comprar una licencia comercial.

**C-16 · Falta el punto legal clave en §10.17.**
El doc 02 dice bien que "generar el archivo propio no habilita a vender el objeto". Falta lo que cambia las decisiones de arquitectura: **mientras todo corra en el navegador y no se aloje nada, no hay obligación de agente DMCA ni de notice & takedown**. Esas obligaciones nacen recién en la fase 2. Es un argumento fuerte para mantener el MVP 100% local todo el tiempo que se pueda.

### 6.3 Lo que verifiqué y estaba bien (no cambiar)

- Todas las licencias de la §2 del doc 01: **22 de 22 correctas** contra el registro de npm y la API de GitHub.
- `potrace` y `esm-potrace-wasm` = GPL-2.0 **[V]**. `marchingsquares` = AGPL-3.0 **[V]**. Kromacut y Chili3D = AGPL-3.0 **[V]**. `lib3mf` = BSD-2-Clause **[V]**.
- OpenCV sigue siendo **Apache-2.0** en su rama actual **[V]**: la nota del doc 02 "(licencia OpenCV no re-verificada aquí)" queda saldada.
- `jszip` es dual `(MIT OR GPL-3.0-or-later)` **[V]**: la recomendación de elegir MIT es correcta.
- La elección de `manifold-3d` (Apache-2.0) como núcleo es, además de técnicamente buena, la **más limpia en licencias** de todas las alternativas de geometría evaluadas.
- MakerWorld Image to Keychain **requiere cuenta** y expone espesor, colores, fondo y gancho/agujero **[FS]**: correcto.
- ImageToStl procesa **en servidor**, con tope de 1200×1200 px y limitaciones con bloqueador de anuncios **[V]**: correcto.

---

## 7. Fuentes

**Licencias (verificadas el 2026-09-11)**
- Registro npm, campo `license` de `/latest`: `three`, `manifold-3d`, `opentype.js`, `earcut`, `fflate`, `d3-contour`, `simplify-js`, `image-q`, `culori`, `@techstark/opencv-js`, `imagetracerjs`, `@visioncortex/vtracer`, `clipper2-ts`, `marchingsquares`, `@imgly/background-removal`, `esm-potrace-wasm`, `potrace`, `jszip`, `three-3mf-exporter`, `@jscadui/3mf-export`.
- API de GitHub `/repos/{owner}/{repo}/license`: `opencv/opencv`, `visioncortex/vtracer`, `vycdev/Kromacut`, `xiangechen/chili3d`, `jankovicsandras/imagetracerjs`, `3MFConsortium/lib3mf`, `hvoss-tech/AutoForge` (404 = sin licencia).
- https://raw.githubusercontent.com/imgly/background-removal-js/main/LICENSE.md (AGPL-3.0)
- https://openfontlicense.org/open-font-license-official-text/ · https://www.tldrlegal.com/license/open-font-license-ofl-explained
- https://filamentcolors.xyz/ (CC BY 4.0, 3.396 filamentos, 243 fabricantes)

**Competencia**
- https://makertools3d.com/image-to-3mf · https://makertools3d.com/image-to-keychain · https://makertools3d.com/about · https://makertools3d.com/privacy
- https://imagetostl.com/convert/file/png/to/3mf
- https://shop.thehueforge.com/products/hueforge · https://shop.thehueforge.com/pages/license-terms · https://shop.thehueforge.com/collections/hueforge · https://shop.thehueforge.com/products/3mf-plugin · https://shop.thehueforge.com/pages/3mf-export-how-it-works
- https://meshminter.com/ · https://meshminter.com/pricing
- https://layerpaint.app/
- https://printpal.io/3dgenerator
- https://www.3d-editor.com/tools/keychain-generator
- https://meshcast.app/keychain
- https://3dmodeltools.com/tools/keychain
- https://obloid.app/tools/keychain
- https://3dkeychain.net/
- https://www.busymommasnook.com/post/how-to-make-a-3d-printed-keychain-from-an-image-using-makerworld-s-makerlab (UX de MakerLab; makerworld.com devuelve 403 a acceso automatizado)
- https://forum.bambulab.com/t/offline-method-to-recreate-the-image-to-keychain-makers-results/89827 (moderación como fricción)
- https://forum.bambulab.com/t/maker-lab-commercial-purposes/87539 (uso comercial de lo generado)
- https://forum.bambulab.com/t/image-to-keychain-error/112729 · https://forum.bambulab.com/t/keychain-maker-printing-image-through-whole-object/121752 (defectos reportados)
- https://www.allaboutbambu.com/2024/09/17/makerworld-now-supports-more-than-one-language/ (MakerWorld en español)

**Legal**
- https://www.copyright.gov/dmca-directory/ · https://www.copyright.gov/dmca-directory/faq.html (agente DMCA: US$6, renovación cada 3 años, publicación en el sitio)
- https://www.fbm.com/content/uploads/2019/01/3d-printing-copyright-challenges-and-the-dmca.pdf · https://www.finnegan.com/en/insights/articles/3d-printing-keeping-it-legal.html (el DMCA no cubre marcas ni patentes; responsabilidad del que imprime)
- https://www.eu-digital-services-act.com/Digital_Services_Act_Article_16.html · https://digitalservicesact.cc/dsa/art16.html (DSA art. 16 y exenciones para micro y pequeñas empresas)
- https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-424-2020-342869/texto · https://www.argentina.gob.ar/justicia/derechofacil/leysimple/boton-arrepentimiento (botón de arrepentimiento)
- https://www.littler.com/es/news-analysis/asap/mexico-tiene-nueva-ley-en-materia-de-proteccion-de-datos-personales · https://rafik.legal/cambios-principales-en-los-avisos-de-privacidad-web/ (nueva LFPDPPP, 20-mar-2025)
- https://en.wikipedia.org/wiki/Walt_Disney_Productions_v._Air_Pirates (protección de personajes)
