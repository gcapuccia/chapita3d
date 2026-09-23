# Réplica local: generador de sellos para gofrar con bisagra (tipo Sellomaker)

> Documento para pasarle a una IA de código (Claude Code, Cursor, etc.) y construir en local una app web que genera **sellos de gofrado/embossing macho-hembra unidos por una bisagra print-in-place**, a partir de un SVG o texto, y exporta STL/3MF para imprimir en 3D.
>
> Análisis hecho sobre `sellomaker.com/app` (sept. 2026). No copiar código ni assets de ellos: la idea es reimplementar el mismo enfoque con código y bisagra propios.

---

## 1. Qué es el producto

Un "sello seco" impreso en 3D: dos placas unidas por una bisagra. Se imprime **abierto y plano** (las dos placas a los lados de la bisagra, todo apoyado en Z=0). Después se cierra como un libro sobre papel/aluminio/celofán y, al apretar, el logo queda en relieve.

- **Placa MACHO**: base + logo **en relieve** (sobresale).
- **Placa HEMBRA**: base más fina + marco con el logo **ahuecado** (el hueco es el logo agrandado con una tolerancia), más "islas" para los agujeros internos del logo (ej. el centro de una "O").
- **Bisagra**: una pieza STL fija, print-in-place, que se repite 1, 2 o 3 veces a lo largo del eje Y. La altura de las placas = altura de la bisagra × cantidad.
- Existe otra variante con **imanes** en vez de bisagra (la dejamos opcional).

---

## 2. Stack detectado en el sitio original

| Capa | Tecnología |
|---|---|
| Frontend | **HTML + JavaScript vanilla con ES Modules**, sin framework ni bundler (`<script type="importmap">`) |
| Estilos | **Tailwind CSS** (compilado a `tailwind.css`) + CSS propio |
| 3D / geometría | **Three.js r160** desde jsDelivr |
| Addons de Three | `SVGLoader`, `STLLoader`, `STLExporter`, `OrbitControls`, `BufferGeometryUtils.mergeGeometries` |
| Texto → vectores | **opentype.js 1.3.4** + fuentes TTF de Google Fonts (vía jsDelivr/GitHub) |
| Export 3MF | Exportador propio con **JSZip 3.10.1** (3MF con metadatos de Bambu Studio / Bambu A1) |
| Backend | **Firebase 11.6.1**: Auth (Google + anónimo), Firestore (proyectos, historial), Storage (STL exportados), Cloud Functions (pagos/créditos) |
| Pagos | Mercado Pago + PayPal (vía Cloud Functions) |
| Sitio principal / tienda | WordPress (el STL de la bisagra está servido desde `wp-content/uploads`) |
| i18n | `i18n.js` propio (ES/EN) |

**Importante:** toda la geometría se arma **en el navegador**. No hay CAD en el servidor ni booleanos CSG: todo es `ExtrudeGeometry` de `THREE.Shape` con agujeros, y el STL final es la suma de mallas superpuestas (los slicers lo unen sin problema).

Para la versión local **no hace falta Firebase ni pagos**. Alcanza con un frontend estático.

---

## 3. Stack recomendado para la réplica local

- **Vite** (vanilla JS o TypeScript) — o importmap sin bundler si querés algo idéntico.
- `three@0.160` (o más nuevo) + addons de `three/examples/jsm`.
- `opentype.js` para el texto.
- `jszip` (opcional, solo para 3MF).
- `manifold-3d` (opcional, mejora: unión booleana real para un STL limpio y manifold).
- **OpenSCAD** o **CadQuery** para modelar **tu propia bisagra** y exportarla como `public/hinge.stl`.
- Tailwind (opcional) para el panel.

Estructura sugerida:

```
sello-local/
├─ index.html
├─ public/
│  └─ hinge.stl            # bisagra propia (ver sección 5)
├─ hinge/
│  └─ hinge.scad           # fuente paramétrica de la bisagra
└─ src/
   ├─ main.js              # UI y eventos
   ├─ engine.js            # escena three, buildPlates(), export
   ├─ geometry/offset.js   # offsetPolygon()
   ├─ geometry/plates.js   # createRoundedRect(), macho, hembra
   ├─ text.js              # texto → SVG paths con opentype
   └─ export3mf.js         # opcional
```

---

## 4. Parámetros (valores por defecto observados)

```js
DEFAULTS = {
  plateWidth: 64.29,   // ancho de cada placa (mm)
  cornerRadius: 5.0,   // radio de esquinas (solo del lado exterior, lejos de la bisagra)
  logoOffset: 4.5,     // desplazamiento del logo en X, alejándolo de la bisagra
  gap: -4.0,           // separación placa↔bisagra; negativo = la placa se solapa 4 mm sobre la hoja de la bisagra
  tolerance: 0.22,     // holgura macho/hembra (offset del contorno en mm)
  padding: 4.0,        // margen interno para encajar el logo
  logoScale: 1.0,
  hingeCount: 1,       // 1, 2 o 3 bisagras
  specs: { thickness: 4.0, relief: 0.40, depth: 0.42 }
}
```

Presets de material (cambian `relief` = altura del logo macho y `depth` = profundidad del hueco hembra, siempre depth ≈ relief + 0.02):

| Preset | relief | depth |
|---|---|---|
| Latas / aluminio | 0.40 | 0.42 |
| Papel | 0.50 | 0.52 |
| Papel 300 g (usar mojado) | 0.60 | 0.62 |
| Celofán / bolsas | 1.20 | ~1.22 |

Otros estados: `logoRotation` (pasos de 90°), `swapPlates` (macho a derecha o izquierda), `exportFormat` ('stl' | '3mf'), `modelType` ('hinge' | 'magnet').

---

## 5. La bisagra

La original es un STL fijo de ~542 triángulos. Medidas relevantes (para replicar el encaje con las placas):

- Bounding box: **23.2 mm (X) × 35.5 mm (Y) × 7 mm (Z)**.
- Eje del pasador **paralelo a Y**; el barril tiene ~7 mm de diámetro y apoya en Z=0.
- Knuckles alternados a lo largo de Y (segmentos aprox. en ±17.75, ±13, ±11, ±4.5, ±2.7 mm), con pasadores cónicos (típico print-in-place).
- Dos hojas planas que salen a X = ±11.6 mm, donde se apoyan las placas.

**Tarea para la IA:** generar una bisagra propia paramétrica en OpenSCAD con estos parámetros:

```
length_y = 35.5      // largo de una unidad de bisagra
barrel_d = 7         // diámetro del barril
leaf_w   = 11.6      // ancho de cada hoja desde el eje
leaf_t   = 4         // espesor de hoja = espesor de placa
knuckles = 5         // cantidad de nudillos alternados
clearance = 0.3      // holgura print-in-place entre nudillos y pasador
pin = "cono"         // pasadores cónicos macho/hembra entre nudillos (sin soportes)
```

Exportar a `public/hinge.stl`. Al cargarla en three.js:

```js
const geo = new STLLoader().parse(buffer);
geo.center();
geo.computeBoundingBox();
geo.translate(0, 0, -geo.boundingBox.min.z); // apoyar en Z=0
hingeSize = geo.boundingBox.getSize(new THREE.Vector3());
// fallback si falla la carga: new THREE.BoxGeometry(23.2, 35.5, 4)
```

Repetición según `hingeCount`:

```js
const unitH = hingeSize.y;
const totalH = unitH * hingeCount;
const startY = -totalH/2 + unitH/2;
for (i in 0..hingeCount-1) mesh(hingeGeo).position.y = startY + i*unitH;
```

---

## 6. Algoritmo de construcción (`buildPlates()`)

Todo en milímetros, Z hacia arriba, cara de impresión en Z=0.

### 6.1 Preparación
1. Parsear el SVG con `SVGLoader().parse(svg).paths`; ignorar paths con `fill="none"` u opacidad 0; `SVGLoader.createShapes(path)` → lista de `THREE.Shape` (con `holes`).
2. Resolución de curvas adaptativa: `{segments:24, points:30}` normal; bajar a 12/16 o 8/12 si hay >20 o >40 paths; modo "draft" 6/10 mientras se arrastran sliders (debounce: draft en `requestAnimationFrame`, alta calidad con `setTimeout`).
3. Bounding box del logo usando `shape.extractPoints(res.points)`.

### 6.2 Layout
```
totalPlateH = hingeSize.y * hingeCount
startX      = hingeBBox.max.x + gap            // 11.6 + (-4) = 7.6
dir         = swapPlates ? 1 : -1
machoSide   = swapPlates ? 'right' : 'left'
hembraSide  = opuesto
centro placa macho  X = dir * (startX + plateW/2)
centro placa hembra X = -dir * (startX + plateW/2)
```

### 6.3 Escala y transformación del logo
```
availW = max(plateW - 2*padding, 1)
availH = totalPlateH - 2*padding
scale  = min(availW/svgW, availH/svgH) * logoScale   // svgW/H se intercambian si está rotado 90/270
```
Transformar cada punto: centrar en el bbox → rotar (`logoRotation * 90°`) → **invertir Y** (el SVG tiene Y hacia abajo) → escalar.
- Para la **hembra** además se invierte X (queda espejado, porque al cerrar la bisagra se enfrenta al macho) y se desplaza `-dir*logoOffset`.
- Para el **macho** se desplaza `+dir*logoOffset` en la posición de la malla.

### 6.4 Rectángulo redondeado "de un lado"
`createRoundedRect(w, h, r, side)`: rectángulo centrado en el origen con `quadraticCurveTo` en las esquinas **solo del lado exterior** (`'left'` o `'right'`); el lado pegado a la bisagra queda recto. `'full'` = las 4 esquinas.

### 6.5 Placa MACHO
- Base: `ExtrudeGeometry(roundedRect(plateW, totalPlateH, r, machoSide), {depth: thickness, bevelEnabled:false})`.
- Relieve: `ExtrudeGeometry(machoShapes, {depth: relief})` trasladado a `z = thickness - 0.05` (solapa 0.05 mm con la base para que el slicer lo funda).

### 6.6 Placa HEMBRA
- `bThick = thickness - depth`.
- Base: roundedRect extruido `bThick + 0.1`.
- Marco: roundedRect con **agujeros** = contorno exterior de cada letra desplazado **+tolerance** (`offsetPolygon(pts, +tol)`, con los puntos invertidos para que sea hole). Extruido `depth`, posición `z = bThick`.
- Islas: por cada agujero interno del logo, `offsetPolygon(holePts, -tol)` como `Shape` sólido, extruido `depth` a `z = bThick`.
- Resultado: la cara superior de la hembra es un negativo del logo con 0.22 mm de holgura por lado.

### 6.7 `offsetPolygon(points, distance)` (clave para la tolerancia)
Offset poligonal simple con miter:
1. Limpiar puntos duplicados (<0.001 mm) y el cierre repetido.
2. Normalizar orientación a antihoraria (signed area; si es horaria, invertir).
3. Por cada vértice: normales de las dos aristas adyacentes, bisectriz normalizada, `miter = 1 / max(dot(n1, bisector), 0.1)`.
4. Si `miter > 12` → bevel (dos puntos: `p + n1*d` y `p + n2*d`); si no → `p + bisector * d * miter`.
5. Distancia positiva = agranda; negativa = achica.

(Mejora opcional: usar `clipper-lib` o `manifold-3d` `CrossSection.offset()` para offsets robustos en logos complejos.)

### 6.8 Solo visual (no se exporta)
- `inkMesh`: `ShapeGeometry` del logo pintado arriba del relieve (color "tinta").
- `coverMesh` / `whiteHoleMesh`: tapas finas para que el hueco de la hembra se vea bien.
- Clipping planes (`renderer.localClippingEnabled = true`) a ±(plateW/2 − 0.1) y ±(totalH/2 − 0.1) para que el logo nunca se vea fuera de la placa.
- Aristas con `EdgesGeometry(geo, 30)` en modo "técnico".

---

## 7. Export

### STL
1. Ocultar mallas solo-visuales (`inkMesh`, `whiteHoleMesh`, `coverMesh`).
2. `new STLExporter().parse(mainGroup, { binary: true })` → `Blob` → descarga con `URL.createObjectURL`.
3. El STL resultante tiene cuerpos superpuestos (base + relieve + bisagra); los slicers lo manejan. **Mejora recomendada:** unir con `manifold-3d` antes de exportar para un sólido único y manifold.

### 3MF (multicolor, opcional)
- Por grupo (macho, hembra) clonar geometrías, `toNonIndexed()`, dejar solo `position`/`normal`, aplicar la matriz local, `mergeGeometries()` → una malla por placa.
- El relieve del macho va como objeto aparte con otro color (para asignar otro filamento).
- Opcional: logo espejado de 0.20 mm en la primera capa de la hembra como "modifier" de color.
- Empaquetar con JSZip: `3D/3dmodel.model` (XML con vértices/triángulos), `[Content_Types].xml`, `_rels/.rels`, y metadatos de Bambu Studio si se quiere abrir directo con perfil.

---

## 8. Features de UI a replicar

- Panel: tipo de sello (bisagra/imanes), material (preset), ancho de placa, cantidad de bisagras (1/2/3), ubicación del logo, escala del logo, opciones avanzadas (tolerancia, radio, gap, espesor, padding).
- Carga de SVG (input + drag & drop), girar 90°, invertir lados (swap macho/hembra).
- Texto personalizado con opentype.js: `font.getPath(text, x, y, size).toSVG()` → mismo pipeline que un SVG.
- Vistas: simple / técnico (con cotas) / perspectiva–ortográfica; cámaras frente/atrás/izq/der/sup/inf; `OrbitControls`.
- Guardado local del proyecto en `localStorage` (serializar `STATE` + `svgString`) en lugar de Firestore.
- Botón exportar STL / 3MF sin login ni pagos.

---

## 9. Prompt sugerido para la IA

> Construí en local, con Vite + JavaScript vanilla + Three.js, una app que genera sellos de gofrado macho/hembra unidos por una bisagra print-in-place, siguiendo este documento. Primero creá `hinge/hinge.scad` (bisagra paramétrica de 23.2 × 35.5 × 7 mm, eje en Y, pasadores cónicos, holgura 0.3) y exportala a `public/hinge.stl`. Después implementá `engine.js` con `buildPlates()`, `offsetPolygon()`, `createRoundedRect()` y el layout de la sección 6, usando los defaults de la sección 4. Agregá el panel de la sección 8 y export STL binario (con unión opcional vía manifold-3d). Sin Firebase, sin pagos, sin login. Probá con un SVG de un círculo con agujero y con el texto "HOLA", y verificá que el hueco de la hembra sea el logo espejado con 0.22 mm de tolerancia.

---

## 10. Checklist de verificación

- [ ] La bisagra apoya en Z=0 y las placas empiezan a `hingeBBox.max.x + gap` en ambos lados.
- [ ] Con 2 y 3 bisagras, la altura de las placas se multiplica y las bisagras quedan apiladas en Y sin huecos.
- [ ] El logo de la hembra es el **espejo** del macho (al plegar coinciden).
- [ ] Hueco hembra = contorno + 0.22 mm; islas internas = agujero − 0.22 mm.
- [ ] `depth` de la hembra ≥ `relief` del macho (+0.02).
- [ ] El STL abre en Bambu Studio / PrusaSlicer / Cura sin errores y la bisagra gira después de imprimir.
