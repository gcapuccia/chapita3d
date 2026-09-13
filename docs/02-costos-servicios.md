# 02 — Costos, servicios, límites y condiciones

**Proyecto:** web que convierte una imagen en un llavero 3D multicolor imprimible (3MF/STL) con editor simple estilo Tinkercad.
**Autor:** Agente 2 (investigación de costos y servicios)
**Fecha de verificación de precios:** 2026-09-10 (salvo que se indique otra fecha)
**Moneda:** USD sin impuestos, salvo que se indique otra.

**Marcas usadas en este documento**

- **[OF]**: verificado en la página oficial del proveedor.
- **[FS]**: tomado de una fuente secundaria (blog, comparador o nota de prensa). Es probable que sea correcto, pero conviene confirmarlo antes de pagar.
- **(no verificado)**: estimación propia o dato que no pude confirmar.

---

## 0. Resumen ejecutivo

1. **Se puede lanzar con $0/mes.** Hay que hacer todo el procesamiento (quitar fondo, reducir colores, vectorizar, extruir y exportar 3MF) en el navegador y servir la web como sitio estático en **Cloudflare** (Workers Static Assets o Pages). Cloudflare no cobra por pedidos ni por ancho de banda de archivos estáticos y permite uso comercial en el plan gratis [OF]. Lo único que se paga es el dominio: ~US$10,44–11,15 al año por un .com (~US$0,93/mes).
2. **Sin IA es bastante más barato y funciona mejor para este caso.** El pipeline clásico en el navegador cuesta $0 por imagen, sin importar el volumen. Las API de IA imagen→3D cuestan entre US$0,02 y US$0,60 por generación. Con 50.000 conversiones al mes, eso da entre US$1.000 y US$30.000/mes. Además, un llavero es 2.5D (capas planas de color), y la IA genera mallas 3D con textura que igual habría que "aplanar".
3. **Para escalar conviene seguir en Cloudflare:** Workers (API) + D1 (base de datos SQLite) + R2 (archivos, **sin costo de egress**) [OF].
   - Hobby (0–100 usuarios): ~US$0 + dominio.
   - ~1.000 usuarios/mes: ~US$0–5.
   - ~10.000 usuarios/mes: **~US$7–30/mes típico**, con un peor caso de ~US$70 si se paga todo lo opcional.
4. **La alternativa más cómoda es Supabase**, porque trae auth, Postgres y storage juntos. Su plan gratis **pausa el proyecto tras 1 semana sin actividad** y trae solo 1 GB de storage [OF]. Para producción hay que pasar a Pro, a US$25/mes.
5. **Vercel Hobby y GitHub Pages no sirven si hay intención comercial.** Sus condiciones prohíben el uso comercial en el plan gratis [OF].
6. **Netlify Free** funciona con 300 créditos al mes. Cada deploy de producción gasta 15 créditos, y al agotarse los créditos **se pausan todos los sitios** hasta el mes siguiente [OF].
7. **Hay que revisar licencias antes de elegir librerías:**
   - **potrace** es GPL.
   - **@imgly/background-removal** es AGPL (la licencia comercial se cotiza a pedido).
   - El modelo por defecto de **rembg** (BRIA) no permite uso comercial gratis.
   - **Hunyuan3D** excluye UE, Reino Unido y Corea del Sur.
   - Los planes gratis de **Meshy y Tripo** entregan los modelos bajo CC BY o sin uso comercial.
   - Sin trampas de licencia: **imagetracerjs** (Unlicense), **vtracer** (MIT) y OpenCV (Apache-2.0).
8. **Competencia:** ya hay herramientas gratis que hacen algo muy parecido. Bambu Lab ofrece *Image to Keychain* en MakerWorld (requiere cuenta) y **MakerTools3D** convierte imagen a 3MF multicolor en el navegador, sin cuenta [OF/FS]. Por eso es difícil cobrar solo por convertir. Lo más prometedor es **vender llaveros impresos** o cobrar funciones premium (guardar diseños, plantillas, uso comercial).

---

## 1. Supuestos de uso y tamaño de archivos (para calcular costos)

| Elemento | Tamaño típico | Comentario |
|---|---|---|
| Foto subida original (celular) | 2–5 MB | JPG/PNG. **No hace falta guardarla**: se procesa en el navegador. |
| Foto normalizada (≤1600 px, WebP) | 150–400 KB (no verificado) | Solo si se guarda el diseño. |
| Proyecto del editor (JSON: vectores, capas, alturas, textos) | 20–300 KB (no verificado) | Es lo único imprescindible para reabrir un diseño. |
| Miniatura | 20–50 KB | Para la galería "Mis diseños". |
| Modelo 3MF / STL exportado | 0,5–5 MB | 3MF es un ZIP, así que pesa menos que STL binario. **Se puede regenerar en el navegador** y no guardarlo. |
| JS/WASM de la web | 1–3 MB (app + three.js); OpenCV.js completo ~8–10 MB (no verificado) | Se descarga una vez y queda en caché. Esto es lo que consume ancho de banda del hosting. |

**Escenarios usados en todo el documento (supuestos propios):**

| Etapa | Usuarios/mes | Visitas/mes | Conversiones/mes | Diseños guardados/mes | Ancho de banda web (8 MB/visita prom.) |
|---|---|---|---|---|---|
| (a) Hobby | 0–100 | ~300 | ~300 | ~50 | ~2,4 GB |
| (b) Crecimiento | ~1.000 | ~3.000 | ~5.000 | ~1.500 | ~24 GB |
| (c) Escala | ~10.000 | ~30.000 | ~50.000 | ~15.000 | ~240 GB |

**Storage acumulado en 12 meses, según qué se guarde:**

| Estrategia | Por diseño | (a) 12 meses | (b) 12 meses | (c) 12 meses |
|---|---|---|---|---|
| **Optimizada** (JSON + foto reducida + miniatura) | ~0,5 MB | 0,3 GB | ~9 GB | ~90 GB |
| **Ingenua** (foto original + 3MF) | ~6 MB | 3,6 GB | ~108 GB | ~1.080 GB |

Guardar lo mínimo cuesta ~12 veces menos en storage.

---

## 2. Hosting del frontend (sitio estático / SPA)

| Servicio | Plan gratis y límites | Primer plan pago | ¿Uso comercial en free? | Fuente |
|---|---|---|---|---|
| **Cloudflare Workers (Static Assets)**, recomendado para proyectos nuevos | Pedidos a archivos estáticos **gratis e ilimitados**. Hasta 20.000 archivos por versión y 25 MiB por archivo. Código dinámico: 100.000 pedidos/día y **10 ms de CPU por pedido**. | **Workers Paid: US$5/mes mínimo.** Incluye 10M pedidos/mes (+US$0,30/M) y 30M ms de CPU (+US$0,02/M ms), con hasta 5 min de CPU por pedido. | **Sí** | [OF] Workers pricing y limits |
| **Cloudflare Pages** | Estáticos gratis e ilimitados. 500 builds/mes, 1 build a la vez, 20.000 archivos, 25 MiB por archivo, 100 dominios. Las Functions cuentan contra la cuota de Workers (100k/día). | Mismo Workers Paid (US$5) | **Sí** | [OF] Pages limits y functions pricing |
| **Vercel Hobby** | 100 GB de transferencia, 1M invocaciones, 4 h de CPU activa, 1M edge requests, 100 deploys/día. Si se excede, la función queda bloqueada hasta 30 días. | **Pro: US$20/mes** por asiento. Incluye 1 TB de transferencia y US$20 de crédito de uso. | **NO**: "non-commercial, personal use only". Cobrar, poner anuncios o recibir pago por el sitio ya cuenta como comercial. | [OF] vercel.com/pricing, docs/plans/hobby |
| **Netlify Free** | **300 créditos/mes con límite duro.** Costos: 1 GB = 20 créditos, 1 deploy de producción = 15, 10.000 pedidos = 2, 1 GB-hora de cómputo = 10. **Al agotarse, todos los sitios se pausan** hasta el próximo ciclo, y en Free no se pueden comprar créditos extra. | **Personal: US$9/mes** (1.000 créditos). **Pro: US$20/mes** (3.000 créditos). Paquete extra de 1.500 créditos: US$10. | No encontré una restricción explícita (no verificado) | [OF] netlify.com/pricing y docs de créditos |
| **GitHub Pages** | Sitio de hasta 1 GB, ~100 GB/mes de ancho de banda (límite blando), 10 builds/hora. | No hay plan pago específico. | **NO**: prohíbe negocios online, e-commerce y SaaS. | [OF] docs.github.com |
| **Firebase Hosting (Spark)** | 10 GB almacenados y **360 MB/día de transferencia** (~10,8 GB/mes). | Blaze (pago por uso): US$0,026/GB almacenado y **US$0,15/GB transferido**. | Sí | [OF] firebase.google.com/pricing |
| **Render (sitios estáticos)** | Deploy gratis, pero consume el ancho de banda del workspace. **Hobby incluye 5 GB/mes: en abril de 2026 bajó de 100 GB a 5 GB.** | Excedente a US$0,15/GB. Workspace Pro: US$25/mes. Sin tarjeta cargada, **suspende** los servicios gratis al pasarse. | Sí | [OF] changelog de Render (abril 2026) + [FS] artículo de Render para el dato de 5 GB |

### 2.1 Costo del ancho de banda web por etapa (usando los supuestos de la sección 1)

| Hosting | (a) ~2,4 GB | (b) ~24 GB | (c) ~240 GB |
|---|---|---|---|
| **Cloudflare Workers / Pages** | **$0** | **$0** | **$0** |
| GitHub Pages | $0 (no comercial) | $0 (no comercial) | Supera el límite blando y no permite uso comercial |
| Netlify | $0 (con ≤ ~10 deploys/mes) | Free se pausa (~650 créditos). **Personal: US$9** | ~5.100 créditos. **Pro + 2 paquetes: ~US$40** |
| Vercel (uso comercial, obliga a Pro) | US$20 | US$20 | US$20 |
| Firebase Hosting | $0 | ~US$2 (Blaze) | ~US$34 (Blaze) |
| Render | $0 | ~US$2,85 | ~US$35 |

**Conclusión:** Cloudflare es el único que sigue en $0 con uso comercial y con archivos WASM pesados (OpenCV.js) descargados miles de veces.

---

## 3. Backend, base de datos, auth y storage (cuando haga falta escalar)

### 3.1 BaaS y bases de datos

| Servicio | Plan gratis y límites | Primer plan pago | ¿Comercial en free? | Fuente |
|---|---|---|---|---|
| **Supabase** | 2 proyectos activos. DB de 500 MB, **storage de 1 GB (archivo máx. 50 MB)**, 5 GB de egress, 50.000 MAU de auth, 500.000 invocaciones de Edge Functions. **Pausa tras 1 semana sin actividad en la DB**; se puede restaurar hasta 1 año después. El SMTP por defecto de auth envía **solo 2 emails/hora**, así que en producción hace falta SMTP propio. | **Pro: US$25/mes.** Incluye 8 GB de disco, 100 GB de storage (+US$0,0213/GB-mes), 250 GB de egress (+US$0,09/GB), 100.000 MAU (+US$0,00325/MAU) y US$10 de crédito de cómputo. Los proyectos pagos no se pausan. | Sí | [OF] supabase.com/pricing, docs de pausa, storage y rate limits |
| **Firebase (Spark)** | Firestore: 1 GiB, 50.000 lecturas/día, 20.000 escrituras/día. Auth: 50.000 MAU. **Cloud Storage: desde el 3-feb-2026 requiere el plan Blaze** (en Spark no hay acceso a ningún bucket). Functions solo en Blaze. | Blaze por uso: Functions con 2M invocaciones/mes gratis y luego US$0,40/M. Storage con 5 GB gratis y luego tarifa de Google Cloud. | Sí | [OF] firebase.google.com/pricing y FAQ de Storage |
| **Cloudflare D1** (SQLite) | 5M filas leídas/día, 100.000 escritas/día, 5 GB en total. | Con Workers Paid (US$5): 25.000M lecturas/mes y 50M escrituras/mes incluidas, luego US$0,001/M lecturas y US$1/M escrituras. 5 GB incluidos, luego US$0,75/GB-mes. | Sí | [OF] developers.cloudflare.com/d1 |
| **Neon** (Postgres) | Hasta 100 proyectos, 0,5 GB y 100 CU-horas por proyecto/mes, 5 GB de egress. Se apaga a los 5 min sin uso (arranque en frío). | **Launch**, pago por uso: US$0,106/CU-hora, US$0,35/GB-mes, 500 GB de egress incluidos. Según la página, sin mínimo mensual. | Sí | [OF] neon.com/pricing |
| **Turso** (libSQL) | 100 DBs, 5 GB, 500M filas leídas/mes, 10M escritas/mes. | **Developer: US$4,99/mes** (9 GB, 2.500M lecturas, 25M escrituras). | Sí | [OF] turso.tech/pricing |
| **PocketBase** (autoalojado) | Licencia MIT, gratis. Un solo binario con SQLite, auth, archivos y panel admin. **Todavía no es v1.0**, así que puede romper compatibilidad. | Se paga solo el servidor donde corre (ver 3.3). | Sí | [OF] github.com/pocketbase |
| **Clerk** (solo auth) | Hobby: 50.000 usuarios retenidos/mes por app, apps ilimitadas. | Pro: US$25/mes (US$20 anual), +US$0,02 por usuario extra. | Sí | [OF] clerk.com/pricing |

### 3.2 Storage de archivos (diseños, miniaturas, fotos)

| Servicio | Gratis | Precio luego | Egress | Notas | Fuente |
|---|---|---|---|---|---|
| **Cloudflare R2** | **10 GB-mes, 1M operaciones clase A (escrituras), 10M clase B (lecturas)** | US$0,015/GB-mes. Clase A: US$4,50/M. Clase B: US$0,36/M. Infrequent Access: US$0,01/GB-mes + US$0,01/GB recuperado. | **Gratis** | No requiere Workers Paid. **Hay que cargar tarjeta para activarlo** [FS]. El free tier no aplica a Infrequent Access. | [OF] developers.cloudflare.com/r2/pricing |
| Supabase Storage | 1 GB (Free) / 100 GB (Pro) | US$0,0213/GB-mes | 5 GB (Free) / 250 GB (Pro), luego US$0,09/GB | Archivo máx. 50 MB en Free | [OF] |
| Firebase Cloud Storage | 5 GB (solo en Blaze) | Tarifa de Google Cloud Storage | Según tarifa GCS | Obliga a pasar a Blaze, con tarjeta y sin tope duro de gasto | [OF] |
| Oracle Always Free Object Storage | 20 GB, 50.000 pedidos/mes | — | 10 TB/mes de salida | Ver trampas de Oracle en la sección 10 | [OF] docs.oracle.com |

**Costo de storage a los 12 meses (sección 1):**

| | (a) | (b) | (c) |
|---|---|---|---|
| R2, estrategia optimizada | $0 | $0 (9 GB < 10 GB) | ~US$1,20/mes |
| R2, estrategia ingenua | $0 | ~US$1,47/mes | ~US$16/mes |
| Supabase, optimizada | $0 (pero se pausa) | US$25 (Pro, porque supera 1 GB) | US$25 (90 GB < 100 GB) |
| Supabase, ingenua | $0 → Pro | US$25 | ~US$46/mes (+ egress si supera 250 GB) |

Las operaciones de R2 en la etapa (c) (~45.000 escrituras y ~90.000 lecturas al mes) entran holgadas en el free tier.

### 3.3 VPS, PaaS y hosting compartido (si se quiere PHP/Laravel como en Laragon, o Node/Python propio)

| Servicio | Gratis | Más barato pago | Notas | Fuente |
|---|---|---|---|---|
| **Oracle Cloud Always Free** | **Ampere A1: 2 OCPU / 12 GB de RAM.** El 15-jun-2026 se redujo desde 4 OCPU / 24 GB sin aviso. También: 2 VM AMD micro (1 GB), 200 GB de disco en bloque, 10 TB/mes de salida. | — | **Recupera instancias ociosas:** si en 7 días la CPU (p95), la red y la memoria quedan por debajo del 20%. Requiere tarjeta (no verificado). Poco confiable para producción. | [OF] docs.oracle.com + [FS] InfoQ jul-2026 |
| **Hetzner Cloud** | — | **CX23 (2 vCPU / 4 GB / 40 GB / 20 TB): €5,49/mes** para pedidos nuevos desde el 15-jun-2026 (antes €3,99) + €0,50 por IPv4. CAX11 (ARM): €5,99. | En 2026 hubo **dos subas** (abril y junio). Redimensionar un servidor existente lo pasa al precio nuevo. | [FS] privatedevops.com, bitdoze.com (la web oficial no mostró precios al consultarla) |
| **Contabo** | — | Cloud VPS 10 (3 vCPU / 8 GB / 75 GB NVMe): ~US$4,95/mes | Posible cargo de instalación según el plazo (no verificado) | [FS] cybernews |
| **DigitalOcean** | — | Droplet a US$4/mes (1 vCPU / 512 MiB / 10 GiB / 500 GiB de transferencia) | Facturación por segundo desde ene-2026 | [OF] |
| **Render** | Web service gratis: **se duerme a los 15 min**, 750 h/mes. Postgres gratis **expira a los 30 días**. Key Value gratis sin persistencia. | Workspace Pro: US$25/mes + cómputo | Ancho de banda extra a US$0,15/GB | [OF] render.com/docs/free |
| **Railway** | Trial: US$5 por única vez (30 días) | **Hobby: US$5/mes** con US$5 de uso incluido. ~US$20/vCPU-mes, ~US$10/GB de RAM-mes, egress US$0,05/GB. | — | [OF] railway.com/pricing |
| **Fly.io** | Sin free tier para nuevos (solo trial) | shared-cpu-1x 256 MB: ~US$2,02/mes. Volumen: US$0,15/GB-mes. Egress: US$0,02/GB (NA/EU), **US$0,04/GB (Sudamérica)**. | — | [OF] fly.io/docs/about/pricing |
| **Hosting compartido PHP** (ej. Hostinger Premium) | — | ~US$1,99–2,99/mes promocional (prepago a 48 meses). **Renueva a ~US$10,99–11,99/mes.** | Sirve para Laravel/MySQL chico. Subas de 3 a 5 veces al renovar. | [FS] ecosistemastartup.com, hostadvice |

---

## 4. Procesamiento de imágenes: navegador vs servidor

**Supuesto de carga (no verificado):** una conversión clásica (reescalar a ~1024 px, k-means, contornos, vectorizar y armar la malla) consume ~2 vCPU-segundos y ~2 GB de RAM durante ~2 s en Python/OpenCV.

| Opción | Gratis/mes | Costo luego | Con 50.000 conversiones/mes | Limitaciones | Fuente |
|---|---|---|---|---|---|
| **100% en el navegador (JS/WASM)** | Ilimitado | **$0** (usa la CPU del usuario) | **$0** | Celulares de gama baja tardan más. Primera descarga pesada (~10 MB con OpenCV.js), que en Cloudflare cuesta $0. | — |
| **Google Cloud Run** (por pedido) | 2M pedidos, 180.000 vCPU-s, 360.000 GiB-s. Con el supuesto: **~90.000 conversiones gratis**. | ~US$0,000018–0,000024/vCPU-s y ~US$0,000002–0,0000025/GiB-s, o sea **~US$0,05–0,06 por cada 1.000 imágenes**. | $0 (entra en el free tier) | Requiere cuenta de facturación (tarjeta). Arranque en frío. | [OF] parcial + [FS] cloudcostkit (hay versiones distintas de la tarifa, confirmar) |
| **AWS Lambda** | Siempre gratis: 1M pedidos + 400.000 GB-s. Con el supuesto: **~100.000 conversiones**. | US$0,20/M pedidos + US$0,0000166667/GB-s, o sea **~US$0,07 por 1.000** | $0 | Cuentas nuevas en "Free plan": créditos por US$100–200 durante 6 meses; **la cuenta se cierra** al vencer si no se pasa a Paid. Hasta 10 GB de RAM. | [OF] aws.amazon.com/lambda/pricing + anuncio jul-2025 |
| **Cloudflare Workers Free** | 100.000 pedidos/día | — | **No viable** | **10 ms de CPU por pedido y 128 MB de memoria.** | [OF] |
| **Cloudflare Workers Paid** | 30M ms de CPU incluidos (~15.000 conversiones) | US$0,02/M ms de CPU, o sea ~US$0,04 por 1.000 | ~US$5 + US$1,40 | **Límite de 128 MB por isolate (JS + WASM)**: ajustado para OpenCV con imágenes grandes | [OF] |
| **Cloudflare Containers** (requiere Workers Paid) | 25 GiB-h de memoria, 375 vCPU-min, 200 GB-h de disco | US$0,000020/vCPU-s, US$0,0000025/GiB-s | ~US$5–10 (no verificado) | Instancias de 1/16 a 4 vCPU. Egress a US$0,025–0,05/GB después de 500 GB–1 TB. | [OF] |
| **VPS Hetzner CX23** | — | €5,49/mes fijo | €5,49 | Mantenerlo es tarea propia. Capacidad teórica de millones de imágenes/mes. | [FS] |

**Conclusión:** procesar en el servidor tampoco sale caro (centavos cada 1.000 imágenes). Aun así, **el navegador cuesta $0, no tiene infraestructura que mantener, preserva la privacidad** (la foto no sale del dispositivo) y no tiene arranques en frío. Recomiendo el servidor solo como respaldo opcional, por ejemplo un botón "procesar en la nube" para celulares lentos, y más adelante.

---

## 5. Conversión foto → 3D: sin IA vs con IA

### 5.1 Pipeline clásico sin IA (todo gratis, en el navegador)

| Paso | Herramienta | Licencia | Costo | Observaciones | Fuente |
|---|---|---|---|---|---|
| Quitar fondo | Relleno por inundación ("varita mágica") con tolerancia, umbral de color o GrabCut con **OpenCV.js** | Apache-2.0 (OpenCV ≥ 4.5) | $0 | Funciona muy bien con logos y dibujos de fondo liso. Con fotos reales conviene agregar un pincel manual para retocar. | (licencia OpenCV no re-verificada aquí) |
| Reducir colores | k-means / median-cut en JS o con OpenCV.js | propia / Apache-2.0 | $0 | Se fija N = cantidad de filamentos (AMS de 4 u 8). | — |
| Vectorizar a color | **imagetracerjs** | **Unlicense (dominio público)** | $0 | Cuantiza colores y devuelve SVG, con presets. Sin riesgo de licencia. | [OF] GitHub |
| Vectorizar a color | **vtracer** (Rust → WASM) | **MIT** | $0 | Maneja color, a diferencia de potrace. Paquete npm `@visioncortex/vtracer`. | [OF] GitHub |
| Vectorizar (1 bit) | **potrace** | **GPL-2.0 o posterior** | $0 | Solo blanco y negro: habría que trazar cada color por separado. **Si se incluye en el JS del sitio, se distribuye bajo GPL.** Existe una versión comercial, *Potrace Professional* (Icosasoft), con precio a consultar. | [OF] potrace.sourceforge.net |
| Extruir capas y exportar 3MF/STL | three.js + ZIP en JS | MIT | $0 | Agente 1 detalla el stack. | — |

### 5.2 Servicios pagos auxiliares (vectorizar o quitar fondo). Opcionales, no recomendados al inicio

| Servicio | Tipo | Precio | 1.000 imágenes | 50.000 imágenes/mes | Licencia / condiciones | Fuente |
|---|---|---|---|---|---|---|
| **vectorizer.ai** | Vectorización (IA) | App web: US$9,99/mes ilimitado, sin API. API: 50 créditos por US$9,99 (US$0,20 c/u) hasta 10.000 por US$949,99 (US$0,095 c/u). Probar la integración es gratis. | ~US$140 | ~US$4.750+ | Los créditos se acumulan hasta 5 meses | [OF] |
| **@imgly/background-removal** | Quitar fondo con ML **en el navegador** (ONNX) | $0 de cómputo. Modelo de ~40 MB (quint8) / ~80 MB (fp16) / ~160 MB. | $0 | $0 | **AGPL**: obliga a publicar el código de toda la app. Licencia comercial: contactar a IMG.LY, sin precio público. | [OF] GitHub + [FS] tamaños |
| **rembg** (autoalojado) | Quitar fondo con ML en servidor | $0 de licencia + cómputo (centavos por 1.000 en Cloud Run) | ~US$0,05–0,20 (no verificado) | ~US$3–10 (no verificado) | rembg es MIT, pero **cada modelo tiene su propia licencia**. El modelo por defecto, `bria-rmbg`, **requiere acuerdo pago para uso comercial**. | [OF] GitHub |
| **Photoroom API** | Quitar fondo | **US$0,02/imagen** (Basic). Sandbox: 1.000 llamadas/mes con marca de agua. | US$20 | US$1.000 | Sin compromiso anual en Basic | [OF] |
| **Clipdrop API** (ahora de Jasper) | Quitar fondo | ~US$0,07–0,09/imagen (paquetes de 100 por US$9 a 10.000 por US$699). 100 créditos gratis para desarrollo. | ~US$70–90 | ~US$3.500–4.500 | — | [FS] (no verificado en la página oficial) |
| **remove.bg API** | Quitar fondo | ~US$0,20–0,23/imagen con suscripción (Lite US$9 / 40 créditos; Pro US$39 / 200). Pago por uso: ~US$1/imagen. | ~US$200 | ~US$10.000 sin negociar | 50 previsualizaciones gratis/mes a baja resolución | [FS] comparedge, poof.bg |

### 5.3 IA imagen → 3D (solo como comparación)

| Servicio | Precio por generación | 1.000 gen. | 50.000 gen./mes | Condiciones / licencia | Fuente |
|---|---|---|---|---|---|
| **TRELLIS** (Microsoft) vía fal.ai | **US$0,02** | US$20 | US$1.000 | Modelo MIT. fal.ai lo marca como apto para uso comercial. | [OF] fal.ai |
| TRELLIS vía Replicate | ~US$0,036 (A100, ~26 s) | ~US$36 | ~US$1.800 | MIT | [OF] replicate.com |
| **Stability Stable Fast 3D** (API) | ~2 créditos ≈ US$0,02 | ~US$20 | ~US$1.000 | Modelo con licencia comunitaria de Stability (no verificado) | [FS] stablefast3d.com, puter (no verificado en la página oficial) |
| **Tripo3D** API | 20 créditos sin textura (US$0,20) / 30 con textura (US$0,30); 1 crédito = US$0,01 | US$200–300 | US$10.000–15.000 | Web gratis: 300 créditos/mes, **CC BY 4.0, sin uso comercial**. Professional: US$19,90/mes. | [OF] developers.tripo3d.ai + [FS] plan web |
| **Hunyuan3D 2.1** (Tencent) vía fal.ai | US$0,30 (**endpoint marcado como obsoleto**) | US$300 | US$15.000 | **La licencia excluye UE, Reino Unido y Corea del Sur.** Por encima de 1M de usuarios activos/mes requiere licencia de Tencent. | [OF] fal.ai + LICENSE en GitHub |
| **Hyper3D Rodin** vía fal.ai | US$0,40 | US$400 | US$20.000 | API directa: ~0,5 créditos × US$1,50 ≈ US$0,75. Plan Business con API: US$120/mes. | [OF] fal.ai + [FS] resto |
| **Meshy** | Pro a US$20/mes con 1.000 créditos; imagen→3D gasta 20–30 créditos, o sea **~US$0,40–0,60** | ~US$400–600 | ~US$20.000–30.000 | Free: 100 créditos/mes con **CC BY 4.0 (atribución obligatoria)**. Pro: los modelos son propios y hay API. | [OF] meshy.ai (licencias) + [FS] precio y créditos |

### 5.4 Por qué para un llavero 2.5D conviene el enfoque sin IA

1. **La geometría es simple.** Un llavero multicolor es una base plana más capas extruidas, cada una de un color y a una altura fija (ej. base de 1,2 mm + 0,6 mm por color). Basta con **regiones 2D por color**, que es justo lo que devuelven la cuantización y la vectorización. La IA imagen→3D inventa volumen, reverso y relieve que no hacen falta.
2. **Los colores tienen que coincidir con los filamentos.** La IA devuelve una textura o colores por vértice que igual hay que cuantizar a 4–8 filamentos y separar en objetos del 3MF. Con el pipeline clásico ya salen como N regiones limpias.
3. **Es imprimible por construcción.** Extruir polígonos cerrados da mallas cerradas (watertight), chicas (miles de triángulos) y con medidas exactas en mm. Las mallas de IA tienen cientos de miles de triángulos, suelen necesitar reparación y no respetan espesores mínimos.
4. **Es predecible y editable.** La misma imagen da siempre el mismo resultado, y el editor puede mover o cambiar el color de cada capa. La IA es no determinista y cada reintento cuesta dinero.
5. **Es inmediato y privado.** Tarda segundos en el navegador contra 30 s–2 min en GPU remota, y la foto no se sube a ningún servidor.
6. **El costo es $0 a cualquier escala** contra US$1.000–30.000/mes con 50.000 generaciones. Encima, la IA suma trampas de licencia (CC BY en planes gratis, restricciones por territorio).
7. **Dónde sí puede servir la IA:** en una función premium futura tipo "figura 3D completa de tu mascota", cobrada aparte, o para quitar el fondo de fotos complejas (mascotas, personas). En ese caso conviene elegir modelos con licencia permisiva y correrlos en el navegador.

---

## 6. Stack "$0/mes" recomendado (MVP)

| Pieza | Elección | Costo | Por qué |
|---|---|---|---|
| Hosting | **Cloudflare Workers Static Assets** (o Pages si se prefiere "git push y listo") | $0 | Estáticos ilimitados, uso comercial permitido, subdominio gratis `*.workers.dev` / `*.pages.dev`, CDN global. Más adelante se agrega API sin migrar. |
| Procesamiento de imagen | 100% navegador: OpenCV.js (Apache-2.0) o JS propio, **imagetracerjs (Unlicense) o vtracer WASM (MIT)**, three.js (MIT) y exportador 3MF/STL en JS | $0 | Sin servidor y sin licencias copyleft |
| Guardado de diseños | Local: IndexedDB + "descargar proyecto (.json)" | $0 | Evita necesitar cuentas al inicio |
| Analítica | Cloudflare Web Analytics | $0 | Privada y sin configuración de DNS [OF] |
| Errores | Sentry Developer | $0 | 5.000 errores/mes, 1 usuario [OF] |
| Código | GitHub (repositorio privado gratis) + deploy automático | $0 | — |
| Anti-bots (si hay formularios) | Cloudflare Turnstile | $0 (no verificado en esta investigación) | — |
| Dominio | Opcional al inicio. Luego un .com en Cloudflare Registrar. | ~US$10,44–11,15/año ≈ **US$0,93/mes** | Único costo real |

**Total MVP: US$0/mes** (o ~US$0,93/mes con dominio propio).

---

## 7. Stack de escalamiento y costo estimado por etapa

### Opción A (recomendada): todo en Cloudflare (Workers + D1 + R2) + auth propia o Clerk

| Concepto | (a) Hobby, 0–100 usuarios | (b) ~1.000 usuarios/mes | (c) ~10.000 usuarios/mes |
|---|---|---|---|
| Hosting estático | $0 | $0 | $0 |
| API (Workers) | $0 (Free, 100.000 pedidos/día) | $0–5 (conviene Paid al abrir cuentas, para evitar el corte diario) | US$5 (10M pedidos incluidos) |
| Base de datos D1 | $0 | $0 | $0 (dentro de lo incluido) |
| Storage R2 a 12 meses (optimizado / ingenuo) | $0 / $0 | $0 / ~US$1,50 | ~US$1,20 / ~US$16 |
| Auth (librería propia sobre Workers + D1, o Clerk Hobby con 50.000 usuarios) | $0 | $0 | $0 |
| Email transaccional (Brevo Free 300/día, o Resend) | $0 | $0 | $0 (Brevo) – US$20 (Resend Pro) |
| Analítica (Cloudflare Web Analytics) | $0 | $0 | $0 |
| Errores (Sentry) | $0 | $0 | $0 – US$26 (Team) |
| Dominio .com prorrateado | ~US$0,93 | ~US$0,93 | ~US$0,93 |
| **Total estimado** | **~US$0–1/mes** | **~US$1–7/mes** | **~US$7–30/mes típico (máx. ~US$68)** |

### Opción B: Cloudflare (frontend) + Supabase (auth + Postgres + storage)

| | (a) | (b) | (c) |
|---|---|---|---|
| Supabase | $0, con **riesgo de pausa** tras 1 semana sin uso | **US$25** (Pro: 1 GB de storage se agota rápido y no conviene arriesgarse a la pausa) | US$25 (optimizado) – ~US$46 (ingenuo: storage de más) |
| SMTP para auth (Resend/Brevo) | $0 | $0 | $0–20 |
| Resto (hosting, analítica, dominio) | ~US$1 | ~US$1 | ~US$1–27 |
| **Total** | **~US$0–1** | **~US$26** | **~US$26–95** |

Ventaja: menos código (auth, RLS y storage ya resueltos). Desventaja: salta a US$25/mes antes que la Opción A.

### Opción C: PHP/Laravel + MySQL (parecido a Laragon) en VPS + R2 para archivos

| | (a) | (b) | (c) |
|---|---|---|---|
| Servidor | $0 con Oracle Always Free (riesgoso) o ~US$2–3 en hosting compartido promocional (renueva a ~US$11) | Hetzner CX23 ~€6/mes con IPv4 (≈US$7) | VPS de 4 vCPU / 8 GB: ~€8–13/mes (no verificado tras la suba de junio) + backups |
| Storage R2 | $0 | $0–1,50 | ~US$1–16 |
| Otros | ~US$1 | ~US$1 | ~US$1–47 |
| **Total** | **~US$0–4** | **~US$8–10** | **~US$12–75** |

Ventaja: el usuario ya conoce PHP/MySQL y Laragon. Desventaja: mantenimiento del servidor (actualizaciones, seguridad, backups) a cargo propio, y la API no queda cerca del usuario como en un CDN.

### Opción D (no recomendada): Firebase

- (a) $0, pero **Storage obliga a Blaze con tarjeta**.
- (b) ~US$2–5.
- (c) ~US$35–60, sobre todo por la transferencia de Hosting a US$0,15/GB y porque Blaze no tiene tope duro de gasto.

---

## 8. Otros costos

### 8.1 Dominio

| TLD | Registrador | Registro | Renovación | Notas | Fuente |
|---|---|---|---|---|---|
| **.com** | **Cloudflare Registrar** (al costo) | US$10,44 | US$10,44 **hasta el 31-oct-2026**; **~US$11,15 desde el 1-nov-2026** | Verisign sube el mayorista un 7% (US$10,26 → US$10,97) y puede repetir la suba cada año hasta 2029 (~US$13,42). Registrar o renovar antes de noviembre congela el precio un año. | [FS] domainnamewire, startupowl, tldprice |
| .com | Porkbun | US$11,08 | US$11,08 | Probablemente suba con Verisign (no verificado) | [OF] porkbun.com |
| .com | Namecheap | ~US$11–16 | ~US$16 | (no verificado: la página bloqueó la consulta) | — |
| **.com.ar** | **NIC Argentina** (único canal) | **ARS 8.500** | **ARS 8.500/año** | Requiere trámite con identidad fiscal argentina (no verificado). El DNS se puede delegar gratis a Cloudflare. | [OF] nic.ar/es/dominios/aranceles |
| **.com.mx** | Porkbun | US$11,33 | **US$23,32** | **Cloudflare Registrar no soporta .mx.** Akky (registro oficial .mx) cobra en MXN con 50% de descuento en septiembre de 2026. | [OF] Porkbun + [FS] foro de Cloudflare |
| .mx | Porkbun | US$35,57 | US$41,23 | — | [OF] |
| .xyz / .shop / .store | Porkbun | US$2,04 / 2,06 / 2,57 (primer año) | **US$14,21 / 31,41 / 43,77** | Trampa: renovación de 7 a 17 veces el precio inicial | [OF] |
| Subdominio | `*.workers.dev` / `*.pages.dev` | $0 | $0 | Suficiente para el MVP | [OF] |

### 8.2 Email transaccional

| Servicio | Gratis | Pago | Notas | Fuente |
|---|---|---|---|---|
| **Resend** | 3.000 emails/mes, **100/día**, 3 dominios. Marketing: 1.000 contactos. | Pro: US$20/mes (50.000) o US$35/mes (100.000). Excedente: US$0,90 por 1.000. | Buena API para desarrolladores | [OF] resend.com/pricing |
| **Brevo** | **300 emails/día** (~9.000/mes) compartidos entre marketing y transaccional | Starter (precio no verificado) | Puede agregar su marca en emails del plan gratis (no verificado) | [FS] emailtooltester, fastlancer |
| SMTP por defecto de Supabase Auth | 2 emails/hora | — | No sirve para producción: hay que conectar Resend o Brevo | [OF] docs de Supabase |

### 8.3 Pasarelas de pago (si se venden llaveros impresos)

| Pasarela | País | Comisión aproximada | Efectivo con IVA | Fuente |
|---|---|---|---|---|
| **Mercado Pago** (Checkout Pro / Link de pago) | Argentina | Acreditación inmediata: **~6,29–6,39% + IVA**. A 10–14 días: ~3,39–4,99% + IVA. A 30–35 días: **~1,49–1,79% + IVA**. Sin costo fijo mensual. **Más retenciones impositivas** (IIBB/IVA según condición fiscal). | Inmediata ≈ 7,7%; a 30 días ≈ 2,2% | [FS] fgbbros.com.ar (ago-2026), estudiocreativo (mar-2026). **La web oficial bloqueó la consulta: confirmar en mercadopago.com.ar/costs-section.** |
| Alternativas en Argentina | Argentina | MODO ~0,8–1,5%; Ualá Bis ~2,9–3,9%; Payway ~3,5–4,5% | — | [FS] estudiocreativo (mar-2026) |
| **Mercado Pago** (Link / Checkout) | México | **3,49% + MXN 4 + IVA** (al instante) | Venta de MXN 200 → comisión ≈ MXN 12,7 (6,4%) | [FS] atempora.studio, guías 2026 |
| **Stripe** | México | **3,6% + MXN 3** (+0,5% tarjeta internacional, +2% conversión). Métodos locales: 4% + MXN 3. **Más IVA.** | Venta de MXN 200 → ≈ MXN 11,8 (5,9%) | [OF] stripe.com/mx/pricing |
| **Stripe** | EE.UU. | 2,9% + US$0,30 (+1,5% internacional, +1% conversión) | — | [OF] stripe.com/pricing |
| Stripe | Argentina | **No disponible para empresas argentinas.** Alternativa: Stripe Atlas (LLC en EE.UU., ~US$500 + mantenimiento anual). | — | [FS] |
| **PayPal** | México | **3,95% + MXN 4** (+0,5% internacional; 3,5% sobre el tipo de cambio). Más IVA. | Venta de MXN 200 → ≈ MXN 13,8 (6,9%) | [OF] paypal.com/mx (actualizado 15-jul-2026) |

**Nota:** con tickets chicos como un llavero, el **cargo fijo** pesa mucho. Conviene vender packs o poner un mínimo de compra.

### 8.4 Analítica

| Servicio | Gratis | Pago | Fuente |
|---|---|---|---|
| **Cloudflare Web Analytics** | Gratis, sin datos personales | — | [OF] |
| **Umami** | Cloud Hobby: 100.000 eventos/mes, 3 sitios, 6 meses de retención. **Autoalojado gratis (MIT).** | Pro: US$20/mes (1M eventos) | [FS] toolradar |
| **Plausible** | Autoalojado Community Edition (AGPL) gratis. Cloud: trial de 30 días. | Desde US$9/mes (10.000 páginas vistas) | [OF] plausible.io |

### 8.5 Monitoreo de errores

| Servicio | Gratis | Pago | Fuente |
|---|---|---|---|
| **Sentry Developer** | 5.000 errores/mes, 1 usuario, 50 replays, 5M spans, 30 días de retención | Team: US$26/mes (anual), 50.000 errores | [OF] sentry.io/pricing |

---

## 9. Competencia y precios de mercado

| Herramienta | Qué ofrece | Gratis | Pago | Notas | Fuente |
|---|---|---|---|---|---|
| **MakerWorld MakerLab: Image to Keychain** (Bambu Lab) | Imagen → llavero, señalador o arte 2D multicolor, con agujero o gancho, espesor y fondo configurables. Exporta 3MF para Bambu Studio. | **Sí, con cuenta** | — | Recomienda **4 colores o menos**. Ecosistema cerrado de Bambu. **Es el competidor más fuerte.** | [OF] makerworld.com/makerlab/imageToKeychain + [FS] busymommasnook |
| MakerLab: otras herramientas | Relieves y placas, litofanías (hasta abanicos), Parametric Model Maker | Gratis (según fuentes) | Las herramientas con IA (Image to 3D con Meshy, Make My Statue) consumen **créditos MakerLab**: se compran o se canjean 80 puntos por 600 créditos. PrintMon Maker fue retirado. | Meshy integrado: 3MF multicolor para AMS | [FS] filamentpicks, 3dprintingindustry |
| **MakerTools3D** (image-to-3mf) | PNG/JPG → **3MF multicolor** plano o con relieve por color, para llaveros, logos y carteles. Paleta automática editable. **En el navegador.** | **Sí, sin cuenta** | No encontré plan pago | Soporta AMS, CFS, IFS, ACE y Prusa XL. **Competidor directo casi idéntico al MVP.** | [OF] makertools3d.com |
| **ImageToStl.com** | Imagen → STL/OBJ/3MF en modo relieve (heightmap) o extrusión, **aro de llavero**, quitar fondo por tolerancia, STL con color | Sí, **con anuncios** | Sin plan pago visible | Máx. 1200×1200 px. Con bloqueador de anuncios limita funciones. | [OF] imagetostl.com |
| **HueForge** (escritorio) | "Pintura con filamento": litofanías a color por capas | — | **Personal: US$30** (oferta a US$24), de por vida con 2 años de actualizaciones, **sin uso comercial**. Licencias comerciales: Limited Commercial anual (vender impresiones), Professional anual (vender archivos) y Lifetime Professional. **Precios de 2024: US$45/año, US$100/año y US$250**; los actuales no se ven (no verificado). | Todas las licencias tienen las mismas funciones; cambia solo el uso permitido | [OF] shop.thehueforge.com |
| **ItsLitho** | Litofanías online (planas, curvas, cajas, lámparas) | Sí | Vende filamento y kits de luz | Los modelos generados **pueden usarse comercialmente** | [FS] itslitho.com/terms-of-use |
| **3dp.rocks/lithophane** | Litofanías en el navegador, también offline | Sí | — | — | [FS] |
| **LithophaneMaker.com** | Cajas, lámparas, luces nocturnas | Sí | — | — | [FS] |
| **Text3D Maker** | Litofanía en el navegador | 2 descargas | **€4,99 pago único** para descargas ilimitadas | Ejemplo de freemium de pago único | [FS] |
| MakerWorld Commercial License Membership | Suscripción para vender impresiones de modelos de terceros | — | Pago al creador | Muestra que "vender impresiones" es un modelo de negocio validado | [OF] blog.bambulab.com |

**Lectura de negocio (análisis propio, no verificado):**

- La conversión imagen→llavero **ya es gratis** en Bambu y MakerTools3D, así que cobrar solo por convertir es difícil.
- Diferenciales posibles:
  - Editor más completo (texto, formas, capas, alturas).
  - Soporte para cualquier marca de impresora.
  - Español y foco en Latinoamérica.
  - Sin cuenta para lo básico.
  - **Pedir el llavero impreso** (el margen está en lo físico, cobrado con Mercado Pago).
- Opciones de monetización:
  - Freemium: guardar diseños, plantillas, packs de fuentes y formas, lotes con nombres.
  - Afiliados de filamento.
  - Donaciones.

---

## 10. Trampas a evitar

1. **Vercel Hobby y GitHub Pages prohíben el uso comercial.** En Vercel cuenta como comercial cobrar, poner anuncios o que alguien reciba pago por el sitio [OF]. Si el proyecto va a vender, no hay que empezar ahí.
2. **Netlify Free pausa todos los sitios** al agotar los 300 créditos, y no deja comprar más [OF]. Solo 20 deploys de producción (15 créditos cada uno) ya consumen todo el mes. En sep-2026 hay reportes en su foro de proyectos marcados como pausados por error [FS].
3. **Render recortó el ancho de banda del plan Hobby de 100 GB a 5 GB** (abril 2026) [OF/FS]. Los web services gratis se duermen a los 15 min, y **el Postgres gratis se borra a los 30 días** (+14 de gracia) [OF].
4. **Supabase Free se pausa tras 1 semana sin actividad**, trae solo 1 GB de storage y archivos de hasta 50 MB. Su SMTP de auth envía 2 emails/hora [OF]. Los "pings" para evitar la pausa van contra el espíritu del plan: mejor pagar Pro al lanzar.
5. **Firebase: desde el 3-feb-2026, Cloud Storage requiere Blaze** (tarjeta) [OF], y Blaze tiene alertas de presupuesto pero no un tope duro (no verificado). Un abuso o un bucle puede generar una factura grande.
6. **Oracle Always Free:** redujo A1 a la mitad sin aviso (15-jun-2026), apaga instancias que considera ociosas y conseguir capacidad es difícil [OF/FS]. No conviene para producción.
7. **Hetzner subió precios dos veces en 2026** (abril y junio). Redimensionar un servidor aplica el precio nuevo [FS].
8. **AWS "Free plan"**: la cuenta **se cierra** a los 6 meses o al agotar los créditos si no se pasa a Paid [FS/OF].
9. **Cloudflare Workers Free da 10 ms de CPU por pedido** [OF], así que no sirve para procesar imágenes en el servidor. Al pasar los 100.000 pedidos/día devuelve **error 1027** en el código dinámico; los estáticos siguen gratis. **R2 pide tarjeta para activarse** aunque se use solo el free tier [FS].
10. **Licencias copyleft y de modelos:**
    - **potrace (GPL)** y **@imgly/background-removal (AGPL)** obligan a liberar el código de la app o a comprar una licencia comercial.
    - **rembg** es MIT, pero su modelo por defecto BRIA **no es gratis para uso comercial**.
    - **Hunyuan3D** excluye UE, Reino Unido y Corea del Sur.
    - **Meshy Free** entrega en CC BY (con atribución) y **Tripo Free** no permite uso comercial [OF/FS].
    - Alternativas seguras: **imagetracerjs (Unlicense)**, **vtracer (MIT)** y **OpenCV.js (Apache-2.0)**.
11. **Precios promocionales:** dominios .xyz/.store/.shop a US$2 el primer año que renuevan a US$14–44. Hosting compartido a US$1,99 que renueva a US$10,99 [OF/FS].
12. **El .com sube un 7% el 1-nov-2026** y puede seguir subiendo hasta 2029 [FS]. Conviene registrar o renovar antes.
13. **Mercado Pago:** la tasa publicada **no incluye IVA** (21% en AR, 16% en MX) ni retenciones de IIBB. La acreditación inmediata cuesta 3–4 veces más que esperar 30 días [FS].
14. **Egress en otros proveedores:** Supabase cobra US$0,09/GB por encima de lo incluido, Render US$0,15/GB, Firebase Hosting US$0,15/GB y Fly.io en Sudamérica US$0,04/GB. En **R2, el egress es gratis** pero las lecturas cuentan como operaciones clase B (10M gratis/mes) [OF].
15. **Guardar la foto original y el 3MF multiplica el storage por ~12** (sección 1). Conviene guardar solo el proyecto JSON, una foto reducida y la miniatura, y regenerar el 3MF en el navegador.
16. **Servicios con facturación por uso y sin tope** (Cloud Run, Lambda, Blaze): hay que configurar alertas y rate limiting, y usar Turnstile en los endpoints públicos para evitar facturas por abuso.
17. **Riesgo legal al vender impresiones:** los usuarios van a subir personajes y logos con copyright o marca registrada (Disney, equipos de fútbol, marcas). Generar el archivo propio no habilita a vender el objeto [FS, foro de Bambu Lab]. Hacen falta términos de uso que trasladen la responsabilidad al usuario y moderación antes de imprimir y vender.

---

## 11. Fuentes (consultadas el 2026-09-10)

**Hosting frontend**
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/functions/pricing/
- https://mecanik.dev/en/posts/cloudflare-pages-vs-workers-which-to-use-in-2026/
- https://vercel.com/pricing
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits/fair-use-guidelines
- https://www.netlify.com/pricing/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://firebase.google.com/pricing
- https://render.com/docs/free
- https://render.com/changelog/updated-plans-for-render-workspaces
- https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026

**Backend / DB / storage / auth**
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
- https://supabase.com/docs/guides/storage/uploads/file-limits
- https://supabase.com/docs/guides/auth/rate-limits
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/containers/pricing/
- https://community.cloudflare.com/t/if-i-want-to-use-cloudflare-r2-i-have-to-link-a-payment-method-i-suggest-not-doin/887578
- https://neon.com/pricing
- https://turso.tech/pricing
- https://github.com/pocketbase/pocketbase
- https://clerk.com/pricing
- https://railway.com/pricing
- https://fly.io/docs/about/pricing/
- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/
- https://privatedevops.com/news/hetzner-june-2026-cloud-price-increase-what-to-do
- https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/
- https://www.digitalocean.com/pricing/droplets
- https://cybernews.com/best-web-hosting/contabo-review/pricing/
- https://ecosistemastartup.com/hosting-web-2026-guia-con-7-proveedores-y-precios-reales/

**Cómputo serverless**
- https://cloud.google.com/run/pricing
- https://cloudcostkit.com/guides/gcp-cloud-run-pricing/
- https://aws.amazon.com/lambda/pricing/
- https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/

**Conversión (sin IA y auxiliares)**
- https://potrace.sourceforge.net/
- https://github.com/jankovicsandras/imagetracerjs
- https://github.com/visioncortex/vtracer
- https://vectorizer.ai/pricing
- https://github.com/imgly/background-removal-js
- https://www.npmjs.com/package/@imgly/background-removal
- https://github.com/danielgatis/rembg
- https://www.photoroom.com/api/pricing
- https://clipdrop.co/apis/docs/remove-background
- https://ai-engine.net/blog/best-background-removal-apis
- https://comparedge.com/tools/remove-bg/pricing
- https://poof.bg/blog/remove-bg-api-alternative

**IA imagen → 3D (comparación)**
- https://fal.ai/models/fal-ai/trellis
- https://replicate.com/firtoz/trellis
- https://www.stablefast3d.com/
- https://developer.puter.com/tutorials/stability-ai-api-pricing/
- https://developers.tripo3d.ai/en/pricing
- https://costbench.com/software/ai-3d-generation/tripo-ai/free-plan/
- https://fal.ai/models/fal-ai/hunyuan3d-v21
- https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE
- https://fal.ai/models/fal-ai/hyper3d/rodin
- https://hyper3d.ai/pricing
- https://www.meshy.ai/pricing
- https://docs.meshy.ai/en/webapp/pricing

**Dominios, email, pagos, analítica, errores**
- https://domainnamewire.com/2026/04/23/breaking-verisign-raising-wholesale-com-prices/
- https://startupowl.com/reviews/cloudflare-registrar
- https://tldprice.org/registrar/cloudflare
- https://porkbun.com/products/domains
- https://nic.ar/es/dominios/aranceles
- https://community.cloudflare.com/t/mx-mexico-tld-is-not-supported-how-come/660369
- https://resend.com/pricing
- https://www.emailtooltester.com/en/reviews/brevo/pricing/
- https://fgbbros.com.ar/guia-medios-pago-tienda-online-argentina/
- https://www.estudiocreativo.agency/blog/metodos-pago-digital-argentina-2026
- https://atempora.studio/blog/comisiones-mercado-pago-2026
- https://stripe.com/mx/pricing
- https://stripe.com/pricing
- https://stripe.com/global
- https://www.paypal.com/mx/business/paypal-business-fees
- https://developers.cloudflare.com/web-analytics/about/
- https://toolradar.com/tools/umami/pricing
- https://plausible.io/
- https://sentry.io/pricing/

**Competencia**
- https://makerworld.com/makerlab/imageToKeychain
- https://www.busymommasnook.com/post/how-to-make-a-3d-printed-keychain-from-an-image-using-makerworld-s-makerlab
- https://filamentpicks.com/makerlab-credits-explained/
- https://3dprintingindustry.com/news/meshy-and-makerworld-team-up-to-put-ai-3d-model-generation-in-bambu-lab-users-hands-250281/
- https://makertools3d.com/image-to-3mf
- https://imagetostl.com/
- https://shop.thehueforge.com/products/hueforge
- https://shop.thehueforge.com/pages/hueforge-anniversary-sale
- https://itslitho.com/terms-of-use/
- https://3dp.rocks/lithophane/
- https://lithophanemaker.com/
- https://blog.bambulab.com/empowering-our-creators-with-new-commercial-license-membership/
- https://forum.bambulab.com/t/maker-lab-commercial-purposes/87539
