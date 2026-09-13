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
