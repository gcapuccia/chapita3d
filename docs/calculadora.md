# Calculadora 3D · cómo quedó

Implementa `docs/calculadora-3d-spec.md` como una app más de Chapita3d, en `/calculadora`.

| Pieza | Archivo |
|---|---|
| Las cuentas (§4) | `src/calculadora/formulas.ts` |
| Tablas de impresoras, monedas y multiplicadores (§5 y §6) | `src/calculadora/datos.ts` |
| Perfiles y productos en el navegador (§7) | `src/calculadora/guardado.ts` |
| Pantalla | `src/paginas/Calculadora.tsx` + `src/calculadora/Campo.tsx` |
| Textos | `src/i18n/esCalculadora.ts` |
| Casos de prueba (§8) | `tests/calculadora.test.ts` |

## Lo que cambia respecto del documento

- **No es un `index.html` suelto**: es una página dentro de la web, con el marco, la paleta y la
  tipografía de la marca. Las cuentas y los resultados son idénticos.
- **`runTests()` en la consola → tests automáticos.** Los dos casos de la §8 corren en cada
  `pnpm verificar`, junto con bordes que el documento no pedía: vida útil en 0, negativos, que el
  margen de error no toque los insumos, coma o punto decimal, y el formato de cada moneda.
- **Nombres por campo en vez de `prompt()`**: guardar un perfil o un producto abre un campo en la
  misma tarjeta. El documento lo permitía («prompt o input»).
- El CSV va con punto y coma, que es lo que abre Excel en español sin romper la coma decimal.

## Verificado en el navegador

Caso A (3 h, 70 g, ×5) da **AR$ 9.998,98** y **AR$ 11.598,81**; caso B (3 h 30, 70 g, insumos 1000)
da **AR$ 11.434,22** y **AR$ 13.055,70**. Guardar un perfil, recargar la página, guardar un producto
y volver a cargarlo devuelven exactamente los mismos valores.

## Pendiente

- Guardar los productos en la cuenta (hoy solo en el navegador, como se pidió).
- Sumar la calculadora a la landing cuando haya más de una app para mostrar.
