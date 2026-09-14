# Fase 2 · Auditoría de las herramientas de corrección

**Fecha:** 2026-09-13 · **Tipo:** auditoría de producto e interacción + propuesta de diseño · **Sin cambios de código**

**Disparador:** un usuario real subió el logo «La Ronda · Tienda»: trazos finos gris oscuro (un círculo, texto curvo con serifa, un mate, hojas de laurel) sobre un fondo degradé gris → blanco. El resultado dejó el degradé adentro del círculo como parte del dibujo (dos mitades grises) y borró los trazos finos (círculo, texto, mate). Solo quedaron los laureles. Lo que dijo: *«no está tan mal, pero no lo puedo usar ni modificar para llegar a algo aceptable. ¿Cómo se puede mejorar? ¿Qué herramientas tengo para usarlo mejor o modificarlo?»*

**Fuente de verdad:** el código de `src/` en `main` (commit `a424957`). No tengo la imagen del usuario, así que el caso La Ronda está **reconstruido leyendo el pipeline**, con supuestos explícitos. No se usó el navegador.

---

## 0. En una pantalla

- **Hoy el usuario tiene 9 controles y ninguno corrige la conversión.** Los dos que reprocesan la imagen (tipo de imagen y cantidad de colores) cambian *cómo* se equivoca, no *dónde*. Los otros siete actúan sobre un resultado que ya perdió la información.
- **El problema de La Ronda son tres decisiones automáticas que nadie puede revertir:**
  1. **Qué es fondo:** el recorte pinta desde los bordes de la imagen y **no puede cruzar un contorno cerrado**. Todo lo que está adentro del círculo es "dibujo" por definición, con cualquier tolerancia.
  2. **Qué es muy fino:** la limpieza **borra** todo lo más angosto que 0,8 mm (a 50 mm de lado) y le da a esos píxeles el color del vecino. No avisa, porque la detección de detalle fino y de texto chico corre **después** de borrarlos.
  3. **Qué color es la base:** solo un color casi blanco (ΔE2000 < 5 contra `#FFFFFF`) va con la base. Los dos grises del degradé quedan como colores propios.
- **Hay textos de la interfaz que prometen herramientas que no existen** («bajá cuánto fondo sacar», «el pincel ✏️», «tocando qué colores son fondo», «probá hacerlo más grande»).
- **Top 5 propuesto** (impacto ÷ esfuerzo): ① acciones por color + deshacer (S) · ② vista «Cómo va a salir» con lo que se pierde en rojo y antes/después (S) · ③ engrosar las líneas en vez de borrarlas (M) · ④ «Tocá lo que es fondo», que rellena lo encerrado (M) · ⑤ tipo «Líneas» + acabado en relieve (M/L). Con ①+③+④ La Ronda ya sale imprimible. Con ⑤, sale lindo y con una sola pausa en una impresora de un color.

---

## 1. Qué pasó adentro del pipeline con La Ronda

Supuestos: imagen sin transparencia · lado mayor del dibujo = 50 mm (`LADO_MAYOR_MM`) · a esa escala los trazos del círculo, el mate y las letras miden entre 0,3 y 0,6 mm, las letras miden entre 2 y 3 mm de alto y las hojas del laurel entre 1 y 2 mm de ancho.

| # | Etapa (archivo) | Qué hace | Qué le hizo a La Ronda |
|---|---|---|---|
| 1 | Previa + preset `auto` (`pipeline/index.ts › convertirAutomatico`) | Arranca con **Dibujo**. Solo pasa a Foto si el recorte no encontró nada (`dibujo-no-encontrado`). | Encuentra dibujo, así que queda en Dibujo. |
| 2 | Máscara por flood fill (`pipeline/mascara.ts › mascaraPorFloodFill`) | Semillas en el borde de la imagen parecidas a la mediana del borde. Pinta vecinos a distancia OKLab < 0,10 **de su semilla**. | El degradé de afuera se va (entero o casi entero). **El círculo es un contorno cerrado: el relleno nunca entra.** El degradé de adentro queda como dibujo. Ninguna tolerancia arregla esto sin comerse también el trazo. |
| 3 | Erosión anti-halo + mediana (`mascara.ts › erosionar`, `prefiltro.ts`) | Saca 1 px de borde para estimar colores y suaviza con mediana r=1. | Los trazos de 3 a 6 px pierden su borde para el cálculo del color. Los más finos casi desaparecen del muestreo. |
| 4 | k-means en OKLab, N = 4, fusión ΔE < 5 (`cuantizar.ts`) | Encuentra hasta 4 colores **dentro de la máscara**. | La mayor parte del área es degradé, así que k-means gasta sus colores en el degradé: gris medio, gris claro y quizás casi-blanco. El gris oscuro de los trazos queda como un color. |
| 5 | **Limpieza** (`limpiar.ts`) | a) moda 3×3 · b) **apertura por color con radio 0,4 mm = 4 px**: lo más angosto que 0,8 mm pasa a "sin asignar" y **toma el color del vecino más cercano** · c) islas < 0,5 mm² se funden. | **Acá mueren el círculo, las letras y el mate.** No pasan a fondo: pasan a gris. Por eso la silueta sigue siendo un disco. Los laureles sobreviven porque sus hojas son más anchas que 0,8 mm. |
| 6 | Diagnóstico (`diagnostico.ts`) | `texto-chico` cuenta componentes finos y alargados **sobre `etiquetas`, que ya salen de la limpieza**. | Las letras ya no existen, así que **no hay aviso de texto**. Puede aparecer `fondo-complejo`, que ofrece «tocar qué colores son fondo» (no hay dónde tocar). |
| 7 | Diseño (`diseno/crear.ts`) | Base `#FFFFFF`. Un color de región pasa a la base solo si ΔE2000 < 5 contra blanco. | Los dos grises del degradé quedan como **dos filamentos propios**: «Gris» y «Gris claro», las «dos mitades». |
| 8 | Geometría + DRC (`geometria/construir.ts`, `drc.ts`) | Silueta = unión de regiones. `drcDetalle` mide la apertura **sobre lo que quedó**. | Disco con dos grises y laureles. El aviso de detalle fino, si aparece, habla de los laureles. De lo que se perdió no dice nada. |

**Conclusión técnica:** el resultado es coherente con el código. No es un bug: son tres umbrales razonables para logos de colores planos que no sirven para dibujos de líneas sobre degradé, **y la interfaz no deja tocar ninguno de los tres**.

---

## 2. Inventario exacto: qué puede hacer hoy el usuario

### 2.1 Controles visibles

| Solapa | Control | Qué toca | ¿Reprocesa la imagen? | ¿Corrige una mala conversión? |
|---|---|---|---|---|
| Fondo | **Tipo de imagen**: Automático · Dibujo · Foto · Silueta | `estado/documento.ts › cambiarPreset` → preset del worker | Sí | Solo cambia *cómo* se calcula la máscara. No deja decir *qué* es fondo. |
| Colores | **¿Cuántos colores?** 2–6 | `cambiarColores` → N de k-means | Sí | Redistribuye los colores. No cambia el umbral de detalle ni la base. |
| Colores | **Lista de colores** | Nada (solo lectura: muestra, nombre, lugar) | — | No. |
| Colores | **¿Cuántos colores podés cargar?** a ras / apilado | `diseno.impresion.modoColor` | No | No (cambia cómo se imprime). |
| Llavero | **Tamaño** 25–80 mm | Escala `transform.sx/sy` de las regiones (`SolapaLlavero › escalar`) | **No** | **No.** Agrandar no recupera nada, porque los trazos se borraron a 50 mm. |
| Llavero | **Espesor** 1,6 / 3,0 / 4,0 | `diseno.cuerpo.espesor` | No | No. |
| Llavero | **Argolla** bolitas / común / gruesa / sin | `diseno.argolla.tipo` | No | No. |
| Llavero | **Borde** sí/no (1,5 mm fijo) | `diseno.contorno.activo` | No | No. |
| Llavero | **Texto** (24 caracteres) + **Letra** (3 fuentes) | `diseno/texto.ts › agregarTexto`: siempre **abajo** del dibujo, centrado | No | Parcial: se puede escribir el nombre, pero no ubicarlo, no borrar las letras rotas del logo y no ponerlo adentro. |
| Vista | Arriba · 3D · Capas | Cámara | No | No (solo mirar). |
| Avisos | `FranjaAvisos` | Texto con semáforo, **sin botón** | — | No. El plan (§4.8) dice que «ningún aviso se escribe sin su botón». |
| Descargar | Slicer, guardar proyecto | — | No | No. Editar `proyecto.json` a mano no es una herramienta. |

**En una línea:** tipo de imagen y cantidad de colores (reprocesan), más tamaño, espesor, argolla, borde, texto e impresora (no tocan el dibujo). No hay pincel, varita, «es fondo», fusionar, cambiar filamento, grosor, deshacer ni comparación.

### 2.2 Lo que el motor ya sabe hacer y la interfaz no expone

| Parámetro / capacidad | Dónde | Hoy | Para qué serviría |
|---|---|---|---|
| `toleranciaFloodFill` (0,10) | `ParamsPipeline`, `defaults.ts` | Fijo | El slider «Cuánto fondo sacar» del plan. Útil con degradés afuera; **inútil con contornos cerrados**. |
| `clustersFondo` | `ParamsPipeline`, `OpcionesImagen` del worker | El worker lo acepta y **nadie se lo pasa** | Los «clusters clickeables» del preset Foto (plan §4.3). |
| `anchoMinimoDetalleMm` (0,8, PROVISORIO) | `limpiar.ts` | Fijo, y **borra** | Es la palanca de los trazos finos: engrosar en vez de borrar. |
| `ladoMayorMm` (50) | `ParamsPipeline` | Fijo en la conversión. El slider de tamaño escala después. | Si el tamaño reprocesara, a 80 mm sobrevivirían trazos 1,6 veces más finos. |
| `mmPorPixel` (0,10) | `ParamsPipeline` | Fijo | Los trazos de menos de 2 px se pierden en el reescalado. Un modo líneas podría trabajar a 0,05. |
| `areaMinimaIslaMm2` | por preset | Fijo | Puntos y tildes chicos. |
| `caja` (encuadre fijo) | `ParamsPipeline` | Se recalcula en cada corrida | **Imprescindible** para que cualquier toque o pincelada en coordenadas de imagen siga valiendo después de reprocesar. |
| `mascaraPorUmbralAdaptativo` | `presets.ts` | Preset Silueta. Sobre el gato **deja solo los trazos** (`f2-interfaz.md`). | Base del tipo «Líneas»: extraer la tinta de un logo de líneas. |
| `distanciaCuadrada`, `apertura` | `morfologia.ts` | Solo para borrar | Dilatar con disco en O(píxeles): engrosar trazos. |
| `Aviso.zonas` (polígonos de lo que se pierde) | `drc.ts › drcDetalle`, `drcIslas` | Se calculan y **no se dibujan** | «Mostrarme dónde» (plan §4.8 caso 4). |
| Apilado = colores **encima** de la base | `franjas.ts › franjasApilado` | Solo con «Solo 1 filamento» | La geometría del relieve ya existe; falta ofrecerla también con AMS. |

### 2.3 Textos que prometen herramientas que no existen (arreglo XS, hoy mismo)

| Texto (`es.ts` / `diagnostico.ts`) | Qué promete | Qué hay |
|---|---|---|
| `errores.sinDibujo`: «Bajá «cuánto fondo sacar», o traé de vuelta lo que falta con el pincel ✏️.» | Slider y pincel | Ninguno de los dos |
| caso `fondo-complejo`: «probá tocando qué colores son fondo» | Clusters tocables | No hay dónde tocar |
| caso `texto-chico`: «Probá hacerlo más grande.» | Que agrandar salve el texto | El tamaño no reprocesa: el texto ya se borró |
| `drcDetalle`: «pueden salir frágiles o no salir» | — | Sin «mostrarme dónde» ni «engordarlas» |
| `fondo.saltear` | Botón «Saltear este paso» | Definido y sin usar |

Hasta que existan las herramientas, esos textos tienen que decir lo que sí se puede hacer, por ejemplo: *«Probá con otro tipo de imagen, o con una versión del logo sobre fondo blanco liso»*.

---

## 3. La Ronda paso a paso: por qué nada llega a algo aceptable

| Intento del usuario | Qué pasa en el código | Resultado |
|---|---|---|
| **Automático** (lo que vio) | Dibujo + flood fill + limpieza (§1) | Disco con dos grises + laureles |
| **Dibujo** | Lo mismo | Igual |
| **Foto** | 6 clusters sobre la imagen entera. Son fondo los que cubren la mitad del borde: el degradé cae en 2 o 3 clusters, y **los mismos clusters adentro del círculo también pasan a fondo** (bien). Pero la máscara queda **solo con los trazos**, y la limpieza (con islas de 1,5 mm² en Foto) borra círculo, letras y mate. | Laureles sueltos. Probable aviso «el llavero quedó en N partes». El usuario no puede elegir clusters. |
| **Silueta** | Umbral adaptativo: los trazos salen como tinta y el degradé se va (bien). Pero es **solo tinta**, sin placa, y la limpieza borra lo fino. | Hojas sueltas o «Me llevé casi todo el dibujo», que además menciona un pincel que no existe |
| **2 colores** | Degradé + trazos en 2 clusters. Los trazos se borran igual. | Disco de un gris + laureles |
| **6 colores** | Más franjas del degradé | Peor: más grises |
| **Tamaño 80 mm** | Escala los polígonos ya limpios | Mismo resultado, más grande |
| **Espesor / argolla / borde / impresora** | No tocan el dibujo | — |
| **Texto «La Ronda»** | Se agrega abajo del disco, afuera del círculo, en otra letra. Con «La Ronda · Tienda» (17 letras a 9 mm) el texto mide ~84 mm y **ensancha el llavero**. | El nombre aparece, pero el disco gris sigue ahí |
| **Leer los avisos** | Sin botones. No mencionan lo borrado (se detecta después de borrar). | Sin pista de qué hacer |

**Por qué no alcanza, resumido:** para llegar a algo aceptable el usuario necesita decidir cuatro cosas, y hoy no puede decidir ninguna:

1. «Adentro del círculo **no** es dibujo: es la placa.»
2. «Estos trazos **no** se borran: se engrosan hasta que se puedan imprimir.»
3. «Estos dos grises son **el mismo color, y es la base**.»
4. «Estas letras chicas no van a salir: **sacalas y ponelas grandes con la letra de la app**.»

---

## 4. Cómo lo resuelven otras herramientas

De memoria, sin navegar. Las funciones de los generadores web cambian seguido: lo marcado *(no verificado)* hay que confirmarlo antes de citarlo.

| Herramienta | Cómo deja corregir | Patrón que importa acá |
|---|---|---|
| **Cricut Design Space** (subir imagen) | Primero pregunta qué tan compleja es la imagen. Después: **«Select & Erase»**, que borra con un toque la zona contigua parecida (sirve **adentro de las letras**, en zonas encerradas), borrador de pincel, recorte y quitar fondo automático. El damero marca lo borrado. Vista previa de «así se corta». | **Tocar la zona para sacarla**, contiguo, también adentro de formas cerradas. Damero = fondo (ya lo usamos). |
| **Silhouette Studio** (panel Trazar) | Se elige el área, un **umbral** con filtros pasa-alto y pasa-bajo, y **la vista pinta en amarillo lo que se va a trazar**. Tres salidas: Trazar · **Trazar solo el borde exterior** · Trazar y separar. | **Vista previa superpuesta de lo que queda.** «Borde exterior» = **la placa base que sigue la silueta**. |
| **Inkscape** (Vectorizar mapa de bits) | Escaneo simple (corte de brillo, bordes, cuantizar), **«centerline tracing»**, que convierte trazos en caminos con grosor, y escaneos múltiples (N colores, apilar, quitar fondo). Opciones: **suprimir motas (tamaño)**, suavizar esquinas, vista previa en vivo. | **Trazo → línea central + grosor elegible**: engrosar sin deformar. «Motas» = área mínima de isla. |
| **Adobe Illustrator** (Calco de imagen) | Modos color/gris/blanco y negro, umbral, trazados/esquinas/ruido, **crear rellenos o trazos con grosor máximo de trazo**, ignorar blanco. Vistas: **resultado · original · contornos sobre el original**. | **Modo trazos vs rellenos.** **Cambiar entre original y resultado** en la misma vista. |
| **remove.bg / Canva** (quitar fondo) | Automático primero. Después **Borrar / Restaurar** con tamaño de pincel, y el original **se ve tenue** debajo de lo borrado. Antes/después. | **Dos pinceles simétricos** y el original de guía. Automático + retoque, nunca «empezá de cero». |
| **Photopea / Photoshop** (varita) | **Tolerancia**, **contiguo sí/no**, Shift suma y Alt resta, refinar borde. | **«Solo lo pegado» vs «todos los parecidos»**: un degradé partido en dos se saca con dos toques o con uno no contiguo. |
| **LightBurn / Glowforge** (trazar imagen) | Corte/umbral, **«ignorar menores que»**, suavizado, «sketch trace» (líneas), atenuar la imagen de fondo. | Atenuar el original para ver el trazo encima. |
| **HueForge** | La luminancia se vuelve altura. **Lista de filamentos con la altura de cada cambio**, que se ajusta arrastrando. Vista 3D en vivo y lista de cambios. | **Relieve como estética válida con 1 filamento + pausas.** Decisiones de color sobre la lista, no sobre la imagen. |
| **Tinkercad** | Importa SVG como sólido. Cada forma es **Sólido o Agujero**. Los trazos sin relleno del SVG no generan volumen *(comportamiento conocido de la importación)*. | **Sólido / agujero / base** como elección por forma. Los trazos finos son un problema de todos. |
| **Bambu Studio / OrcaSlicer** (pintar color) | Pincel, **balde con relleno inteligente**, «rellenar huecos». La vista previa muestra lo que no se imprime. | **Balde** = tocar zona. La vista de impresión honesta. |
| **Generadores «imagen a llavero» de MakerWorld/MakerLab y similares** *(no verificado, a grandes rasgos)* | Quitar fondo automático (a veces con IA), cantidad de colores, grosor del borde, forma de la base (silueta / redonda / rectangular), altura del relieve. Pocas herramientas de retoque. | Confirma el hueco de mercado (ver `llaveros3d-investigacion`): **resuelven lo automático y dejan al usuario sin retoque**. |

### 4.1 Los 10 patrones que tomamos

1. **Automático primero, retoque después.** Nunca se arranca de cero (ya es principio del plan §4.3).
2. **Tocar una zona = elegirla.** Contigua por defecto, con la opción de «todos los parecidos».
3. **Dos modos simétricos:** sacar / devolver. Tanto en el pincel como en el toque.
4. **El original tenue debajo** de lo que se sacó, para ver qué se perdió.
5. **Superposición de lo que queda o se pierde** (el amarillo de Silhouette, nuestro rojo).
6. **Borde exterior = placa:** la silueta rellena, sin los huecos de adentro.
7. **Trazos con grosor elegible** (centerline de Inkscape, trazos de Illustrator) en vez de borrar lo fino.
8. **Decisiones de color sobre la lista:** juntar, cambiar, «es fondo» (HueForge, Illustrator).
9. **Sólido / agujero** como elección explícita cuando algo encerrado deja de ser dibujo.
10. **Antes / después** en la misma vista, con divisor o con interruptor.

---

## 5. Principios de la propuesta

1. **Presupuesto de controles (plan §7.8): Fondo 4 · Colores 3 · Llavero 5.** Hoy hay 1 / 3 / 5. Todo lo avanzado va detrás de **«Retocar»** (`data-avanzado`). Deshacer/rehacer y los interruptores de vista son cromo del lienzo, como Arriba/3D/Capas hoy. *Nota:* `tests/e2e/presupuesto-controles.spec.ts` **todavía no existe** (F2.6). Conviene escribirlo antes de sumar controles.
2. **Todo arreglo nace de un aviso con botón** (plan §4.8). La herramienta aparece cuando el problema existe: el slider de grosor solo se ve si hay líneas finas.
3. **Nadie queda atrapado en algo peor que lo automático:** «Volver al recorte automático» borra todos los retoques de imagen (plan §4.8 caso 6).
4. **Los retoques de imagen son una lista de operaciones, no un bitmap.** Toques, pinceladas y grosor se guardan como datos chicos en coordenadas normalizadas al encuadre (`caja` fija) y **se re-aplican en cada corrida** del pipeline, que es determinista (semilla fija). Así se consigue deshacer barato, que los retoques sobrevivan a cambiar la cantidad de colores o el tipo de imagen, y que entren en `proyecto.json`.
5. **Las decisiones de color son reglas por color**, identificadas por el hex con tolerancia ΔE, y también se re-aplican después de reprocesar. Hoy `conservarOpciones` perdería cualquier cambio por color.
6. **Todo corre en el cliente sobre las etapas existentes.** Sin IA, sin descargas nuevas.
7. **Microcopy con las reglas de §4.7:** vos, primera persona para lo que hizo el sistema, sin «Error», sin jerga. El usuario nunca lee «tolerancia»: lee «parecido».

---

## 6. La propuesta completa, priorizada

Impacto: **cuántas subidas reales mejora** (logos de líneas, badges con círculo, degradés y letras encerradas son muy frecuentes en logos de emprendimientos). Esfuerzo en días, con la escala del plan.

| Orden | Propuesta | Impacto | Esfuerzo | Ratio | Resuelve de La Ronda |
|---|---|---|---|---|---|
| **1** | **Acciones por color** (Es fondo · Juntar con… · Cambiar filamento) + **deshacer/rehacer de 20 pasos** | Alto | **S** · 1,5 d | ★★★★★ | Las dos mitades grises |
| **2** | **Vista «Cómo va a salir»**: lo que se pierde en rojo + **antes/después** | Alto (hace entendible todo lo demás) | **S** · 1,5 d | ★★★★★ | Muestra que el círculo, el texto y el mate se borran |
| **3** | **Engrosar las líneas** en vez de borrarlas + slider «Grosor de las líneas» | Muy alto en logos | **M** · 2,5 d | ★★★★ | Círculo y mate de vuelta |
| **4** | **«Tocá lo que es fondo»**, que rellena con la base lo encerrado (u ofrece agujerearlo) | Muy alto | **M** · 3 d | ★★★★ | El degradé de adentro, sin depender de los colores |
| **5** | **Tipo «Líneas»** (reemplaza a Silueta) + **acabado en relieve** | Alto en line art, firmas y escaneos | **M/L** · 3,5 d | ★★★ | Todo el logo de una vez, lindo, con 1 pausa |
| 6 | **Retocar**: pincel sacar/devolver, varita con «Parecido» y «Solo lo pegado», zoom/pan | Alto en fotos | M · 2,5 d (usa la infra de 4) | ★★★ | Limpieza fina de restos |
| 7 | **Texto del logo → texto de la app** | Medio-alto | S/M · 1,5 d | ★★★ | «La Ronda» legible |
| 8 | **El tamaño reprocesa** (`ladoMayorMm` = tamaño elegido) | Medio | S · 0,5 d | ★★★★ | Agrandar salva detalle de verdad |
| 9 | **Clusters tocables en Foto** (pasar `clustersFondo`) | Medio (fotos) | S · 1 d | ★★★ | — |
| 10 | **Arreglar los textos que prometen herramientas** (§2.3) | Bajo, pero es deuda de confianza | XS · 0,25 d | ★★★★★ | — |
| 11 | **«Cuánto fondo sacar»** (slider de `toleranciaFloodFill`, solo en Dibujo) | Medio-bajo: **no resuelve lo encerrado** | S · 0,5 d | ★★ | Restos de degradé afuera |

**Orden de implementación sugerido:** 10 → 1 → 2 → 8 → 3 → 4 → 7 → 5 → 6 → 9 → 11. El 10 y el 8 son rápidos y ya cambian la experiencia. El 2 antes que el 3, porque el rojo es cómo el usuario entiende qué hace el slider de grosor. El 4 construye la lista de operaciones que después usan el 6 y el 7.

---

## 7. Top 5 en detalle

### ① Acciones por color + deshacer · **S (1,5 días)**

**Qué resuelve:** los colores que sobran («las dos mitades grises»), un color del degradé que en realidad es base, y el filamento real que tiene el usuario. Es lo más barato porque **trabaja sobre `Diseno`, sin tocar el pipeline**: pasar una pieza a la base es cambiar su `filamentoId`, y `construir.ts` ya funde con la base lo que usa el filamento de la base.

**Flujo**
1. En Colores, cada fila de «Los colores de tu llavero» se vuelve un botón.
2. Tocar «Gris 2» abre un menú en línea (hoja inferior en celular) con tres acciones.
3. **Es fondo:** las piezas de ese color pasan al filamento de la base. Se reconstruye y aparece un aviso breve con «Deshacer».
4. **Juntar con otro color:** se elige el destino en la misma lista, las piezas pasan a ese filamento, se borra el filamento huérfano y se renumeran los lugares.
5. **Cambiar el filamento:** grilla de colores (hoy `NOMBRES_DE_COLOR`, después `filamentos.json` de F2.4). Solo cambia `hex` y `nombre`. En la fila de la base es la única acción.
6. `Ctrl+Z` / `Ctrl+Shift+Z` o los botones ↩ ↪ del encabezado deshacen hasta 20 pasos.

**Wireframe (panel Colores)**
```
LOS COLORES DE TU LLAVERO
┌───────────────────────────────────────────┐
│ ▉ Blanco            Base y borde        › │
├───────────────────────────────────────────┤
│ ▉ Gris 2            lugar 2             ˅ │
│ ┌───────────────────────────────────────┐ │
│ │ ◻ Es fondo: que vaya con la base      │ │
│ │   Se imprime del color de la base.    │ │
│ │ ⇆ Juntar con otro color               │ │
│ │ ◐ Cambiar el filamento                │ │
│ └───────────────────────────────────────┘ │
├───────────────────────────────────────────┤
│ ▉ Gris              lugar 3             › │
│ ▉ Gris oscuro       lugar 4             › │
└───────────────────────────────────────────┘
  Listo: Gris 2 ahora va con la base.  [Deshacer]
```

**Microcopy (`es.colores.acciones`)**
| Clave | Texto |
|---|---|
| `abrir` (aria) | `Opciones de ${nombre}` |
| `esFondo` | Es fondo: que vaya con la base |
| `esFondoDetalle` | `Se imprime del color de la base (${base}).` |
| `juntar` | Juntar con otro color |
| `juntarCon` | `¿Con cuál junto ${nombre}?` |
| `cambiar` | Cambiar el filamento |
| `cambiarTitulo` | Elegí el filamento que vas a usar |
| `cambiarNota` | Los colores de la pantalla son aproximados: fijate en el rollo que tenés. |
| `baseNota` | La base es la placa de abajo y el borde. |
| `listoFondo` | `Listo: ${nombre} ahora va con la base.` |
| `listoJuntar` | `Junté ${a} con ${b}.` |
| `deshacer` / `rehacer` | Deshacer · Rehacer (aria con el atajo: «Deshacer (Ctrl+Z)») |
| `reglaPerdida` | `Reprocesé la imagen y ${nombre} ya no está: lo que habías elegido para ese color no se aplicó.` |

**Dónde vive:** `SolapaColores.tsx` (la lista sigue siendo **1 control**: el presupuesto queda en 3) · botones ↩ ↪ en el encabezado de `Crear.tsx`, a la izquierda de «Descargar», como en el wireframe del plan §4.3.

**Estado y archivos**
- `estado/documento.ts`: `historial: { pasado: Instantanea[]; futuro: Instantanea[] }` con tope de 20. `Instantanea = { preset, colores, ajustes, reglasColor, diseno }`. Funciones `deshacer()` y `rehacer()`. Si la instantánea cambia `preset`, `colores` o `ajustes`, se reprocesa (con caché LRU de 5 conversiones por clave para que sea instantáneo).
- `estado/documento.ts`: `reglasColor: { hex; accion: 'base' | 'juntar' | 'filamento'; destinoHex?; filamento? }[]`, aplicadas en `conservarOpciones` después de `crearDiseno` (match ΔE2000 < 10).
- Nuevo `diseno/colores.ts` (puro, testeable): `pasarABase(d, filamentoId)`, `juntar(d, de, a)`, `cambiarFilamento(d, id, f)`, `renumerarSlots(d)`.
- `crear/util.ts › coloresDePiezas`: leer los hex del `diseno` para que **cambiar el filamento no dispare geometría** (plan §4.4).
- `i18n/es.ts`.

**Aceptación**
- [ ] Con una imagen sintética nueva del banco, `logo-lineas-degrade` (anillo de 0,4 mm + hojas de 1,5 mm + degradé adentro), «Es fondo» sobre los dos grises deja `filamentos.length` = 2 o 3 y ninguna pieza gris en el 3MF.
- [ ] Los lugares quedan contiguos 1..n después de juntar, y el 3MF abre con esos lugares.
- [ ] Cambiar el filamento actualiza la vista 3D sin mostrar «Actualizando…» ni llamar al worker de geometría.
- [ ] 20 pasos de deshacer y rehacer. Un paso nuevo vacía el futuro. Deshacer un cambio de colores reprocesa y deja la misma `etiquetas` (determinismo).
- [ ] Las reglas sobreviven a cambiar espesor, argolla, texto y la cantidad de colores, si el color sigue existiendo. Si no, se ve `reglaPerdida`.
- [ ] Presupuesto de Colores: 3. Todo alcanzable con teclado. Menú con `aria-expanded`.

---

### ② Vista «Cómo va a salir» con lo que se pierde en rojo + antes/después · **S (1,5 días)**

**Qué resuelve:** hoy lo que se borra desaparece sin rastro. El usuario de La Ronda no sabe que el círculo **existía y se borró por fino**. Cree que la app «no lo vio». Esta vista convierte un fracaso misterioso en un problema con nombre, y le da sentido al slider de grosor.

**Flujo**
1. En Fondo, arriba del lienzo, un selector: **Tu imagen · Comparar · Cómo va a salir** (por defecto: «Cómo va a salir»).
2. «Cómo va a salir» muestra el resultado por colores, como hoy, **y en rojo rayado lo que estaba en la imagen y no se imprime** (borrado por fino o fundido como isla).
3. Debajo, una línea de resumen con acción: «Se pierden 3 partes finas (12 % del dibujo). [Engrosar las líneas]».
4. «Comparar» muestra la imagen original a la izquierda y el resultado a la derecha, con **divisor arrastrable** (mouse, dedo y flechas del teclado).
5. «Tu imagen» muestra el recorte original con el fondo sacado en damero tenue. Es la guía para tocar (④) y pintar (⑥).

**Wireframe (lienzo de Fondo)**
```
┌──────────────────────────────────────────────────────┐
│   [ Tu imagen ][ Comparar ][▓ Cómo va a salir ▓]     │
│                                                      │
│        ░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░                      │
│      ░░░▒▒ ////////////// ▒▒░░░     //// = en rojo:  │
│     ░░▒▒ //  ▓▓ ♣ ▓▓  // ▒▒░░      no se imprime     │
│     ░░▒▒ //  mate ///  // ▒▒░░                        │
│      ░░░▒▒ ////////////// ▒▒░░░                      │
│        ░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░                      │
│                                                      │
│  🔴 Se pierden 4 partes finas (18 % del dibujo).     │
│     [ Engrosar las líneas ]   [ Mostrame ]           │
└──────────────────────────────────────────────────────┘
```

**Microcopy (`es.fondo.vista`)**
| Clave | Texto |
|---|---|
| `tuImagen` / `comparar` / `comoSale` | Tu imagen · Comparar · Cómo va a salir |
| `leyenda` | En rojo, lo que es muy fino para imprimirse. |
| `pierde` | `Se pierden ${n} ${n === 1 ? 'parte fina' : 'partes finas'} (${p} % del dibujo).` |
| `nadaPerdido` | No se pierde nada: todo lo que ves se puede imprimir. |
| `mostrame` | Mostrame |
| `divisor` (aria) | Arrastrá para comparar tu imagen con cómo va a salir |
| `antes` / `despues` | Tu imagen · Cómo va a salir |

**Dónde vive:** `crear/VistaMascara.tsx` (modos, capa roja, divisor) y el selector en `Crear.tsx`, con el mismo estilo que Arriba/3D/Capas. Es cromo de vista: **no suma a los 4 de Fondo**. El resumen con acción va arriba de `FranjaAvisos` en el panel.

**Estado y archivos**
- `pipeline/index.ts`: después de `limpiar`, calcular `perdidos: Uint8Array`. Un píxel está perdido si estaba en la máscara con un color asignado en `crudas` (antes de la limpieza) y en `etiquetas` terminó con otro color o como fondo. Se agregan a `diagnostico` el `perdidos`, el recuento de componentes y la fracción.
- `pipeline/index.ts`: devolver también el recorte de trabajo `trabajo.pixeles` (~530² × 4 ≈ 1,1 MB, transferible) para «Tu imagen» y «Comparar».
- `pipeline/diagnostico.ts`: **mover la detección `texto-chico` a antes de la limpieza** (sobre `crudas` rellenadas), para que vea las letras antes de que se borren. Nuevo caso `lineas-finas` cuando la fracción perdida supera el 5 %.
- `workers/imagen.worker.ts`: transferir los buffers nuevos.
- `crear/VistaMascara.tsx` · `paginas/Crear.tsx` · `i18n/es.ts`.
- Segundo paso, fuera de este S: pintar `Aviso.zonas` de `drcDetalle` y `drcIslas` en la vista 3D.

**Aceptación**
- [ ] Una línea sintética de 0,5 mm sale 100 % en rojo. Una de 1,2 mm, 0 %. Un disco de 10 mm, 0 %.
- [ ] El porcentaje del resumen coincide con el recuento de píxeles de `perdidos` (± 1 punto).
- [ ] El rojo va con rayado diagonal (no solo color) y contraste ≥ 3:1 sobre gris y blanco.
- [ ] El divisor responde a mouse, dedo y flechas del teclado. No se traba en un celular de 375 px.
- [ ] Armar la capa roja lleva < 30 ms a 530 × 530 en la PC de desarrollo.
- [ ] El banco golden no cambia: `etiquetas` y `regiones` quedan idénticas (solo se agregan datos).

---

### ③ Engrosar las líneas en vez de borrarlas · **M (2,5 días)**

**Qué resuelve:** el caso más frecuente de «me borró el dibujo» en logos de línea: círculos contenedores, íconos de trazo, ilustraciones a pluma. El plan ya lo intuía («▓ Engordarlas ▓», §4.8 caso 4), pero como `offset(+0,1)` sobre la geometría, que **llega tarde**: el trazo ya se borró en la limpieza, y +0,1 mm no rescata una línea de 0,3. Hay que hacerlo **en píxeles, antes de borrar**.

**Flujo**
1. Si el diagnóstico detecta `lineas-finas` (> 5 % del dibujo perdido, o algún color que pierde > 30 % de su área), en Fondo aparece arriba una tarjeta: «Tu dibujo tiene líneas más finas de lo que se puede imprimir. ¿Las engroso?» con **[Engrosar las líneas]** y **[Dejar que se borren]**.
2. Al engrosar, se reprocesa con `grosorLineasMm = 1,0`, el rojo de ② desaparece y aparece el grupo **«Grosor de las líneas»** con un slider de 0,8 a 2,0 mm.
3. Mover el slider reprocesa con 250 ms de espera. La vista 2D y la 3D se actualizan.
4. Si al engrosar se empastan letras (se tocan componentes que antes estaban separados), aparece la sugerencia de texto de la propuesta 7.

**Wireframe (panel Fondo)**
```
┌─────────────────────────────────────────┐
│ 🟡 Tu dibujo tiene líneas más finas de  │
│    lo que se puede imprimir.            │
│    [▓ Engrosar las líneas ▓] [Dejarlas] │
└─────────────────────────────────────────┘
TIPO DE IMAGEN
 [Automático] [Dibujo] [Líneas] [Foto]
GROSOR DE LAS LÍNEAS
 finas ────●──────────── gruesas   1,0 mm
 Más finas que 0,8 mm no salen en la impresora.
```

**Microcopy (`es.fondo.lineas`)**
| Clave | Texto |
|---|---|
| `tarjeta` | Tu dibujo tiene líneas más finas de lo que se puede imprimir. ¿Las engroso? |
| `engrosar` | Engrosar las líneas |
| `dejar` | Dejar que se borren |
| `grosor` | Grosor de las líneas |
| `extremos` | finas · gruesas |
| `valor` | `${mm} mm` |
| `minimo` | Más finas que 0,8 mm no salen en la impresora. |
| `empastado` | Al engrosar, algunas letras se juntaron. Mirá la sugerencia para el texto. |

**Dónde vive:** `SolapaFondo.tsx`. El grupo solo se ve cuando hay líneas finas o el tipo es «Líneas». Cuenta como 1 de los 4 de Fondo.

**Algoritmo (en `limpiar.ts`, sin librerías)**
1. Por cada color `c`: `finas = mascara_c ∧ ¬apertura(mascara_c, r_min)`. Es lo mismo que hoy, pero en lugar de marcarlo «sin asignar», se guarda.
2. Se descartan los componentes de `finas` con largo < `LARGO_MINIMO_LINEA_MM` (1,5 mm): son ruido de antialias, no líneas.
3. **Esqueleto** (Zhang-Suen, ~60 líneas) de `finas ∪ (borde de las partes gruesas que tocan esas finas)`, para que la línea engrosada empalme con el resto.
4. **Dilatación del esqueleto con un disco de radio `grosor/2`**, usando `distanciaCuadrada`, en O(píxeles). El resultado tiene ancho uniforme = grosor, como el «centerline + stroke» de Inkscape.
5. Se pinta `c` sobre lo dilatado **con prioridad sobre los otros colores y sobre el fondo** (la silueta crece si la línea es el borde exterior). Si dos colores finos compiten, gana el más oscuro.
6. Recién después: apertura normal para el resto e islas.
7. Si `grosorLineasMm` es `null`, todo queda **idéntico a hoy** (banco golden intacto).
8. **Resolución:** si el diagnóstico ve trazos de menos de 2 px, se corre con `mmPorPixel = 0,05`. Hay que medir el costo: se estiman +250 ms, dentro del presupuesto de 2 s.

**Estado y archivos**
- `pipeline/defaults.ts`: `GROSOR_LINEAS_MM = { minimo: 0.8, porDefecto: 1.0, maximo: 2.0 }` y `LARGO_MINIMO_LINEA_MM = 1.5`, cada uno con su origen (el mínimo ata con `ANCHO_MINIMO_DETALLE_MM`, PROVISORIO hasta P1).
- `pipeline/morfologia.ts`: `esqueleto()` y `dilatar()`.
- `pipeline/limpiar.ts`: parámetro `grosorLineasMm: number | null`.
- `pipeline/index.ts`: `ParamsPipeline.grosorLineasMm`, que pasa a `limpiar`.
- `pipeline/diagnostico.ts`: caso `lineas-finas` y detección de empastado (componentes que se unen).
- `workers/imagen.worker.ts`: `OpcionesImagen.grosorLineasMm`.
- `estado/documento.ts`: `ajustes.grosorLineasMm` y `cambiarGrosor()` con 250 ms de espera. Entra al historial.
- `crear/SolapaFondo.tsx` · `i18n/es.ts` · `tests/pipeline.test.ts`.

**Aceptación**
- [ ] Anillo sintético de 0,4 mm a 50 mm: con grosor 1,0 queda un anillo cerrado, y `drcDetalle` no avisa sobre él.
- [ ] Ancho medido del trazo engrosado (2 × distancia máxima al borde en el eje) = grosor ± 0,1 mm.
- [ ] Formas gruesas (disco de 10 mm) conservan el área ± 1 %.
- [ ] Con `grosorLineasMm: null`, los snapshots del banco golden no cambian.
- [ ] Al mover el slider, la vista 2D se actualiza en < 600 ms en la PC de desarrollo.
- [ ] En `logo-lineas-degrade`, ② muestra 0 % perdido (salvo las letras, si están marcadas como texto).

---

### ④ «Tocá lo que es fondo» · **M (3 días)**

**Qué resuelve:** lo que ningún slider puede resolver: **fondo encerrado por un contorno** (el interior del círculo, los huecos de la «o», el cielo dentro de un marco), degradés y restos. Es el «Select & Erase» de Cricut y el balde del slicer. Además construye la **lista de operaciones** que usan ⑥ y ⑦.

**La decisión de diseño clave: ¿qué pasa con un fondo encerrado?** En un llavero, «eso es fondo» adentro del círculo casi nunca quiere decir «agujerealo». Quiere decir «**eso es la placa**». Entonces:
- Si la zona tocada **toca el fondo de afuera** → se saca (damero).
- Si está **encerrada por el dibujo** → **se rellena con el color de la base**. El aviso ofrece «Agujerearlo» (patrón sólido/agujero de Tinkercad).

**Flujo**
1. En Fondo, la herramienta por defecto es **Tocar**. El cursor es una mano. En celular, el dedo.
2. Tocás adentro del círculo, sobre el degradé gris.
3. En < 100 ms la zona parpadea con un contorno (vista previa en el cliente sobre la imagen de trabajo). Se agrega la operación y el worker reprocesa. La 3D se actualiza.
4. Aviso: «Lo rellené con el color de la base.» con **[Agujerearlo]** y **[Deshacer]**. Si la zona era afuera: «Listo, eso era fondo.» con [Deshacer].
5. Si quedó otra franja del degradé, el aviso también ofrece **[Sacar también los parecidos]**: la versión no contigua, que agarra todos los píxeles de ese color en el dibujo.
6. **Mantener apretado / clic derecho / Alt+clic** = «Esto no es fondo» → «Lo devolví al dibujo.»
7. En el panel, siempre: **«Volver al recorte automático»**, que vacía las operaciones (entra al historial).

**Wireframe**
```
┌────────────────────────── lienzo ──────────────────────────┐
│  [ Tu imagen ][ Comparar ][▓ Cómo va a salir ▓]    ↩  ↪    │
│            ░░░░▒▒▒▒▒▒▒▒▒▒▒░░░░                             │
│          ░░▒▒   ┌╌╌╌╌╌╌╌┐   ▒▒░░                            │
│         ░▒▒     ╎  👆   ╎    ▒▒░   ← zona tocada (contorno) │
│          ░░▒▒   └╌╌╌╌╌╌╌┘   ▒▒░░                            │
│            ░░░░▒▒▒▒▒▒▒▒▒▒▒░░░░                             │
├────────────────────────────────────────────────────────────┤
│ Lo rellené con el color de la base.                        │
│ [Sacar también los parecidos] [Agujerearlo] [Deshacer]     │
└────────────────────────────────────────────────────────────┘
PANEL
HERRAMIENTA
 [▓ 👆 Tocar lo que es fondo ▓]  [ ✏️ Retocar ]
 Tocá lo que es fondo para sacarlo. Si está adentro
 del dibujo, lo relleno con el color de la base.
 ░ Volver al recorte automático ░
```

**Microcopy (`es.fondo.tocar`)**
| Clave | Texto |
|---|---|
| `herramienta` | Herramienta |
| `tocar` | Tocar lo que es fondo |
| `retocar` | Retocar |
| `ayuda` | Tocá lo que es fondo para sacarlo. Si está adentro del dibujo, lo relleno con el color de la base. |
| `ayudaDevolver` | Mantené apretado (o Alt + clic) para devolver algo al dibujo. |
| `listoAfuera` | Listo, eso era fondo. |
| `listoRelleno` | Lo rellené con el color de la base. |
| `agujerear` | Agujerearlo |
| `agujereado` | Listo, quedó agujereado. |
| `parecidos` | Sacar también los parecidos |
| `devuelto` | Lo devolví al dibujo. |
| `nada` | Ahí no encontré nada para sacar. Probá tocando un poco más adentro. |
| `automatico` | Volver al recorte automático |
| `todoFondo` | Eso se llevaría casi todo el dibujo, así que no lo saqué. Probá tocando otra parte. |

**Dónde vive:** interacción en `crear/VistaMascara.tsx` (pointer events, paso de coordenadas de pantalla a imagen, vista previa) · selector de herramienta y ayuda en `SolapaFondo.tsx` (1 control) · aviso breve reutilizable en `crear/controles.tsx`.

**Semántica de la zona (en `pipeline/mascara.ts › zonaDesdeToque`)**
- Relleno 4-conexo sobre el recorte de trabajo en OKLab. Cada vecino se compara con **su vecino** (paso < 0,03) **y** con la semilla (< 0,25). Así se recorre un degradé suave y se frena en un trazo, que es un salto brusco. El comentario de `mascaraPorFloodFill` advierte que comparar con el vecino se escapa en escaneos: acá lo compensan el tope contra la semilla y el deshacer.
- «Parecidos» (no contiguo): todos los píxeles de la máscara a < 0,10 del color medio de la zona.
- Tope de seguridad: si la zona supera el 85 % del dibujo, no se aplica (`todoFondo`).
- Encerrada = la zona **no toca** ningún píxel de fondo conectado al borde de la imagen.

**Estado y archivos**
- `pipeline/tipos.ts`: `OperacionImagen = { tipo: 'fondo' | 'dibujo' | 'agujero'; x: number; y: number; alcance: 'contiguo' | 'parecidos' }`, con coordenadas **normalizadas 0..1 sobre `caja`**. La propuesta ⑥ agrega `{ tipo: 'pincel'; modo; radio; puntos }`.
- `pipeline/tipos.ts`: `RegionTrazada.esBase?: true`.
- `pipeline/index.ts`: `ParamsPipeline.operaciones`, re-aplicadas después de `mascaraDe(trabajo)` y antes de la erosión. Las zonas «relleno» se marcan con una etiqueta `RELLENO`: no participan en k-means y salen como región `esBase`. Las zonas `agujero` y las de afuera se ponen en 0 en la máscara.
- `diseno/crear.ts`: una región `esBase` usa `base.id` sin mirar ΔE.
- `workers/imagen.worker.ts`: guardar en caché previa, `caja` y `trabajo` por (archivo, caja, mm/px). Una corrida por toque arranca en la máscara (objetivo ~200 ms).
- `estado/documento.ts`: `caja` fija después de la primera conversión (se pasa en `ParamsPipeline.caja`), `ajustes.operaciones`, `tocar()`, `volverAlAutomatico()`, y todo al historial de ①.
- `crear/VistaMascara.tsx` · `crear/SolapaFondo.tsx` · `i18n/es.ts` · `tests/pipeline.test.ts`.

**Aceptación**
- [ ] `logo-lineas-degrade`: 1 toque adentro del anillo → `filamentos` sin gris, silueta con el mismo área ± 1 %, **sin agujero pasante** (`cuerpo.decompose().length === 1` y sin huecos).
- [ ] «Agujerearlo» deja un hueco, la DRC no bloquea y el 3MF abre.
- [ ] Un toque afuera sobre un resto de degradé → ese resto pasa a damero.
- [ ] Alt+clic o mantener apretado devuelve la zona.
- [ ] Las operaciones sobreviven a cambiar la cantidad de colores, el tipo de imagen y el grosor (misma `caja`).
- [ ] Del toque a la vista previa 2D: < 100 ms. Del toque a la 3D: < 1 s en la PC de desarrollo.
- [ ] Un toque que se llevaría > 85 % no se aplica y muestra `todoFondo`.
- [ ] «Volver al recorte automático» deja `etiquetas` byte a byte igual que sin operaciones.
- [ ] Funciona con dedo en 375 px (el toque se ajusta a la zona más cercana dentro de 6 px de pantalla).

---

### ⑤ Tipo «Líneas» + acabado en relieve · **M/L (3,5 días)**

**Qué resuelve:** lleva La Ronda, y cualquier logo de trazo, firma o dibujo a pluma, de «corregible» a **lindo con un click**. Arma la placa que sigue el borde exterior (el «Trazar borde exterior» de Silhouette) y pone las líneas encima, a ras o en relieve. **Reemplaza a «Silueta»**, que hoy sobre el gato «saca solo los trazos» (`f2-interfaz.md`): mismo umbral adaptativo, pero rellenando el interior. Así Tipo de imagen sigue con 4 opciones.

**Flujo**
1. Si en Dibujo aparece `lineas-finas` y la tinta es de 1 o 2 colores oscuros sobre claro, la tarjeta de ③ suma una segunda opción: **[Probar «Líneas»]**.
2. Con «Líneas», el pipeline:
   - extrae la tinta (umbral adaptativo), así que el degradé se va solo, adentro y afuera;
   - engrosa las líneas (③, 1,0 mm por defecto);
   - **rellena el interior de la silueta como base** (lo encerrado es placa);
   - agrupa la tinta en hasta 2 colores (k-means solo sobre la tinta).
3. En Llavero, `▸ Avanzado` suma «Las líneas: **A ras** · **En relieve**». Con el tipo «Líneas» arranca en relieve.
4. En Colores, si el usuario elige «Solo 1 (los cambio a mano)», aparece la nota: «Con líneas en relieve te queda 1 sola pausa.»
5. Descargar ya explica las pausas por capa. En relieve con AMS no hay pausas: cada pieza tiene su lugar.

**Wireframe (resultado La Ronda en «Líneas» + relieve, vista 3D en corte)**
```
          tinta en relieve (+0,6 mm), 1 filamento
      ▄▄      ▄  ▄▄▄  ▄      ▄▄
  ▐██████████████████████████████▌  ← placa base (silueta rellena + borde 1,5 mm)
  ▐██████████████████████████████▌     3,0 mm
```

**Microcopy**
| Clave | Texto |
|---|---|
| `fondo.presets.lineas` | Líneas |
| `fondo.presetsDetalle.lineas` | logos de trazo, firmas |
| `fondo.lineas.probar` | Probar «Líneas» |
| `fondo.lineas.sugerencia` | Parece un dibujo de líneas. Con «Líneas» relleno el interior y engroso los trazos. |
| `llavero.lineas` | Las líneas |
| `llavero.acabados` | A ras · En relieve |
| `llavero.acabadoDetalle.aRas` | lisas, al mismo nivel |
| `llavero.acabadoDetalle.relieve` | sobresalen 0,6 mm, se sienten al tacto |
| `colores.relieveUnSlot` | Con líneas en relieve te queda 1 sola pausa. |
| `descargar.relieveAms` | Las líneas en relieve van en su propio lugar: no hay pausas. |

**Dónde vive:** `SolapaFondo.tsx` (opción del grupo Tipo: el presupuesto no cambia) · `SolapaLlavero.tsx` dentro de `▸ Avanzado` (`data-avanzado`, así que Llavero sigue en 5) · nota en `SolapaColores.tsx`.

**Estado y archivos**
- `pipeline/presets.ts`: `NombrePreset` suma `'lineas'` y saca `'silueta'` (o lo deja como alias para `proyecto.json` viejos). `PRESETS.lineas = { colores: 2, radioPrefiltro: 1, areaMinimaIslaMm2: 0.5 }`.
- `pipeline/mascara.ts`: `rellenarInterior(mascara)` = todo lo que no alcanza el relleno desde el borde de la imagen sobre `¬tinta`.
- `pipeline/index.ts`: `fuenteMascara: 'lineas'` = tinta por umbral adaptativo; `grosorLineasMm` por defecto 1,0; la región `esBase` es el interior relleno menos la tinta.
- `pipeline/diagnostico.ts`: sugerir `lineas` (con `cambiarSolo: false`).
- `diseno/tipos.ts`: `cuerpo.acabado: 'a_ras' | 'relieve'` y `cuerpo.alturaRelieve` (0,6). Hay que migrar `proyecto.json` (versión 1: sin campo = a ras).
- `geometria/franjas.ts`: `franjasRelieve()` = la base extruida a `espesor` y cada color extruido `alturaRelieve` **encima**, con su propio filamento y lugar (la geometría de `franjasApilado` con la asignación de `franjasAras`).
- `geometria/construir.ts`: elegir el constructor según `modoColor × acabado`. En apilado + relieve, las franjas empiezan en `espesor`.
- `geometria/estimar.ts`: el volumen de purga es solo el de la tinta.
- `geometria/drc.ts`: `drcFlotantes` sigue valiendo (la tinta siempre queda sobre la base, porque la silueta la contiene).
- `export/3mf`, `export/instrucciones.ts`: verificar la z de inicio de cada pieza y los textos.
- `crear/SolapaFondo.tsx`, `SolapaLlavero.tsx`, `SolapaColores.tsx` · `i18n/es.ts` · `tests/construir.test.ts` (disjuntas, volumen > 0, z máxima = espesor + relieve).

**Aceptación**
- [ ] `logo-lineas-degrade` en «Líneas»: 2 filamentos (base + tinta), silueta = disco + borde, anillo presente con ancho ≥ 0,8 mm, degradé ausente, 0 % en rojo (salvo letras marcadas).
- [ ] Relieve: z máxima de la tinta = `espesor + 0,6` mm, piezas disjuntas, manifold válido, 3MF abre en Bambu Studio con 2 lugares (prueba manual en la matriz de `3mf.md`).
- [ ] Apilado + relieve + 1 color de tinta: `cambiosDeCapa.length === 1`.
- [ ] Un `proyecto.json` guardado antes (sin `acabado`) abre igual que antes.
- [ ] El banco golden de Dibujo y Foto no cambia. Las muestras de Silueta se regeneran a propósito, con un commit que lo diga.
- [ ] Presupuesto: Fondo ≤ 4, Llavero = 5.

---

## 8. Resto de las propuestas (resumen)

### ⑥ Retocar: pincel, varita, «Parecido», deshacer · M (2,5 d, sobre la infra de ④)
- **Flujo:** tocar [Retocar] abre, debajo del selector de herramienta, un panel `data-avanzado` con: **Pincel** · **Varita** · modo **Sacar / Devolver** · **Tamaño del pincel** · **Parecido** (tolerancia de la varita) · casilla **Solo lo que está pegado** (contiguo). Zoom con rueda o pellizco, desplazamiento con barra espaciadora o dos dedos (plan §4.3).
- **Microcopy:** «Pincel» · «Varita» · «Sacar» · «Devolver» · «Tamaño del pincel» · «Parecido: poco ─●─ mucho» · «Solo lo que está pegado» · ayuda: «Pintá lo que sobra con Sacar, o lo que falta con Devolver.» · «Listo» para cerrar.
- **Estado:** `OperacionImagen` tipo `pincel` (trazo normalizado + radio en proporción de la caja) y tipo `varita` con `parecido`, `contiguo`. Una pincelada completa (del pointerdown al pointerup) = **1 paso** de deshacer (plan §8.3). Vista previa en el cliente pintando sobre el canvas y reprocesado con 300 ms de espera (plan §7.6).
- **Archivos:** nuevo `crear/LienzoMascara.tsx` (plan §6: reemplaza a `VistaMascara`), `pipeline/mascara.ts` (rasterizar trazos), `estado/documento.ts`.
- **Aceptación:** las 5 fotos de mascota del banco quedan aceptables en < 60 s cada una (aceptación de F2 en el plan), 1 pincelada = 1 deshacer, y el presupuesto de Fondo no cambia con el panel abierto (todo `data-avanzado`).
- **Desvío del plan a propósito:** el plan cuenta «tamaño de pincel» como uno de los 4 de Fondo. Acá pasa a Retocar, porque solo sirve mientras se pinta, y ese lugar lo toma «Grosor de las líneas».

### ⑦ Texto del logo → texto de la app · S/M (1,5 d)
- **Detección:** `texto-chico` corrido **antes** de la limpieza (ver ②), más componentes chicos de altura parecida (< 4 mm) alineados. Se guardan sus cajas.
- **Tarjeta en Fondo:** «Las letras de tu logo miden unos 2 mm: impresas no se van a leer.» con **[Reemplazarlas por texto]** · **[Dejarlas]**.
- **Reemplazar:** agrega operaciones `fondo` (encerradas → base) sobre esas componentes, lleva a `/crear#llavero` con el campo Texto enfocado y placeholder «Escribí lo que decía, por ejemplo «La Ronda»», más la ayuda: «Cortito se lee mejor: con 24 letras como máximo.» Si el texto hace crecer el llavero más de 30 %: «Con «${texto}» el llavero pasa a ${mm} mm de ancho. Probá con menos palabras.»
- **Ubicación:** hoy `agregarTexto` pone el texto siempre abajo. Primer paso barato: dentro del grupo Texto, chips **Abajo · Arriba · Adentro** (adentro = centrado en la caja del dibujo, con la base debajo). Texto en arco y arrastrar quedan para la manipulación directa (F2.5/Fase 5).
- **Archivos:** `pipeline/diagnostico.ts`, `diseno/texto.ts` (parámetro `posicion`), `SolapaLlavero.tsx`, `i18n/es.ts`. **Sin OCR** (no hay IA y Tesseract pesa varios MB): el usuario escribe.

### ⑧ El tamaño reprocesa · S (0,5 d)
- Al soltar el slider Tamaño (o 400 ms después), si hay imagen se reprocesa con `ladoMayorMm = lado`. A 80 mm el umbral de 0,8 mm equivale a trazos 1,6 veces más finos en la imagen original.
- El texto `texto-chico` («Probá hacerlo más grande») pasa a ser cierto. Suma un botón: «Agrandar a ${mm} mm», con el tamaño mínimo que ya no pierde nada, calculado desde el ancho de lo perdido (plan §4.8 caso 4: «pasaría a 62 mm»).
- **Archivos:** `SolapaLlavero.tsx › escalar` → `estado/documento.ts › cambiarTamano()`, `OpcionesImagen.ladoMayorMm`.

### ⑨ Clusters tocables en Foto · S (1 d)
- Con el tipo Foto, «Tocar lo que es fondo» alterna el cluster que tocaste (usa `clustersFondo`, que el worker ya acepta). Arriba del lienzo, fila de 6 muestras con ✓ (wireframe del plan §4.3). Microcopy: «Tocá los colores que son fondo» · «✓ = es fondo».

### ⑩ Arreglar los textos (§2.3) · XS (0,25 d)
- `sinDibujo` → «Me llevé casi todo el dibujo. Probá con otro tipo de imagen, o con una versión del logo sobre fondo blanco liso.» Cuando exista ④: «…o tocá lo que no es fondo para devolverlo.»
- `fondo-complejo` → «Si el recorte no quedó bien, probá con el tipo «Foto».» con botón [Probar «Foto»] (el caso ya trae `sugerirPreset`).
- `texto-chico` → «Parece que hay texto chico: puede salir ilegible.» (sin prometer lo que el tamaño no hace, hasta ⑧).
- Sumar al test de textos una regla nueva: **ningún texto nombra una herramienta que no está en la interfaz** (lista blanca de nombres de herramienta en `es.ts`).

### ⑪ «Cuánto fondo sacar» · S (0,5 d)
- Slider sin número de `toleranciaFloodFill` (2–40), solo con Dibujo y sin transparencia, con 80 ms de espera (plan §7.2). Es útil con degradés **afuera** del dibujo. Se deja para el final porque **no resuelve lo encerrado**: eso lo resuelve ④ con un toque.

---

## 9. Presupuesto de controles: antes y después

| Solapa | Máx. (§7.8) | Hoy | Con la propuesta | Qué va detrás de «Retocar» / «Avanzado» |
|---|---|---|---|---|
| **Fondo** | 4 | 1 (Tipo) | **4**: Tipo de imagen · Herramienta (Tocar / Retocar) · Grosor de las líneas *(si hay líneas finas)* · Cuánto fondo sacar *(solo Dibujo)* | Pincel/varita, Sacar/Devolver, Tamaño del pincel, Parecido, Solo lo pegado |
| **Colores** | 3 | 3 | **3**: Cuántos · Lista (ahora con acciones por fila) · Impresora | — |
| **Llavero** | 5 | 5 | **5**: Tamaño · Espesor · Argolla · Borde · Texto (con chips de posición dentro del mismo grupo) | Las líneas: a ras / en relieve |
| **Descargar** | 1 | 1 | 1 | — |
| Cromo (no cuenta) | — | Arriba/3D/Capas | + Tu imagen/Comparar/Cómo va a salir · ↩ ↪ · avisos breves con acción | — |

El test de presupuesto tiene que **excluir explícitamente** el cromo de la vista y los botones de acción de los avisos (no llevan `data-control`), y dejar escrito por qué.

---

## 10. La Ronda con la propuesta, de punta a punta

```
1. Sube el logo → Automático (Dibujo)
   Lienzo en «Cómo va a salir»: disco gris + laureles, con el círculo, el mate y las letras en ROJO.
   🟡 «Tu dibujo tiene líneas más finas de lo que se puede imprimir. ¿Las engroso?»
      [Engrosar las líneas] [Probar «Líneas»]                                   (② + ③ + ⑤)

2a. Camino corto: [Probar «Líneas»]
    → degradé fuera, interior relleno como base, círculo y mate a 1,0 mm, laureles intactos.
    🟡 «Las letras de tu logo miden unos 2 mm: impresas no se van a leer.»
       [Reemplazarlas por texto] → escribe «La Ronda» → posición «Adentro»             (⑦)
    Llavero ▸ las líneas: En relieve (ya viene así). Base Blanco + tinta Gris oscuro.
    Si imprime con 1 filamento: 1 pausa.                                                (⑤)

2b. Camino manual (Dibujo):
    [Engrosar las líneas] → vuelven el círculo y el mate                                (③)
    Toca adentro del círculo → «Lo rellené con el color de la base.»                    (④)
    (o en Colores: Gris → Es fondo, Gris 2 → Es fondo)                                  (①)
    Se equivocó → Ctrl+Z                                                                (①)

3. Descargar: 2 colores, sin rojo, 0 avisos de detalle.
```

Tiempo esperado para el camino corto: **menos de 30 segundos y 4 clicks** después de procesar.

---

## 11. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación |
|---|---|---|
| 1 | **0,8 mm es PROVISORIO** (hasta imprimir P1). El mínimo del slider de grosor depende de eso. | El mínimo lee `ANCHO_MINIMO_DETALLE_MM`. Recalibrarlo es cambiar una constante y regenerar el banco, como ya dice el plan. |
| 2 | Engrosar **empasta letras y detalles cercanos**. | Detectar uniones nuevas de componentes → sugerencia de texto (⑦). El slider permite bajar. El rojo de ② lo muestra. |
| 3 | La vista previa en el cliente del toque puede **no coincidir** con el resultado del worker. | La vista previa es solo un contorno que parpadea. La verdad es la corrida del worker (< 400 ms con caché). |
| 4 | Comparar con el vecino en ④ **se escapa** en JPG y escaneos con bordes suaves. | Tope contra la semilla (0,25), tope de 85 %, deshacer, y «Parecido» en Retocar para afinar. |
| 5 | Reprocesar en cada toque o pincelada en **Android de gama media** (tiempos pendientes en `tiempos.md`). | Caché de previa/caja/trabajo en el worker. Arrancar la corrida en la máscara. Medir en `/#/dev/pipeline` antes de cerrar ④. |
| 6 | `mmPorPixel = 0,05` para líneas cuadruplica los píxeles. | Solo si el diagnóstico ve trazos < 2 px. Medir contra el presupuesto de 2 s / 5 s. |
| 7 | Reemplazar «Silueta» por «Líneas» cambia proyectos guardados. | Alias `silueta → lineas` al abrir `proyecto.json`. Regenerar las muestras de Silueta a propósito. |
| 8 | **¿La pestaña debería llamarse «Dibujo» en vez de «Fondo»?** Con ③, ④ y ⑦ hace mucho más que el fondo. | Pregunta para el usuario (dueño del producto). No bloquea: los textos de la propuesta funcionan con los dos nombres. |
| 9 | ¿El relieve por defecto con «Líneas» también con AMS? | Propuesto: sí. En AMS a ras es más prolijo, pero el relieve se entiende mejor con 2 colores de alto contraste. Se valida con 3 personas mirando las dos vistas 3D. |

---

## 12. Cómo validar la propuesta sin imprimir

1. **Agregar al banco golden** (F0.7) tres imágenes sintéticas que hoy no tiene: `logo-lineas-degrade` (el caso La Ronda sin la marca), `badge-circulo-texto` (texto curvo de 2 mm dentro de un anillo de 0,5 mm) y `logo-marco-cerrado` (marco cuadrado con colores planos adentro). Hoy las tres deberían fallar de la misma manera que La Ronda: es la línea de base.
2. Métrica por imagen: IoU de la silueta, **fracción perdida** (②) y cantidad de filamentos contra lo esperado.
3. Prueba de pasillo cronometrada con las tres personas del criterio de F2: «llegá a un llavero que te guste de este logo». Hoy: no llegan. Objetivo con 1-4: < 2 min. Con 5: < 1 min.
