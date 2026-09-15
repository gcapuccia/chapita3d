// TODOS los numeros del proyecto, cada uno con su origen (plan §7).
// Recalibrar = cambiar una constante, no tocar logica.

// ---------------------------------------------------------------------------------------
// Los dos epsilon: la falsa contradiccion que hay que dejar escrita (plan §3).
//
// audit-01 §3.3 y §6.4 exigen ε = 0,05 mm. audit-02 §2 dice "empezar sin epsilon".
// NO hablan del mismo epsilon. Quien quiera "arreglar" esto agregando un hueco en Z se
// fabrica exactamente el problema que cree estar evitando.
//
// |                | ε de audit-01                            | ε de audit-02                          |
// |----------------|------------------------------------------|----------------------------------------|
// | Donde          | En XY, en el plano                       | En Z, entre volumenes apilados         |
// | Que es         | Crecimiento 2D de cada region ANTES de   | Separacion vertical entre la base y    |
// |                | la cadena de resta por prioridad         | la capa de color                       |
// | Para que       | Contra micro-huecos entre colores        | Contra un solapamiento que NO existe   |
// |                | vecinos: en pantalla no se ven, impresos |                                        |
// |                | si                                       |                                        |
// | Decision       | SI. Siempre activo, oculto               | NO. Contacto cara a cara en Z es lo    |
// |                |                                          | normal y correcto                      |
// ---------------------------------------------------------------------------------------

/**
 * mm. Crecimiento de cada region de color antes de restar las de mayor prioridad.
 * Cierra huecos de hasta 2ε entre colores vecinos (el RDP por separado los abre).
 * Rango valido 0,02–0,10. Si la pieza patron P1 muestra una linea del color de la base
 * entre dos colores, subir de a 0,01 (plan F0.5). Fuente: audit-01 §3.3.
 */
export const EPSILON_SOLAPE_XY = 0.05

/** mm. NO TOCAR: el contacto cara a cara en Z es lo correcto. Fuente: plan §3. */
export const EPSILON_Z = 0

// ---------------------------------------------------------------------------------------
// Pipeline de imagen (plan §7.1 a §7.5). Cada numero con su origen.
// ---------------------------------------------------------------------------------------

/** mm. Lado mayor del dibujo en el llavero. Fuente: audit-02 §6.1 ("como una tarjeta SUBE"). */
export const LADO_MAYOR_MM = 50

/** px. Tope de la imagen de trabajo previa, donde se busca el dibujo. Fuente: audit-01 §6.1. */
export const LADO_MAX_PX_PREVIA = 900

/**
 * mm por pixel de la imagen de trabajo. MEDIDO en F0.8 (docs/pruebas/f0.8-pipeline.md).
 *
 * El plan pedia el valor mas grueso con desviacion MAXIMA de contorno < 0,05 mm contra una
 * referencia a 0,05 mm/px. Ninguna resolucion lo cumple, ni 0,10: el maximo ronda 1 pixel en las
 * esquinas por la propia grilla. Criterio ajustado (confirmado por el usuario el 2026-09-13): percentil 95 de la
 * desviacion <= 0,10 mm, un cuarto de la boquilla de 0,4, invisible impreso.
 *   0,10 → p95 peor 0,077 mm ✅ · exito logos + dibujos 10/10
 *   0,15 → p95 peor 0,150 mm ❌ · 10/10
 *   0,20 → p95 peor 0,329 mm ❌ · 9/10 (sobrevive un color de transicion en un escaneo)
 * Costo: ~350 ms por imagen contra ~230 a 0,20 en la PC de desarrollo, lejos del limite de 2 s.
 */
export const MM_POR_PIXEL = 0.1

/** 0–255. Alfa por debajo de esto es fondo. Fuente: audit-01 §6.2. */
export const UMBRAL_ALFA = 128

/**
 * Distancia OKLab. El plan la escribe como 10 (ΔOKLab × 100). Es el slider "Cuánto fondo sacar".
 * Fuente: plan §7.2.
 */
export const TOLERANCIA_FLOOD_FILL = 0.1

/** px. Defringe obligatorio: sin esto el antialias del borde se vuelve un color mas. Fuente: plan §7.2. */
export const EROSION_ANTI_HALO = 1

/** Cantidad de colores. 4 = un AMS lleno. Fuente: audit-02 §6.5. */
export const COLORES = 4

/** Pixeles de la muestra aleatoria para k-means. Fuente: plan §7.3. */
export const MUESTRA_KMEANS = 30_000

/** Iteraciones de k-means y corte por movimiento de centroides (OKLab). Fuente: plan §7.3. */
export const ITERACIONES_KMEANS = 20
export const CORTE_KMEANS = 1e-4

/**
 * ΔE2000. Centroides mas parecidos que esto se fusionan en un solo color.
 * El plan (§7.3) usa este mismo umbral para AVISAR ("avisoColisionPaleta" con boton Fusionarlos).
 * Se fusionan solos (decision del usuario, 2026-09-13): un slot del AMS gastado en un tono de
 * antialias no le sirve a nadie. Si se quieren mas colores, se sube COLORES.
 */
export const FUSION_DELTA_E2000 = 5

/** Radio de la mediana, por preset. Fuente: plan §7.3. */
export const RADIO_PREFILTRO = { logo: 1, foto: 2 } as const

/** mm². Regiones mas chicas se funden con el vecino. Fuente: audit-02 §6.3 y plan §7.4. */
export const AREA_MINIMA_ISLA_MM2 = { logo: 0.5, estandar: 1.0, foto: 1.5 } as const

/**
 * mm. Lo mas angosto se borra en la limpieza (apertura con radio = la mitad).
 * ⚠️ PROVISORIO: audit-02 §6.3 lo deriva de 2 lineas de extrusion. Lo confirma la pieza P1 (F0.5).
 */
export const ANCHO_MINIMO_DETALLE_MM = 0.8

/** mm. Tolerancia de Ramer-Douglas-Peucker. Fuente: audit-02 §6.1. */
export const TOLERANCIA_RDP_MM = 0.05

/** Corte de seguridad de memoria por region. Fuente: plan §7.5. */
export const MAX_VERTICES_POR_REGION = 2000

/** Semilla del PRNG de k-means: la misma imagen da siempre el mismo resultado. */
export const SEMILLA_KMEANS = 20260913

// ---------------------------------------------------------------------------------------
// Llavero, extrusion y material (plan §7.5, §7.6 y §9.5). Cada numero con su origen.
// ---------------------------------------------------------------------------------------

/** mm. Grilla de TODAS las alturas: el generador redondea a multiplos y avisa. Fuente: plan §7.6. */
export const ALTURA_CAPA = 0.2

/** mm. Espesor de la capa de color (3 capas: 2 ya tapan, 3 dan margen claro sobre oscuro). Fuente: plan §7.6. */
export const ALTURA_COLOR = 0.6

/** mm. Espesor total por preset. Fuente: plan §9.5 (audit-02 §6.2). */
export const ESPESOR = { delgado: 1.6, estandar: 3.0, reforzado: 4.0 } as const

/** mm. Borde alrededor del dibujo. Fuente: audit-02 §6.2 (corrige el 2,0 de audit-01 §6.4). */
export const OFFSET_CONTORNO = 1.5

/**
 * mm. Diametro del agujero por tipo de argolla: nominal + 0,2 de compensacion.
 * Fuente: audit-02 §6.4 y plan §9.5.
 */
export const DIAMETRO_AGUJERO = { bola: 3.7, comun: 4.2, gruesa: 5.2 } as const

/**
 * mm. Anillo de material alrededor del agujero.
 * ⚠️ PROVISORIO: lo confirma el tiron de la pieza P2 (F0.5). Fuente: audit-02 §6.4.
 */
export const MARGEN_AGUJERO = 3.0

/** mm. Por debajo de esto el anillo es un error que bloquea la descarga (DRC #2). Fuente: plan §7.9. */
export const MARGEN_AGUJERO_MINIMO = 2.0

/** mm. Redondeo donde la pestaña se une al cuerpo, contra la concentracion de tension. Fuente: plan §7.5. */
export const RADIO_FILLET_PESTANA = 2.0

/** mm. Cuanto se mete la pestaña en el contorno para quedar unida. Fuente: spike F0.5. */
export const SOLAPE_PESTANA = 1.0

/** Fraccion del area de una region que se puede perder por detalle fino antes de avisar (DRC #5). Fuente: plan §4.8 caso 4. */
export const PERDIDA_DETALLE_AVISO = 0.02

/** g/cm³. Densidad del PLA. */
export const DENSIDAD_PLA = 1.24

/**
 * mm³ de purga por cambio de filamento en un AMS.
 * ⚠️ PROVISORIO y con una inconsistencia en el plan: audit-02 §6.6 dice "~400 mm³ por cambio,
 * ≈ 2–5 g", pero 400 mm³ de PLA pesan 0,5 g. Se usa el volumen, y el coeficiente se calibra
 * contra lo que reporta Bambu Studio al rebanar P2 (F0.5), hasta caer en ±20 % (plan §9.5).
 */
export const PURGA_MM3_POR_CAMBIO = 400

/** g de cebado por cambio manual (M600) en modo apilado: ahi no hay torre de purga. Fuente: plan §9.5 y §9.8. */
export const CEBADO_G_POR_CAMBIO = 0.6

/** Cambios de filamento en modo apilado a partir de los cuales se avisa. Fuente: plan §7.6. */
export const MAX_CAMBIOS_APILADO = 3

/**
 * mm. Correccion de la altura que se escribe en top_z del XML de cambios de capa.
 * ⚠️ PENDIENTE: la resuelve la prueba de las variantes A y B de P3 en el slicer (F0.5).
 * 0 = variante A (z de inicio de la franja) · ALTURA_CAPA = variante B (primera capa del color nuevo).
 */
export const DESPLAZAMIENTO_TOP_Z = 0

/** mm. Texto mas bajo que esto sale ilegible. Fuente: audit-02 §6.3 y plan §7.6. */
export const ALTURA_MIN_TEXTO_MM = 6

/** mm. Trazo de letra mas fino que esto sale ilegible. Fuente: audit-02 §6.3 y plan §7.6. */
export const TRAZO_MIN_TEXTO_MM = 1.0

/**
 * Fraccion del area de un texto que se puede perder con la apertura de TRAZO_MIN_TEXTO_MM antes de avisar.
 * Mas alta que la de los dibujos (PERDIDA_DETALLE_AVISO, 2 %) porque las letras tienen muchas esquinas
 * y la apertura tambien las redondea. Medido con "Guido" (F1): Lilita One pierde 2–3 % con trazos
 * gruesos (a radio 0,3 sigue perdiendo ~1 %: es efecto de esquina), y Pacifico pierde 12,6 % a 10 mm y
 * 51 % a 8 mm (trazos finos de verdad). Con 5 % avisa lo segundo y no lo primero.
 */
export const PERDIDA_TEXTO_AVISO = 0.05

/**
 * mm. Tamaño de fuente (em) con que se agrega un texto nuevo. Las letras miden ~70 % del em: con 8 mm
 * "Guido" medía 5,9 mm y el texto nacía con el aviso de ilegible (medido en F1). Con 9 mide ~6,6 mm.
 */
export const TAMANO_TEXTO_MM = 9

// ------------------------------------------------------------------ arreglos de F2 (spikes/08-arreglos)
// ⚠️ PROVISORIO: salen de 29 imagenes (13 escenas reales sinteticas, una foto y el banco). Se recalibran
// con fotos reales.

/** Grosor al que se engrosan las lineas mas finas que lo imprimible, en vez de borrarlas. */
export const GROSOR_LINEAS_MM = { minimo: 0.8, porDefecto: 0.8, maximo: 3.0 } as const

/** mm. Debajo de esto una linea se imprime, pero sale fragil: la interfaz avisa (pedido del usuario). */
export const GROSOR_LINEAS_SEGURO_MM = 2.0

/** Una linea fina mas corta que esto es ruido (antialias, motas): no se engrosa. */
export const LARGO_MINIMO_LINEA_MM = 1.5

/** Fraccion del dibujo en lineas finas a partir de la cual "Automatico" engrosa. Separa las 29 sin errores. */
export const FRACCION_LINEAS_AUTO = 0.04

/** Una zona de fondo encerrado (o de degrade) mas chica que esto queda como dibujo. */
export const FONDO_AREA_MINIMA_MM2 = 3

/** Tolerancia del fondo encerrado en OKLab: base + sigmas × desvio del borde, entre min y max. */
export const FONDO_TOLERANCIA = { base: 0.035, sigmas: 3, min: 0.05, max: 0.1 } as const

/** Para la caja del dibujo solo cuentan las manchas de al menos esta fraccion de la mayor. */
export const CAJA_FRACCION_MOTA = 0.01
