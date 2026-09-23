# Calculadora de costos de impresión 3D — Especificación completa

> **Instrucción para la IA:** Construí una aplicación web **local** (sin backend) que funcione abriéndola en el navegador de la PC. Preferentemente un único archivo `index.html` con HTML + CSS + JavaScript vanilla (sin dependencias externas ni build). Si preferís otra tecnología, avisá antes. Seguí **exactamente** las fórmulas de la sección 4: están verificadas contra la calculadora original y los casos de prueba de la sección 8 tienen que dar idénticos.

---

## 1. Objetivo

Calcular el **costo real** de una impresión 3D (material, electricidad, desgaste de la máquina, margen de error, insumos) y el **precio sugerido de venta**, tanto para venta directa como para MercadoLibre.

Título: **Calculadora 3D**
Subtítulo: *Calculá el costo real de tus impresiones y el precio sugerido de venta.*

---

## 2. Estructura de la pantalla

Layout en dos columnas en escritorio (formulario a la izquierda, resultados a la derecha, resultados "sticky"); en celular, una columna con los resultados abajo.

### 2.1 Bloque "Perfil" (arriba de todo)
- **Selector de perfil**: desplegable con los perfiles guardados + opción `-- Nuevo perfil --`.
- **Botón "Nuevo"**: limpia los gastos fijos a valores por defecto y deja el selector en "Nuevo perfil".
- **Selector de moneda** (ver sección 5).
- **Botón "Guardar perfil"**: pide un nombre (prompt o input) y guarda los **gastos fijos + moneda** en localStorage. Si el perfil ya existe, lo sobrescribe.
- Opcional (agregado mío): botón "Eliminar perfil".
- Al elegir un perfil del desplegable, se cargan sus valores en el formulario.

### 2.2 Bloque "Gastos fijos"
| Etiqueta en pantalla | Variable | Tipo | Valor por defecto | Ayuda |
|---|---|---|---|---|
| Precio del filamento ($/kg) | `precioKg` | número ≥ 0 | 25000 | — |
| Precio del kWh ($) | `precioKwh` | número ≥ 0 | 140 | — |
| Modelo de impresora | `modelo` | desplegable | "Otro / Personalizado" | *Elegí tu modelo y autocompletamos el consumo (W). Si no está en la lista, dejá "Otro / Personalizado".* |
| Consumo de la impresora (W) | `watts` | número ≥ 0 | 100 | *Consumo promedio durante un print (no peak). Si no lo sabés, ~100W es un buen valor default.* |
| Vida útil de la máquina (horas) | `vidaUtilHs` | número > 0 | 4320 | — |
| Costo de repuestos ($) | `repuestos` | número ≥ 0 | 150000 | — |
| Margen de error (%) | `errorPct` | número ≥ 0 | 5 | — |

Comportamiento del modelo de impresora:
- Al elegir un modelo, se autocompleta `watts` con su valor (tabla de la sección 6).
- Si el usuario edita `watts` a mano, el modelo pasa a "Otro / Personalizado".

> El símbolo de moneda en las etiquetas cambia según la moneda elegida (ej: "AR$/kg", "US$/kg").

### 2.3 Bloque "Pieza"
| Etiqueta | Variable | Tipo | Defecto |
|---|---|---|---|
| Horas de impresión | `horas` | número ≥ 0 | vacío (=0) |
| Minutos adicionales | `minutos` | número 0–59 | vacío (=0) |
| Gramos de filamento | `gramos` | número ≥ 0 | vacío (=0) |
| Insumos extra ($) | `insumos` | número ≥ 0 | vacío (=0) |

Los campos vacíos cuentan como 0.

### 2.4 Bloque "Margen de ganancia"
- **Botones de multiplicador** (se elige uno solo; el elegido queda resaltado): `×2`, `×2.5`, `×3`, `×3.5`, `×4`, `×5`, `Personalizado`.
- Al elegir "Personalizado" aparece un input numérico con ayuda: *Si necesitás otro valor, ingresalo acá (ej: 2.8).*
- Valor por defecto: ×3.
- **Botón/acordeón "Referencias"** que muestra:
  - ×2.0 → Alto volumen / descuento
  - ×2.5 → Volumen medio
  - ×3.0 → Mayorista
  - ×3.5 → Intermedio
  - ×4.0 → Minorista
  - ×5.0 → Llaveros / piezas chicas

### 2.5 Panel "Resultados"
Se recalcula **en vivo** con cada cambio de cualquier campo (sin botón "calcular").

Filas, en este orden:
1. Precio material
2. Precio luz
3. Desgaste máquina
4. Margen de error
5. Costo total (sin insumos)
6. Insumos (+30%)

Luego, destacados en grande:
- **TOTAL A COBRAR**
- **PRECIO MERCADOLIBRE**

Botón al final: **"Guardar como producto"** (ver sección 7).

---

## 3. Unidades

- Gramos → kg: `/1000`
- Watts → kW: `/1000`
- Minutos → horas: `/60`

---

## 4. Fórmulas (verificadas contra la original)

```js
const tiempoHs     = horas + minutos / 60;

const material     = (gramos / 1000) * precioKg;
const luz          = (watts / 1000) * tiempoHs * precioKwh;
const desgaste     = (repuestos / vidaUtilHs) * tiempoHs;
const margenError  = (material + luz + desgaste) * (errorPct / 100);

const costoTotal   = material + luz + desgaste + margenError;   // "Costo total (sin insumos)"
const insumosFinal = insumos * 1.30;                              // "Insumos (+30%)"

const totalCobrar  = costoTotal * multiplicador + insumosFinal;          // "TOTAL A COBRAR"
const precioML     = costoTotal * multiplicador * 1.16 + insumosFinal;   // "PRECIO MERCADOLIBRE"
```

Reglas clave (no cambiar):
- El **margen de error** se aplica sobre material + luz + desgaste (no sobre insumos).
- Los **insumos NO se multiplican** por el multiplicador; solo llevan un recargo fijo del **30%**.
- El **precio MercadoLibre** agrega un **16%** solo a la parte multiplicada (`costoTotal * multiplicador`); los insumos se suman igual que en el total.
- **No redondear en los pasos intermedios.** Calcular todo con precisión completa y redondear a 2 decimales **solo al mostrar**.
- Si `vidaUtilHs` es 0 o vacío, `desgaste = 0` (evitar división por cero).
- Constantes configurables (dejarlas como constantes al inicio del código): `RECARGO_INSUMOS = 0.30`, `RECARGO_ML = 0.16`.

---

## 5. Monedas

Solo cambian el símbolo y el formato; **no hay conversión** entre monedas.

| Nombre en el selector | Código | Símbolo sugerido |
|---|---|---|
| Pesos argentinos (ARS) | ARS | AR$ |
| Dólares (USD) | USD | US$ |
| Euros (EUR) | EUR | € |
| Pesos mexicanos (MXN) | MXN | MX$ |
| Pesos colombianos (COP) | COP | COL$ |
| Pesos chilenos (CLP) | CLP | CLP$ |
| Soles (PEN) | PEN | S/ |
| Pesos uruguayos (UYU) | UYU | $U |
| Pesos dominicanos (DOP) | DOP | RD$ |
| Guaraníes (PYG) | PYG | ₲ |

Formato de números: `es-AR` → punto de miles y coma decimal, 2 decimales. Ej: `AR$ 11.598,81`.
Usar `Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` y anteponer el símbolo.

---

## 6. Modelos de impresora y consumo (W)

```js
const IMPRESORAS = [
  { nombre: "Bambu Lab A1", w: 95 },
  { nombre: "Bambu Lab A1 Mini", w: 45 },
  { nombre: "Bambu Lab P1P", w: 80 },
  { nombre: "Bambu Lab P1S", w: 100 },
  { nombre: "Bambu Lab X1 Carbon", w: 120 },
  { nombre: "Bambu Lab P2S", w: 130 },
  { nombre: "Bambu Lab H2S", w: 210 },
  { nombre: "Bambu Lab H2D", w: 210 },
  { nombre: "Bambu Lab H2C", w: 210 },
  { nombre: "Prusa MK3S+", w: 80 },
  { nombre: "Prusa MK4", w: 100 },
  { nombre: "Creality Ender 3 V2", w: 110 },
  { nombre: "Creality Ender 3 S1", w: 120 },
  { nombre: "Creality K1", w: 100 },
  { nombre: "Creality K1C", w: 100 },
  { nombre: "Creality K1 Max", w: 200 },
  { nombre: "Creality K2", w: 150 },
  { nombre: "Creality K2 Pro", w: 180 },
  { nombre: "Creality K2 Plus", w: 220 },
  { nombre: "Anycubic Kobra 2", w: 75 },
  { nombre: "Anycubic Vyper", w: 80 },
  { nombre: "SnapMaker U1", w: 130 },
  { nombre: "Elegoo Saturn 3 (resina)", w: 75 },
  { nombre: "Elegoo Saturn 4 (resina)", w: 75 },
  { nombre: "Voron 2.4 (350mm DIY)", w: 225 },
  { nombre: "Otro / Personalizado", w: null }
];
```

En el desplegable mostrar como `Nombre (W W)`, ej: `Bambu Lab A1 (95 W)`.

---

## 7. Persistencia (localStorage)

Todo local, sin servidor. Envolver lecturas/escrituras en `try/catch`.

**Claves:**
- `calc3d_perfiles` → objeto `{ [nombrePerfil]: { precioKg, precioKwh, modelo, watts, vidaUtilHs, repuestos, errorPct, moneda } }`
- `calc3d_ultimo_perfil` → nombre del último perfil usado (se carga al abrir)
- `calc3d_productos` → array de productos guardados

**"Guardar como producto":** pide un nombre de producto y guarda:
```js
{
  id, nombre, fecha,             // fecha ISO
  perfil, moneda,
  entradas: { horas, minutos, gramos, insumos, multiplicador, ...gastosFijos },
  resultados: { material, luz, desgaste, margenError, costoTotal, insumosFinal, totalCobrar, precioML }
}
```

**Sección "Mis productos"** (agregado para la versión local, debajo de la calculadora o en una pestaña):
- Tabla con: nombre, fecha, gramos, tiempo, costo total, total a cobrar, precio ML.
- Acciones por fila: **Cargar** (vuelve a poner esos valores en la calculadora), **Eliminar**.
- Botones globales: **Exportar JSON** (descarga perfiles + productos), **Importar JSON**, **Exportar CSV** (productos).

---

## 8. Casos de prueba (tienen que dar exactamente esto)

Gastos fijos para ambos casos: `precioKg=25000`, `precioKwh=140`, `watts=120`, `vidaUtilHs=4320`, `repuestos=150000`, `errorPct=5`, multiplicador `×5`.

### Caso A — 3 h, 0 min, 70 g, sin insumos
| Concepto | Resultado |
|---|---|
| Precio material | AR$ 1.750,00 |
| Precio luz | AR$ 50,40 |
| Desgaste máquina | AR$ 104,17 |
| Margen de error | AR$ 95,23 |
| Costo total (sin insumos) | AR$ 1.999,80 |
| Insumos (+30%) | AR$ 0,00 |
| **TOTAL A COBRAR** | **AR$ 9.998,98** |
| **PRECIO MERCADOLIBRE** | **AR$ 11.598,81** |

### Caso B — 3 h, 30 min, 70 g, insumos 1000
| Concepto | Resultado |
|---|---|
| Precio material | AR$ 1.750,00 |
| Precio luz | AR$ 58,80 |
| Desgaste máquina | AR$ 121,53 |
| Margen de error | AR$ 96,52 |
| Costo total (sin insumos) | AR$ 2.026,84 |
| Insumos (+30%) | AR$ 1.300,00 |
| **TOTAL A COBRAR** | **AR$ 11.434,22** |
| **PRECIO MERCADOLIBRE** | **AR$ 13.055,70** |

> Nota: 1.999,80 × 5 daría 9.999,00, pero la original muestra 9.998,98 porque multiplica el valor **sin redondear** (1.999,795...). Si tu resultado da 9.999,00, estás redondeando en el medio: corregilo.

Incluí en el código una función `runTests()` que ejecute estos dos casos y muestre en la consola si pasan.

---

## 9. Requisitos de diseño y UX

- Tema oscuro por defecto con opción de claro. Tarjetas con bordes redondeados y un color de acento (ej: naranja o violeta).
- Responsive: tiene que funcionar bien en el celular.
- Inputs numéricos con `inputmode="decimal"`; aceptar tanto coma como punto decimal.
- No permitir negativos (tomarlos como 0).
- Totales grandes y bien visibles; "PRECIO MERCADOLIBRE" con un color distinto al de "TOTAL A COBRAR".
- Opcional: botón para copiar el total al portapapeles.
- Todo en español rioplatense.

---

## 10. Entregable esperado

1. `index.html` único y autocontenido (CSS y JS adentro), que funcione con doble clic sin servidor.
2. Constantes de configuración (recargos, defaults, impresoras, monedas) agrupadas al principio del script.
3. Los casos de prueba de la sección 8 pasando.
