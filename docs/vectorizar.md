# Vectorizar · cómo quedó

El paso que faltaba antes del llavero: sacar el fondo, convertir, y **borrar a mano lo que sobró**
antes de llevarlo a imprimir. Vive en `/vector/crear`.

| Pieza | Archivo |
|---|---|
| Borrador, pincel y la mancha que se toca | `src/vector/pincel.ts` |
| Regiones en mm → SVG | `src/vector/svg.ts` |
| El lienzo y lo que hace el dedo | `src/vector/Lienzo.tsx` |
| Estado, historial y los pases a otras apps | `src/estado/vector.ts` |
| Pantalla | `src/paginas/Vector.tsx` |
| Textos | `src/i18n/esVector.ts` |
| Pruebas | `tests/vector.test.ts` |

## La decisión de fondo: se edita el mapa, no los contornos

`convertir()` ya devuelve el **mapa de etiquetas** (`diagnostico.etiquetas`): un byte por píxel con
el índice del color, o `FONDO`. A 0,1 mm por píxel y 50 mm de lado mayor son unos 500 × 500: entra
en la mano y se copia entero en menos de un milisegundo.

Editar ahí y volver a llamar a `trazar()` tiene tres ventajas sobre editar los contornos:

- **Lo que ves es lo que se imprime.** El mapa es lo que el pipeline ya resolvió (islas, líneas
  finas engrosadas, fondo encerrado). No hay una segunda verdad que pueda discrepar.
- **Borrar una mota es borrar píxeles**, no adivinar qué anillo sobra ni qué anillo era su agujero.
- **Deshacer es una copia del array.** 250 KB por paso, 24 pasos: simple y sin bugs.

El precio es que no se pueden arrastrar nodos de una curva. Para lo que se pidió —sacar lo que no
va, recortar un borde, tapar un agujero— el pincel alcanza y sobra.

## Las tres herramientas

- **Borrar manchas**: un clic y se va la mancha entera. Al pasar por encima se **prende en rojo lo
  que se iría**, antes de tocar: nadie borra medio dibujo sin querer. Si se toca fondo, se prende
  en lima y el clic lo rellena con el color elegido (sirve para tapar un agujero).
- **Borrador**: pincel de grosor regulable, para recortar un borde a mano.
- **Pincel**: lo mismo pero pintando con un color de la paleta.

`Ctrl+Z` y `Ctrl+Shift+Z` deshacen y rehacen. Rueda para acercar, Shift y arrastrar para mover, dos
dedos en el celular.

### Por qué la mancha va por color y no por «toda la tinta junta»

La primera versión agrupaba toda la tinta como una sola clase, para que una mota de dos colores se
fuera de un clic. Probándola con el logo de La Ronda quedó claro que no servía: en un logo relleno,
**toda la tinta es una sola mancha** y la herramienta prendía el dibujo entero.

Ahora la mancha es el conjunto conexo del **mismo color**. Tocar el aro exterior agarra el aro;
tocar el relleno agarra el relleno. Vecindad de 4, también a propósito: una mota pegada en diagonal
al dibujo es una mota y se borra sola, no se lleva el dibujo puesto.

## A dónde va lo que sale

Al bajar el SVG aparece el ofrecimiento de seguir en otra app. El ofrecimiento vive en el estado
(`ofrecido`), no en la pantalla, así sobrevive a irse y volver.

- **Descargar el SVG**: un `<path>` por color, `fill-rule="evenodd"` para que los agujeros queden
  agujereados, medidas en mm y `viewBox` en mm. Abre en Illustrator, Inkscape o donde sea.
- **Usar en el llavero** (`usarDesdeEditor` en `src/estado/documento.ts`): entra con la conversión
  editada, **sin archivo**. Sin archivo `procesar()` sale solo, así que ni Fondo ni Colores pueden
  reprocesar y perder lo editado; la solapa Fondo lo dice y ofrece volver al editor.
- **Usar en el sello**: manda la **silueta** de toda la tinta junta, de un solo color, que es lo
  que necesita un sello. Si se quieren solo las líneas, hay que borrar el relleno antes; está
  escrito al lado del botón.

## Lo que verifican las pruebas, sin abrir el navegador

- El círculo del pincel no se sale de su radio, y pintar dos veces lo mismo no cuenta de nuevo.
- El trazo no sale punteado aunque el puntero salte (se interpola entre los dos puntos).
- Una mota pegada en diagonal es una mota: borrarla deja el dibujo entero.
- La mancha es la del color que se toca, no toda la tinta pegada.
- Tocar el fondo devuelve el hueco encerrado, no todo el fondo.
- Borrar la mota deja una sola región al volver a trazar.
- El SVG sale con un path por color, con y para abajo, y nada se va del `viewBox`.
- Un agujero sale como anillo aparte, para que `evenodd` lo agujeree.

## Probado en el navegador

Con `public/marca/hero-antes.png` (el logo de La Ronda, 53 × 53 mm, 4 colores): el aro exterior se
prende entero al pasar por encima y se va de un clic; deshacer lo trae de vuelta; el borrador
recorta a mano. El SVG baja en 38 KB con 4 paths. «Usar en el sello» abre `/sellos/crear` con el
dibujo puesto, y «Usar en el llavero» abre `/llaveros/crear` con el llavero ya construido y la
solapa Fondo mostrando la máscara editada.

## Pendiente

- Los avisos que se ven en el llavero (`conversion.diagnostico.casos`) son los de la conversión
  original, no los de lo editado. Dicen qué hizo el pipeline, que sigue siendo cierto, pero no
  saben de las ediciones.
- Guardar lo editado en la cuenta, como se guardan los diseños.
- Una goma que respete el borde del color de al lado, para recortar sin comerse al vecino.
