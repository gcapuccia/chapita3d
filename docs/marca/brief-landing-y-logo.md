# Brief para Claude Design · Landing + logo

**Para:** diseñar la página de inicio (antes de entrar a la app) y la marca.
**Fecha:** 2026-09-15 · **Idioma de todo lo visible:** español rioplatense, de vos.
**App funcionando hoy:** https://3dllaveros.vercel.app

---

## 1 · Qué es el producto

Una web que convierte una imagen (logo, dibujo, silueta) en un llavero 3D **listo para imprimir**, con
sus colores separados por filamento. Todo pasa en el navegador de quien la usa: la imagen no se sube a
ningún servidor, no hay IA de por medio y no hay cuenta ni pago para convertir.

Lo que entrega: un ZIP con un **.3mf multicolor** (Bambu Studio / OrcaSlicer), **un .stl por color** y la
pieza entera, **INSTRUCCIONES.txt** y el proyecto para volver a editarlo.

Lo que ya hace y conviene mostrar:
- Saca el fondo solo, incluso cuando está encerrado dentro de un círculo o es un degradé.
- **Engrosa las líneas finas** hasta que se puedan imprimir, en vez de borrarlas.
- Avisa lo que no va a salir bien (partes finas, demasiados colores, texto ilegible) **antes** de descargar.
- Vista 3D con tres modos (desde arriba, en 3D, por capas), tamaño, espesor, tipo de argolla, borde y texto.
- Funciona igual con impresora de un solo filamento: genera las pausas y dice en qué capa cambiar el color.
- Elegir el color de cada filamento y el grosor de las líneas de cada color.

## 2 · Qué tiene que lograr la landing

1. Que la persona entienda en 5 segundos qué hace y para quién es.
2. **Que se cree una cuenta** (Google o correo) y pruebe la app.
3. Dejar sembrado que más adelante hay más: pedir llaveros impresos, cotizador, otras herramientas.

Métrica principal: cuentas creadas. Secundaria: imágenes convertidas y ZIP descargados.

> **Decisión pendiente (importante para el diseño).** Hoy la app no tiene cuentas ni servidor: todo corre
> en el navegador. Sumarlas es posible, pero cambia la arquitectura. Hay dos caminos y el diseño tiene que
> contemplar el elegido:
>
> - **A · Muro blando (recomendado).** Se prueba sin cuenta y la cuenta se pide para **guardar proyectos,
>   volver a abrirlos y recibir novedades**. El público maker desconfía de los registros obligatorios, y el
>   producto vende solo cuando ve su llavero en 3D. La landing pide la cuenta dos veces: arriba (botón
>   secundario "Crear cuenta") y después de la primera descarga.
> - **B · Muro duro.** No se puede convertir sin cuenta. Más cuentas por visita, menos visitas que llegan
>   al final. Si se elige este, la landing necesita explicar muy bien qué gana la persona con la cuenta.
>
> El diseño debería entregar **las dos variantes de la sección de registro**, para poder probar.

## 3 · A quién le hablamos

**Principal: gente que ya tiene impresora 3D** (Bambu Lab con AMS, Prusa, Ender). Sabe lo que es un slicer,
un filamento y una purga. Le molesta:
- que los generadores existentes sean de pago o pidan tarjeta,
- que la IA le invente un modelo que no se parece a su logo,
- pasar media hora en Inkscape + Tinkercad para un llavero,
- descubrir en la impresora que una línea era demasiado fina.

**Más adelante** (no ahora, pero la marca no tiene que cerrarles la puerta): comercios que quieren llaveros
con su logo, regalos personales (dibujo de un hijo, una mascota) y locales que imprimen para otros.

## 4 · Qué decimos que nos hace distintos

| Mensaje | Cómo se dice en la página |
|---|---|
| Sin IA: sale tu logo, no una versión inventada | "Tu logo, no la idea que una IA se hace de tu logo." |
| Privado: nada se sube | "Tu imagen no sale de tu computadora." |
| Gratis | "Gratis, sin límite de descargas." |
| Multicolor de verdad | "Un .3mf con los colores separados, listo para el AMS." |
| También para una sola boquilla | "¿Un solo filamento? Te digo en qué capa cambiarlo." |
| Te avisa antes de imprimir | "Te marco lo que no va a salir, antes de gastar filamento." |
| Rápido | "De la imagen al ZIP en menos de 5 segundos." |

Tono: directo, de vos, sin marketinería y sin jerga técnica innecesaria. Nada de "revolucionario",
"potenciado por IA" ni "solución integral". Palabras prohibidas en todo lo visible: extrusor, mesh,
render, buffer, polígono, vértice, malla, worker, offset (la app ya tiene un test que lo verifica).

## 5 · El nombre

Se busca **nombre nuevo**. Criterios:

- Corto, que se pueda decir por teléfono en español sin deletrear.
- Que funcione como dominio (.com o .com.ar) y como usuario de Instagram.
- Que no encierre al producto solo en "llaveros": mañana puede haber imanes, dijes, señaladores.
- Que no empiece con "3D" (lo hacen todos) ni termine en "-ify" o "-AI".

**Candidatos** (elegir uno, o usarlos de punto de partida):

| Nombre | Por qué | En contra |
|---|---|---|
| **Chapita** | En Argentina una chapita es exactamente esto: la plaquita del llavero. Cálido, propio, memorable. Da "chapita.app". | Muy local: fuera de Argentina no se entiende. Doble sentido ("estar chapita"), que puede jugar a favor. |
| **Dije** | Corto, lindo, y ya significa "colgante". Sirve para llaveros, imanes y colgantes. | Se confunde con el verbo decir. |
| **Argolla** | Concreto y físico, la parte que hace que sea un llavero. | Menos lindo al oído. |
| **Filo** | De filamento. Corto, suena bien, sirve de marca paraguas para más herramientas. | Muy usado en otros rubros. |
| **Copiapega** | Describe lo que hace: tu imagen pasa al objeto. Simpático. | Largo. |
| **Milímetro / 1 mm** | Guiño a lo que importa: que el detalle entre. Habla el idioma maker. | Difícil de decir rápido. |

Mi recomendación: **Chapita** si el foco es Argentina, **Dije** si pensás en Latinoamérica.
El nombre elegido tiene que verse bien junto a un descriptor, porque solo no explica nada:
*"Chapita · llaveros 3D desde tu imagen"*.

> Puedo verificar la disponibilidad del dominio de los que te gusten antes de que dibujes el logo.

## 6 · Brief del logo

**Concepto a explorar (en orden de preferencia):**

1. **La chapita**: una forma de llavero (plaquita o círculo) con su agujero, y adentro la inicial o una marca
   simple. El agujero de la argolla como el único "hueco" del isotipo: es el detalle que lo hace reconocible.
2. **Dos mitades de color**: la misma forma partida en dos o tres colores planos, guiño al multicolor y a las
   capas de filamento.
3. **La imagen que se convierte**: un cuadradito de foto que se transforma en una chapita. Riesgo de quedar
   literal y complicado; probarlo igual.

**Requisitos duros:**
- Funciona en **un solo color** (se imprime en 3D: el logo tiene que poder ser un llavero real).
- Legible a **16 px** (favicon) y a 1 cm impreso.
- Sin degradés, sin sombras, sin líneas más finas que 1/12 de su alto (si no, no se imprime).
- Versión horizontal (isotipo + nombre) e isotipo suelto.
- Sobre fondo claro y sobre fondo oscuro.

**Evitar:** la impresora 3D dibujada, el cubo isométrico, la boquilla extruyendo, el degradé violeta de "app
de IA", el cerebro, y la tipografía de ciencia ficción.

**Entregables:** SVG del isotipo, SVG horizontal, favicon (cuadrado, legible a 16 px), versión monocroma,
y los colores en hex.

## 7 · Estructura de la landing

Una sola página, sin menú de navegación (o con un menú mínimo: Cómo funciona · Preguntas · Entrar).
Mobile primero: el 375 px tiene que quedar impecable.

### 7.1 · Barra superior
Logo a la izquierda. A la derecha: **Entrar** (texto) y **Crear cuenta** (botón). Nada más.

### 7.2 · Hero
- **Título:** "Convertí tu logo en un llavero listo para imprimir."
- **Bajada:** "Subís una imagen y bajás el .3mf con los colores separados. Gratis, sin IA y sin que tu
  imagen salga de tu computadora."
- **Botón principal:** "Probar con mi imagen" (lleva a la app).
- **Botón secundario:** "Crear cuenta" (o, en la variante B, el principal es "Crear cuenta gratis").
- **Debajo, chiquito:** "Bambu Studio · OrcaSlicer · PrusaSlicer · un archivo por color."
- **Visual:** antes y después. A la izquierda un logo de línea (tipo el de una tienda), a la derecha el
  llavero 3D ya resuelto. Ideal: que se pueda arrastrar una divisoria. Si se puede, que el 3D gire solo,
  despacio. Si no, una imagen fija en tres cuartos.

### 7.3 · Prueba en vivo (opcional pero potente)
La dropzone de la app, embebida acá mismo: "Arrastrá tu imagen y mirá qué sale. No hace falta cuenta."
Con tres muestras para tocar (logo, dibujo, silueta). Es el argumento más fuerte que tenemos: el producto
se explica solo en 5 segundos.

### 7.4 · Cómo funciona, en tres pasos
1. **Subís tu imagen.** PNG, JPG o WEBP. También una foto del dibujo.
2. **Ajustás.** Fondo, colores, tamaño, argolla, grosor de las líneas. Lo ves en 3D mientras tocás.
3. **Descargás el ZIP.** El .3mf para tu AMS, un .stl por color y los pasos escritos.

Cada paso con una captura real de la app (las tengo: se pueden generar en el tamaño que pidas).

### 7.5 · Lo que resuelve (la sección que convence al maker)
Cuatro tarjetas con un antes/después chico en cada una:
- **Las líneas finas no desaparecen.** "Un logo de trazo fino se borra al imprimirlo. Acá se engrosan hasta
  el mínimo que tu impresora puede hacer, y vos elegís cuánto."
- **El fondo se va, aunque esté encerrado.** "Un logo dentro de un círculo o sobre un degradé también sale."
- **Colores de verdad.** "Cada color, su filamento. Y si tenés una sola boquilla, te digo en qué capa cambiarlo."
- **Te aviso antes de imprimir.** "Partes frágiles, texto ilegible, más colores que lugares en el AMS."

### 7.6 · Compatibilidad
Una línea de logos o nombres: Bambu Lab (A1, P1S, X1C con AMS), OrcaSlicer, PrusaSlicer, Creality.
**Ojo legal:** no usar los logos de esas marcas sin permiso; escribir los nombres en texto es suficiente y
es lo que pide el respeto de marcas.

### 7.7 · Privacidad
Bloque corto con un ícono: "Tu imagen no se sube a ningún lado. La conversión pasa entera en tu navegador,
incluso sin internet una vez cargada la página." Es diferencial y además es verdad.

### 7.8 · Crear cuenta
- Qué gana: **guardar tus diseños**, volver a abrirlos desde cualquier equipo, y enterarte de lo que viene.
- Dos botones: **Seguir con Google** y **Crear cuenta con correo**.
- Una línea honesta debajo: "Te escribimos solo cuando hay algo nuevo. Podés borrar tu cuenta cuando quieras."
- Variante B (muro duro): el mismo bloque, arriba de todo, y la prueba en vivo se saca.

### 7.9 · Lo que viene (siembra, sin prometer fechas)
Tres ítems en gris, tipo lista: "Pedir el llavero impreso y que te llegue a casa" · "Cotizador por cantidad
para comercios" · "Más formas: imanes, dijes, señaladores".

### 7.10 · Preguntas
- ¿Es gratis? Sí, y las descargas no tienen límite.
- ¿Usa IA? No. Es un proceso de imagen, así que el resultado se parece a tu imagen, no a una versión inventada.
- ¿Sirve para mi impresora? Si tu slicer abre .3mf o .stl, sí.
- ¿Y si no tengo AMS? Te da la misma pieza con las pausas y la lista de capas para cambiar el filamento.
- ¿Qué tan chico puede salir el detalle? Lo más fino que se imprime bien ronda 0,8 mm; la app engrosa o avisa.
- ¿Puedo usar cualquier imagen? Solo imágenes tuyas o con permiso. Convertirlas no te da derechos sobre
  logos o personajes de otros.
- ¿Qué archivos me llevo? Un .3mf multicolor, un .stl por color, la pieza entera y las instrucciones.

### 7.11 · Pie
Logo, una línea de qué es, enlaces: Privacidad · Términos · Contacto · Instagram. Y "Hecho en Argentina".

## 8 · Sistema visual

Estilo elegido: **simple y claro**. Fondo claro, mucho aire, una sola familia tipográfica redonda, un color
de acento, y que las fotos del producto (los llaveros) sean lo único colorido.

Lo que ya usa la app y conviene mantener para que la landing y la app sean la misma cosa:

- **Tipografías (libres, ya instaladas):** Nunito (redonda, para todo) y Lilita One (gruesa, para títulos
  cortos si hace falta contraste). Si proponés otra, que sea de licencia libre (OFL).
- **Color:** escala neutra cálida (los grises "stone" de Tailwind, #FAFAF9 a #1C1917). Acento actual: el
  negro/piedra oscuro de los botones. **Falta definir un acento de marca**: proponé uno que se vea bien
  impreso en PLA (naranja filamento, verde lima, cian) y que pase contraste AA sobre blanco.
- **Formas:** esquinas bien redondeadas (12 a 24 px), sombras suaves y bajas, bordes finos de 1 px.
- **Botones:** alto mínimo 44 px, texto en negrita, sin degradés.
- **Accesibilidad:** contraste AA (4.5:1 en texto), foco visible con teclado, nada que dependa solo del color.

## 9 · Restricciones técnicas (para que se pueda implementar tal cual)

- Se implementa en **React 19 + Tailwind 4**, estático, en Vercel. No hay servidor propio.
- **Nada de librerías externas por CDN** ni fuentes de Google cargadas en vivo: las fuentes van empaquetadas.
- Imágenes: propias o generadas por nosotros. **Nada de stock con licencia dudosa ni logos ajenos.**
- La página tiene que cargar rápido en un celular: la parte 3D pesa y se carga después, así que el hero
  debería resolverse con imagen, video corto propio o un 3D que entre después sin mover el diseño.
- Modo oscuro: opcional. Si lo diseñás, que sea con los mismos tokens.
- Todos los textos en un solo archivo (`src/i18n/es.ts`): entregá el copy en una lista, no pegado a las imágenes.

## 10 · Material disponible

- App funcionando para sacar capturas: https://3dllaveros.vercel.app
- Imágenes de muestra propias (logo, dibujo, silueta) y renders del llavero en 3D.
- Un caso real completo: el logo de una tienda (círculo con laureles, texto y un mate en el centro) y su
  llavero resuelto, ideal para el antes/después del hero.
- Puedo generar cualquier captura o render que el diseño necesite, en el tamaño que pidas.

## 11 · Cuando esté el diseño, lo doy por listo si

1. El hero se entiende en 5 segundos: qué es, para quién y qué me llevo.
2. Hay un solo botón principal por pantalla, y en el celular se ve sin scrollear.
3. Está la versión de 375 px de ancho de todas las secciones.
4. Están las dos variantes del bloque de cuenta (muro blando y muro duro).
5. El logo funciona a 16 px, en un solo color, y se podría imprimir como llavero.
6. Ningún texto usa jerga de la lista prohibida, y todo está en un archivo aparte para pegarlo al código.

## 12 · Lo que necesito que decidas

1. **El nombre** (o descartar la lista y proponer otro).
2. **Muro blando o duro** para la cuenta.
3. **Color de acento** de la marca.
4. Si querés el **cotizador y el pedido de impresión** ya nombrados en la landing o solo insinuados.
5. Dominio: si querés que verifique disponibilidad y precio de los nombres que te gusten.

---

## Resuelto (2026-09-20)

El diseño llegó desde Claude Design y está implementado. Copia local en
`docs/marca/diseno/Chapita3d.dc.html`.

- **Nombre:** Chapita3d. **Acento:** lima `#C6F24E` sobre carbón `#14161A` (paleta «Modo taller»).
- **Muro:** blando. Se prueba sin cuenta; el bloque de cuenta está armado pero los botones dicen
  «Muy pronto» hasta que haya un servicio de autenticación.
- **Isotipo:** `src/marca/Isotipo.tsx` (chapita con el agujero y CH3d en dos líneas). El favicon va
  sin letras, como pide el diseño.
- **Copy:** `src/i18n/esLanding.ts`, tal cual el `copy-landing.md` del diseño.
- **Imágenes:** `public/marca/`. Las tres capturas de «Cómo funciona» y las de «Lo que resuelve»
  salieron de la app de verdad; las dos comparaciones antes/después las genera
  `node spikes/09-marca/figuras.ts` desde el motor.
- **Pendiente del diseño:** el turno 7 (la app `/crear` en Modo taller) todavía no se migró: la app
  sigue clara.
