# Sellos para gofrar · cómo quedó

Implementa `docs/sellomaker-bisagra-replica.md` como app de Chapita3d, en `/sellos/crear`.

| Pieza | Archivo |
|---|---|
| Bisagra print-in-place, generada por código | `src/sellos/bisagra.ts` |
| Las dos placas y sus avisos | `src/sellos/placas.ts` |
| SVG → contornos (usa el DOM, va en la pantalla) | `src/sellos/svg.ts` |
| ZIP con los STL y los pasos | `src/export/paqueteSello.ts` |
| Armado en el worker | `src/workers/geometria.worker.ts` › `construirSello` |
| Estado y pantalla | `src/estado/sello.ts`, `src/paginas/Sellos.tsx` |
| Textos | `src/i18n/esSellos.ts` |
| Pruebas | `tests/sellos.test.ts` |

## Lo que cambia respecto del documento

- **La bisagra es propia y paramétrica**, no un STL fijo hecho con OpenSCAD. Mismas medidas de
  referencia (35,5 mm de largo, hoja de 11,6 mm, pasadores cónicos, 0,3 mm de aire), con una
  diferencia a propósito: **el barril mide 2 × el espesor de la placa (8 mm, no 7)**, para que el eje
  de giro quede a la altura de la cara del sello. Así, al cerrarlo, las dos caras se encuentran
  exactas; con 7 mm quedaba 1 mm de interferencia.
- **Las placas son un sólido de verdad**, armado con el mismo motor que los llaveros, en vez de
  mallas apiladas que el slicer tenía que unir. Cada mitad sale como una sola pieza.
- **El hueco de la hembra sale del offset del motor**, no del cálculo casero con inglete del
  documento: aguanta curvas y agujeros. Las islas de los agujeros internos aparecen solas, porque el
  offset agranda el contorno y achica los agujeros al mismo tiempo.
- **Sin Firebase, sin pagos y sin login**, como pedía el documento.

## Lo que verifican las pruebas, sin imprimir

- La bisagra es un sólido válido, apoya en z = 0 y mide lo que dice.
- Son **dos piezas que se enganchan y no se tocan**; con holgura 0 **sí** se pisan (o sea que la
  prueba mide algo).
- Cada placa es una sola pieza, y macho y hembra no se tocan.
- **Al cerrar el sello, el relieve entra en el hueco sin chocar**; con tolerancia negativa choca.
- El hueco siempre es más hondo que el relieve, con los cuatro materiales.
- El dibujo entra con su margen, y con 2 o 3 bisagras las placas se alargan igual.

## Lo que se agregó después (2026-09-29)

- **El relieve se lee en pantalla.** Una cara de 0,4 mm tiene la misma inclinación que la placa, así
  que el motor le daba el mismo color: no se veía nada. La vista de sellos enciende una luz rasante
  (`relieve` en `src/crear/Vista3D.tsx`) a unos 20° sobre el plano, que proyecta ~1 mm de sombra
  por cada 0,4 mm de relieve, y baja el resto de las luces para no lavarla. Entra casi por el eje de
  la bisagra, así los nudillos no tiran sombra sobre las placas. La placa del hueco pasó de casi
  blanca a gris: dos claros pegados no se distinguían.
- **Texto en varios renglones.** El campo es un `textarea`: Enter abre un renglón nuevo, hasta 4
  renglones de 24 letras. Cada renglón se centra por su propia tinta y se apila con el alto natural
  de la fuente (`INTERLINEA` en `src/geometria/texto.ts`). No hace falta avisar cuando no entra:
  `sello()` escala el dibujo para que entre con su margen, y si al achicarse los trazos quedan por
  debajo de 0,8 mm salta el aviso de detalle fino que ya existía.
- **Ocho tipografías en vez de tres**: Redonda, Gruesa, Negra, Angosta, Con serifas, De bloque,
  Clásica y Manuscrita. Todas OFL-1.1, todas del subset latino de @fontsource, y cada `.woff` se
  baja recién cuando alguien la elige.

  Probé Lobster como «Cursiva» y **quedó afuera**: su «O» viene como un solo contorno pinchado en
  vez de anillo de afuera + agujero, así que la letra sale con el centro lleno. Lo agarró el test
  `la O de %s conserva su agujero`, que ahora corre sobre las ocho.

## Probado en el navegador

Texto «CHAPITA» y un SVG con agujero (una dona): las dos se ven en 3D con el relieve de un lado y el
hueco espejado del otro. El ZIP pesa 92 KB y trae `sello.stl`, `partes/macho.stl`,
`partes/hembra.stl` e `INSTRUCCIONES.txt`. Armar el sello tarda 37 ms.

## Pendiente

- **Imprimir**: calibrar la holgura de la bisagra (hay STL de 0,2 · 0,3 · 0,4 en
  `spikes/10-sellos/`) y comprobar que el sello marque bien en papel y en lata.
- La variante con imanes en vez de bisagra (el documento la daba como opcional).
- Exportar 3MF además de STL, si hace falta abrirlo con perfil.
- Vista «cerrado» para ver cómo encajan las dos placas antes de imprimir.
