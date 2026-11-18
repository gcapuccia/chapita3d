# Cortantes de galletitas · cómo quedó

Subís un dibujo y salen dos piezas: el **cortante**, que sigue la silueta, y un **marcador** opcional
que entra adentro y deja los detalles hundidos en la masa. Vive en `/cortantes/crear`.

| Pieza | Archivo |
|---|---|
| Cortante, marcador, avisos y el marcado por defecto | `src/cortantes/cortante.ts` |
| ZIP con los STL y los pasos | `src/export/paqueteCortante.ts` |
| Armado en el worker | `src/workers/geometria.worker.ts` › `construirCortante` |
| Estado (imagen, muestra, viene de Vectorizar) | `src/estado/cortante.ts` |
| Pantalla | `src/paginas/Cortantes.tsx` |
| Textos | `src/i18n/esCortantes.ts` |
| Pruebas | `tests/cortante.test.ts` |

La imagen pasa por el mismo pipeline que los llaveros (`preset: 'auto'`): de ahí salen las
regiones por color, en mm. El resto es geometría.

## Las decisiones

- **Todo va espejado en X.** El cortante se imprime con el reborde en la cama y el filo para arriba,
  y para usarlo se da vuelta; el marcador se imprime con el dibujo para arriba y también se da
  vuelta. Espejadas, la galletita sale al derecho: un texto se lee bien. La vista 3D lo avisa, y
  la tarjeta "Así sale la galletita" la dibuja al derecho para que no queden dudas.
- **La galletita no tiene agujeros.** Un filo suelto adentro no tendría de dónde agarrarse. La forma
  es el dibujo con margen (3 mm por defecto), rellena; los detalles los pone el marcador.
- **Los entrantes angostos se cierran** (radio 1,5 mm): ahí la masa no entra. El margen ya redondea
  lo de afuera.
- **Las partes sueltas se unen con puentes**, no con un cierre sobre toda la silueta. El cierre se
  aplica solo donde hay dos partes distintas cerca, con un radio que crece hasta que queda una sola
  pieza. Así el hueco entre las orejas del gato sigue ahí. Avisa que lo hizo.
- **El filo se afina en escalones**: 1,2 mm en la base y 0,6 mm en la punta, en seis escalones de
  medio milímetro a lo largo de los últimos 3 mm. El slicer lo ve como rampa. La cara de adentro
  queda recta, que es la que corta.
- **El marcador** es la forma achicada por la holgura (0,6 mm por lado), de 2,4 mm, con el dibujo
  de 2 mm arriba. El dibujo se aleja 1 mm del borde para no rozar el filo.

## Qué marca el marcador

- **Las líneas** (por defecto): el borde de cada color, de 1,2 mm. Queda como un dibujo para
  colorear, que es lo que se busca para decorar con glasé.
- **Colores**: los colores que elijas, enteros. Al entrar a este modo arranca con todos menos el que
  más ocupa, que suele ser el cuerpo y hundiría la galletita entera.
- **Sin marcador.**

`marcadoPorDefecto` elige **Colores** con el color más oscuro cuando el dibujo es de líneas (un trazo
oscuro con ancho medio menor al 5 % del dibujo): con "Las líneas" saldría cada trazo doble.

## Avisos

- Las partes sueltas se unieron.
- El marcador tiene líneas más finas que 1 mm (la masa no las toma).
- El marcador quedó vacío (por ejemplo, en Colores sin ninguno elegido).

## Desde y hacia Vectorizar

- "¿Quedó algo de más? Limpialo en Vectorizar" abre la misma imagen ahí, y Vectorizar muestra
  **Volver al cortante con esto** sin tener que bajar el SVG antes.
- Vectorizar también ofrece **Usar en el cortante** después de bajar el SVG, como con el llavero y el
  sello. Manda las regiones por color, así el marcador sigue teniendo los detalles.

## Lo que verifican las pruebas, sin imprimir ni hornear

- Una sola pieza válida, apoyada en el piso, de la altura pedida, con la galletita del largo pedido.
- El filo en la punta mide la mitad que a media altura.
- Espejado: un detalle de la derecha queda a la izquierda en el marcador, y a la derecha en la
  galletita dibujada.
- El marcador entra en el cortante con su holgura.
- Dos manchas sueltas dan un solo cortante; el entrante de una U no se rellena; un aro da una
  galletita sin agujero.
- Líneas, colores y sin marcador; marcador vacío; líneas finas.
- El marcado por defecto, con un dibujo de líneas y con uno relleno.
- El ZIP: piezas, nombre sin tildes, instrucciones con el espejado y los cuidados.
- El gato de muestra, de punta a punta por el pipeline, en menos de 3 s.

## Probado en el navegador

Con las tres muestras (`public/muestras`): el gato (líneas: contorno, ojos y nariz), el logo de la
estrella (líneas y colores) y la flor. La flor fue a Vectorizar, se le borró la hoja y volvió sin la
hoja. El ZIP baja como `cortante-flor.zip` con `cortante.stl`, `marcador.stl` e
`INSTRUCCIONES.txt`. En el celular, la vista arriba y los controles abajo. Arma en 0,6 a 1,3 s.
